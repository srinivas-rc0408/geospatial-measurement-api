"""Database engine and session factory (SQLite locally and in tests, PostgreSQL/Neon in production)."""

from pathlib import Path

import psycopg
from sqlalchemy import Engine, MetaData, create_engine, event, make_url
from sqlalchemy.orm import DeclarativeBase, sessionmaker

# Deterministic constraint and index names, identical on every database, so migrations can refer to them.
NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_N_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)


def build_engine(database_url: str) -> Engine:
    if make_url(database_url).get_backend_name() == "sqlite":
        return _sqlite_engine(database_url)
    return _postgres_engine(database_url)


def _sqlite_engine(database_url: str) -> Engine:
    # The DB file's folder must exist before SQLite can create the file.
    db_path = make_url(database_url).database
    if db_path and db_path != ":memory:":
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    # Uploads are processed in a worker thread, so the connection is shared across threads.
    engine = create_engine(database_url, connect_args={"check_same_thread": False})

    @event.listens_for(engine, "connect")
    def _sqlite_pragmas(dbapi_connection, _record) -> None:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")  # enforce ON DELETE CASCADE
        cursor.execute("PRAGMA journal_mode=WAL")  # readers don't block the writer
        cursor.close()

    return engine


def _postgres_engine(database_url: str) -> Engine:
    connect_args: dict = {"connect_timeout": 10}
    # Neon's PgBouncer (1.22+, max_prepared_statements=1000) supports psycopg's protocol-level prepared
    # statements, but only with libpq 17+ on the client. Turn them off if this install's libpq is older.
    if not psycopg.capabilities.has_send_close_prepared():
        connect_args["prepare_threshold"] = None
    return create_engine(
        database_url,
        connect_args=connect_args,
        pool_pre_ping=True,  # Neon closes idle connections when compute scales to zero
        pool_recycle=300,
        pool_size=5,
        max_overflow=5,
    )


def build_session_factory(engine: Engine) -> sessionmaker:
    return sessionmaker(bind=engine, expire_on_commit=False)
