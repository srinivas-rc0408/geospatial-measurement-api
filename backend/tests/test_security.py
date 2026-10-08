"""Security headers on every response, the Content-Security-Policy, and the per-IP upload rate limit."""

import re

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.security import UploadRateLimit, inline_script_hashes
from tests.factories import kml_document, kml_point, placemark

THEME_SCRIPT = "document.documentElement.dataset.theme = 'dark'"
INDEX = f"""<!doctype html><html><head><script>{THEME_SCRIPT}</script>
<script type="module" crossorigin src="/assets/index-abc.js"></script></head><body></body></html>"""
KML = kml_document(placemark("P", kml_point((77.5, 12.9))))


def directive(policy: str, name: str) -> str:
    match = re.search(rf"(?:^|; ){name} ([^;]*)", policy)
    assert match, f"{name} missing from {policy}"
    return match.group(1)


@pytest.fixture
def site(settings, tmp_path):
    dist = tmp_path / "dist"
    dist.mkdir()
    (dist / "index.html").write_text(INDEX, encoding="utf-8")
    with TestClient(create_app(settings.model_copy(update={"frontend_dist": dist}))) as client:
        yield client


@pytest.mark.parametrize("path", ["/health", "/api/files/", "/api/files/unknown", "/", "/files/abc"])
def test_every_response_has_the_security_headers(site, path):
    headers = site.get(path).headers
    assert headers["x-content-type-options"] == "nosniff"
    assert headers["referrer-policy"] == "strict-origin-when-cross-origin"
    assert headers["permissions-policy"] == "camera=(), microphone=(), geolocation=()"
    assert "content-security-policy" in headers


def test_early_413_has_the_security_headers(client):
    response = client.post("/api/files/", content=b"x", headers={"content-length": str(50 * 1024 * 1024)})
    assert response.status_code == 413
    assert response.headers["x-content-type-options"] == "nosniff"


def test_hsts_only_over_https(settings):
    app = create_app(settings)
    with TestClient(app) as plain, TestClient(app, base_url="https://testserver") as secure:
        assert "strict-transport-security" not in plain.get("/health").headers
        assert secure.get("/health").headers["strict-transport-security"].startswith("max-age=31536000")


def test_site_policy_allows_the_theme_script_by_hash_and_never_unsafe_inline_scripts(site):
    policy = site.get("/").headers["content-security-policy"]
    scripts = directive(policy, "script-src")
    assert inline_script_hashes(INDEX)[0] in scripts
    assert "'unsafe-inline'" not in scripts and "'unsafe-eval'" not in scripts
    assert "https://tiles.openfreemap.org" in directive(policy, "connect-src")
    assert "blob:" in directive(policy, "worker-src")
    assert directive(policy, "frame-ancestors") == "'none'"


def test_inline_script_hash_is_the_csp_sha256_of_its_text():
    # Reference value: printf %s "<script text>" | openssl dgst -sha256 -binary | base64
    assert inline_script_hashes("<script>alert(1)</script>") == [
        "'sha256-bhHHL3z2vDgxUt0W3dWQOrprscmda2Y5pLsLg4GF+pI='"
    ]
    assert inline_script_hashes('<script src="/a.js"></script>') == []


def test_docs_page_runs_under_its_own_policy(client):
    response = client.get("/docs")
    assert response.status_code == 200
    policy = response.headers["content-security-policy"]
    scripts = directive(policy, "script-src")
    assert "https://cdn.jsdelivr.net" in scripts
    assert inline_script_hashes(response.text)[0] in scripts  # the Swagger UI bootstrap script
    assert "'unsafe-inline'" not in scripts
    assert "validator.swagger.io" not in response.text and '"validatorUrl": null' in response.text


def test_uploads_over_the_limit_get_429_with_retry_after(settings):
    limited = settings.model_copy(update={"upload_rate_limit": 2})
    with TestClient(create_app(limited)) as client:
        for _ in range(2):
            assert client.post("/api/files/", files={"file": ("p.kml", KML)}).status_code == 202
        response = client.post("/api/files/", files={"file": ("p.kml", KML)})
    assert response.status_code == 429
    assert 0 < int(response.headers["retry-after"]) <= 600
    assert response.json()["detail"] == (
        "Too many uploads from your network: the limit is 2 every 10 minutes. Try again in 10 minutes."
    )
    assert response.headers["x-content-type-options"] == "nosniff"


def test_rate_limit_zero_disables_it(settings):
    with TestClient(create_app(settings.model_copy(update={"upload_rate_limit": 0}))) as client:
        for _ in range(3):
            assert client.post("/api/files/", files={"file": ("p.kml", KML)}).status_code == 202


def test_rate_limit_window_slides_and_is_per_address():
    now = [1000.0]
    limit = UploadRateLimit(limit=2, window_seconds=60, clock=lambda: now[0])
    assert limit.retry_after("1.1.1.1") is None
    now[0] += 30
    assert limit.retry_after("1.1.1.1") is None
    assert limit.retry_after("1.1.1.1") == 30  # the first upload leaves the window in 30 s
    assert limit.retry_after("2.2.2.2") is None  # another address has its own budget
    now[0] += 30
    assert limit.retry_after("1.1.1.1") is None  # the first upload has left the window
