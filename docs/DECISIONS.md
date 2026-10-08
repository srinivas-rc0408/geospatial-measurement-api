# Decision Log

Format: `## YYYY-MM-DD — Title` · **Context** · **Decision** · **Alternatives** · **Consequences**.
Append only. Keep each entry under 10 lines. These are the answers to "why did you…?" in the interview.

## 2026-10-07 — FastAPI over Django + DRF
**Context:** 2-table service, upload + background processing + JSON API.
**Decision:** FastAPI. **Alternatives:** Django + DRF.
**Consequences:** typed schemas and OpenAPI for free; no admin panel; services layer has no
framework imports, so swapping the HTTP layer would be contained.

## 2026-10-07 — Always reproject to a per-feature UTM zone
**Context:** must not measure in degrees; projected source CRSs (Web Mercator, feet) can also be wrong.
**Decision:** source → WGS84 → UTM zone of feature centroid (feature-centred LAEA beyond 84°N/80°S).
**Alternatives:** measure in source CRS if projected; one CRS per file; geodesic only.
**Consequences:** one code path, metric, ≤ ~0.1% scale error; geodesic kept as a cross-check.

## 2026-10-07 — Pure-pip geo stack (shapely, pyproj, pyshp, defusedxml)
**Context:** GDAL/geopandas are hard to install, especially on Windows and slim containers.
**Decision:** pure wheels. **Alternatives:** geopandas/fiona/pyogrio.
**Consequences:** fewer formats than GDAL; every step explicit and testable.

## 2026-10-07 — Background tasks with status lifecycle
**Decision:** FastAPI BackgroundTasks, 202 + polling. **Alternatives:** synchronous; Celery/RQ.
**Consequences:** no extra infra; in-process jobs die on restart → marked FAILED at startup.

## 2026-10-07 — Monorepo (backend + frontend in one repo)
**Context:** the submission form accepts one GitHub link; reviewers should see everything in one place.
**Decision:** single repo with `backend/` and `frontend/`. **Alternatives:** two repos.
**Consequences:** one README, one history; CI uses path filters so each side builds independently.

## 2026-10-07 — Neon: pooled URL for the app, direct URL for migrations
**Context:** Neon offers a PgBouncer pooled endpoint (transaction mode) and a direct endpoint.
**Decision:** app uses the pooled URL (`GEO_DATABASE_URL`); Alembic uses the direct URL
(`GEO_MIGRATIONS_DATABASE_URL`, falling back to `GEO_DATABASE_URL`). **Alternatives:** one URL for both.
**Consequences:** many short app connections are cheap; DDL runs on a real session. Two secrets to manage.

## 2026-10-07 — Keep psycopg's automatic prepared statements through Neon's pooler
**Context:** prepared statements can break behind transaction-mode poolers.
**Finding:** psycopg ≥ 3.2 supports them via PgBouncer if PgBouncer ≥ 1.22, `max_prepared_statements` > 0
and client libpq ≥ 17 (psycopg.org/psycopg3/docs/advanced/prepare.html). Neon runs PgBouncer 1.22+ with
`max_prepared_statements=1000` (neon.com/docs/connect/connection-pooling); psycopg-binary 3.3.6 bundles libpq 18.
**Decision:** keep them on; set `prepare_threshold=None` only if `has_send_close_prepared()` is false.
**Consequences:** verified on Neon with repeated uploads and polling — no prepared-statement errors.

## 2026-10-07 — Alembic owns the schema
**Decision:** migrations in `backend/migrations/`, applied with `alembic upgrade head` (also on container start);
the app never calls `create_all`. **Alternatives:** `create_all` at startup.
**Consequences:** schema changes are versioned and reviewable; tests use `create_all` for speed, and one test
proves migrations and models produce the same schema on SQLite and PostgreSQL.

## 2026-10-07 — Plain `json` (not `jsonb`) for JSON columns on PostgreSQL
**Context:** `jsonb` (chosen first) re-orders object keys, so feature attributes came back in a different order
than the source file — and attribute order is the column order users see.
**Decision:** plain `JSON` on every database (Postgres `json` keeps the text as written); migration 0002 converts
the columns. **Alternatives:** `jsonb` plus a stored field-order list; `jsonb` and accept the reordering.
**Consequences:** fidelity over queryability — no GIN indexes or efficient attribute queries. Revisit `jsonb` if
attribute queries are ever needed. A test checks attribute order on SQLite and PostgreSQL.

## 2026-10-07 — Bulk insert of features
**Decision:** one `session.execute(insert(Feature).execution_options(render_nulls=True), rows)` per file.
**Alternatives:** `add_all` of ORM objects. **Consequences:** one executemany instead of a round trip per feature.
`render_nulls` is needed: without it SQLAlchemy splits rows with different NULL columns into separate INSERTs
(caught by a test that counts statements).

## 2026-10-07 — Constraint naming convention
**Decision:** `MetaData(naming_convention=…)` on `Base` (`pk_`, `fk_`, `uq_`, `ix_`, `ck_`).
**Alternatives:** database-generated names. **Consequences:** identical names on SQLite and PostgreSQL, so later
migrations can drop or alter constraints by name.

## 2026-10-07 — Liveness and readiness are separate health endpoints
**Context:** Render polls the health check path every few seconds; Neon's free tier has 100 compute-hours a month and
suspends compute after 5 idle minutes. A database query in that check would keep the compute awake around the clock.
**Decision:** `/health` (liveness, never touches the database) is Render's check; `/health/ready` runs `SELECT 1` with a
5 s limit. **Alternatives:** one `/health` with a database check (planned at first).
**Consequences:** Neon scales to zero between real requests; a database outage shows on `/health/ready`, not on Render.

## 2026-10-07 — CI tests both databases and reports combined coverage
**Context:** production runs on PostgreSQL, local development and most CI runs on SQLite; some code paths (the
PostgreSQL engine options, the jsonb→json migration) only run on one of them.
**Decision:** a PostgreSQL 17 service-container job runs `alembic upgrade head`, `alembic check` and the full suite;
coverage data from it and the SQLite job is combined, and that combined figure is the one in the README.
**Alternatives:** SQLite only (misses dialect bugs); a PostgreSQL matrix for every Python version (slower, no extra
signal). **Consequences:** dialect-specific regressions fail CI; coverage reflects what actually runs in production.

## 2026-10-08 — Vite SPA over Next.js
**Context:** the UI is a login-free tool in front of a JSON API: upload, poll, map, tables. No SEO-critical
dynamic pages, no server-side data access. **Decision:** Vite + React SPA, deployed as static files.
**Alternatives:** Next.js (SSR/RSC). **Consequences:** no Node server to host or keep warm; one origin to configure
for CORS; the map and tables render client-side anyway. Static meta tags cover link previews.

## 2026-10-08 — openapi-typescript + openapi-fetch: one source of truth for API types
**Decision:** `npm run gen:api` turns the committed `backend/openapi.json` into `schema.d.ts`; `openapi-fetch` types
every path, parameter and response from it. CI regenerates and fails on a diff.
**Alternatives:** hand-written types; a full client generator (orval, openapi-generator).
**Consequences:** a backend schema change that breaks the frontend fails `typecheck`; ~6 kB runtime, no generated code.

## 2026-10-08 — Radix primitives for dialogs and tooltips
**Decision:** `@radix-ui/react-dialog` (Sheet) and `@radix-ui/react-tooltip`, styled with our tokens.
**Alternatives:** hand-rolled focus trap and Esc handling; a styled component library.
**Consequences:** focus trap, scroll lock, Esc, ARIA wiring and portal stacking are tested upstream; we own the look.

## 2026-10-08 — Tailwind v4 tokens via CSS variables
**Decision:** every token is a CSS variable in `tokens.css` (light under `:root`, dark under `[data-theme='dark']`),
mapped with `@theme inline`; the default palette is removed. Theme = system by default, manual override in
`localStorage`, applied by an inline script before first paint. **Alternatives:** `dark:` variants; a JS theme object.
**Consequences:** components use semantic classes only and switch theme without re-rendering; any subtree can
switch theme (the dev gallery shows both side by side).

## 2026-10-08 — Colour tokens adjusted for WCAG AA
**Context:** the design system requires AA; Apple's palette values for light `--text-tertiary` (`#86868b`),
`--success` (`#248a3d`), `--neutral` (`#8e8e93`), and dark `--text-tertiary` (`#6e6e73`) and `--danger` (`#ff453a`)
fall to 2.5–3.9:1 on `--fill`. White on dark `--accent` (`#2997ff`) is 2.9:1.
**Decision:** darken (light) / lighten (dark) those text tokens until every pair is ≥ 4.5:1; status dots keep the
original hues; primary buttons use `--accent-fill` (`#0071e3`) in both themes; status pills use a hairline border,
not a fill. **Consequences:** tertiary and secondary text are close in light mode; `DESIGN_SYSTEM.md` lists the values.

## 2026-10-08 — Dark-first theme
**Context:** the product shows maps and numbers; a black page lets them carry the screen, as on Pro product pages.
**Decision:** dark is the default (also in CSS before any script runs); the toggle cycles Dark → Light → System.
**Alternatives:** follow the OS by default (the Step 4 behaviour). **Consequences:** every token pair is checked in
both themes; the map switches between OpenFreeMap `dark` and `positron`.

## 2026-10-08 — XMLHttpRequest for uploads
**Decision:** uploads use XHR; every other request uses the typed `openapi-fetch` client.
**Alternatives:** `fetch` (no upload progress in browsers); fake progress. **Consequences:** a real percentage;
`upload.ts` maps XHR outcomes onto the same `ApiError` / `NetworkError` types, so the UI handles both paths alike.

## 2026-10-08 — Load the map only when it is on screen
**Context:** MapLibre is ~280 kB gzipped and its setup is the longest main-thread task on the site.
**Decision:** its own chunk, mounted when the map box enters the viewport, built in a task of its own.
**Consequences:** first load of a phone's results page stays fast (Lighthouse mobile 91, CLS 0). On desktop the
map is visible at once, so its ~250 ms module evaluation still counts (Performance 85–87); the remaining fix would be a
static preview image instead of the live map, which is not worth the complexity now.

## 2026-10-08 — History total area from the measurement summary
**Context:** `FileInfo` has no total area, and the backend is frozen for this step.
**Decision:** each completed row asks `GET /api/files/{id}/measurements/?limit=1` (the summary covers the whole file),
cached forever. **Alternatives:** add `total_area_m2` to `FileInfo` (a backend change — the better long-term fix).
**Consequences:** up to 20 small requests per history page, once per file.

## 2026-10-08 — One Render service for the frontend and the API
**Context:** the site was planned as a Vercel frontend plus a Render API: two URLs, CORS, and the API's URL baked
into the build. **Decision:** one Docker image (root `Dockerfile`: frontend build, then the API image serving it)
on one Render web service. API routes win; anything else is a build file or `index.html`; unknown API paths are a
JSON 404. **Alternatives:** Vercel + Render; Render static site + web service. **Consequences:** one URL, no CORS,
no build-time config (link-preview URLs are filled in per request). The cost: when the free instance sleeps, the
whole site — not just the API — takes ~1 min on the first visit. Mitigated during the review window by an external
keep-warm ping to `/health`, which never touches the database, so Neon still scales to zero.

## 2026-10-08 — GET /api/config: one source for upload limits
**Context:** the frontend hard-coded 10 MB and the extension list, duplicating `GEO_MAX_UPLOAD_MB`.
**Decision:** the server reports `max_upload_mb` and `accepted_extensions`; the app fetches them once (cached) for
client-side checks and the dropzone caption. **Consequences:** changing the limit is one env var; the server still
enforces it, the client check only saves a doomed upload.

## 2026-10-08 — Stored file totals (supersedes "History total area from the measurement summary")
**Decision:** `geo_files.total_area_m2` / `total_length_m` are written when processing completes and returned in
`FileInfo`; migration 0003 adds them and backfills completed files with one SQL statement that runs on SQLite and
PostgreSQL. **Alternatives:** a summary request per history row (the N+1 it replaces); compute in the list query.
**Consequences:** a history page is one request; totals are a denormalised copy of the features' sums, safe because
features never change after processing.

## 2026-10-08 — The app compresses its own responses
**Context:** on Vercel the CDN compressed the bundle; served by the API it went out raw (471 kB instead of 150 kB for
the main chunk) and mobile Lighthouse Performance on the home page fell from 94 to 75.
**Decision:** Starlette's `GZipMiddleware` for bodies over 1 kB, only when the client sends `Accept-Encoding: gzip`.
**Alternatives:** pre-compressed `.gz` files from the build; a CDN in front of Render. **Consequences:** a little CPU
per response on a small instance; no new dependency and no build step. Brotli would save more, but needs a package.

## 2026-10-08 — Requests fail at once when offline
**Context:** TanStack Query pauses queries and mutations while the browser reports offline (`networkMode: 'online'`).
An upload then sat at "Uploading 0%" with no message, and started on its own when the connection came back.
**Decision:** `networkMode: 'always'` for queries and mutations, so the existing "Could not reach the server" message
shows at once. **Alternatives:** keep pausing and show an "offline" banner. **Consequences:** no surprise uploads after
reconnecting; a page opened offline shows an error with a retry button instead of loading forever.

## 2026-10-08 — Results workspace split 1:1 on desktop
**Context:** with the map at 7/12, the measurement table was ~450 px wide and most feature names wrapped to three lines.
**Decision:** map and table get half the 1200 px width each. **Alternatives:** shorter status labels; hiding the
type · layer line. **Consequences:** most rows fit on one line; the map is 584 px wide instead of 680.

## 2026-10-08 — Security headers and a strict Content-Security-Policy
**Context:** the API now serves the whole site, so it owns the browser-facing headers. **Decision:** one middleware adds
`nosniff`, a referrer policy, a permissions policy, HSTS (HTTPS requests only) and a CSP to every response. Scripts are
limited to the origin; the one inline script (the no-flash theme switch in `index.html`) is allowed by the SHA-256 hash
the server computes from the built file at start-up, so a rebuilt page never needs a manual hash update. Styles keep
`'unsafe-inline'` because React, Motion and MapLibre set style attributes. Swagger UI is served by our own `/docs`
route (same FastAPI helper) so its inline bootstrap script also has a known hash; its validator badge is switched off.
**Alternatives:** `'unsafe-inline'` scripts (defeats the CSP); a nonce (needs per-request HTML rewriting); exempting
`/docs`. **Consequences:** adding a third-party script or tile host means editing `app/security.py`.

## 2026-10-08 — In-memory per-IP upload rate limit
**Context:** a public demo with free hosting should not be filled by a script. **Decision:** a sliding window of 20
uploads per 10 minutes per client address, kept in process memory, as a dependency on `POST /api/files/`; `429` with
`Retry-After`. The address is the one uvicorn derives from `X-Forwarded-For` behind Render's proxy. The frontend shows
the server's message with a neutral clock icon, not an error. **Alternatives:** Redis (another service to run); a
library such as slowapi (a dependency for ~30 lines). **Consequences:** resets on restart, per instance only, and a
client that forges `X-Forwarded-For` can dodge it — acceptable for an abuse brake on one instance, not for access control.
