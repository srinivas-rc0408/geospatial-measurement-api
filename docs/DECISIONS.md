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
