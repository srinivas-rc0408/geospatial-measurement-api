"""GET /api/config: limits the browser needs before uploading, so they are defined once (here)."""

from fastapi import APIRouter, Request

from app.schemas import ClientConfig
from app.services.readers import ALLOWED_EXTENSIONS

router = APIRouter(prefix="/api", tags=["meta"])


@router.get("/config", response_model=ClientConfig, summary="Upload limits for clients")
def client_config(request: Request) -> ClientConfig:
    """The upload size limit and accepted file extensions, so a client can check a file before sending it."""
    settings = request.app.state.settings
    return ClientConfig(max_upload_mb=settings.max_upload_mb, accepted_extensions=list(ALLOWED_EXTENSIONS))
