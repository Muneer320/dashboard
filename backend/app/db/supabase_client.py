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
from urllib.parse import urlparse

from supabase import AsyncClient, create_async_client

from app.core.config import settings

_client: AsyncClient | None = None
_mirage_client: AsyncClient | None = None


def _normalize_supabase_url(url: str) -> str:
    normalized = url.strip().rstrip("/")
    if normalized.endswith("/rest/v1"):
        normalized = normalized[: -len("/rest/v1")]
    return normalized


async def _ensure_client() -> AsyncClient:
    """Create (or return cached) Supabase async client.

    Using the service-role key gives server-side code full access; RLS is still
    enforced at the database layer via policies in the migration SQL.
    """
    global _client
    if _client is None:
        url = _normalize_supabase_url(settings.SUPABASE_URL)
        if not url:
            raise RuntimeError(
                "SUPABASE_URL is empty. For local PostgREST dev, run the "
                "`postgrest` + `supabase-rest-proxy` services (see "
                "`docker-compose.override.yml`) and set SUPABASE_URL to "
                "`http://localhost:54321`."
            )
        parsed = urlparse(url)
        if parsed.scheme not in {"http", "https"}:
            raise RuntimeError(
                "SUPABASE_URL must start with http:// or https:// "
                f"(got: {settings.SUPABASE_URL!r})."
            )
        if not settings.SUPABASE_SERVICE_ROLE_KEY.strip():
            raise RuntimeError(
                "SUPABASE_SERVICE_ROLE_KEY is empty. Set it to either your Supabase "
                "service role key, or to a JWT accepted by your PostgREST gateway."
            )
        _client = await create_async_client(
            url,
            settings.SUPABASE_SERVICE_ROLE_KEY,
        )
    return _client


async def _ensure_mirage_client() -> AsyncClient:
    global _mirage_client
    if _mirage_client is None:
        base_url = _normalize_supabase_url(
            settings.MIRAGE_SUPABASE_URL or settings.SUPABASE_URL
        )
        if not base_url:
            raise RuntimeError("MIRAGE_SUPABASE_URL or SUPABASE_URL is empty.")
        _mirage_client = await create_async_client(
            base_url,
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
