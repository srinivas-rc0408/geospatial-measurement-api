"""Health endpoints: liveness (/health) for the platform, readiness (/health/ready) for the database."""

import asyncio
import logging

from fastapi import APIRouter, Request, Response, status
from sqlalchemy import Engine, text

from app import __version__
from app.schemas import Health, Readiness

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/health", tags=["meta"])

READY_TIMEOUT_SECONDS = 5.0


def _ping(engine: Engine) -> None:
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))


@router.get("", response_model=Health, summary="Liveness check")
def health() -> Health:
    """Is the process up? Never touches the database: Render polls this, and a database query on every poll
    would keep Neon's compute awake (it scales to zero when idle)."""
    return Health(status="ok", version=__version__)


@router.get(
    "/ready",
    response_model=Readiness,
    summary="Readiness check (database)",
    responses={503: {"model": Readiness, "description": "Database unavailable or too slow (> 5 s)."}},
)
async def ready(request: Request, response: Response) -> Readiness:
    """Runs `SELECT 1` against the database with a 5 s limit. Wakes Neon's compute if it is suspended."""
    try:
        # In a worker thread: the query blocks. The timeout also covers connecting to a suspended database.
        await asyncio.wait_for(asyncio.to_thread(_ping, request.app.state.engine), READY_TIMEOUT_SECONDS)
    except Exception as exc:
        # Only the exception type: messages can contain host names or connection strings.
        logger.warning("Readiness check failed: %s", type(exc).__name__)
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return Readiness(status="unavailable", database="unavailable")
    return Readiness(status="ok", database="ok")
