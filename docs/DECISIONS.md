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
