"""Liveness must never touch the database; readiness must, and must fail closed without leaking details."""

import time

from sqlalchemy import event

from app import __version__
from app.api import health
from app.database import build_engine


def test_liveness_does_not_open_a_database_connection(client):
    engine = client.app.state.engine
    checkouts: list[object] = []

    def record(*_args) -> None:
        checkouts.append(object())

    event.listen(engine, "checkout", record)
    try:
        response = client.get("/health")
    finally:
        event.remove(engine, "checkout", record)
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "version": __version__}
    assert checkouts == []


def test_readiness_ok(client):
    response = client.get("/health/ready")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok"}


def test_readiness_503_when_database_is_down(client):
    # Nothing listens on port 1, so the connection is refused at once.
    client.app.state.engine = build_engine("postgresql+psycopg://geo:s3cret@127.0.0.1:1/geo")
    response = client.get("/health/ready")
    assert response.status_code == 503
    assert response.json() == {"status": "unavailable", "database": "unavailable"}
    assert "s3cret" not in response.text and "127.0.0.1" not in response.text


def test_readiness_503_when_database_is_too_slow(client, monkeypatch):
    monkeypatch.setattr(health, "READY_TIMEOUT_SECONDS", 0.05)
    monkeypatch.setattr(health, "_ping", lambda _engine: time.sleep(0.5))
    response = client.get("/health/ready")
    assert response.status_code == 503
    assert response.json()["database"] == "unavailable"
