"""Application factory. Run with:  uvicorn app.main:create_app --factory --reload"""

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.responses import HTMLResponse, JSONResponse

from app import __version__
from app.api.config import router as config_router
from app.api.files import router as files_router
from app.api.frontend import frontend_router
from app.api.health import router as health_router
from app.config import Settings, get_settings
from app.database import build_engine, build_session_factory
from app.logging_config import REQUEST_ID_HEADER, configure_logging, request_id_and_access_log
from app.security import UploadRateLimit, app_csp, docs_csp, inline_script_hashes, security_headers
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
    configure_logging()

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
        docs_url=None,  # served below, so the page's inline script has a known CSP hash
    )
    app.state.settings = settings
    app.state.engine = engine
    app.state.session_factory = session_factory
    app.state.upload_rate_limit = UploadRateLimit(settings.upload_rate_limit, settings.upload_rate_window_seconds)

    # The validator badge would load an image from validator.swagger.io; the API needs no such check.
    docs_page = get_swagger_ui_html(
        openapi_url="/openapi.json", title=f"{app.title} - Swagger UI", swagger_ui_parameters={"validatorUrl": None}
    ).body.decode()

    @app.get("/docs", include_in_schema=False)
    def swagger_ui() -> HTMLResponse:
        return HTMLResponse(docs_page)

    dist = settings.frontend_dist
    has_frontend = dist is not None and (dist / "index.html").is_file()
    index_page = (dist / "index.html").read_text(encoding="utf-8") if has_frontend and dist else ""

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

    app.middleware("http")(
        security_headers(app_csp(inline_script_hashes(index_page)), docs_csp(inline_script_hashes(docs_page)))
    )
    # The frontend bundle and JSON compress 3-4x; with no CDN in front, the app compresses them itself.
    app.add_middleware(GZipMiddleware, minimum_size=1024)
    # Middleware added later wraps the earlier ones. Order, outside in: CORS → request ID + access log → gzip →
    # security headers → size check, so even early 413 responses get a request ID, an access-log line, CORS
    # and security headers.
    app.middleware("http")(request_id_and_access_log)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_methods=["GET", "POST", "DELETE"],
        allow_credentials=False,
        expose_headers=[REQUEST_ID_HEADER],
    )

    @app.exception_handler(GeoFileError)
    async def _geo_file_error(_: Request, exc: GeoFileError) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.message})

    app.include_router(health_router)
    app.include_router(files_router)
    app.include_router(config_router)
    # Last: its catch-all route must never shadow an API route.
    if has_frontend and dist:
        app.include_router(frontend_router(dist, settings.public_url))
    elif dist is not None:
        logger.warning("GEO_FRONTEND_DIST=%s has no index.html; serving the API only", dist)
    return app
