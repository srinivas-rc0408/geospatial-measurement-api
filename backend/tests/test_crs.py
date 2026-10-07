import pytest
from pyproj import CRS

from app.services.crs import crs_label, select_projected_crs, utm_zone


@pytest.mark.parametrize(
    ("lon", "expected"),
    [(-180.0, 1), (-177.1, 1), (0.0, 31), (77.59, 43), (179.99, 60), (180.0, 1)],
)
def test_utm_zone(lon, expected):
    assert utm_zone(lon) == expected


@pytest.mark.parametrize(
    ("lon", "lat", "label"),
    [
        (77.59, 12.97, "EPSG:32643"),  # Bengaluru -> UTM 43N
        (151.2, -33.87, "EPSG:32756"),  # Sydney -> UTM 56S
        (10.0, 85.0, "LAEA(lat_0=85.0, lon_0=10.0)"),  # beyond UTM's northern limit
        (10.0, -82.0, "LAEA(lat_0=-82.0, lon_0=10.0)"),  # beyond UTM's southern limit
    ],
)
def test_select_projected_crs(lon, lat, label):
    selected_label, crs = select_projected_crs(lon, lat)
    assert selected_label == label
    assert crs.is_projected
    assert crs.axis_info[0].unit_name == "metre"


def test_crs_label_prefers_authority_code():
    assert crs_label(CRS.from_epsg(4326)) == "EPSG:4326"
    assert crs_label(CRS.from_wkt(CRS.from_epsg(32643).to_wkt("WKT1_ESRI"))) == "EPSG:32643"
    assert crs_label(None) is None
