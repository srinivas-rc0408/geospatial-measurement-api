# Architecture

## System overview
```
 Browser                    One Render web service (Docker), one URL                Neon PostgreSQL
┌──────────────────┐ HTTPS ┌─────────────────────────────────────────────┐  TLS   ┌──────────────────┐
│ React SPA        │ ────► │ FastAPI                                     │ ─────► │ geo_files        │
│ upload, poll,    │ ◄──── │  ├─ /api/*, /health*, /docs  API routes     │ ◄───── │ features         │
│ map, tables      │       │  │    ├─ api/      (HTTP only)              │        │ alembic_version  │
└──────────────────┘       │  │    ├─ services/ (domain logic)           │        └──────────────────┘
        │                  │  │    └─ BackgroundTasks worker             │
        │ vector tiles     │  └─ everything else  frontend build         │
        ▼                  │       (/app/frontend_dist: assets, index)   │
 tiles.openfreemap.org     │ local disk: uploaded files                  │
 (free, no key)            └─────────────────────────────────────────────┘
```
The page and the API share one origin, so there is no CORS in production and no API URL baked into the build.
API routes are registered first; the frontend catch-all (`app/api/frontend.py`) only sees what they did not match,
and answers unknown `/api`, `/health`, `/docs`, `/redoc` and `/assets` paths with a JSON 404, never with the app.

## Monorepo layout
```
/
├── README.md, LICENSE, render.yaml   # render.yaml: Render Blueprint for the whole site
├── Dockerfile, .dockerignore  # deploy image: frontend build (stage 1) + API serving it (stage 2)
├── docs/                      # architecture, API contract, design system, decision log
├── .github/workflows/         # backend.yml, frontend.yml, docker.yml (path-filtered)
├── backend/                   # Python service (existing, extended)
│   ├── app/                   # api/, services/, readers/, models, schemas, config, main
│   ├── migrations/            # Alembic
│   ├── tests/
│   ├── sample_data/, scripts/
│   ├── Dockerfile (API-only image), docker-entrypoint.sh, openapi.json, pyproject.toml, requirements*.txt
│   └── README.md              # deep technical backend doc
└── frontend/
    ├── src/
    │   ├── app/               # router, providers, layout
    │   ├── pages/             # Home, Results, Files (history), NotFound
    │   ├── features/          # home/, upload/, results/ (map, measurements), history/
    │   ├── components/        # Logo, ui/ (design-system primitives)
    │   ├── lib/               # api client + XHR upload, generated types, hooks, formatters, theme
    │   └── styles/            # tokens + global CSS
    ├── public/samples/        # the same sample files as backend/sample_data (minus the broken one)
    ├── e2e/                   # Playwright accuracy tests against a local backend
    ├── scripts/               # generate-brand-assets.mjs (favicon, icons, OG image)
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
- **React Router**: `/`, `/files`, `/files/:id`, `*`. Home is in the first chunk; the other pages
  are lazy routes, so the first load stays under 160 kB of gzipped JavaScript.
- **TanStack Query** for server state: polling `GET /api/files/{id}` every 1 s while
  `PENDING`/`PROCESSING`, then stop. Measurements (all pages) and GeoJSON are cached forever per
  completed file. History rows show the `total_area_m2` / `total_length_m` stored on each file when processing
  completes (part of `FileInfo`), so a page of history is one request. Upload limits and accepted extensions come
  from `GET /api/config`, fetched once and cached.
- **Uploads** use `XMLHttpRequest` (the only browser API with upload progress) and then the same
  polling. Requests slower than 2.5 s raise an app-wide "waking up the server" banner.
- **Types generated from the backend OpenAPI** (`openapi-typescript`) into
  `src/lib/api/schema.d.ts`; a thin typed `fetch` wrapper in `src/lib/api/client.ts`.
  The frontend never hand-writes API types.
- **MapLibre GL JS** in its own chunk, mounted only when the map box scrolls into view, over
  OpenFreeMap's `dark` and `positron` styles (switching with the theme). Data from
  `GET /api/files/{id}/geojson/` (EPSG:4326); colours come from the design tokens at style load.
- **motion** only where CSS cannot: the dropzone → progress card shared-layout morph, scroll
  reveals and count-ups (its animation engine loads on demand via `LazyMotion`).
- Config: `VITE_API_BASE_URL`, empty for the same origin (the default; `npm run dev` proxies `/api`, `/health` and
  `/docs` to the local backend). Open Graph URLs in `index.html` hold a `__PUBLIC_URL__` placeholder that the backend
  replaces with `GEO_PUBLIC_URL`, or with the request's scheme and host (behind Render's proxy, its forwarded headers).

## Deployment
| Part | Host | Notes |
|---|---|---|
| Database | Neon (free) | Singapore region; pooled URL for app, direct URL for migrations |
| Site (frontend + API) | One Render web service (Docker, free) | Singapore; root `Dockerfile` builds the frontend, then the API image serving it from `/app/frontend_dist`; runs `alembic upgrade head` then uvicorn; free tier sleeps after 15 min idle and takes ~1 min to wake |

Caching: hashed `/assets/*` files are `immutable` for a year, other build files (favicon, manifest, OG image,
samples) for a day, and `index.html` is `no-cache`, so a deploy is picked up on the next page load. Responses over
1 kB are gzipped when the browser accepts it (there is no CDN in front of the service).

Health checks are split so Neon can scale to zero: Render polls `GET /health` (liveness, no database
access); `GET /health/ready` runs `SELECT 1` with a 5 s limit for when the database itself must be checked.

CI (`backend.yml`) runs the suite on SQLite (Python 3.11–3.13) and on a PostgreSQL 17 service container
(after `alembic upgrade head` and `alembic check`) and combines coverage from both. `docker.yml` builds both images:
the root `Dockerfile` (deployed) and `backend/Dockerfile` (API only).

Cold starts: with one service, a sleeping instance means the whole site — page included — takes ~1 min on the first
visit, not just the API. During the review window an external pinger requests `/health` every ~10 min to keep it awake;
`/health` never touches the database, so Neon still scales to zero. Once the page is up, slow API calls show a calm
"Waking up the server…" banner.

## Security
- CORS: none in production (one origin). `GEO_CORS_ORIGINS` exists only for a frontend hosted elsewhere; never `*`.
- The frontend server never serves files outside the build directory, and the `Host` header is HTML-escaped before
  it goes into `index.html`.
- Upload limits, zip-bomb, zip-slip and XXE protections stay in place.
- No auth (out of scope); documented as future scope.
