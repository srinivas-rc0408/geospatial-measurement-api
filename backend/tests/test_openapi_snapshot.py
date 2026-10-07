"""The committed openapi.json must match the app, so the frontend's generated types never drift."""

from scripts.export_openapi import OUT, render_schema


def test_committed_openapi_snapshot_is_current():
    assert OUT.read_text(encoding="utf-8") == render_schema(), (
        "backend/openapi.json is out of date. Regenerate it from backend/ with: python -m scripts.export_openapi"
    )
