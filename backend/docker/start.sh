#!/bin/sh
set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not set. Provide it via docker-compose env/.env before starting the backend container." >&2
  exit 1
fi

if [ "${WAIT_FOR_DB:-true}" = "true" ]; then
  python - <<'PY'
import asyncio
import os
from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import create_async_engine


def normalize_async_database_url(database_url: str) -> str:
    url = make_url(database_url)
    backend = url.get_backend_name()
    if "+asyncpg" not in url.drivername:
        url = url.set(drivername=f"{backend}+asyncpg")
    return str(url)


async def wait_for_db() -> None:
    database_url = normalize_async_database_url(os.environ["DATABASE_URL"])
    engine = create_async_engine(database_url, pool_pre_ping=True)
    try:
        for attempt in range(1, 31):
            try:
                async with engine.connect() as connection:
                    await connection.execute(text("SELECT 1"))
                print("Database is ready.")
                return
            except Exception as exc:  # pragma: no cover - startup helper
                print(f"Waiting for database (attempt {attempt}/30): {exc}")
                await asyncio.sleep(2)
    finally:
        await engine.dispose()
    raise SystemExit("Database did not become ready in time.")


asyncio.run(wait_for_db())
PY
fi

if [ "${RUN_DB_INIT:-false}" = "true" ]; then
  python -c "from app.db.init_db import run; run()"
fi

exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
