#!/bin/sh
# Container start: bring the database schema up to date, then serve.
# exec replaces this shell with uvicorn, so stop signals (SIGTERM) reach the server directly.
set -e

alembic upgrade head

# $PORT is set by Render; 8000 locally. Proxy headers make request.url / client IP reflect the original
# request behind Render's load balancer (whose address is not fixed, hence '*').
exec uvicorn app.main:create_app --factory \
    --host 0.0.0.0 --port "${PORT:-8000}" \
    --proxy-headers --forwarded-allow-ips='*'
