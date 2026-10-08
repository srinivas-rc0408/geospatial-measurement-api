"""Serves the built frontend (a single-page app) from the same origin as the API.

Mounted last, so every API route takes precedence. For a GET that no API route matched:
- a file in the build is returned (hashed /assets/* cached for a year, other files for a day);
- an unknown path under an API prefix (/api, /health, /docs, /redoc) or under /assets gets a 404, never the app;
- anything else is a client-side route and gets index.html, uncached, with absolute link-preview URLs.
"""

import html
import mimetypes
from pathlib import Path

from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import FileResponse, HTMLResponse

# index.html carries this in og:url, og:image and twitter:image; crawlers need absolute URLs.
PUBLIC_URL_PLACEHOLDER = "__PUBLIC_URL__"
API_PREFIXES = {"api", "health", "docs", "redoc"}
ASSETS_CACHE = "public, max-age=31536000, immutable"  # content-hashed names: a new build means new URLs
FILE_CACHE = "public, max-age=86400"  # favicon, manifest, OG image, robots.txt, samples
INDEX_CACHE = "no-cache"  # always revalidate, so a deploy is picked up at once

mimetypes.add_type("application/manifest+json", ".webmanifest")
mimetypes.add_type("application/vnd.google-earth.kml+xml", ".kml")
mimetypes.add_type("application/xml", ".xml")  # sitemap.xml; hosts disagree (text/xml vs application/xml)


def frontend_router(dist: Path, public_url: str | None) -> APIRouter:
    dist = dist.resolve()
    index_template = (dist / "index.html").read_text(encoding="utf-8")
    router = APIRouter(include_in_schema=False)

    def index(request: Request) -> HTMLResponse:
        origin = (public_url or f"{request.url.scheme}://{request.url.netloc}").rstrip("/")
        # The Host header is client-controlled: escape it before it goes into an HTML attribute.
        page = index_template.replace(PUBLIC_URL_PLACEHOLDER, html.escape(origin, quote=True))
        return HTMLResponse(page, headers={"Cache-Control": INDEX_CACHE})

    # Every method, so an unknown API path answers 404 whatever the method (not 405 from a GET-only route).
    @router.api_route("/{path:path}", methods=["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"])
    def frontend(path: str, request: Request):
        first = path.split("/", 1)[0]
        if first in API_PREFIXES or path == "openapi.json":
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found.")
        if request.method not in ("GET", "HEAD"):
            raise HTTPException(status.HTTP_405_METHOD_NOT_ALLOWED, "Method not allowed.")
        if path in ("", "index.html"):
            return index(request)
        candidate = (dist / path).resolve()
        if candidate.is_relative_to(dist) and candidate.is_file():  # never serve outside the build
            cache = ASSETS_CACHE if first == "assets" else FILE_CACHE
            return FileResponse(candidate, headers={"Cache-Control": cache})
        if first == "assets":  # a stale hashed URL: answering with HTML would break the script that asked
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found.")
        return index(request)

    return router
