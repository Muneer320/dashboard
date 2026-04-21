#!/bin/sh
set -eu

if [ -z "${SUPABASE_URL:-}" ]; then
  echo "SUPABASE_URL is not set. Provide it via docker-compose env/.env before starting the backend container." >&2
  exit 1
fi

if [ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
  echo "SUPABASE_SERVICE_ROLE_KEY is not set. Provide it via docker-compose env/.env before starting the backend container." >&2
  exit 1
fi

if [ "${RUN_DB_INIT:-false}" = "true" ]; then
  echo "RUN_DB_INIT=true was requested, but schema creation is no longer handled via local SQLAlchemy init. Skipping."
fi

exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
