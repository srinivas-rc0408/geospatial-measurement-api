"""Response models (the public API contract)."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.models import FileStatus, FileType, MeasurementStatus


class FileInfo(BaseModel):
    id: str
    filename: str
    file_type: FileType
    size_bytes: int
    status: FileStatus
    crs: str | None = Field(description="Source CRS of the file; 'MIXED' if layers differ.")
    feature_count: int | None
    geometry_types: dict[str, int] = Field(default_factory=dict, description="Feature count per geometry type.")
    bbox: list[float] | None = Field(
        default=None, description="[min_lon, min_lat, max_lon, max_lat] in EPSG:4326; null until processed or if empty."
    )
    total_area_m2: float | None = Field(
        default=None, description="Sum of the features' areas in m²; null until the file is COMPLETED."
    )
    total_length_m: float | None = Field(
        default=None, description="Sum of the features' lengths in m; null until the file is COMPLETED."
    )
    warnings: list[str] = Field(default_factory=list)
    error: str | None = Field(default=None, description="Why processing failed (status FAILED only).")
    created_at: datetime
    processed_at: datetime | None
    links: dict[str, str] = Field(default_factory=dict)


class FileList(BaseModel):
    total: int
    limit: int
    offset: int
    items: list[FileInfo]


class FeatureOut(BaseModel):
    feature_id: int = Field(description="0-based index of the feature in the file.")
    layer: str | None
    geometry_type: str | None
    crs: str | None
    geometry: dict | None = Field(description="GeoJSON geometry in the file's own CRS.")
    properties: dict


class FeatureList(BaseModel):
    file_id: str
    total: int
    limit: int
    offset: int
    items: list[FeatureOut]


class GeodesicCheck(BaseModel):
    area_m2: float | None = None
    length_m: float | None = None


class MeasurementOut(BaseModel):
    feature_id: int
    layer: str | None
    geometry_type: str | None
    status: MeasurementStatus
    measurement_crs: str | None = Field(description="Projected CRS the measurement was computed in.")
    area_m2: float | None = None
    area_hectares: float | None = None
    perimeter_m: float | None = None
    length_m: float | None = None
    length_km: float | None = None
    geodesic: GeodesicCheck | None = Field(
        default=None, description="Independent ellipsoidal (WGS84) measurement used as a cross-check."
    )
    messages: list[str] = Field(default_factory=list)


class MeasurementSummary(BaseModel):
    total_area_m2: float
    total_area_hectares: float
    total_length_m: float
    total_length_km: float
    by_status: dict[str, int]


class MeasurementList(BaseModel):
    file_id: str
    crs: str | None
    units: dict[str, str] = {"area": "square metres (m²)", "length": "metres (m)"}
    summary: MeasurementSummary
    total: int
    limit: int
    offset: int
    items: list[MeasurementOut]


class ClientConfig(BaseModel):
    max_upload_mb: float = Field(description="Largest accepted upload, in MB (1 MB = 1,048,576 bytes).")
    accepted_extensions: list[str] = Field(description="File extensions the upload endpoint accepts.")


class Health(BaseModel):
    status: Literal["ok"]
    version: str


class Readiness(BaseModel):
    status: Literal["ok", "unavailable"]
    database: Literal["ok", "unavailable"]


class ErrorResponse(BaseModel):
    detail: str
