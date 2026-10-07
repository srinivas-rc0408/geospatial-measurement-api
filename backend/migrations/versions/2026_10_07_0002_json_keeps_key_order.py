"""Store JSON columns as json instead of jsonb on PostgreSQL, so attribute key order is preserved.

jsonb re-orders object keys; json keeps the text as written. SQLite stores both as JSON text, so this
migration changes nothing there. Rows already stored as jsonb keep jsonb's key order after the cast.

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-07 18:05:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

JSON_COLUMNS = {
    "geo_files": ("bbox", "warnings"),
    "features": ("geometry", "geometry_wgs84", "properties", "messages"),
}


def _convert(from_type: sa.types.TypeEngine, to_type: sa.types.TypeEngine, cast: str) -> None:
    if op.get_bind().dialect.name != "postgresql":
        return
    for table, columns in JSON_COLUMNS.items():
        for column in columns:
            op.alter_column(table, column, existing_type=from_type, type_=to_type, postgresql_using=f"{column}::{cast}")


def upgrade() -> None:
    _convert(postgresql.JSONB(), sa.JSON(), "json")


def downgrade() -> None:
    _convert(sa.JSON(), postgresql.JSONB(), "jsonb")
