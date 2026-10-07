FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Dependencies first, so this layer is cached when only source code changes.
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY docker-entrypoint.sh alembic.ini ./
COPY migrations ./migrations
COPY app ./app

# Run as an unprivileged user; it owns only the data directory.
RUN useradd --create-home --uid 1000 appuser && mkdir -p /app/data && chown appuser /app/data
USER appuser

# Listens on $PORT (Render sets it), 8000 by default.
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
    CMD python -c "import os, urllib.request; urllib.request.urlopen('http://localhost:%s/health' % os.environ.get('PORT', '8000'))" || exit 1

# Runs migrations, then execs uvicorn (see docker-entrypoint.sh).
ENTRYPOINT ["sh", "/app/docker-entrypoint.sh"]
