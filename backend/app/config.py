"""Application settings, loaded from environment variables (prefix ``GEO_``) or a ``.env`` file."""

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="GEO_", extra="ignore")

    # Runtime database. On Neon this is the pooled URL (host contains "-pooler").
    database_url: str = "sqlite:///./data/geo.db"
    # Alembic needs a direct (unpooled) connection on Neon; falls back to database_url.
    migrations_database_url: str | None = None
    storage_dir: Path = Path("./data/uploads")

    # Upload limits. The uncompressed limit protects against ZIP bombs.
    max_upload_mb: float = Field(default=50, gt=0)
    max_uncompressed_mb: float = Field(default=500, gt=0)
    max_archive_members: int = Field(default=500, gt=0)

    # A Shapefile without a .prj has no CRS. If every coordinate fits inside
    # lon/lat bounds we assume EPSG:4326 and record a warning; otherwise the
    # features are not measured, because guessing a projected CRS is unsafe.
    assume_wgs84_when_crs_missing: bool = True

    # Per client IP: at most this many uploads in any window (0 disables). Answered with 429 + Retry-After.
    upload_rate_limit: int = Field(default=20, ge=0)
    upload_rate_window_seconds: float = Field(default=600, gt=0)

    # Projected vs geodesic difference (in %) above which a warning is attached.
    measurement_divergence_warning_pct: float = Field(default=0.5, gt=0)

    # Browser origins allowed to call the API from another origin, comma-separated. Empty by default: in
    # production the API serves the frontend itself (same origin), and in development Vite proxies /api.
    # Set it only for a frontend hosted elsewhere. Never "*".
    cors_origins: str = ""

    # Directory with the built frontend (index.html, assets/); served when it exists. None: API only.
    frontend_dist: Path | None = None
    # Public origin of the site (e.g. https://geo-measure.onrender.com) for absolute link-preview URLs.
    # None: taken from each request's scheme and host (behind Render's proxy, from its forwarded headers).
    public_url: str | None = None

    @property
    def migrations_url(self) -> str:
        return self.migrations_database_url or self.database_url

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def max_upload_bytes(self) -> int:
        return int(self.max_upload_mb * 1024 * 1024)

    @property
    def max_uncompressed_bytes(self) -> int:
        return int(self.max_uncompressed_mb * 1024 * 1024)


@lru_cache
def get_settings() -> Settings:
    return Settings()
