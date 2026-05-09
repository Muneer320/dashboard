from __future__ import annotations

import json
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import asyncpg

from app.core.config import settings

_pool: asyncpg.Pool | None = None


def _mirage_database_url() -> str | None:
    return settings.MIRAGE_DATABASE_URL or settings.DATABASE_URL


async def get_mirage_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        database_url = _mirage_database_url()
        if not database_url:
            raise RuntimeError("MIRAGE_DATABASE_URL or DATABASE_URL is not configured.")
        _pool = await asyncpg.create_pool(
            dsn=database_url,
            min_size=1,
            max_size=5,
            command_timeout=30,
            init=_init_connection,
        )
    return _pool


async def _init_connection(connection: asyncpg.Connection) -> None:
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
async def mirage_connection() -> AsyncIterator[asyncpg.Connection]:
    pool = await get_mirage_pool()
    async with pool.acquire() as connection:
        yield connection
