import logging

import pytest
import shapefile
from shapely.geometry import Polygon

from app.config import Settings
from app.models import FileType
from app.services.errors import InvalidFileError, UnsupportedFileTypeError
from app.services.readers import extension_of, inspect_upload, read_datasets
from app.services.readers.base import ProblemKind
from app.services.readers.kml import read_kml
from tests.factories import (
    BLR_E,
    BLR_N,
    UTM43N,
    Layer,
    kml_document,
    kml_line,
    kml_point,
    kml_polygon,
    placemark,
    shapefile_members,
    shapefile_zip,
    square,
    to_lonlat,
    zip_bytes,
)


@pytest.fixture
def settings(tmp_path):
    return Settings(storage_dir=tmp_path, max_uncompressed_mb=1, max_archive_members=20)


def write(tmp_path, name, data):
    path = tmp_path / name
    path.write_bytes(data)
    return path


# ---------------------------------------------------------------- KML


def test_kml_extracts_geometry_properties_and_layers():
    ring = to_lonlat(square(BLR_E, BLR_N, 100))
    doc = kml_document(
        placemark("Pit", kml_polygon(ring), {"site": "North", "owner": "Aereo"}),
        placemark("Road", kml_line([(77.5, 12.9), (77.6, 12.9)])),
        placemark("GCP", kml_point((77.59, 12.97, 920))),
        folder="Survey",
    )
    dataset = read_kml(doc, default_layer="file")
    assert dataset.crs.to_epsg() == 4326
    assert [f.geometry["type"] for f in dataset.features] == ["Polygon", "LineString", "Point"]
    assert dataset.features[0].properties == {"name": "Pit", "site": "North", "owner": "Aereo"}
    assert {f.layer for f in dataset.features} == {"Survey"}
    assert dataset.features[2].geometry["coordinates"] == [77.59, 12.97, 920.0]


def test_kml_without_namespace_and_unclosed_ring_is_repaired():
    doc = (
        b"<kml><Placemark><Polygon><outerBoundaryIs><LinearRing><coordinates>"
        b"77.5,12.9 77.6,12.9 77.6,13.0</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark></kml>"
    )
    ring = read_kml(doc, "f").features[0].geometry["coordinates"][0]
    assert ring[0] == ring[-1] and len(ring) == 4


def test_kml_multigeometry_becomes_multi_type():
    a = to_lonlat(square(BLR_E, BLR_N, 10))
    b = to_lonlat(square(BLR_E + 50, BLR_N, 10))
    doc = kml_document(placemark("M", f"<MultiGeometry>{kml_polygon(a)}{kml_polygon(b)}</MultiGeometry>"))
    assert read_kml(doc, "f").features[0].geometry["type"] == "MultiPolygon"


def test_kml_mixed_multigeometry_becomes_collection():
    doc = kml_document(
        placemark("M", f"<MultiGeometry>{kml_point((77, 12))}{kml_line([(77, 12), (78, 12)])}</MultiGeometry>")
    )
    assert read_kml(doc, "f").features[0].geometry["type"] == "GeometryCollection"


def test_kml_gx_track_is_read_as_linestring():
    doc = kml_document(
        placemark(
            "Flight",
            "<gx:Track><when>2026-01-01T00:00:00Z</when><gx:coord>77.5 12.9 100</gx:coord>"
            "<when>2026-01-01T00:01:00Z</when><gx:coord>77.51 12.9 100</gx:coord></gx:Track>",
        )
    )
    feature = read_kml(doc, "f").features[0]
    assert feature.geometry["type"] == "LineString"
    assert feature.geometry_type == "Track"


def test_kml_bad_feature_is_isolated():
    doc = kml_document(
        placemark("Good", kml_point((77.59, 12.97))),
        placemark("Bad", "<Point><coordinates>abc,def</coordinates></Point>"),
        placemark("OutOfRange", "<Point><coordinates>200,95</coordinates></Point>"),
        placemark("Model", "<Model><Link><href>tower.dae</href></Link></Model>"),
        placemark("Empty", ""),
    )
    features = read_kml(doc, "f").features
    assert features[0].problem is None
    assert features[1].problem_kind is ProblemKind.INVALID
    assert "outside valid" in features[2].problem
    assert features[3].problem_kind is ProblemKind.UNSUPPORTED
    assert features[4].problem == "Placemark has no geometry."


@pytest.mark.parametrize(
    ("data", "message"),
    [
        (b"<kml><Placemark>", "not well-formed"),
        (b"<gpx></gpx>", "expected <kml>"),
        (b'<?xml version="1.0"?><!DOCTYPE kml [<!ENTITY x SYSTEM "file:///etc/passwd">]><kml>&x;</kml>', "DTD"),
    ],
)
def test_kml_rejects_invalid_and_malicious_xml(data, message):
    with pytest.raises(InvalidFileError, match=message):
        read_kml(data, "f")


# ---------------------------------------------------------------- Detection & ZIP safety


@pytest.mark.parametrize("name", ["a.geojson", "a.shp", "a", "a.txt"])
def test_unsupported_extensions(name):
    with pytest.raises(UnsupportedFileTypeError):
        extension_of(name)


def test_inspect_detects_types(tmp_path, settings):
    shp = shapefile_zip({"roads": Layer(shapefile.POINT, [(77.5, 12.9)], [{"name": "a"}])})
    kmz = zip_bytes({"doc.kml": kml_document(placemark("p", kml_point((77, 12))))})
    assert inspect_upload(write(tmp_path, "a.zip", shp), "a.zip", settings) is FileType.SHAPEFILE
    assert inspect_upload(write(tmp_path, "b.kmz", kmz), "b.kmz", settings) is FileType.KMZ
    assert inspect_upload(write(tmp_path, "c.kml", b"\xef\xbb\xbf <kml/>"), "c.kml", settings) is FileType.KML


@pytest.mark.parametrize(
    ("name", "data", "message"),
    [
        ("a.zip", b"not a zip", "not a valid ZIP"),
        ("a.zip", zip_bytes({"readme.txt": b"hi"}), "no Shapefile"),
        ("a.kml", b"PK\x03\x04binary", "does not look like XML"),
        ("a.zip", zip_bytes({"__MACOSX/._x": b"", ".DS_Store": b""}), "empty"),
    ],
)
def test_inspect_rejects_bad_containers(tmp_path, settings, name, data, message):
    with pytest.raises(InvalidFileError, match=message):
        inspect_upload(write(tmp_path, name, data), name, settings)


def test_missing_shapefile_component_is_reported(tmp_path, settings):
    data = shapefile_zip({"parcels": Layer(shapefile.POINT, [(77.5, 12.9)], [{"name": "a"}])}, drop={"parcels.dbf"})
    with pytest.raises(InvalidFileError, match=r"'parcels' is missing required component\(s\): .dbf"):
        inspect_upload(write(tmp_path, "a.zip", data), "a.zip", settings)


def test_zip_bomb_is_rejected_before_extraction(tmp_path, settings):
    bomb = zip_bytes({"big.kml": b"0" * (2 * 1024 * 1024)})  # 2 MB of zeros compresses to ~2 KB
    with pytest.raises(InvalidFileError, match="limit is 1 MB"):
        inspect_upload(write(tmp_path, "bomb.kmz", bomb), "bomb.kmz", settings)


def test_zip_slip_paths_are_never_extracted(tmp_path, settings):
    data = zip_bytes({"../../evil/doc.kml": kml_document(placemark("p", kml_point((77, 12))))})
    path = write(tmp_path, "slip.kmz", data)
    datasets = read_datasets(path, FileType.KMZ, "slip.kmz", settings)
    assert len(datasets[0].features) == 1
    assert not (tmp_path.parent.parent / "evil").exists()


# ---------------------------------------------------------------- Shapefile


def test_shapefile_crs_properties_and_nested_folder(tmp_path, settings):
    ring = square(BLR_E, BLR_N, 100)
    members = shapefile_members("Parcels", Layer(shapefile.POLYGON, [[ring]], [{"name": "Lot 7"}], crs=UTM43N))
    data = zip_bytes({f"export/{name}": blob for name, blob in members.items()})  # nested folder in the ZIP
    path = write(tmp_path, "p.zip", data)
    [dataset] = read_datasets(path, FileType.SHAPEFILE, "p.zip", settings)
    assert dataset.crs.to_epsg() == 32643
    assert dataset.features[0].properties == {"name": "Lot 7"}
    assert dataset.features[0].layer == "Parcels"


@pytest.mark.parametrize("clockwise", [True, False])
def test_shapefile_polygon_ring_orientation(tmp_path, settings, caplog, clockwise):
    """Clockwise exteriors (ESRI) read silently; counter-clockwise ones are still read as exteriors."""
    ring = square(BLR_E, BLR_N, 100)
    layer = Layer(shapefile.POLYGON, [[ring]], [{"name": "Lot"}], crs=UTM43N, clockwise=clockwise)
    path = write(tmp_path, "p.zip", shapefile_zip({"p": layer}))
    with caplog.at_level(logging.WARNING, logger="shapefile"):
        [dataset] = read_datasets(path, FileType.SHAPEFILE, "p.zip", settings)
    geometry = dataset.features[0].geometry
    assert geometry["type"] == "Polygon" and len(geometry["coordinates"]) == 1  # one exterior ring, no hole
    assert Polygon(geometry["coordinates"][0]).area == pytest.approx(10_000)
    assert bool(caplog.records) is not clockwise  # pyshp warns only about counter-clockwise exteriors


def test_shapefile_without_prj_assumes_wgs84_only_for_lonlat(tmp_path, settings):
    lonlat = shapefile_zip({"a": Layer(shapefile.POINT, [(77.5, 12.9)], [{"name": "x"}], crs=None)})
    metres = shapefile_zip({"b": Layer(shapefile.POINT, [(BLR_E, BLR_N)], [{"name": "x"}], crs=None)})
    [a] = read_datasets(write(tmp_path, "a.zip", lonlat), FileType.SHAPEFILE, "a.zip", settings)
    [b] = read_datasets(write(tmp_path, "b.zip", metres), FileType.SHAPEFILE, "b.zip", settings)
    assert a.crs.to_epsg() == 4326 and "assumed" in a.warnings[0]
    assert b.crs is None and "CRS unknown" in b.warnings[0]


def test_shapefile_null_shape_is_flagged(tmp_path, settings):
    data = shapefile_zip({"a": Layer(shapefile.POINT, [(77.5, 12.9), None], [{"name": "ok"}, {"name": "null"}])})
    [dataset] = read_datasets(write(tmp_path, "a.zip", data), FileType.SHAPEFILE, "a.zip", settings)
    assert dataset.features[0].problem is None
    assert "NULL shape" in dataset.features[1].problem


def test_corrupt_shapefile_body_raises_invalid(tmp_path, settings):
    data = zip_bytes({"a.shp": b"garbage" * 20, "a.shx": b"garbage", "a.dbf": b"garbage"})
    with pytest.raises(InvalidFileError, match="could not be read"):
        read_datasets(write(tmp_path, "a.zip", data), FileType.SHAPEFILE, "a.zip", settings)
