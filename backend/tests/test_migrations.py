"""The Alembic migrations must build exactly the schema the models describe."""

from pathlib import Path

import pytest
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from sqlalchemy import text

from app import models  # noqa: F401  (registers the tables on Base.metadata)
from app.database import Base, build_engine
from tests.conftest import TEST_DATABASE_URL

ALEMBIC_INI = Path(__file__).resolve().parents[1] / "alembic.ini"


def test_migrations_match_models(tmp_path):
    url = TEST_DATABASE_URL or f"sqlite:///{tmp_path / 'migrated.db'}"
    engine = build_engine(url)
    if TEST_DATABASE_URL:  # a shared database: start from empty
        Base.metadata.drop_all(engine)
        with engine.begin() as connection:
            connection.execute(text("DROP TABLE IF EXISTS alembic_version"))

    config = Config(ALEMBIC_INI)
    config.set_main_option("sqlalchemy.url", url.replace("%", "%%"))  # ini values interpolate '%'
    command.upgrade(config, "head")

    with engine.connect() as connection:
        context = MigrationContext.configure(connection, opts={"compare_type": True})
        diff = compare_metadata(context, Base.metadata)
    engine.dispose()
    assert diff == []


def test_migration_0003_backfills_totals_of_completed_files(tmp_path):
    url = TEST_DATABASE_URL or f"sqlite:///{tmp_path / 'backfill.db'}"
    engine = build_engine(url)
    if TEST_DATABASE_URL:
        Base.metadata.drop_all(engine)
        with engine.begin() as connection:
            connection.execute(text("DROP TABLE IF EXISTS alembic_version"))
    config = Config(ALEMBIC_INI)
    config.set_main_option("sqlalchemy.url", url.replace("%", "%%"))
    command.upgrade(config, "0002")

    with engine.begin() as connection:
        for file_id, status in [("done", "COMPLETED"), ("waiting", "PENDING")]:
            connection.execute(
                text(
                    "INSERT INTO geo_files (id, filename, file_type, size_bytes, storage_path, status, warnings,"
                    " created_at) VALUES (:id, 'a.kml', 'KML', 1, 'x', :status, '[]', CURRENT_TIMESTAMP)"
                ),
                {"id": file_id, "status": status},
            )
        for index, (area, length) in enumerate([(100.5, None), (None, 20.25), (49.5, None), (None, None)]):
            connection.execute(
                text(
                    "INSERT INTO features (file_id, feature_index, properties, measurement_status, area_m2,"
                    " length_m, messages) VALUES ('done', :i, '{}', 'MEASURED', :area, :length, '[]')"
                ),
                {"i": index, "area": area, "length": length},
            )

    command.upgrade(config, "head")
    with engine.connect() as connection:
        rows = connection.execute(text("SELECT id, total_area_m2, total_length_m FROM geo_files"))
        totals = {row.id: (row.total_area_m2, row.total_length_m) for row in rows}
    engine.dispose()
    assert totals["done"] == pytest.approx((150.0, 20.25))
    assert totals["waiting"] == (None, None)
