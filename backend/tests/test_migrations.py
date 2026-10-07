"""The Alembic migrations must build exactly the schema the models describe."""

from pathlib import Path

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
