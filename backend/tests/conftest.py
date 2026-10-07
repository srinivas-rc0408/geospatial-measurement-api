import time

import pytest
from fastapi.testclient import TestClient

from app import models  # noqa: F401  (registers the tables on Base.metadata)
from app.config import Settings
from app.database import Base, build_engine
from app.main import create_app


@pytest.fixture
def database_url(tmp_path) -> str:
    """An empty database with the current schema. Built with create_all for speed;
    test_migrations.py proves the Alembic migrations produce the same schema."""
    url = f"sqlite:///{tmp_path / 'test.db'}"
    engine = build_engine(url)
    Base.metadata.create_all(engine)
    engine.dispose()
    return url


@pytest.fixture
def settings(tmp_path, database_url) -> Settings:
    return Settings(
        _env_file=None,  # never pick up a developer's backend/.env (e.g. a real database URL)
        database_url=database_url,
        storage_dir=tmp_path / "uploads",
        max_upload_mb=2,
        max_uncompressed_mb=5,
    )


@pytest.fixture
def client(settings):
    with TestClient(create_app(settings)) as c:
        yield c


@pytest.fixture
def upload(client):
    """Upload bytes and return the final file info (background task has finished)."""

    def _upload(filename: str, content: bytes, expected_status: int = 202) -> dict:
        response = client.post("/api/files/", files={"file": (filename, content)})
        assert response.status_code == expected_status, response.text
        if expected_status != 202:
            return response.json()
        file_id = response.json()["id"]
        for _ in range(50):  # TestClient runs background tasks before returning; poll defensively anyway
            info = client.get(f"/api/files/{file_id}").json()
            if info["status"] in ("COMPLETED", "FAILED"):
                return info
            time.sleep(0.05)
        raise AssertionError(f"File {file_id} did not finish processing")

    return _upload


def measurements(client, file_id: str) -> list[dict]:
    response = client.get(f"/api/files/{file_id}/measurements/")
    assert response.status_code == 200, response.text
    return response.json()["items"]
