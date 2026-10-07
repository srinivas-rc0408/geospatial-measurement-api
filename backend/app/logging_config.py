"""Logging setup and the request-ID / access-log middleware.

Every request gets one log line:
    INFO app.access method=POST path=/api/files/ status=202 duration_ms=12.3 request_id=4f1c…
The request ID comes from the client's X-Request-ID header when it is safe to log, otherwise a new one is
generated; it is returned in the X-Request-ID response header so a client can quote it in a bug report.
"""

import logging
import re
import time
import uuid
from collections.abc import Awaitable, Callable

from fastapi import Request, Response

REQUEST_ID_HEADER = "X-Request-ID"
# Letters, digits and . _ - only (no spaces or newlines that could forge log lines), at most 64 characters.
_VALID_REQUEST_ID = re.compile(r"[A-Za-z0-9._-]{1,64}")

access_logger = logging.getLogger("app.access")


def configure_logging() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    # Our middleware writes one access line per request; uvicorn's own access log would duplicate it.
    logging.getLogger("uvicorn.access").disabled = True


def request_id_from(header_value: str | None) -> str:
    if header_value and _VALID_REQUEST_ID.fullmatch(header_value):
        return header_value
    return uuid.uuid4().hex


async def request_id_and_access_log(request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
    request_id = request_id_from(request.headers.get(REQUEST_ID_HEADER))
    start = time.perf_counter()
    status = 500  # logged if the app raises before producing a response
    try:
        response = await call_next(request)
        status = response.status_code
        response.headers[REQUEST_ID_HEADER] = request_id
        return response
    finally:
        access_logger.info(
            "method=%s path=%s status=%d duration_ms=%.1f request_id=%s",
            request.method,
            request.url.path,
            status,
            (time.perf_counter() - start) * 1000,
            request_id,
        )
