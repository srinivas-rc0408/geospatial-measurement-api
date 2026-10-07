"""Initial schema: geo_files (one row per upload) and features (one row per feature).

Revision ID: 0001
Revises:
Create Date: 2026-10-07 16:16:41.414610
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Same as app.models.JSONType: JSONB on PostgreSQL, JSON text on SQLite.
JSON = sa.JSON().with_variant(postgresql.JSONB(), "postgresql")


def _enum(name: str, *values: str) -> sa.Enum:
    # Stored as VARCHAR(16) (native_enum=False), so adding a value later needs no ALTER TYPE.
    return sa.Enum(*values, name=name, native_enum=False, length=16)


def upgrade() -> None:
    op.create_table(
        "geo_files",
        sa.Column("id", sa.String(length=32), nullable=False),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("file_type", _enum("filetype", "SHAPEFILE", "KML", "KMZ"), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("storage_path", sa.String(length=1024), nullable=False),
        sa.Column("status", _enum("filestatus", "PENDING", "PROCESSING", "COMPLETED", "FAILED"), nullable=False),
        sa.Column("crs", sa.String(length=255), nullable=True),
        sa.Column("feature_count", sa.Integer(), nullable=True),
        sa.Column("bbox", JSON, nullable=True),
        sa.Column("warnings", JSON, nullable=False),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_geo_files")),
    )
    op.create_index(op.f("ix_geo_files_status"), "geo_files", ["status"])

    op.create_table(
        "features",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("file_id", sa.String(length=32), nullable=False),
        sa.Column("feature_index", sa.Integer(), nullable=False),
        sa.Column("layer", sa.String(length=255), nullable=True),
        sa.Column("geometry_type", sa.String(length=64), nullable=True),
        sa.Column("crs", sa.String(length=255), nullable=True),
        sa.Column("geometry", JSON, nullable=True),
        sa.Column("geometry_wgs84", JSON, nullable=True),
        sa.Column("properties", JSON, nullable=False),
        sa.Column(
            "measurement_status",
            _enum("measurementstatus", "MEASURED", "NOT_APPLICABLE", "UNSUPPORTED", "FAILED"),
            nullable=False,
        ),
        sa.Column("measurement_crs", sa.String(length=64), nullable=True),
        sa.Column("area_m2", sa.Float(), nullable=True),
        sa.Column("perimeter_m", sa.Float(), nullable=True),
        sa.Column("length_m", sa.Float(), nullable=True),
        sa.Column("geodesic_area_m2", sa.Float(), nullable=True),
        sa.Column("geodesic_length_m", sa.Float(), nullable=True),
        sa.Column("messages", JSON, nullable=False),
        sa.ForeignKeyConstraint(
            ["file_id"], ["geo_files.id"], name=op.f("fk_features_file_id_geo_files"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_features")),
        sa.UniqueConstraint("file_id", "feature_index", name=op.f("uq_features_file_id_feature_index")),
    )
    op.create_index(op.f("ix_features_file_id"), "features", ["file_id"])
    op.create_index(op.f("ix_features_geometry_type"), "features", ["geometry_type"])
    op.create_index(op.f("ix_features_measurement_status"), "features", ["measurement_status"])


def downgrade() -> None:
    # Dropping a table drops its indexes and constraints with it.
    op.drop_table("features")
    op.drop_table("geo_files")
