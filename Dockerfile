# The deploy image: the frontend build served by the API, one container, one origin.
# backend/Dockerfile is the API-only image (no frontend).

# --- Stage 1: build the frontend ------------------------------------------------------------------
FROM node:24-slim AS frontend
WORKDIR /frontend
# Dependencies first, so this layer is cached when only source code changes.
COPY frontend/package.json frontend/package-lock.json frontend/.npmrc ./
RUN npm ci
COPY frontend/ ./
# Empty: the app calls the API on its own origin.
ENV VITE_API_BASE_URL=
RUN npm run build

# --- Stage 2: the API, serving that build ---------------------------------------------------------
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Same steps as backend/Dockerfile up to here, so the two images share the dependency layer.
COPY backend/requirements.txt .
RUN pip install -r requirements.txt

COPY backend/docker-entrypoint.sh backend/alembic.ini ./
COPY backend/migrations ./migrations
COPY backend/app ./app
COPY --from=frontend /frontend/dist ./frontend_dist
ENV GEO_FRONTEND_DIST=/app/frontend_dist

# Run as an unprivileged user; it owns only the data directory.
RUN useradd --create-home --uid 1000 appuser && mkdir -p /app/data && chown appuser /app/data
USER appuser

# Listens on $PORT (Render sets it), 8000 by default.
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
    CMD python -c "import os, urllib.request; urllib.request.urlopen('http://localhost:%s/health' % os.environ.get('PORT', '8000'))" || exit 1

# Runs migrations, then execs uvicorn with proxy headers (see backend/docker-entrypoint.sh).
ENTRYPOINT ["sh", "/app/docker-entrypoint.sh"]
