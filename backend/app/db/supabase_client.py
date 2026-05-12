"""
Supabase async client factory.

This module replaces the old SQLAlchemy session layer. Every service now talks
to Postgres through supabase-py's PostgREST transport.

`get_supabase` is the FastAPI dependency injected into routes in place of the
old `get_db_session`. Services receive the async client directly and issue
calls like `await supabase.table("users").select("*").eq("id", uid).execute()`.
"""

from __future__ import annotations

from collections.abc import AsyncGenerator
from typing import Any

from supabase import AsyncClient, create_async_client

from app.core.config import settings

_client: AsyncClient | None = None
_mirage_client: AsyncClient | None = None


async def _ensure_client() -> AsyncClient:
    """Create (or return cached) Supabase async client.

    Using the service-role key gives server-side code full access; RLS is still
    enforced at the database layer via policies in the migration SQL.
    """
    global _client
    if _client is None:
        _client = await create_async_client(
            settings.SUPABASE_URL,
            settings.SUPABASE_SERVICE_ROLE_KEY,
        )
    return _client


async def _ensure_mirage_client() -> AsyncClient:
    global _mirage_client
    if _mirage_client is None:
        _mirage_client = await create_async_client(
            settings.MIRAGE_SUPABASE_URL or settings.SUPABASE_URL,
            settings.MIRAGE_SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_SERVICE_ROLE_KEY,
        )
    return _mirage_client


async def get_supabase() -> AsyncGenerator[AsyncClient, None]:
    """FastAPI dependency yielding the shared Supabase async client."""
    client = await _ensure_client()
    yield client


async def get_client() -> AsyncClient:
    """Direct accessor for background tasks / places that can't use DI."""
    return await _ensure_client()


async def get_mirage_supabase() -> AsyncGenerator[AsyncClient, None]:
    client = await _ensure_mirage_client()
    yield client


async def get_mirage_client() -> AsyncClient:
    return await _ensure_mirage_client()


def rows(response: Any) -> list[dict]:
    """Convenience: pull the data list off a PostgREST response."""
    return list(response.data or [])


def first_row(response: Any) -> dict | None:
    """Convenience: first row of a PostgREST response, or None."""
    data = response.data or []
    return data[0] if data else None
