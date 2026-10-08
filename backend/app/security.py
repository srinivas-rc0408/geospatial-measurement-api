"""Security response headers (CSP and friends) and the per-IP upload rate limit."""

import base64
import hashlib
import math
import re
import threading
import time
from collections import defaultdict, deque
from collections.abc import Awaitable, Callable

from fastapi import HTTPException, Request, Response, status

TILES = "https://tiles.openfreemap.org"  # basemap styles, tiles, sprites and label fonts
CDN = "https://cdn.jsdelivr.net"  # Swagger UI and ReDoc bundles
DOCS_PATHS = ("/docs", "/redoc")

_INLINE_SCRIPT = re.compile(r"<script>(.*?)</script>", re.DOTALL)

STATIC_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
}
HSTS = "max-age=31536000; includeSubDomains"


def inline_script_hashes(page: str) -> list[str]:
    """CSP sources ('sha256-…') for each inline <script> in a page, so they run without 'unsafe-inline'."""
    return [
        f"'sha256-{base64.b64encode(hashlib.sha256(script.encode()).digest()).decode()}'"
        for script in _INLINE_SCRIPT.findall(page)
    ]


def _policy(*directives: str) -> str:
    return "; ".join(
        [*directives, "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'"]
    )


def app_csp(script_hashes: list[str]) -> str:
    """The site's policy: its own files, OpenFreeMap for the map, blob: workers for MapLibre.

    Styles allow 'unsafe-inline' because React, Motion and MapLibre set style attributes; scripts never do —
    the one inline script (the no-flash theme switch in index.html) is allowed by its hash.
    """
    return _policy(
        "default-src 'self'",
        " ".join(["script-src 'self'", *script_hashes]),
        "style-src 'self' 'unsafe-inline'",
        f"img-src 'self' data: blob: {TILES}",
        "font-src 'self'",
        f"connect-src 'self' {TILES}",
        "worker-src 'self' blob:",
    )


def docs_csp(script_hashes: list[str]) -> str:
    """Swagger UI and ReDoc load their bundles from a CDN, ReDoc its fonts from Google Fonts."""
    return _policy(
        "default-src 'self'",
        " ".join([f"script-src 'self' {CDN}", *script_hashes]),
        f"style-src 'self' 'unsafe-inline' {CDN} https://fonts.googleapis.com",
        "img-src 'self' data: https://fastapi.tiangolo.com",
        "font-src 'self' https://fonts.gstatic.com",
        "connect-src 'self'",
        "worker-src 'self' blob:",
    )


def security_headers(
    site_policy: str, docs_policy: str
) -> Callable[[Request, Callable[[Request], Awaitable[Response]]], Awaitable[Response]]:
    """Middleware adding the security headers to every response, including errors."""

    async def middleware(request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
        response = await call_next(request)
        response.headers.update(STATIC_HEADERS)
        docs = request.url.path in DOCS_PATHS
        response.headers["Content-Security-Policy"] = docs_policy if docs else site_policy
        # HSTS over plain HTTP is ignored by browsers and would only confuse local development.
        if request.url.scheme == "https":
            response.headers["Strict-Transport-Security"] = HSTS
        return response

    return middleware


class UploadRateLimit:
    """At most `limit` uploads per client IP in any `window_seconds` (a sliding window).

    The client IP is what uvicorn's --proxy-headers derives from X-Forwarded-For behind Render's proxy.
    ponytail: in memory, one process, reset on restart, and a client that forges X-Forwarded-For can
    dodge it. It is an abuse brake for a free demo, not access control; Redis + a trusted-proxy hop
    count if the API ever runs on several instances or needs a hard guarantee.
    """

    def __init__(self, limit: int, window_seconds: float, clock: Callable[[], float] = time.monotonic) -> None:
        self.limit = limit
        self.window = window_seconds
        self.clock = clock
        self._hits: defaultdict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()  # uploads are handled in worker threads

    def retry_after(self, key: str) -> int | None:
        """Record an upload for `key`; return the seconds to wait if it is over the limit, else None."""
        now = self.clock()
        with self._lock:
            hits = self._hits[key]
            while hits and hits[0] <= now - self.window:
                hits.popleft()
            if len(hits) >= self.limit:
                return max(1, math.ceil(hits[0] + self.window - now))
            hits.append(now)
            return None

    def __call__(self, request: Request) -> None:
        """FastAPI dependency for the upload route: raises 429 with Retry-After when over the limit."""
        if self.limit == 0:  # disabled
            return
        wait = self.retry_after(request.client.host if request.client else "unknown")
        if wait is not None:
            minutes = math.ceil(wait / 60)
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS,
                f"Too many uploads from your network: the limit is {self.limit} every "
                f"{self.window / 60:g} minutes. Try again in {minutes} minute{'s' if minutes != 1 else ''}.",
                headers={"Retry-After": str(wait)},
            )
