# Architecture

## System overview
```
 Browser (Vercel)                Backend (Render, Docker)                 Neon PostgreSQL
┌──────────────────┐  HTTPS  ┌────────────────────────────────┐  TLS   ┌────────────────────┐
│ React SPA        │ ──────► │ FastAPI                        │ ─────► │ geo_files          │
│ upload, poll,    │ ◄────── │  ├─ api/      (HTTP only)      │ ◄───── │ features           │
│ map, tables      │  JSON   │  ├─ services/ (domain logic)   │        │ alembic_version    │
└──────────────────┘         │  └─ BackgroundTasks worker     │        └────────────────────┘
        │                    │ local disk: uploaded files     │
        │ vector tiles       └────────────────────────────────┘
        ▼
 tiles.openfreemap.org (free, no key)
```

## Monorepo layout
```
/
├── README.md, LICENSE
├── docs/                      # architecture, API contract, design system, decision log
├── .github/workflows/         # backend.yml, frontend.yml (path-filtered)
├── backend/                   # Python service (existing, extended)
│   ├── app/                   # api/, services/, readers/, models, schemas, config, main
│   ├── migrations/            # Alembic
│   ├── tests/
│   ├── sample_data/, scripts/
│   ├── Dockerfile, render.yaml (or at root), pyproject.toml, requirements*.txt
│   └── README.md              # deep technical backend doc
└── frontend/
    ├── src/
    │   ├── app/               # router, providers, layout
    │   ├── pages/             # Home, Results, History, NotFound
    │   ├── components/        # ui/ (primitives), upload/, map/, measurements/
    │   ├── lib/               # api client, generated types, formatters, hooks
    │   └── styles/            # tokens + global CSS
    ├── public/samples/        # the same sample files as backend/sample_data
    ├── tests/
    └── README.md
```

## Backend layering (unchanged principle)
- `api/` parses requests and shapes responses. It knows nothing about geometry.
- `services/readers/` turn any file format into `Dataset → RawFeature`. They know nothing about measuring.
- `services/measurement.py` + `crs.py` measure. They know nothing about HTTP or files.
- `services/processor.py` orchestrates read → measure → persist and owns the status lifecycle.

## Database: Neon PostgreSQL
- **Two connection strings** from the Neon console:
  - **Pooled** (host contains `-pooler`): used by the app at runtime (`GEO_DATABASE_URL`).
  - **Direct** (no `-pooler`): used by Alembic migrations (`GEO_MIGRATIONS_DATABASE_URL`),
    because migrations need session-level features a transaction pooler doesn't guarantee.
- SQLAlchemy URL scheme: `postgresql+psycopg://…?sslmode=require` (psycopg 3).
- Engine options: `pool_pre_ping=True` (Neon suspends idle compute after 5 min and drops
  connections), `pool_recycle=300`, small pool (`pool_size=5`, `max_overflow=5`) to fit the free tier,
  `connect_timeout=10`.
- Prepared statements: psycopg prepares a query automatically after 5 executions on a connection.
  Through PgBouncer that is safe when PgBouncer ≥ 1.22 with `max_prepared_statements` > 0 (Neon: 1.22+,
  1000) and the client libpq is ≥ 17 (the psycopg binary wheel bundles libpq 18). The engine turns them
  off (`prepare_threshold=None`) if the installed libpq is older. See `docs/DECISIONS.md`.
- JSON columns are plain `json`, which keeps object key order (the source file's attribute order);
  `jsonb` would re-order keys. See `docs/DECISIONS.md`.
- Feature rows are inserted in bulk (one `executemany`, with `render_nulls=True` so rows with
  different NULL columns stay in one batch), not one round-trip per feature — Neon is a network hop
  away (~70 ms round trip from Bengaluru to Singapore), so round-trips dominate latency.
- **Schema is owned by Alembic** (`backend/migrations/`) in every real environment; the app never
  calls `create_all`. Tests build the schema with `create_all` for speed, and one test upgrades an
  empty database to head and asserts no difference from the models.
- Constraint and index names come from a metadata naming convention (`pk_`, `fk_`, `uq_`, `ix_`,
  `ck_`), so they are identical on SQLite and PostgreSQL and migrations can refer to them.
- Region: the same region for Neon and Render (Singapore is closest to India).
- Free-tier limits (verified Oct 2026): 0.5 GB storage, 100 CU-hours/month, scale to zero after
  5 min idle. Keep demo upload limit at 10 MB.

## Processing flow
1. `POST /api/files/`: check extension → copy upload to disk in chunks with size limit →
   cheap structural validation → insert `GeoFile(PENDING)` → `202` → queue background job.
2. Worker: `PROCESSING` → read datasets → measure each feature (isolated) → bulk insert features,
   compute file bbox (EPSG:4326, from the features' WGS84 geometries) → `COMPLETED`, or `FAILED`
   with a user-readable `error`.
3. Client polls `GET /api/files/{id}` until `COMPLETED`/`FAILED`.
4. On startup, jobs stuck in `PENDING`/`PROCESSING` are marked `FAILED` (in-process worker).

## Measurement flow (unchanged)
source CRS → WGS84 → UTM zone of the feature's centroid (LAEA centred on the feature beyond
84°N / 80°S) → shapely area/length in metres. Independent geodesic value via `pyproj.Geod`;
warning if they differ by > 0.5% or the feature is wider than 6° longitude.

## Frontend architecture
- **Vite + React + TypeScript (strict) + Tailwind CSS v4.** SPA; no SSR needed.
- **React Router**: `/`, `/files`, `/files/:id`, `*`.
- **TanStack Query** for server state: polling `GET /api/files/{id}` every 1 s while
  `PENDING`/`PROCESSING`, then stop. Cache measurements per file.
- **Types generated from the backend OpenAPI** (`openapi-typescript`) into
  `src/lib/api/schema.d.ts`; a thin typed `fetch` wrapper in `src/lib/api/client.ts`.
  The frontend never hand-writes API types.
- **MapLibre GL JS**, lazy-loaded (code-split), styles from OpenFreeMap: `positron` (light) and
  a dark style (verify current style names at openfreemap.org). Data from
  `GET /api/files/{id}/geojson/`.
- Config: `VITE_API_BASE_URL`.

## Deployment
| Part | Host | Notes |
|---|---|---|
| Database | Neon (free) | Singapore region; pooled URL for app, direct URL for migrations |
| Backend | Render web service (Docker, free) | Singapore; runs `alembic upgrade head` then uvicorn; free tier sleeps after 15 min idle and takes ~1 min to wake |
| Frontend | Vercel (free) | root dir `frontend/`; SPA rewrite to `index.html` |

Cold starts are handled honestly: the frontend pings `/health` on load and shows a calm
"Waking up the server…" state if it is slow. During the review window, an external pinger can
keep the backend warm.

## Security
- CORS: only origins in `GEO_CORS_ORIGINS` (comma-separated); never `*` in production.
- Upload limits, zip-bomb, zip-slip and XXE protections stay in place.
- No auth (out of scope); documented as future scope.
