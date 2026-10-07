"""End-to-end tests through the HTTP API."""

import shapefile
from sqlalchemy import event

from tests.conftest import measurements
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
    shapefile_zip,
    square,
    to_lonlat,
    zip_bytes,
)


def survey_kml() -> bytes:
    return kml_document(
        placemark("Stockpile", kml_polygon(to_lonlat(square(BLR_E, BLR_N, 1000))), {"material": "iron ore"}),
        placemark("Haul road", kml_line(to_lonlat([(BLR_E, BLR_N), (BLR_E + 2000, BLR_N)]))),
        placemark("GCP-01", kml_point((77.59, 12.97))),
        placemark("Tower", "<Model><Link><href>tower.dae</href></Link></Model>"),
        placemark("Broken", "<LineString><coordinates>77.5,abc</coordinates></LineString>"),
        folder="Mine site",
    )


def test_health(client):
    assert client.get("/health").json()["status"] == "ok"


def test_upload_kml_end_to_end(client, upload):
    response = client.post("/api/files/", files={"file": ("survey.kml", survey_kml())})
    assert response.status_code == 202
    assert response.json()["status"] == "PENDING"

    info = upload("survey.kml", survey_kml())
    assert info["status"] == "COMPLETED"
    assert info["filename"] == "survey.kml"
    assert info["file_type"] == "KML"
    assert info["crs"] == "EPSG:4326"
    assert info["feature_count"] == 5
    assert info["geometry_types"]["Polygon"] == 1
    assert info["links"]["measurements"] == f"/api/files/{info['id']}/measurements/"

    items = measurements(client, info["id"])
    by_name = {i["feature_id"]: i for i in items}
    assert by_name[0]["status"] == "MEASURED"
    assert abs(by_name[0]["area_m2"] - 1_000_000) < 1
    assert by_name[0]["area_hectares"] == round(by_name[0]["area_m2"] / 10_000, 6)
    assert by_name[0]["measurement_crs"] == "EPSG:32643"
    assert abs(by_name[1]["length_m"] - 2000) < 0.01
    assert by_name[2]["status"] == "NOT_APPLICABLE"
    assert by_name[3]["status"] == "UNSUPPORTED"
    assert by_name[4]["status"] == "FAILED"


def test_measurement_summary_and_filters(client, upload):
    info = upload("survey.kml", survey_kml())
    body = client.get(f"/api/files/{info['id']}/measurements/", params={"status": "MEASURED", "limit": 1}).json()
    assert body["total"] == 2 and len(body["items"]) == 1
    summary = body["summary"]
    assert summary["by_status"] == {"MEASURED": 2, "NOT_APPLICABLE": 1, "UNSUPPORTED": 1, "FAILED": 1}
    assert abs(summary["total_area_m2"] - 1_000_000) < 1
    assert abs(summary["total_length_m"] - 2000) < 0.01


def test_features_endpoint_returns_geometry_crs_and_properties(client, upload):
    info = upload("survey.kml", survey_kml())
    body = client.get(f"/api/files/{info['id']}/features/", params={"geometry_type": "Polygon"}).json()
    [feature] = body["items"]
    assert feature["feature_id"] == 0
    assert feature["crs"] == "EPSG:4326"
    assert feature["layer"] == "Mine site"
    assert feature["geometry"]["type"] == "Polygon"
    assert feature["properties"] == {"name": "Stockpile", "material": "iron ore"}


def test_shapefile_in_projected_crs(client, upload):
    layer = Layer(
        shapefile.POLYGON,
        [[square(BLR_E, BLR_N, 500)], [square(BLR_E + 1000, BLR_N, 100)]],
        [{"name": "Pit A"}, {"name": "Pit B"}],
        crs=UTM43N,
    )
    info = upload("parcels.zip", shapefile_zip({"parcels": layer}))
    assert info["status"] == "COMPLETED" and info["crs"] == "EPSG:32643"
    areas = [m["area_m2"] for m in measurements(client, info["id"])]
    assert abs(areas[0] - 250_000) < 0.5 and abs(areas[1] - 10_000) < 0.5


def test_shapefile_with_multiple_layers_and_crs(client, upload):
    data = shapefile_zip(
        {
            "a_utm": Layer(shapefile.POLYLINE, [[[(BLR_E, BLR_N), (BLR_E, BLR_N + 300)]]], [{"name": "l"}], crs=UTM43N),
            "b_wgs": Layer(shapefile.POINT, [(77.59, 12.97)], [{"name": "p"}]),
        }
    )
    info = upload("multi.zip", data)
    assert info["feature_count"] == 2
    assert info["crs"] == "MIXED"
    items = measurements(client, info["id"])
    assert [i["layer"] for i in items] == ["a_utm", "b_wgs"]
    assert abs(items[0]["length_m"] - 300) < 0.01


def test_one_bad_shape_does_not_fail_the_file(client, upload):
    data = shapefile_zip({"a": Layer(shapefile.POINT, [(77.5, 12.9), None], [{"name": "ok"}, {"name": "null"}])})
    info = upload("a.zip", data)
    assert info["status"] == "COMPLETED"
    assert [m["status"] for m in measurements(client, info["id"])] == ["NOT_APPLICABLE", "FAILED"]


def test_kmz_upload(client, upload):
    info = upload("site.kmz", zip_bytes({"doc.kml": survey_kml()}))
    assert info["file_type"] == "KMZ" and info["feature_count"] == 5


def test_geojson_export(client, upload):
    info = upload("survey.kml", survey_kml())
    body = client.get(f"/api/files/{info['id']}/geojson/").json()
    assert body["type"] == "FeatureCollection"
    first = body["features"][0]
    assert first["geometry"]["type"] == "Polygon"
    assert first["properties"]["material"] == "iron ore"
    assert first["properties"]["_status"] == "MEASURED"


def test_features_are_inserted_in_one_statement(client, upload):
    engine = client.app.state.session_factory.kw["bind"]
    statements: list[str] = []

    def record(_conn, _cursor, statement, *_args) -> None:
        statements.append(statement)

    event.listen(engine, "before_cursor_execute", record)
    try:
        info = upload("survey.kml", survey_kml())
    finally:
        event.remove(engine, "before_cursor_execute", record)
    assert info["feature_count"] == 5
    assert len([s for s in statements if s.startswith("INSERT INTO features")]) == 1


# ---------------------------------------------------------------- Errors


def test_unsupported_type_is_415(client):
    response = client.post("/api/files/", files={"file": ("data.geojson", b"{}")})
    assert response.status_code == 415
    assert "Unsupported file type" in response.json()["detail"]


def test_incomplete_shapefile_is_422_and_not_stored(client, settings):
    data = shapefile_zip({"a": Layer(shapefile.POINT, [(77.5, 12.9)], [{"name": "x"}])}, drop={"a.shx"})
    response = client.post("/api/files/", files={"file": ("a.zip", data)})
    assert response.status_code == 422
    assert ".shx" in response.json()["detail"]
    assert list(settings.storage_dir.iterdir()) == []
    assert client.get("/api/files/").json()["total"] == 0


def test_too_large_is_413_from_content_length(client, settings):
    response = client.post("/api/files/", files={"file": ("big.kml", b"<kml>" + b" " * 4 * 1024 * 1024)})
    assert response.status_code == 413
    assert "upload limit" in response.json()["detail"]
    assert list(settings.storage_dir.iterdir()) == []


def test_too_large_is_413_while_copying(client, settings):
    """Just over the limit: passes the header check (slack), caught by the chunked copy."""
    response = client.post("/api/files/", files={"file": ("big.kml", b"<kml>" + b" " * (2 * 1024 * 1024 + 10))})
    assert response.status_code == 413
    assert list(settings.storage_dir.iterdir()) == []


def test_malformed_kml_fails_with_reason(client, upload):
    info = upload("bad.kml", b"<kml><Placemark>")
    assert info["status"] == "FAILED"
    assert "not well-formed" in info["error"]
    response = client.get(f"/api/files/{info['id']}/measurements/")
    assert response.status_code == 409
    assert "processing failed" in response.json()["detail"]


def test_unknown_file_is_404(client):
    assert client.get("/api/files/doesnotexist").status_code == 404
    assert client.get("/api/files/doesnotexist/measurements/").status_code == 404


def test_path_in_filename_is_stripped(client, upload):
    info = upload("../../etc/survey.kml", survey_kml())
    assert info["filename"] == "survey.kml"


# ---------------------------------------------------------------- Lifecycle


def test_list_and_delete(client, upload, settings):
    info = upload("survey.kml", survey_kml())
    assert client.get("/api/files/", params={"status": "COMPLETED"}).json()["total"] == 1
    assert client.delete(f"/api/files/{info['id']}").status_code == 204
    assert client.get(f"/api/files/{info['id']}").status_code == 404
    assert list(settings.storage_dir.iterdir()) == []


def test_interrupted_jobs_are_failed_on_startup(settings):
    from fastapi.testclient import TestClient

    from app.main import create_app
    from app.models import FileStatus, FileType, GeoFile

    app = create_app(settings)
    with app.state.session_factory() as db:
        db.add(GeoFile(id="stuck", filename="x.kml", file_type=FileType.KML, size_bytes=1, storage_path="x"))
        db.commit()
    with TestClient(create_app(settings)) as c:
        info = c.get("/api/files/stuck").json()
    assert info["status"] == FileStatus.FAILED
    assert "interrupted" in info["error"]
