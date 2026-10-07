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

## 2026-10-07 — JSONB for JSON columns on PostgreSQL
**Decision:** `JSON().with_variant(JSONB, "postgresql")`; plain JSON on SQLite. **Alternatives:** JSON (text) everywhere.
**Consequences:** parsed binary storage that can be queried and GIN-indexed later. JSONB does not keep object
key order, so `properties` may come back in a different key order than the source file on PostgreSQL.

## 2026-10-07 — Bulk insert of features
**Decision:** one `session.execute(insert(Feature).execution_options(render_nulls=True), rows)` per file.
**Alternatives:** `add_all` of ORM objects. **Consequences:** one executemany instead of a round trip per feature.
`render_nulls` is needed: without it SQLAlchemy splits rows with different NULL columns into separate INSERTs
(caught by a test that counts statements).

## 2026-10-07 — Constraint naming convention
**Decision:** `MetaData(naming_convention=…)` on `Base` (`pk_`, `fk_`, `uq_`, `ix_`, `ck_`).
**Alternatives:** database-generated names. **Consequences:** identical names on SQLite and PostgreSQL, so later
migrations can drop or alter constraints by name.
