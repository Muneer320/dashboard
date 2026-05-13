from __future__ import annotations

import json
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import asyncpg

from app.core.config import settings

_pool: asyncpg.Pool | None = None


async def get_pool() -> asyncpg.Pool:
    """
    Primary Postgres pool.

    This is intentionally tiny and only used as a fallback path when the
    PostgREST/Supabase HTTP layer is unavailable but the backend can still
    reach Postgres directly (for example in AWS/VPC deployments).
    """

    global _pool
    if _pool is None:
        if not settings.DATABASE_URL:
            raise RuntimeError("DATABASE_URL is not configured.")
        _pool = await asyncpg.create_pool(
            dsn=settings.DATABASE_URL,
            min_size=1,
            max_size=5,
            command_timeout=30,
            init=_init_connection,
        )
    return _pool


async def _init_connection(connection: asyncpg.Connection) -> None:
    # Keep parity with app/db/mirage_postgres.py so JSON/JSONB round-trips as dicts.
    await connection.set_type_codec(
        "jsonb",
        schema="pg_catalog",
        encoder=lambda value: json.dumps(value),
        decoder=lambda value: json.loads(value),
        format="text",
    )
    await connection.set_type_codec(
        "json",
        schema="pg_catalog",
        encoder=lambda value: json.dumps(value),
        decoder=lambda value: json.loads(value),
        format="text",
    )


@asynccontextmanager
async def db_connection() -> AsyncIterator[asyncpg.Connection]:
    pool = await get_pool()
    async with pool.acquire() as connection:
        yield connection

