"""The backend serves the built frontend (same origin) when GEO_FRONTEND_DIST points at a build."""

import pytest
from fastapi.testclient import TestClient

from app.main import create_app

INDEX = """<!doctype html><html><head>
<meta property="og:url" content="__PUBLIC_URL__/" />
<meta property="og:image" content="__PUBLIC_URL__/og-image.png" />
<meta name="twitter:image" content="__PUBLIC_URL__/og-image.png" />
</head><body><div id="root"></div></body></html>"""


@pytest.fixture
def dist(tmp_path):
    root = tmp_path / "dist"
    (root / "assets").mkdir(parents=True)
    (root / "index.html").write_text(INDEX, encoding="utf-8")
    (root / "assets" / "index-abc123.js").write_text("console.info('app')", encoding="utf-8")
    (root / "favicon.svg").write_text("<svg/>", encoding="utf-8")
    (root / "manifest.webmanifest").write_text("{}", encoding="utf-8")
    (root / "samples").mkdir()
    (root / "samples" / "site.kml").write_text("<kml/>", encoding="utf-8")
    (tmp_path / "secret.txt").write_text("outside the build", encoding="utf-8")
    return root


def site(settings, dist, **overrides) -> TestClient:
    return TestClient(create_app(settings.model_copy(update={"frontend_dist": dist, **overrides})))


def test_assets_are_cached_for_a_year(settings, dist):
    with site(settings, dist) as client:
        response = client.get("/assets/index-abc123.js")
    assert response.status_code == 200
    assert response.headers["cache-control"] == "public, max-age=31536000, immutable"
    assert "javascript" in response.headers["content-type"]


def test_other_root_files_are_cached_for_a_day(settings, dist):
    with site(settings, dist) as client:
        for path, content_type in [
            ("/favicon.svg", "image/svg+xml"),
            ("/manifest.webmanifest", "application/manifest+json"),
            ("/samples/site.kml", "application/vnd.google-earth.kml+xml"),
        ]:
            response = client.get(path)
            assert response.status_code == 200, path
            assert response.headers["cache-control"] == "public, max-age=86400"
            assert response.headers["content-type"].startswith(content_type)


@pytest.mark.parametrize("path", ["/", "/files", "/files/9f69fdac523d4233a88b21b0ca504506", "/no/such/page"])
def test_client_routes_get_index_html_uncached(settings, dist, path):
    with site(settings, dist) as client:
        response = client.get(path)
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/html")
    assert response.headers["cache-control"] == "no-cache"
    assert '<div id="root">' in response.text


def test_api_routes_take_precedence(settings, dist):
    with site(settings, dist) as client:
        assert client.get("/health").json()["status"] == "ok"
        assert client.get("/api/files/").json()["total"] == 0
        assert client.get("/api/config").json()["accepted_extensions"] == [".zip", ".kml", ".kmz"]
        assert client.get("/openapi.json").json()["info"]["title"] == "Geospatial File Measurement API"
        assert client.get("/docs").headers["content-type"].startswith("text/html")


@pytest.mark.parametrize(
    ("method", "path"),
    [("get", "/api/nope"), ("post", "/api/nope"), ("get", "/api"), ("get", "/health/nope"), ("get", "/docs/nope")],
)
def test_unknown_api_paths_are_json_404_never_the_app(settings, dist, method, path):
    with site(settings, dist) as client:
        response = client.request(method.upper(), path)
    assert response.status_code == 404
    assert response.json() == {"detail": "Not found."}


def test_missing_asset_is_404_not_the_app(settings, dist):
    with site(settings, dist) as client:
        assert client.get("/assets/index-old999.js").status_code == 404


def test_files_outside_the_build_are_never_served(settings, dist):
    with site(settings, dist) as client:
        response = client.get("/..%2Fsecret.txt")
    assert "outside the build" not in response.text


def test_link_preview_urls_come_from_the_request(settings, dist):
    with site(settings, dist) as client:
        page = client.get("/", headers={"host": "geo.example.com"}).text
    assert 'content="http://geo.example.com/og-image.png"' in page
    assert "__PUBLIC_URL__" not in page


def test_link_preview_urls_honour_forwarded_scheme_behind_a_proxy(settings, dist):
    """Uvicorn's --proxy-headers rewrites the scheme from X-Forwarded-Proto; simulate its result."""
    with site(settings, dist) as client:
        page = client.get("https://geo.example.com/files").text
    assert 'content="https://geo.example.com/og-image.png"' in page


def test_configured_public_url_wins(settings, dist):
    with site(settings, dist, public_url="https://geo-measure-api.onrender.com/") as client:
        page = client.get("/", headers={"host": "internal:10000"}).text
    assert 'content="https://geo-measure-api.onrender.com/"' in page
    assert 'content="https://geo-measure-api.onrender.com/og-image.png"' in page


def test_hostile_host_header_is_escaped(settings, dist):
    with site(settings, dist) as client:
        page = client.get("/", headers={"host": 'x"><script>alert(1)</script>'}).text
    assert "<script>alert(1)</script>" not in page


def test_without_a_build_only_the_api_is_served(settings, tmp_path):
    for dist in (None, tmp_path / "missing"):
        with TestClient(create_app(settings.model_copy(update={"frontend_dist": dist}))) as client:
            assert client.get("/").status_code == 404
            assert client.get("/files").status_code == 404
            assert client.get("/health").status_code == 200


def test_text_responses_are_gzipped_for_clients_that_accept_it(settings, dist):
    (dist / "assets" / "big-def456.js").write_text("console.info('app');\n" * 500, encoding="utf-8")
    with site(settings, dist) as client:
        compressed = client.get("/assets/big-def456.js", headers={"Accept-Encoding": "gzip"})
        plain = client.get("/assets/big-def456.js", headers={"Accept-Encoding": "identity"})
    assert compressed.headers["content-encoding"] == "gzip"
    assert compressed.text == plain.text  # the client decompresses transparently
    assert "content-encoding" not in plain.headers
