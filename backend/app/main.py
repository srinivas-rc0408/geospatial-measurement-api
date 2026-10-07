"""Application factory. Run with:  uvicorn app.main:create_app --factory --reload"""

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app import __version__
from app.api.files import router as files_router
from app.config import Settings, get_settings
from app.database import build_engine, build_session_factory
from app.services.errors import GeoFileError
from app.services.processor import fail_interrupted_jobs

logger = logging.getLogger("app")

DESCRIPTION = """
Upload a **Shapefile (.zip)** or **KML/KMZ** file and get, for every feature, its geometry,
CRS, attributes and measurements: **area** for polygons and **length** for lines, computed in
a local UTM projection (never in raw degrees) and cross-checked against geodesic values.
"""


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

    settings.storage_dir.mkdir(parents=True, exist_ok=True)
    # The schema is owned by Alembic migrations (`alembic upgrade head`), never created here.
    engine = build_engine(settings.database_url)
    session_factory = build_session_factory(engine)

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        if failed := fail_interrupted_jobs(session_factory):
            logger.warning("Marked %d interrupted job(s) as FAILED", failed)
        yield
        engine.dispose()

    app = FastAPI(
        title="Geospatial File Measurement API",
        version=__version__,
        description=DESCRIPTION,
        lifespan=lifespan,
    )
    app.state.settings = settings
    app.state.session_factory = session_factory

    @app.middleware("http")
    async def _reject_oversized_uploads(request: Request, call_next):
        """Refuse obviously oversized uploads from the Content-Length header, before the body is read."""
        length = request.headers.get("content-length")
        slack = 1024 * 1024  # multipart boundaries and headers
        if request.method == "POST" and length and length.isdigit() and int(length) > settings.max_upload_bytes + slack:
            return JSONResponse(
                status_code=413, content={"detail": f"File exceeds the {settings.max_upload_mb:g} MB upload limit."}
            )
        return await call_next(request)

    # Added last, so it is the outermost middleware: even early 413 responses carry CORS headers.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_methods=["GET", "POST", "DELETE"],
        allow_credentials=False,
    )

    @app.exception_handler(GeoFileError)
    async def _geo_file_error(_: Request, exc: GeoFileError) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.message})

    @app.get("/health", tags=["meta"], summary="Liveness check")
    def health() -> dict[str, str]:
        return {"status": "ok", "version": __version__}

    app.include_router(files_router)
    return app
