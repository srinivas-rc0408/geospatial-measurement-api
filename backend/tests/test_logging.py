"""Request IDs and the structured access / processing log lines."""

import logging
import re

import pytest

from tests.factories import kml_document, kml_point, placemark

HEX_ID = re.compile(r"[0-9a-f]{32}")


def access_lines(caplog) -> list[str]:
    return [r.getMessage() for r in caplog.records if r.name == "app.access"]


def test_valid_request_id_is_echoed_and_logged(client, caplog):
    with caplog.at_level(logging.INFO):
        response = client.get("/health", headers={"X-Request-ID": "frontend-42.a_b"})
    assert response.headers["X-Request-ID"] == "frontend-42.a_b"
    [line] = access_lines(caplog)
    assert line.startswith("method=GET path=/health status=200 duration_ms=")
    assert line.endswith(" request_id=frontend-42.a_b")


@pytest.mark.parametrize("unsafe", ["x" * 65, "two words", "back\\slash", 'quote"', ""])
def test_unsafe_or_missing_request_id_is_replaced(client, unsafe):
    headers = {"X-Request-ID": unsafe} if unsafe else {}
    response = client.get("/health", headers=headers)
    assert HEX_ID.fullmatch(response.headers["X-Request-ID"])


def test_one_access_line_per_request_even_for_early_413(client, caplog):
    with caplog.at_level(logging.INFO):
        response = client.post("/api/files/", files={"file": ("big.kml", b"<kml>" + b" " * 4 * 1024 * 1024)})
    assert response.status_code == 413
    assert HEX_ID.fullmatch(response.headers["X-Request-ID"])
    [line] = access_lines(caplog)
    assert line.startswith("method=POST path=/api/files/ status=413 ")


def test_request_id_is_exposed_to_browsers(client):
    response = client.get("/health", headers={"Origin": "http://localhost:5173"})
    assert "X-Request-ID" in response.headers["access-control-expose-headers"]


def test_processing_log_lines_include_the_file_id(client, upload, caplog):
    with caplog.at_level(logging.INFO):
        info = upload("p.kml", kml_document(placemark("P", kml_point((77.59, 12.97)))))
    lines = [r.getMessage() for r in caplog.records if r.name == "app.services.processor"]
    assert lines == [f"file_id={info['id']} processing started", f"file_id={info['id']} processed: 1 features"]
