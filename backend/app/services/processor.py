"""Background job: read the stored upload, measure every feature, persist the results.

Status lifecycle:  PENDING ──► PROCESSING ──► COMPLETED
                                         └──► FAILED  (file-level problem, message in ``error``)
Feature-level problems never fail the file; they are recorded per feature.
"""

import logging
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy.orm import Session, sessionmaker

from app.config import Settings
from app.models import Feature, FileStatus, GeoFile, MeasurementStatus
from app.services.crs import crs_label
from app.services.errors import GeoFileError
from app.services.measurement import GeometryMeasurer, MeasurementResult
from app.services.readers import read_datasets
from app.services.readers.base import Dataset, ProblemKind, RawFeature

logger = logging.getLogger(__name__)

_PROBLEM_STATUS = {
    ProblemKind.INVALID: MeasurementStatus.FAILED,
    ProblemKind.UNSUPPORTED: MeasurementStatus.UNSUPPORTED,
}


def _to_row(file_id: str, index: int, crs: str | None, raw: RawFeature, result: MeasurementResult) -> Feature:
    return Feature(
        file_id=file_id,
        feature_index=index,
        layer=raw.layer,
        geometry_type=result.geometry_type or raw.geometry_type,
        crs=crs,
        geometry=raw.geometry,
        geometry_wgs84=result.geometry_wgs84,
        properties=raw.properties,
        measurement_status=result.status,
        measurement_crs=result.measurement_crs,
        area_m2=result.area_m2,
        perimeter_m=result.perimeter_m,
        length_m=result.length_m,
        geodesic_area_m2=result.geodesic_area_m2,
        geodesic_length_m=result.geodesic_length_m,
        messages=result.messages,
    )


def _build_rows(file_id: str, datasets: list[Dataset], settings: Settings) -> list[Feature]:
    rows: list[Feature] = []
    for dataset in datasets:
        measurer = GeometryMeasurer(dataset.crs, settings.measurement_divergence_warning_pct)
        label = crs_label(dataset.crs)
        for raw in dataset.features:
            if raw.problem_kind is not None:
                result = MeasurementResult(_PROBLEM_STATUS[raw.problem_kind], raw.geometry_type, messages=[raw.problem])
            else:
                result = measurer.measure(raw.geometry)
            rows.append(_to_row(file_id, len(rows), label, raw, result))
    return rows


def _file_crs(datasets: list[Dataset]) -> str | None:
    labels = {crs_label(d.crs) for d in datasets if d.crs is not None}
    if len(labels) > 1:
        return "MIXED"
    return labels.pop() if labels else None


def _finish(db: Session, geo_file: GeoFile, status: FileStatus, error: str | None = None) -> None:
    geo_file.status = status
    geo_file.error = error
    geo_file.processed_at = datetime.now(UTC)
    db.commit()


def process_file(file_id: str, session_factory: sessionmaker, settings: Settings) -> None:
    with session_factory() as db:
        geo_file = db.get(GeoFile, file_id)
        if geo_file is None or geo_file.status != FileStatus.PENDING:
            return  # deleted meanwhile, or already picked up
        geo_file.status = FileStatus.PROCESSING
        db.commit()

        try:
            datasets = read_datasets(Path(geo_file.storage_path), geo_file.file_type, geo_file.filename, settings)
            rows = _build_rows(geo_file.id, datasets, settings)
            db.add_all(rows)
            geo_file.crs = _file_crs(datasets)
            geo_file.feature_count = len(rows)
            geo_file.warnings = [w for d in datasets for w in d.warnings]
            if geo_file.crs == "MIXED":
                geo_file.warnings.append("Layers use different CRSs; see each feature's 'crs'.")
            _finish(db, geo_file, FileStatus.COMPLETED)
            logger.info("Processed file %s: %d features", geo_file.id, len(rows))
        except GeoFileError as exc:
            db.rollback()
            _finish(db, geo_file, FileStatus.FAILED, exc.message)
            logger.info("File %s rejected: %s", geo_file.id, exc.message)
        except Exception:
            db.rollback()
            logger.exception("Unexpected error while processing file %s", file_id)
            _finish(db, geo_file, FileStatus.FAILED, "Internal error while processing the file.")


def fail_interrupted_jobs(session_factory: sessionmaker) -> int:
    """On startup, jobs left PENDING/PROCESSING by a crash or restart can never finish — mark them FAILED."""
    with session_factory() as db:
        stuck = db.query(GeoFile).filter(GeoFile.status.in_([FileStatus.PENDING, FileStatus.PROCESSING])).all()
        for geo_file in stuck:
            _finish(
                db, geo_file, FileStatus.FAILED, "Processing was interrupted by a server restart. Please re-upload."
            )
        return len(stuck)
