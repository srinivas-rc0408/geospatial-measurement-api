import math

import pytest
from pyproj import CRS
from shapely.geometry import mapping

from app.models import MeasurementStatus
from app.services.measurement import GEOD, GeometryMeasurer
from tests.factories import BLR_E, BLR_N, UTM43N, WEB_MERCATOR, WGS84, square, to_lonlat


def polygon(ring, holes=()):
    return {"type": "Polygon", "coordinates": [ring, *holes]}


def test_square_km_in_wgs84_measures_one_km2():
    ring = to_lonlat(square(BLR_E, BLR_N, 1000))
    result = GeometryMeasurer(WGS84).measure(polygon(ring))

    assert result.status is MeasurementStatus.MEASURED
    assert result.measurement_crs == "EPSG:32643"
    assert result.area_m2 == pytest.approx(1_000_000, rel=1e-6)
    assert result.perimeter_m == pytest.approx(4_000, rel=1e-6)
    # UTM grid area vs true ellipsoidal area differ by the zone scale factor (~0.1% here).
    assert result.geodesic_area_m2 == pytest.approx(result.area_m2, rel=2e-3)
    assert result.messages == []


def test_polygon_hole_is_subtracted():
    outer = to_lonlat(square(BLR_E, BLR_N, 1000))
    hole = to_lonlat(square(BLR_E + 250, BLR_N + 250, 500))[::-1]
    result = GeometryMeasurer(WGS84).measure(polygon(outer, [hole]))
    assert result.area_m2 == pytest.approx(750_000, rel=1e-6)
    assert result.geodesic_area_m2 == pytest.approx(750_000, rel=2e-3)


def test_projected_source_crs_is_reprojected_not_trusted():
    ring = square(BLR_E, BLR_N, 1000)  # coordinates already in UTM 43N metres
    result = GeometryMeasurer(UTM43N).measure(polygon(ring))
    assert result.area_m2 == pytest.approx(1_000_000, rel=1e-6)
    assert result.geometry_wgs84["coordinates"][0][0][0] == pytest.approx(77.6, abs=0.1)


def test_web_mercator_area_inflation_is_corrected():
    """A 1000x1000 'metre' square in EPSG:3857 is NOT 1 km² on the ground at 13°N."""
    lon, lat = 77.59, 12.97
    from pyproj import Transformer

    x, y = Transformer.from_crs(WGS84, WEB_MERCATOR, always_xy=True).transform(lon, lat)
    ring = square(x, y, 1000)
    result = GeometryMeasurer(WEB_MERCATOR).measure(polygon(ring))

    true_area = abs(GEOD.geometry_area_perimeter(_shape(result.geometry_wgs84))[0])
    naive_area = 1_000_000
    assert result.area_m2 == pytest.approx(true_area, rel=2e-3)
    assert result.area_m2 == pytest.approx(naive_area * math.cos(math.radians(lat)) ** 2, rel=5e-3)
    assert result.area_m2 < naive_area * 0.96  # naive Mercator area would be ~5% too large


def _shape(geojson):
    from shapely.geometry import shape

    return shape(geojson)


def test_line_length_matches_geodesic():
    line = {"type": "LineString", "coordinates": [[77.5, 12.9], [77.6, 12.9], [77.6, 13.0]]}
    result = GeometryMeasurer(WGS84).measure(line)
    expected = GEOD.line_length([77.5, 77.6, 77.6], [12.9, 12.9, 13.0])
    assert result.status is MeasurementStatus.MEASURED
    assert result.length_m == pytest.approx(expected, rel=2e-3)
    assert result.area_m2 is None


def test_multipolygon_area_is_sum_of_parts():
    a = to_lonlat(square(BLR_E, BLR_N, 100))
    b = to_lonlat(square(BLR_E + 500, BLR_N, 200))
    result = GeometryMeasurer(WGS84).measure({"type": "MultiPolygon", "coordinates": [[a], [b]]})
    assert result.area_m2 == pytest.approx(10_000 + 40_000, rel=1e-6)


def test_point_is_not_applicable():
    result = GeometryMeasurer(WGS84).measure({"type": "Point", "coordinates": [77.59, 12.97]})
    assert result.status is MeasurementStatus.NOT_APPLICABLE
    assert result.area_m2 is None and result.length_m is None
    assert result.geometry_wgs84 is not None


def test_geometry_collection_is_unsupported_not_crash():
    gc = {
        "type": "GeometryCollection",
        "geometries": [
            {"type": "Point", "coordinates": [77.59, 12.97]},
            {"type": "LineString", "coordinates": [[77.5, 12.9], [77.6, 12.9]]},
        ],
    }
    result = GeometryMeasurer(WGS84).measure(gc)
    assert result.status is MeasurementStatus.UNSUPPORTED


def test_self_intersecting_polygon_is_repaired():
    bowtie = to_lonlat(
        [(BLR_E, BLR_N), (BLR_E + 100, BLR_N + 100), (BLR_E + 100, BLR_N), (BLR_E, BLR_N + 100), (BLR_E, BLR_N)]
    )
    result = GeometryMeasurer(WGS84).measure(polygon(bowtie))
    assert result.status is MeasurementStatus.MEASURED
    assert result.area_m2 == pytest.approx(5_000, rel=1e-3)  # two triangles of 2,500 m²
    assert any("repaired" in m for m in result.messages)


def test_unknown_crs_is_not_measured():
    result = GeometryMeasurer(None).measure(polygon(square(BLR_E, BLR_N, 10)))
    assert result.status is MeasurementStatus.FAILED
    assert "CRS is unknown" in result.messages[0]


@pytest.mark.parametrize(
    "geometry",
    [
        None,
        {"type": "Polygon", "coordinates": []},
        {"type": "LineString", "coordinates": [[1, 2]]},
        {"type": "Banana", "coordinates": [1, 2]},
    ],
)
def test_bad_geometry_fails_gracefully(geometry):
    result = GeometryMeasurer(WGS84).measure(geometry)
    assert result.status is MeasurementStatus.FAILED
    assert result.messages


def test_3d_coordinates_are_ignored_for_measurement():
    ring = [(*p, 900.0) for p in to_lonlat(square(BLR_E, BLR_N, 1000))]
    result = GeometryMeasurer(WGS84).measure(polygon(ring))
    assert result.area_m2 == pytest.approx(1_000_000, rel=1e-6)


def test_polar_feature_uses_local_equal_area_projection():
    line = {"type": "LineString", "coordinates": [[10.0, 85.0], [10.0, 85.1]]}
    result = GeometryMeasurer(WGS84).measure(line)
    assert result.measurement_crs.startswith("LAEA(")
    assert result.length_m == pytest.approx(result.geodesic_length_m, rel=1e-4)

    ring = [[10.0, 85.0], [10.5, 85.0], [10.5, 85.2], [10.0, 85.2], [10.0, 85.0]]
    result = GeometryMeasurer(WGS84).measure({"type": "Polygon", "coordinates": [ring]})
    assert result.area_m2 == pytest.approx(result.geodesic_area_m2, rel=1e-4)


def test_feature_wider_than_utm_zone_gets_warning():
    line = {"type": "LineString", "coordinates": [[70.0, 20.0], [85.0, 20.0]]}
    result = GeometryMeasurer(WGS84).measure(line)
    assert result.status is MeasurementStatus.MEASURED
    assert any("wider than a UTM zone" in m for m in result.messages)


def test_mapping_roundtrip_is_geojson():
    ring = to_lonlat(square(BLR_E, BLR_N, 10))
    result = GeometryMeasurer(CRS.from_epsg(4326)).measure(polygon(ring))
    assert result.geometry_wgs84["type"] == "Polygon"
    assert mapping(_shape(result.geometry_wgs84))["type"] == "Polygon"
