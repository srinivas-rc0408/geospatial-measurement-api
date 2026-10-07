"""Alembic environment: migrate the database configured in app settings to the models' schema.

The URL comes from ``sqlalchemy.url`` when a caller sets it (the migration test does), otherwise from
settings: GEO_MIGRATIONS_DATABASE_URL (Neon's direct connection), falling back to GEO_DATABASE_URL.
"""

from logging.config import fileConfig

from alembic import context

from app import models  # noqa: F401  (registers the tables on Base.metadata)
from app.config import get_settings
from app.database import Base, build_engine

config = context.config
if config.config_file_name is not None:
    # Keep the application's loggers working when migrations run inside the app's process (tests).
    fileConfig(config.config_file_name, disable_existing_loggers=False)


def run_migrations() -> None:
    url = config.get_main_option("sqlalchemy.url") or get_settings().migrations_url
    engine = build_engine(url)
    try:
        with engine.connect() as connection:
            context.configure(
                connection=connection,
                target_metadata=Base.metadata,
                compare_type=True,
                # SQLite cannot ALTER most things in place; batch mode rebuilds the table instead.
                render_as_batch=connection.dialect.name == "sqlite",
            )
            with context.begin_transaction():
                context.run_migrations()
    finally:
        engine.dispose()


run_migrations()
