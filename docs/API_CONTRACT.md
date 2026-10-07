# API Contract (v1)

Base URL: `GEO` backend, e.g. `http://localhost:8000`. All JSON. Errors: `{"detail": "<message>"}`.
The OpenAPI schema at `/openapi.json` is the machine-readable source; this file is the human one.
If they disagree, it is a bug.

## Enums
- `FileStatus`: `PENDING | PROCESSING | COMPLETED | FAILED`
- `FileType`: `SHAPEFILE | KML | KMZ`
- `MeasurementStatus`: `MEASURED | NOT_APPLICABLE | UNSUPPORTED | FAILED`

## `GET /health`
`200` → `{"status": "ok", "version": "1.x.y", "database": "ok"}`
(`database` added in Step 3: a `SELECT 1` with a short timeout; `"unavailable"` + `503` if it fails.)

## `POST /api/files/` — multipart, field `file`
Accepts `.zip` (Shapefile), `.kml`, `.kmz`. Returns `202` with a `FileInfo` (`status: PENDING`).
Errors: `413` too large, `415` wrong type, `422` corrupt/incomplete.

## `GET /api/files/?status=&limit=&offset=`
`200` → `{ total, limit, offset, items: FileInfo[] }`, newest first. `limit` 1–1000 (default 100).

## `GET /api/files/{id}`
`200` → `FileInfo`. `404` if unknown.

```jsonc
// FileInfo
{
  "id": "9f69fdac523d4233a88b21b0ca504506",
  "filename": "mine_site_survey.kml",
  "file_type": "KML",
  "size_bytes": 3068,
  "status": "COMPLETED",
  "crs": "EPSG:4326",            // "MIXED" if layers differ; null until processed / if unknown
  "feature_count": 7,
  "geometry_types": {"Polygon": 3, "LineString": 2, "Point": 1, "Model": 1},
  "bbox": [77.59, 12.97, 77.61, 12.99],  // NEW (Step 2): [minLon, minLat, maxLon, maxLat] EPSG:4326, null if none
  "warnings": [],
  "error": null,                  // reason when FAILED
  "created_at": "2026-10-07T08:38:44.277511Z",
  "processed_at": "2026-10-07T08:38:44.295466Z",
  "links": {"self": "...", "features": "...", "measurements": "...", "geojson": "..."}
}
```

## `GET /api/files/{id}/features/?geometry_type=&limit=&offset=`
`200` → `{ file_id, total, limit, offset, items: Feature[] }`. `409` if not `COMPLETED`.
```jsonc
{ "feature_id": 0, "layer": "Site boundaries", "geometry_type": "Polygon",
  "crs": "EPSG:4326", "geometry": { /* GeoJSON in the file's own CRS */ },
  "properties": {"name": "Pit boundary", "zone": "North pit"} }
```

## `GET /api/files/{id}/measurements/?status=&limit=&offset=`
`200` → `MeasurementList`. `409` if not `COMPLETED` (detail explains status or failure).
```jsonc
{
  "file_id": "…", "crs": "EPSG:4326",
  "units": {"area": "square metres (m²)", "length": "metres (m)"},
  "summary": { "total_area_m2": 255000.291, "total_area_hectares": 25.500029,
               "total_length_m": 1370.02, "total_length_km": 1.37002,
               "by_status": {"MEASURED": 5, "NOT_APPLICABLE": 1, "UNSUPPORTED": 1, "FAILED": 0} },
  "total": 7, "limit": 100, "offset": 0,
  "items": [{
    "feature_id": 0, "layer": "Site boundaries", "geometry_type": "Polygon",
    "status": "MEASURED", "measurement_crs": "EPSG:32643",
    "area_m2": 232000.35, "area_hectares": 23.200035, "perimeter_m": 2360.002,
    "length_m": null, "length_km": null,
    "geodesic": {"area_m2": 231731.912, "length_m": null},
    "messages": []
  }]
}
```
Summary always covers the whole file, regardless of filters/pagination.

## `GET /api/files/{id}/geojson/`
`200` → RFC 7946 `FeatureCollection` in EPSG:4326. Each feature: `id` = feature index;
`properties` = original attributes + `_feature_id, _layer, _geometry_type, _status,
_measurement_crs, _area_m2, _area_hectares, _perimeter_m, _length_m, _length_km, _messages`.
Features without a WGS84 geometry have `geometry: null`.

## `DELETE /api/files/{id}`
`204`. `409` while `PROCESSING`. `404` if unknown.

## CORS
Allowed origins from `GEO_CORS_ORIGINS`. Methods: GET, POST, DELETE. Exposes no custom headers
except `X-Request-ID`.
