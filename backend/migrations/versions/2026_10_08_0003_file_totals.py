"""Store each file's total area and length on geo_files, so file lists need no per-file query.

Existing COMPLETED files are backfilled from their features; other files keep NULL (no totals yet).

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-08 12:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("geo_files", sa.Column("total_area_m2", sa.Float(), nullable=True))
    op.add_column("geo_files", sa.Column("total_length_m", sa.Float(), nullable=True))
    # Correlated subqueries: the same SQL works on SQLite and PostgreSQL.
    op.execute(
        """
        UPDATE geo_files SET
            total_area_m2 = (SELECT COALESCE(SUM(area_m2), 0) FROM features WHERE features.file_id = geo_files.id),
            total_length_m = (SELECT COALESCE(SUM(length_m), 0) FROM features WHERE features.file_id = geo_files.id)
        WHERE status = 'COMPLETED'
        """
    )


def downgrade() -> None:
    # batch mode: SQLite cannot drop columns in place on older versions.
    with op.batch_alter_table("geo_files") as batch:
        batch.drop_column("total_length_m")
        batch.drop_column("total_area_m2")
