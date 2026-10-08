"""HTTP endpoints under /api/files/."""

from collections.abc import Iterator
from datetime import UTC, datetime
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Query, Request, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import Settings
from app.models import Feature, FileStatus, GeoFile, MeasurementStatus, new_id
from app.schemas import (
    ErrorResponse,
    FeatureList,
    FeatureOut,
    FileInfo,
    FileList,
    GeodesicCheck,
    MeasurementList,
    MeasurementOut,
    MeasurementSummary,
)
from app.services.errors import GeoFileError
from app.services.processor import process_file
from app.services.readers import extension_of, inspect_upload
from app.services.storage import clean_filename, save_upload

router = APIRouter(prefix="/api/files", tags=["files"])

PAGE_LIMIT = Query(100, ge=1, le=1000, description="Page size.")
PAGE_OFFSET = Query(0, ge=0, description="Number of items to skip.")


def get_db(request: Request) -> Iterator[Session]:
    with request.app.state.session_factory() as session:
        yield session


def get_settings(request: Request) -> Settings:
    return request.app.state.settings


def _get_file(db: Session, file_id: str) -> GeoFile:
    geo_file = db.get(GeoFile, file_id)
    if geo_file is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"File '{file_id}' not found.")
    return geo_file


def _require_completed(geo_file: GeoFile) -> None:
    if geo_file.status == FileStatus.COMPLETED:
        return
    if geo_file.status == FileStatus.FAILED:
        detail = f"File processing failed: {geo_file.error}"
    else:
        detail = f"File is still {geo_file.status.value}; poll GET /api/files/{geo_file.id} until COMPLETED."
    raise HTTPException(status.HTTP_409_CONFLICT, detail)


def _utc(value: datetime | None) -> datetime | None:
    """SQLite drops timezone info; every timestamp we store is UTC, so re-attach it."""
    if value is not None and value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value


def _r(value: float | None, digits: int) -> float | None:
    return None if value is None else round(value, digits)


def _file_info(db: Session, geo_file: GeoFile) -> FileInfo:
    counts = db.execute(
        select(Feature.geometry_type, func.count())
        .where(Feature.file_id == geo_file.id)
        .group_by(Feature.geometry_type)
    ).all()
    base = f"/api/files/{geo_file.id}"
    return FileInfo(
        id=geo_file.id,
        filename=geo_file.filename,
        file_type=geo_file.file_type,
        size_bytes=geo_file.size_bytes,
        status=geo_file.status,
        crs=geo_file.crs,
        feature_count=geo_file.feature_count,
        geometry_types={(gtype or "None"): n for gtype, n in counts},
        bbox=geo_file.bbox,
        total_area_m2=_r(geo_file.total_area_m2, 3),
        total_length_m=_r(geo_file.total_length_m, 3),
        warnings=geo_file.warnings or [],
        error=geo_file.error,
        created_at=_utc(geo_file.created_at),
        processed_at=_utc(geo_file.processed_at),
        links={
            "self": base,
            "features": f"{base}/features/",
            "measurements": f"{base}/measurements/",
            "geojson": f"{base}/geojson/",
        },
    )


def _measurement(f: Feature) -> MeasurementOut:
    geodesic = None
    if f.geodesic_area_m2 is not None or f.geodesic_length_m is not None:
        geodesic = GeodesicCheck(area_m2=_r(f.geodesic_area_m2, 3), length_m=_r(f.geodesic_length_m, 3))
    return MeasurementOut(
        feature_id=f.feature_index,
        layer=f.layer,
        geometry_type=f.geometry_type,
        status=f.measurement_status,
        measurement_crs=f.measurement_crs,
        area_m2=_r(f.area_m2, 3),
        area_hectares=_r(f.area_m2 / 10_000 if f.area_m2 is not None else None, 6),
        perimeter_m=_r(f.perimeter_m, 3),
        length_m=_r(f.length_m, 3),
        length_km=_r(f.length_m / 1000 if f.length_m is not None else None, 6),
        geodesic=geodesic,
        messages=f.messages or [],
    )


_ERRORS = {
    404: {"model": ErrorResponse, "description": "File not found."},
    409: {"model": ErrorResponse, "description": "File not processed yet, or processing failed."},
}


@router.post(
    "/",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=FileInfo,
    summary="Upload a geospatial file",
    responses={
        413: {"model": ErrorResponse, "description": "File too large."},
        415: {"model": ErrorResponse, "description": "Unsupported file type."},
        422: {"model": ErrorResponse, "description": "File is corrupt or incomplete."},
    },
)
def upload_file(
    background_tasks: BackgroundTasks,
    request: Request,
    file: UploadFile = File(..., description="A .zip containing a Shapefile, or a .kml / .kmz file."),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> FileInfo:
    """Validates the upload synchronously, then reads and measures it in the background.

    A plain ``def`` on purpose: FastAPI runs it in a worker thread, so the blocking disk and
    database I/O below never stalls the event loop.

    Returns **202 Accepted** with `status: PENDING`. Poll `GET /api/files/{id}` until
    `COMPLETED` (or `FAILED`, with the reason in `error`).
    """
    filename = clean_filename(file.filename)
    ext = extension_of(filename)  # reject wrong types before writing anything to disk

    file_id = new_id()
    # Stored under a server-generated name: the client's filename never touches the filesystem.
    path = settings.storage_dir / f"{file_id}{ext}"
    size = save_upload(file, path, settings.max_upload_bytes)
    try:
        file_type = inspect_upload(path, filename, settings)
    except GeoFileError:
        path.unlink(missing_ok=True)
        raise

    geo_file = GeoFile(id=file_id, filename=filename, file_type=file_type, size_bytes=size, storage_path=str(path))
    db.add(geo_file)
    db.commit()

    background_tasks.add_task(process_file, geo_file.id, request.app.state.session_factory, settings)
    return _file_info(db, geo_file)


@router.get("/", response_model=FileList, summary="List uploaded files")
def list_files(
    status_filter: FileStatus | None = Query(None, alias="status"),
    limit: int = PAGE_LIMIT,
    offset: int = PAGE_OFFSET,
    db: Session = Depends(get_db),
) -> FileList:
    query = select(GeoFile)
    if status_filter is not None:
        query = query.where(GeoFile.status == status_filter)
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    files = db.scalars(query.order_by(GeoFile.created_at.desc()).limit(limit).offset(offset)).all()
    return FileList(total=total, limit=limit, offset=offset, items=[_file_info(db, f) for f in files])


@router.get("/{file_id}", response_model=FileInfo, summary="File information and status", responses=_ERRORS)
def get_file(file_id: str, db: Session = Depends(get_db)) -> FileInfo:
    return _file_info(db, _get_file(db, file_id))


@router.get("/{file_id}/features/", response_model=FeatureList, summary="Extracted features", responses=_ERRORS)
def list_features(
    file_id: str,
    geometry_type: str | None = Query(None, description="Filter, e.g. Polygon."),
    limit: int = PAGE_LIMIT,
    offset: int = PAGE_OFFSET,
    db: Session = Depends(get_db),
) -> FeatureList:
    """Every feature with its index, geometry type, geometry (source CRS), CRS and properties."""
    geo_file = _get_file(db, file_id)
    _require_completed(geo_file)
    query = select(Feature).where(Feature.file_id == file_id)
    if geometry_type:
        query = query.where(Feature.geometry_type == geometry_type)
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    rows = db.scalars(query.order_by(Feature.feature_index).limit(limit).offset(offset)).all()
    items = [
        FeatureOut(
            feature_id=f.feature_index,
            layer=f.layer,
            geometry_type=f.geometry_type,
            crs=f.crs,
            geometry=f.geometry,
            properties=f.properties or {},
        )
        for f in rows
    ]
    return FeatureList(file_id=file_id, total=total, limit=limit, offset=offset, items=items)


@router.get(
    "/{file_id}/measurements/", response_model=MeasurementList, summary="Feature measurements", responses=_ERRORS
)
def list_measurements(
    file_id: str,
    measurement_status: MeasurementStatus | None = Query(None, alias="status"),
    limit: int = PAGE_LIMIT,
    offset: int = PAGE_OFFSET,
    db: Session = Depends(get_db),
) -> MeasurementList:
    """Area (polygons) and length (lines) per feature, plus file-wide totals.

    The summary always covers the whole file, independent of pagination and filters.
    """
    geo_file = _get_file(db, file_id)
    _require_completed(geo_file)

    total_area, total_length = db.execute(
        select(func.coalesce(func.sum(Feature.area_m2), 0.0), func.coalesce(func.sum(Feature.length_m), 0.0)).where(
            Feature.file_id == file_id
        )
    ).one()
    status_counts = dict(
        db.execute(
            select(Feature.measurement_status, func.count())
            .where(Feature.file_id == file_id)
            .group_by(Feature.measurement_status)
        ).all()
    )
    summary = MeasurementSummary(
        total_area_m2=round(total_area, 3),
        total_area_hectares=round(total_area / 10_000, 6),
        total_length_m=round(total_length, 3),
        total_length_km=round(total_length / 1000, 6),
        by_status={s.value: status_counts.get(s, 0) for s in MeasurementStatus},
    )

    query = select(Feature).where(Feature.file_id == file_id)
    if measurement_status is not None:
        query = query.where(Feature.measurement_status == measurement_status)
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    rows = db.scalars(query.order_by(Feature.feature_index).limit(limit).offset(offset)).all()
    return MeasurementList(
        file_id=file_id,
        crs=geo_file.crs,
        summary=summary,
        total=total,
        limit=limit,
        offset=offset,
        items=[_measurement(f) for f in rows],
    )


@router.get("/{file_id}/geojson/", summary="Export as GeoJSON (EPSG:4326) with measurements", responses=_ERRORS)
def export_geojson(file_id: str, db: Session = Depends(get_db)) -> dict:
    """RFC 7946 FeatureCollection. Drop it into geojson.io or QGIS to see features with their measurements."""
    geo_file = _get_file(db, file_id)
    _require_completed(geo_file)
    features = []
    for f in geo_file.features:
        measured = _measurement(f).model_dump(exclude={"feature_id", "layer", "geodesic"})
        properties = {**(f.properties or {}), "_feature_id": f.feature_index, "_layer": f.layer}
        properties.update({f"_{key}": value for key, value in measured.items()})
        features.append(
            {"type": "Feature", "id": f.feature_index, "geometry": f.geometry_wgs84, "properties": properties}
        )
    return {"type": "FeatureCollection", "name": geo_file.filename, "features": features}


@router.delete("/{file_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete a file", responses=_ERRORS)
def delete_file(file_id: str, db: Session = Depends(get_db)) -> None:
    geo_file = _get_file(db, file_id)
    if geo_file.status == FileStatus.PROCESSING:
        raise HTTPException(status.HTTP_409_CONFLICT, "File is being processed; try again shortly.")
    path = geo_file.storage_path
    db.delete(geo_file)
    db.commit()
    if path:
        Path(path).unlink(missing_ok=True)
