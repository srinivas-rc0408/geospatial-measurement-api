"""Area and length measurement.

Flow for each feature:
    source CRS ──► WGS84 (EPSG:4326) ──► local UTM zone (metres) ──► shapely area/length

Why not measure in the source CRS directly?
  * Geographic CRS (EPSG:4326): units are degrees, so area in "degrees²" is meaningless.
  * Some projected CRS are unsuitable: Web Mercator (EPSG:3857) inflates area by
    1/cos²(latitude) — ~6% at Bengaluru, ~4x at 60°N. Others use feet, not metres.
Re-projecting everything into the local UTM zone gives one consistent, metric,
low-distortion frame regardless of what the file was saved in.

As an independent check, the same geometry is also measured geodesically on the WGS84
ellipsoid (pyproj.Geod, no projection at all). If the two differ by more than a threshold,
the feature gets a warning (e.g. a polygon spanning several UTM zones).
"""

from dataclasses import dataclass, field

import numpy as np
import shapely
from pyproj import CRS, Geod, Transformer
from shapely.geometry import MultiPolygon, Polygon, mapping, shape
from shapely.geometry.base import BaseGeometry
from shapely.geometry.polygon import orient

from app.models import MeasurementStatus
from app.services.crs import WGS84, select_projected_crs

AREAL = {"Polygon", "MultiPolygon"}
LINEAR = {"LineString", "MultiLineString", "LinearRing"}
PUNTAL = {"Point", "MultiPoint"}

GEOD = Geod(ellps="WGS84")
UTM_ZONE_WIDTH_DEG = 6.0


@dataclass
class MeasurementResult:
    status: MeasurementStatus
    geometry_type: str | None
    measurement_crs: str | None = None
    area_m2: float | None = None
    perimeter_m: float | None = None
    length_m: float | None = None
    geodesic_area_m2: float | None = None
    geodesic_length_m: float | None = None
    geometry_wgs84: dict | None = None
    messages: list[str] = field(default_factory=list)


def _apply(transformer: Transformer, geom: BaseGeometry) -> BaseGeometry:
    """Reproject every vertex of a shapely geometry (vectorised over numpy arrays)."""

    def _fn(coords: np.ndarray) -> np.ndarray:
        x, y = transformer.transform(coords[:, 0], coords[:, 1])
        return np.column_stack([x, y])

    return shapely.transform(geom, _fn)


def _polygonal(geom: BaseGeometry) -> BaseGeometry:
    """Keep only the polygon parts of a geometry (``make_valid`` can return collections)."""
    if isinstance(geom, Polygon | MultiPolygon):
        return geom
    polys = [g for g in getattr(geom, "geoms", []) if isinstance(g, Polygon | MultiPolygon)]
    parts = [p for g in polys for p in (g.geoms if isinstance(g, MultiPolygon) else [g])]
    return MultiPolygon(parts)


def _oriented(geom: BaseGeometry) -> BaseGeometry:
    """Exterior counter-clockwise, holes clockwise — what pyproj.Geod expects."""
    if isinstance(geom, Polygon):
        return orient(geom, sign=1.0)
    return MultiPolygon([orient(p, sign=1.0) for p in geom.geoms])


class GeometryMeasurer:
    """Measures geometries that share one source CRS.

    One instance is created per dataset in the processing thread, so its transformer
    cache is never shared between threads (pyproj Transformers are not thread-safe).
    """

    def __init__(self, source_crs: CRS | None, divergence_warning_pct: float = 0.5) -> None:
        self.source_crs = source_crs
        self.divergence_warning_pct = divergence_warning_pct
        self._to_wgs84: Transformer | None = None
        if source_crs is not None and not source_crs.equals(WGS84, ignore_axis_order=True):
            self._to_wgs84 = Transformer.from_crs(source_crs, WGS84, always_xy=True)
        self._projectors: dict[str, Transformer] = {}

    def _projector(self, label: str, target: CRS) -> Transformer:
        if label not in self._projectors:
            self._projectors[label] = Transformer.from_crs(WGS84, target, always_xy=True)
        return self._projectors[label]

    def measure(self, geometry: dict | None) -> MeasurementResult:
        gtype = geometry.get("type") if geometry else None
        try:
            return self._measure(geometry, gtype)
        except Exception as exc:  # one bad feature must never fail the whole file
            return MeasurementResult(MeasurementStatus.FAILED, gtype, messages=[f"Measurement failed: {exc}"])

    def _measure(self, geometry: dict | None, gtype: str | None) -> MeasurementResult:
        failed = MeasurementStatus.FAILED
        if not geometry:
            return MeasurementResult(failed, gtype, messages=["Feature has no geometry."])
        try:
            geom = shape(geometry)
        except Exception as exc:
            return MeasurementResult(failed, gtype, messages=[f"Invalid geometry: {exc}"])
        if geom.is_empty:
            return MeasurementResult(failed, gtype, messages=["Geometry is empty."])
        geom = shapely.force_2d(geom)  # altitude does not affect planimetric area/length

        if self.source_crs is None:
            return MeasurementResult(
                failed, gtype, messages=["CRS is unknown, so the geometry cannot be measured safely."]
            )

        wgs84 = _apply(self._to_wgs84, geom) if self._to_wgs84 else geom
        if not np.isfinite(shapely.get_coordinates(wgs84)).all():
            return MeasurementResult(failed, gtype, messages=["Coordinates could not be transformed to WGS84."])
        result = MeasurementResult(MeasurementStatus.MEASURED, gtype, geometry_wgs84=mapping(wgs84))

        if gtype in PUNTAL:
            result.status = MeasurementStatus.NOT_APPLICABLE
            result.messages.append("Points have no area or length.")
            return result
        if gtype not in AREAL | LINEAR:
            result.status = MeasurementStatus.UNSUPPORTED
            result.messages.append(f"Measurement is not supported for {gtype}.")
            return result

        if gtype in AREAL and not wgs84.is_valid:
            reason = shapely.is_valid_reason(wgs84)
            wgs84 = _polygonal(shapely.make_valid(wgs84))
            result.geometry_wgs84 = mapping(wgs84)
            result.messages.append(f"Invalid polygon repaired before measuring ({reason}).")

        centroid = wgs84.centroid
        label, target = select_projected_crs(centroid.x, centroid.y)
        projected = _apply(self._projector(label, target), wgs84)
        result.measurement_crs = label

        if gtype in AREAL:
            result.area_m2 = projected.area
            result.perimeter_m = projected.length  # includes hole boundaries
            area, _ = GEOD.geometry_area_perimeter(_oriented(wgs84))
            result.geodesic_area_m2 = abs(area)
            projected_value, geodesic_value = result.area_m2, result.geodesic_area_m2
        else:
            result.length_m = projected.length
            result.geodesic_length_m = GEOD.geometry_length(wgs84)
            projected_value, geodesic_value = result.length_m, result.geodesic_length_m

        minx, _, maxx, _ = wgs84.bounds
        if maxx - minx > UTM_ZONE_WIDTH_DEG:
            result.messages.append(
                f"Feature spans {maxx - minx:.1f}° of longitude (wider than a UTM zone); prefer the geodesic value."
            )
        if geodesic_value:
            diff_pct = abs(projected_value - geodesic_value) / geodesic_value * 100
            if diff_pct > self.divergence_warning_pct:
                result.messages.append(
                    f"Projected and geodesic measurements differ by {diff_pct:.2f}%; prefer the geodesic value."
                )
        return result
