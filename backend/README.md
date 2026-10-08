# Geospatial File Measurement API

[![CI](https://github.com/srinivas-rc0408/geospatial-measurement-api/actions/workflows/backend.yml/badge.svg)](https://github.com/srinivas-rc0408/geospatial-measurement-api/actions/workflows/backend.yml)
![Python](https://img.shields.io/badge/python-3.11%20|%203.12%20|%203.13-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-0.142-009688)
![Coverage](https://img.shields.io/badge/coverage-94%25-brightgreen)

A FastAPI service that accepts a **Shapefile (.zip)**, **KML** or **KMZ** file, extracts every feature
(index, geometry type, geometry, CRS, attributes) and returns **area** for polygons and **length** for
lines — computed in metres in a local projected CRS, never in raw latitude/longitude degrees.

```bash
curl -F "file=@sample_data/mine_site_survey.kml" http://localhost:8000/api/files/
```

### Highlights

- **Correct CRS handling.** Every geometry is reprojected to the UTM zone of its own centroid before
  measuring, even when the file is already projected. A Web Mercator file is measured correctly
  (944,917 m², not the naive 1,000,000 m² — see [CRS handling](#crs-handling)).
- **Self-checking measurements.** Each result is cross-checked against an independent geodesic
  (ellipsoidal) calculation; large differences are flagged on the feature.
- **One bad feature never fails the file.** Each feature gets its own status:
  `MEASURED`, `NOT_APPLICABLE`, `UNSUPPORTED` or `FAILED`, with a human-readable reason.
- **Real-world input.** Multi-layer Shapefile ZIPs (each with its own CRS), nested folders, missing
  `.prj`, `.cpg` encodings, NULL shapes, self-intersecting polygons, polygons with holes, 3D
  coordinates, KMZ, KML `MultiGeometry` and drone flight paths (`gx:Track`).
- **Secure by default.** ZIP-bomb and zip-slip protection, XXE-safe XML parsing, upload size limit
  (early `413` from `Content-Length`, enforced again while copying), server-generated storage names.
- **Async processing lifecycle.** Upload returns `202 Accepted`; status moves
  `PENDING → PROCESSING → COMPLETED | FAILED`.
- **PostgreSQL-ready.** Runs on SQLite locally and on Neon PostgreSQL in production; the schema is owned by
  Alembic migrations, and the whole test suite passes on both databases.
- **Operable.** Liveness and readiness health checks, a request ID on every response, one structured
  access-log line per request, and a Docker image ready for Render.
- **122 tests, 94% coverage** (SQLite and PostgreSQL combined), lint + tests in CI on Python 3.11–3.13 and
  PostgreSQL 17, Docker image runs as non-root.

---

## Contents

1. [Quick start](#quick-start)
2. [API](#api)
3. [Architecture](#architecture)
4. [CRS handling](#crs-handling)
5. [Design decisions](#design-decisions)
6. [Testing](#testing)
7. [Limitations](#limitations)
8. [Learnings](#learnings)
9. [Future scope](#future-scope)

---

## Quick start

**Requirements:** Python 3.11+. No GDAL or system libraries — every dependency installs from a wheel.

```bash
git clone https://github.com/srinivas-rc0408/geospatial-measurement-api.git
cd geospatial-measurement-api/backend

python -m venv .venv
source .venv/bin/activate            # fish: source .venv/bin/activate.fish · Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt

alembic upgrade head                 # create/upgrade the database schema (SQLite at ./data/geo.db by default)
uvicorn app.main:create_app --factory --reload
```

Open **http://localhost:8000/docs** for interactive Swagger docs.

The app never creates tables itself: run `alembic upgrade head` once after cloning and again whenever a new
migration is pulled.

### With Docker

```bash
cd backend
docker compose up --build
```

The container runs `alembic upgrade head`, then `exec`s uvicorn (so stop signals reach the server). It listens on
`$PORT` (default `8000`) and trusts `X-Forwarded-*` headers, because in production it sits behind a load balancer.
To run the image directly:

```bash
docker build -t geo-measure-api .
docker run --rm --env-file .env -e PORT=8000 -p 8000:8000 geo-measure-api
```

This `backend/Dockerfile` is the **API-only** image. The deployed image is the root [`Dockerfile`](../Dockerfile):
the same API stage plus the frontend build in `/app/frontend_dist` (`GEO_FRONTEND_DIST`), served from the same origin.

### Deploying to Render

[`render.yaml`](../render.yaml) at the repository root is a Render Blueprint: **one** Docker web service built from
the root `Dockerfile` (frontend and API on one URL), in Singapore (next to the Neon database), with `/health` as its
health check. Creating the Blueprint in the Render dashboard prompts for three values (`GEO_DATABASE_URL`,
`GEO_MIGRATIONS_DATABASE_URL`, `GEO_PUBLIC_URL`); they are never stored in the repository. No CORS origins are set:
the browser only calls its own origin.

### Configuration

All settings are optional environment variables (or a `.env` file — see [`.env.example`](.env.example)).

| Variable | Default | Purpose |
|---|---|---|
| `GEO_DATABASE_URL` | `sqlite:///./data/geo.db` | Database the app uses (on Neon: the **pooled** URL) |
| `GEO_MIGRATIONS_DATABASE_URL` | *(falls back to `GEO_DATABASE_URL`)* | Database Alembic migrates (on Neon: the **direct** URL) |
| `GEO_CORS_ORIGINS` | *(empty: none)* | Comma-separated browser origins allowed to call the API from **another** origin. Not needed when the API serves the frontend, or with the Vite dev proxy |
| `GEO_FRONTEND_DIST` | *(unset: API only)* | Directory of the built frontend; when it holds `index.html`, the app serves it (see [API_CONTRACT](../docs/API_CONTRACT.md#frontend-same-origin)) |
| `GEO_PUBLIC_URL` | *(unset: from each request)* | Public origin for absolute link-preview URLs, e.g. `https://geo-measure-api.onrender.com` |
| `GEO_STORAGE_DIR` | `./data/uploads` | Where uploaded files are stored |
| `GEO_MAX_UPLOAD_MB` | `50` | Upload size limit (also reported by `GET /api/config`, which the frontend uses) |
| `GEO_UPLOAD_RATE_LIMIT` | `20` | Uploads per client address per window; `429` with `Retry-After` beyond it; `0` disables |
| `GEO_UPLOAD_RATE_WINDOW_SECONDS` | `600` | The rate-limit window (sliding) |
| `GEO_MAX_UNCOMPRESSED_MB` | `500` | ZIP-bomb guard: max total uncompressed size |
| `GEO_MAX_ARCHIVE_MEMBERS` | `500` | Max files inside a ZIP |
| `GEO_ASSUME_WGS84_WHEN_CRS_MISSING` | `true` | See [missing `.prj`](#missing-prj) |
| `GEO_MEASUREMENT_DIVERGENCE_WARNING_PCT` | `0.5` | Projected-vs-geodesic difference that triggers a warning |

### Using PostgreSQL / Neon

The app talks to PostgreSQL through psycopg 3 (`postgresql+psycopg://…`). Neon gives two connection strings:

| Neon URL | Host looks like | Used for | Setting |
|---|---|---|---|
| **Pooled** | `ep-…-pooler.<region>.aws.neon.tech` | The running app: many short transactions through PgBouncer | `GEO_DATABASE_URL` |
| **Direct** | `ep-….<region>.aws.neon.tech` | Migrations: DDL needs a real session, not a transaction pooler | `GEO_MIGRATIONS_DATABASE_URL` |

Put both in `backend/.env` (git-ignored; see [`.env.example`](.env.example)), keeping `?sslmode=require`, then:

```bash
alembic upgrade head                             # migrates via the direct URL
uvicorn app.main:create_app --factory            # serves via the pooled URL
```

On PostgreSQL the engine pings connections before use and recycles them after 5 minutes (Neon suspends idle
compute and drops its connections), keeps a small pool (5 + 5 overflow) and stores JSON columns as plain `json`, which keeps attribute order.

To change the schema: edit `app/models.py`, run `alembic revision --autogenerate -m "<what changed>"`, review
the generated file in `migrations/versions/`, then `alembic upgrade head`.

### Sample data

[`sample_data/`](sample_data/) holds synthetic files around a mine site near Bengaluru
(regenerate from `backend/` with `python -m scripts.generate_sample_data`; output is byte-identical every run):

| File | What it demonstrates |
|---|---|
| `mine_site_survey.kml` | Polygon with a hole, self-intersecting polygon, line, point, drone `gx:Track`, unsupported `<Model>`, folders as layers |
| `parcels_utm43n.zip` | Two Shapefile layers (polygons + lines) in UTM 43N |
| `web_mercator_square.zip` | Why the source CRS must not be trusted for measuring |
| `broken_missing_dbf.zip` | Validation error for an incomplete Shapefile |

---

## API

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/files/` | Upload a file. Validates, stores, queues processing. Returns `202`. |
| `GET` | `/api/files/` | List files. Filters: `status`, `limit`, `offset`. |
| `GET` | `/api/files/{id}` | File information and processing status. |
| `GET` | `/api/files/{id}/features/` | Extracted features: index, type, geometry, CRS, properties. Filter: `geometry_type`. |
| `GET` | `/api/files/{id}/measurements/` | Area / length per feature plus file totals. Filter: `status`. |
| `GET` | `/api/files/{id}/geojson/` | GeoJSON (EPSG:4326) with measurements — open it in geojson.io or QGIS. |
| `DELETE` | `/api/files/{id}` | Delete the file and its results. |
| `GET` | `/health` | Liveness: the process is up. Never touches the database. |
| `GET` | `/health/ready` | Readiness: `SELECT 1` with a 5 s limit. `503` if the database is unreachable. |

List endpoints are paginated (`limit` 1–1000, default 100).

### Health checks and request IDs

`/health` returns `{"status": "ok", "version": "1.0.0"}` without opening a database connection. Render polls it,
and a query on every poll would keep Neon's compute awake (it scales to zero when idle). `/health/ready` returns
`{"status": "ok", "database": "ok"}`, or `503` with `{"status": "unavailable", "database": "unavailable"}`;
it never exposes the underlying error.

Every response carries an `X-Request-ID` header (readable by browsers through CORS). A client-supplied
`X-Request-ID` is echoed back if it is at most 64 characters of letters, digits, `.`, `_` or `-`; otherwise the
server generates one. Each request produces one log line:

```
INFO app.access method=POST path=/api/files/ status=202 duration_ms=12.3 request_id=4f1c…
```

Background processing logs carry the file id (`file_id=… processing started`).

### OpenAPI snapshot

[`openapi.json`](openapi.json) is the committed OpenAPI schema; the frontend generates its TypeScript types from
it. A test fails if it drifts from the app. After changing the API, regenerate it from `backend/`:

```bash
python -m scripts.export_openapi
```

### Upload

```bash
curl -F "file=@sample_data/mine_site_survey.kml" http://localhost:8000/api/files/
```

`202 Accepted`

```json
{
  "id": "9f69fdac523d4233a88b21b0ca504506",
  "filename": "mine_site_survey.kml",
  "file_type": "KML",
  "size_bytes": 3068,
  "status": "PENDING",
  "crs": null,
  "feature_count": null,
  "geometry_types": {},
  "bbox": null,
  "warnings": [],
  "error": null,
  "created_at": "2026-10-07T08:38:44.277511Z",
  "processed_at": null,
  "links": {
    "self": "/api/files/9f69fdac523d4233a88b21b0ca504506",
    "features": "/api/files/9f69fdac523d4233a88b21b0ca504506/features/",
    "measurements": "/api/files/9f69fdac523d4233a88b21b0ca504506/measurements/",
    "geojson": "/api/files/9f69fdac523d4233a88b21b0ca504506/geojson/"
  }
}
```

### File information

```bash
curl http://localhost:8000/api/files/9f69fdac523d4233a88b21b0ca504506
```

```json
{
  "id": "9f69fdac523d4233a88b21b0ca504506",
  "filename": "mine_site_survey.kml",
  "file_type": "KML",
  "size_bytes": 3068,
  "status": "COMPLETED",
  "crs": "EPSG:4326",
  "feature_count": 7,
  "geometry_types": { "LineString": 2, "Model": 1, "Point": 1, "Polygon": 3 },
  "bbox": [77.5901949, 12.97410647, 77.59855531, 12.9813424],
  "warnings": [],
  "error": null,
  "created_at": "2026-10-07T08:38:44.277511Z",
  "processed_at": "2026-10-07T08:38:44.295466Z",
  "links": { "...": "..." }
}
```

`bbox` is `[min_lon, min_lat, max_lon, max_lat]` in EPSG:4326 over every feature that has a geometry — handy for
zooming a map to the data. It is `null` until processing finishes, or if no feature has a geometry.

### Features

```bash
curl "http://localhost:8000/api/files/{id}/features/?geometry_type=LineString&limit=1"
```

```json
{
  "file_id": "c19aa595cb3b4d4f8383c92ec4516bff",
  "total": 2,
  "limit": 1,
  "offset": 0,
  "items": [
    {
      "feature_id": 0,
      "layer": "access_roads",
      "geometry_type": "LineString",
      "crs": "EPSG:32643",
      "geometry": { "type": "LineString", "coordinates": [[781000.0, 1435950.0], [782000.0, 1435950.0]] },
      "properties": { "road_id": "R-1", "surface": "gravel" }
    }
  ]
}
```

`geometry` is returned in the file's **own** CRS, exactly as stored in the file.

### Measurements

```bash
curl http://localhost:8000/api/files/9f69fdac523d4233a88b21b0ca504506/measurements/
```

```json
{
  "file_id": "9f69fdac523d4233a88b21b0ca504506",
  "crs": "EPSG:4326",
  "units": { "area": "square metres (m²)", "length": "metres (m)" },
  "summary": {
    "total_area_m2": 255000.291,
    "total_area_hectares": 25.500029,
    "total_length_m": 1370.02,
    "total_length_km": 1.37002,
    "by_status": { "MEASURED": 5, "NOT_APPLICABLE": 1, "UNSUPPORTED": 1, "FAILED": 0 }
  },
  "total": 7,
  "limit": 100,
  "offset": 0,
  "items": [
    {
      "feature_id": 0,
      "layer": "Site boundaries",
      "geometry_type": "Polygon",
      "status": "MEASURED",
      "measurement_crs": "EPSG:32643",
      "area_m2": 232000.35,
      "area_hectares": 23.200035,
      "perimeter_m": 2360.002,
      "length_m": null,
      "length_km": null,
      "geodesic": { "area_m2": 231731.912, "length_m": null },
      "messages": []
    },
    {
      "feature_id": 2,
      "layer": "Site boundaries",
      "geometry_type": "Polygon",
      "status": "MEASURED",
      "measurement_crs": "EPSG:32643",
      "area_m2": 5000.005,
      "area_hectares": 0.500001,
      "perimeter_m": 482.843,
      "geodesic": { "area_m2": 4994.237, "length_m": null },
      "messages": ["Invalid polygon repaired before measuring (Self-intersection[77.5906601299006 12.9745627300995])."]
    },
    {
      "feature_id": 3,
      "layer": "Infrastructure",
      "geometry_type": "LineString",
      "status": "MEASURED",
      "measurement_crs": "EPSG:32643",
      "length_m": 363.79,
      "length_km": 0.36379,
      "geodesic": { "area_m2": null, "length_m": 363.579 },
      "messages": []
    },
    {
      "feature_id": 4,
      "layer": "Infrastructure",
      "geometry_type": "Point",
      "status": "NOT_APPLICABLE",
      "messages": ["Points have no area or length."]
    },
    {
      "feature_id": 5,
      "layer": "Infrastructure",
      "geometry_type": "Model",
      "status": "UNSUPPORTED",
      "messages": ["KML <Model> geometry is not supported for measurement."]
    }
  ]
}
```

*(Some items and null fields trimmed for brevity.)* The pit boundary is 600 m × 400 m with an 8,000 m²
pond cut out: 240,000 − 8,000 = **232,000 m²**.

| Status | Meaning |
|---|---|
| `MEASURED` | Polygon → `area_m2`, `area_hectares`, `perimeter_m`. Line → `length_m`, `length_km`. |
| `NOT_APPLICABLE` | Point / MultiPoint — nothing to measure. |
| `UNSUPPORTED` | Readable but not measurable (GeometryCollection, KML `<Model>`, Shapefile MultiPatch). |
| `FAILED` | Bad coordinates, empty or missing geometry, or unknown CRS. Reason in `messages`. |

### Errors

Every error returns `{"detail": "<human-readable reason>"}`.

| Code | When |
|---|---|
| `404` | File id does not exist. |
| `409` | Features/measurements requested before processing finished, or after it failed. |
| `413` | Upload larger than `GEO_MAX_UPLOAD_MB`. |
| `429` | More than `GEO_UPLOAD_RATE_LIMIT` uploads from one address in the window; `Retry-After` says when to retry. |
| `415` | Extension is not `.zip`, `.kml` or `.kmz`. |
| `422` | Corrupt ZIP, ZIP bomb, Shapefile missing `.shp`/`.shx`/`.dbf`, no Shapefile/KML in the ZIP, non-XML `.kml`. |

```bash
curl -F "file=@sample_data/broken_missing_dbf.zip" http://localhost:8000/api/files/
# 422 {"detail": "Shapefile 'parcels' is missing required component(s): .dbf. A Shapefile needs .shp, .shx and .dbf files with the same name."}
```

Problems found later, while parsing (e.g. malformed KML XML), set the file to `FAILED` with the reason in `error`.

---

## Architecture

### Application structure

```
app/
├── main.py                 # App factory: settings, DB, middleware, routes, error handler, startup recovery
├── logging_config.py       # Logging setup, request-ID + access-log middleware
├── config.py               # Typed settings from env vars (pydantic-settings)
├── database.py             # Engine + session factory (SQLite pragmas; PostgreSQL pool tuning), naming convention
├── models.py               # GeoFile (one per upload) ── 1:N ── Feature (one per feature)
├── schemas.py              # Pydantic response models = the public API contract
├── api/
│   ├── files.py            # HTTP layer only: parse request, call services, shape response
│   └── health.py           # Liveness and readiness checks
└── services/
    ├── storage.py          # Chunked upload copy with size limit, filename sanitising
    ├── processor.py        # Background job: read → measure → persist; status lifecycle
    ├── measurement.py      # Reprojection, area/length, geodesic cross-check, repairs
    ├── crs.py              # CRS labels, projected-CRS selection (UTM / local LAEA)
    ├── errors.py           # Domain errors, each mapped to an HTTP status
    ├── jsonsafe.py         # Dates/Decimals/bytes/NaN → JSON
    └── readers/
        ├── __init__.py     # Format detection, cheap validation, dispatch
        ├── archive.py      # Safe in-memory ZIP access (zip-bomb / zip-slip safe)
        ├── shapefile.py    # pyshp + .prj/.cpg handling, one Dataset per layer
        ├── kml.py          # defusedxml parser for KML/KMZ incl. gx:Track
        └── base.py         # RawFeature / Dataset: the format-neutral contract
migrations/                 # Alembic: env.py + versions/ (the schema's single source of truth in every database)
```

The **HTTP layer knows nothing about geometry**, and the **readers know nothing about measuring**.
Readers turn any format into the same `Dataset` → `RawFeature` structure, so adding GeoJSON or
GeoPackage means adding one reader file; measurement and API code stay untouched.

### File-processing flow

```mermaid
sequenceDiagram
    participant C as Client
    participant API as POST /api/files/
    participant FS as Storage
    participant DB as Database
    participant W as Background worker

    C->>API: multipart upload
    API->>API: check extension (415)
    API->>FS: copy to disk in 1 MB chunks (413 if over limit)
    API->>API: cheap validation: ZIP integrity, bomb limits, .shp/.shx/.dbf present (422)
    API->>DB: insert GeoFile (PENDING)
    API-->>C: 202 Accepted + id
    API->>W: queue process_file(id)
    W->>DB: status = PROCESSING
    W->>W: read datasets (KML / KMZ / Shapefile layers)
    W->>W: measure every feature (isolated try/except per feature)
    W->>DB: insert all Features in one executemany, bbox, status = COMPLETED (or FAILED + error)
    C->>DB: GET /api/files/{id} … until COMPLETED
```

**Fail fast on what is cheap.** Wrong type, oversize, corrupt or incomplete ZIPs are rejected during
the request, before anything is queued, so clients get an immediate, specific error and no junk rows
are created. Expensive parsing happens in the background.

### Measurement calculation flow

```mermaid
flowchart LR
    A[GeoJSON geometry<br/>source CRS] --> B{CRS known?}
    B -- no --> F[FAILED]
    B -- yes --> C[drop Z, reproject<br/>to EPSG:4326]
    C --> D{geometry type}
    D -- Point --> NA[NOT_APPLICABLE]
    D -- other --> U[UNSUPPORTED]
    D -- Polygon / Line --> R[repair invalid<br/>polygons]
    R --> P[project to UTM zone<br/>of centroid]
    P --> M[area / perimeter / length<br/>in metres]
    R --> G[geodesic area / length<br/>on WGS84 ellipsoid]
    M --> X{differ > 0.5%?}
    G --> X
    X -- yes --> W[MEASURED + warning]
    X -- no --> OK[MEASURED]
```

---

## CRS handling

### The rule

**Never measure in the file's own CRS.** Always: source CRS → WGS84 → UTM zone of the feature's
centroid → measure.

### Why not measure in the source CRS?

- **Geographic CRS (EPSG:4326):** units are degrees. One degree of longitude is 111 km at the
  equator and 0 km at the poles, so "area in degrees²" is meaningless.
- **Some projected CRS are wrong for measuring.** Web Mercator (EPSG:3857) — the projection used by
  web maps — stretches distances by `1/cos(latitude)` and areas by `1/cos²(latitude)`.
  `sample_data/web_mercator_square.zip` holds a square of 1000 × 1000 Mercator units near Bengaluru.
  Trusting the source CRS gives **1,000,000 m²**. This API returns **944,917 m²** (geodesic check:
  943,822 m²) — the naive answer is **~6% too large**. At 60°N it would be 4× too large.
- **Some projected CRS use feet**, or are local grids with unknown distortion.

Reprojecting everything into one known, metric, low-distortion frame removes all three problems
with one code path.

### Choosing the projected CRS

| Where the feature's centroid is | Projection used | Why |
|---|---|---|
| 80°S – 84°N | WGS 84 / UTM zone (EPSG:326xx north, 327xx south) | Standard, metric, ≤ ~0.1% scale error inside a zone |
| Beyond 84°N or 80°S | Lambert Azimuthal Equal-Area centred on the feature | UTM is undefined there; UPS has ~0.4% scale error at 85° (caught by the tests) |

The zone is chosen **per feature**, not per file, so a file covering several zones still measures
each feature in its own best zone.

### Cross-check against geodesic values

Each feature is also measured directly on the WGS84 ellipsoid with `pyproj.Geod` — no projection
at all. Both values are returned. If they differ by more than 0.5% (configurable), or the feature
is wider than a UTM zone (6° longitude), the feature gets a warning recommending the geodesic value.

The small difference you see at Bengaluru (~0.12%) is expected: Bengaluru is ~280 km east of UTM
zone 43's central meridian (75°E), where UTM's scale factor is ~1.0006, so grid area is ~0.12%
larger than ground area.

### Missing `.prj`

A Shapefile without a `.prj` has no CRS. If every coordinate fits within lon/lat bounds, EPSG:4326 is
assumed and a warning is added to the file. Otherwise the CRS is reported as unknown and those
features are `FAILED` — a wrong measurement is worse than no measurement. KML is always EPSG:4326
by the OGC KML 2.2 standard.

---

## Design decisions

| Decision | Chosen | Alternatives considered | Why |
|---|---|---|---|
| Framework | **FastAPI** | Django + DRF | Typed request/response models, automatic OpenAPI docs, lightweight background tasks. Django's ORM and admin aren't needed for a 2-table service. |
| Geo stack | **shapely + pyproj + pyshp + defusedxml** | geopandas / fiona / GDAL | All pure-pip wheels: `pip install` works on any OS without GDAL. Each step (parse, reproject, measure) is explicit and testable. Trade-off: fewer formats than GDAL — acceptable for Shapefile + KML. |
| Processing | **Background task, `202 Accepted`** | Synchronous; Celery/RQ | Large drone-survey files shouldn't hold an HTTP connection open. FastAPI `BackgroundTasks` needs no extra infrastructure. The status lifecycle is identical to a real queue, so moving to Celery changes only how `process_file` is scheduled. |
| Projection | **Per-feature UTM** (LAEA near poles) | One CRS per file; equal-area only; geodesic only | Requirement asks for a projected CRS. UTM is the survey industry standard and gives area *and* length accurately. Geodesic is kept as an independent check. |
| Source CRS | **Always reproject** | Use source CRS if already projected | Projected ≠ suitable (Web Mercator, feet). See above. |
| Invalid polygons | **Repair with `make_valid` + warning** | Reject; measure as-is | Self-intersections are common in hand-digitised data. As-is gives wrong areas; rejecting loses data. Repair keeps data and tells the user. |
| Failure granularity | **Per feature** | Fail whole file | One bad placemark in a 10,000-feature survey must not lose the other 9,999. File-level failure is reserved for unreadable files. |
| Storage | **Disk for files; SQLite locally, Neon PostgreSQL in production** | Blobs in DB; PostgreSQL everywhere | Files stay re-processable. SQLite keeps local setup and tests instant; the same code and migrations run on PostgreSQL, and the test suite passes on both. |
| Schema changes | **Alembic migrations** | `create_all` at startup | `create_all` never alters existing tables. Migrations are versioned, reviewed and testable (a test proves they match the models). |
| Geometry storage | **GeoJSON in a JSON column** | PostGIS | Portable across SQLite/PostgreSQL; spatial queries aren't required yet. PostGIS is the next step (see [Future scope](#future-scope)). |
| KML parsing | **Own parser on defusedxml** | `fastkml`; GDAL KML driver | Full control of edge cases (missing namespaces, unclosed rings, `gx:Track`), XXE-safe, no GDAL. |
| ZIP handling | **Read members in memory, never extract** | `extractall()` to a temp dir | Removes zip-slip entirely; size/count limits checked before decompressing. |
| App creation | **Factory (`create_app(settings)`)** | Module-level `app` | Each test gets an isolated DB and storage dir; no import side effects. |

---

## Testing

Run from `backend/`:

```bash
pytest                  # 122 tests, ~5 s
pytest --cov            # with coverage (94% on SQLite, 94% on PostgreSQL, 94% combined in CI)
ruff check . && ruff format --check .
```

By default every test gets a fresh SQLite database. To run the same suite against PostgreSQL:

```bash
docker run --rm -d --name geo-pg -e POSTGRES_PASSWORD=geo -p 5433:5432 postgres:17
GEO_TEST_DATABASE_URL=postgresql+psycopg://postgres:geo@localhost:5433/postgres pytest
```

Tests ignore `backend/.env`, but `alembic` does not: if `.env` points at Neon, set both `GEO_DATABASE_URL` and
`GEO_MIGRATIONS_DATABASE_URL` when running `alembic` against a local database.

CI runs the suite on SQLite (Python 3.11–3.13) and on a PostgreSQL 17 service container (after
`alembic upgrade head` and `alembic check`) and combines coverage from both; `docker.yml` builds the API-only image
and the deployed root image.

Tests build every input file **in memory** (`tests/factories.py`), so there are no opaque binary
fixtures and each test states exactly what it feeds the API.

| Area | Examples of what is verified |
|---|---|
| Measurement accuracy | 1 km² square = 1,000,000 m² (±1e-6); holes subtracted; MultiPolygon sums; line length vs geodesic |
| CRS handling | UTM-source re-projection; **Web Mercator inflation corrected**; polar LAEA within 0.01% of geodesic; zone selection incl. ±180° |
| Robustness | Self-intersecting polygon repaired (two triangles = 5,000 m²); 3D coords; empty/invalid geometries; GeometryCollection |
| Readers | KML folders → layers, ExtendedData, missing namespace, unclosed rings, MultiGeometry, `gx:Track`; Shapefile `.prj`, nested folders, missing `.prj`, NULL shapes, corrupt bodies |
| Security | ZIP bomb, zip-slip, XXE entity attack, path in filename, upload size limit (header and copy) |
| API | Full lifecycle, pagination & filters, summaries, bbox, 404/409/413/415/422, delete, GeoJSON export, CORS, startup recovery of interrupted jobs |
| Database | Migrations upgrade an empty database to exactly the models' schema; features are inserted in a single statement |
| Operations | `/health` opens no database connection; `/health/ready` returns `503` without leaking details; request IDs validated, echoed and logged once per request; committed OpenAPI snapshot matches the app |
| Fidelity | Attribute order survives storage on both databases; clockwise and counter-clockwise Shapefile rings read the same |

---

## Limitations

- **Antimeridian:** a feature crossing ±180° longitude gets a wrong centroid and zone. Rare for
  site-scale drone data; fix noted below.
- **Background tasks are in-process.** A restart interrupts running jobs; they are marked `FAILED`
  on startup with a clear message rather than staying `PROCESSING` forever.
- **Polygon area is planimetric** (2D). Terrain surface area and volumes need a DEM.
- **Only the main KML in a KMZ** (`doc.kml`) is read; `NetworkLink`s are not followed.

---

## Learnings

- **"Projected" does not mean "safe to measure in".** Writing the Web Mercator test changed my
  design from "reproject only geographic files" to "always reproject".
- **Tests found a real accuracy bug.** My first design used Universal Polar Stereographic beyond
  84°N; the polar test showed a 0.4% error against the geodesic value. Switching to a
  feature-centred equal-area projection brought it under 0.01%.
- **Real files are messy.** macOS `__MACOSX/` folders, `.prj` in ESRI WKT, missing namespaces,
  unclosed rings and NULL shapes all needed explicit handling.
- **Status design matters.** Separating file-level status from per-feature status is what lets one
  bad feature fail alone.

## Future scope

- **Task queue** (Celery/RQ + Redis) for horizontal scaling and retries.
- **PostGIS** for spatial queries (`features within this bbox`) and server-side `ST_Area(geography)`.
- **More formats:** GeoJSON, GeoPackage, DXF via an optional GDAL-backed reader.
- **Antimeridian-aware** centroids (split or shift geometries crossing ±180°).
- **Units on request** (`?units=imperial`), and **3D measures** (surface area, cut/fill volume) from a DEM.
- **Auth** (API keys / OAuth2), rate limiting, and object storage (S3) for uploads.
- **Streaming large Shapefiles** in batches instead of loading all records at once.

---

Built by **Srinivas R C** · [GitHub](https://github.com/srinivas-rc0408) · [Portfolio](https://srinivas-rc.is-a.dev)
