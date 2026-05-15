from __future__ import annotations

import json
import logging
from collections.abc import Awaitable, Callable
from typing import Any

from fastapi import Request, Response
from fastapi_cache import FastAPICache
from fastapi_cache.backends.inmemory import InMemoryBackend

from app.core.config import settings

try:
    from fastapi_cache.backends.redis import RedisBackend
    from redis import asyncio as redis_asyncio
except Exception:  # pragma: no cover - optional at runtime
    RedisBackend = None
    redis_asyncio = None

logger = logging.getLogger(__name__)

_redis_client = None


def auth_aware_cache_key_builder(
    func: Callable[..., Any],
    namespace: str = "",
    *,
    request: Request | None = None,
    response: Response | None = None,
    **kwargs: Any,
) -> str:
    del response
    path = request.url.path if request is not None else func.__name__
    query = request.url.query if request is not None else ""

    subject = "public"
    if request is not None:
        payload = getattr(request.state, "token_payload", None) or {}
        token_sub = payload.get("sub")
        if token_sub:
            subject = str(token_sub)

    current_user = kwargs.get("current_user")
    if current_user is not None and getattr(current_user, "id", None) is not None:
        subject = str(current_user.id)

    admin = kwargs.get("admin")
    if admin is not None and getattr(admin, "uid", None) is not None:
        subject = f"admin:{admin.uid}"

    prefix = namespace or settings.CACHE_PREFIX
    return f"{prefix}:{func.__module__}.{func.__name__}:{subject}:{path}?{query}"


async def init_cache_backend() -> str:
    global _redis_client

    if settings.REDIS_URL and RedisBackend is not None and redis_asyncio is not None:
        try:
            _redis_client = redis_asyncio.from_url(
                settings.REDIS_URL,
                encoding="utf-8",
                decode_responses=False,
                socket_connect_timeout=settings.REDIS_SOCKET_CONNECT_TIMEOUT_SECONDS,
            )
            await _redis_client.ping()
            FastAPICache.init(RedisBackend(_redis_client), prefix=settings.CACHE_PREFIX)
            return "redis"
        except Exception as exc:  # pragma: no cover - external dependency
            logger.warning(
                "Redis cache init failed. Falling back to in-memory cache. Error: %s",
                exc,
            )

    FastAPICache.init(InMemoryBackend(), prefix=settings.CACHE_PREFIX)
    return "in-memory"


async def shutdown_cache_backend() -> None:
    global _redis_client

    if _redis_client is not None:
        await _redis_client.aclose()
        _redis_client = None


async def cache_get_json(key: str) -> Any | None:
    try:
        backend = FastAPICache.get_backend()
    except Exception:
        return None
    if backend is None:
        return None

    raw = await backend.get(key)
    if raw is None:
        return None

    if isinstance(raw, (bytes, bytearray)):
        return json.loads(raw.decode("utf-8"))
    if isinstance(raw, str):
        return json.loads(raw)
    return raw


async def cache_set_json(key: str, value: Any, ttl_seconds: int) -> None:
    try:
        backend = FastAPICache.get_backend()
    except Exception:
        return
    if backend is None:
        return

    payload = json.dumps(value, separators=(",", ":"), default=str).encode("utf-8")
    await backend.set(key, payload, expire=ttl_seconds)


async def get_or_set_json(
    key: str,
    ttl_seconds: int,
    fetcher: Callable[[], Awaitable[Any]],
) -> Any:
    cached = await cache_get_json(key)
    if cached is not None:
        return cached

    fresh = await fetcher()
    await cache_set_json(key, fresh, ttl_seconds=ttl_seconds)
    return fresh
