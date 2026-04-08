from __future__ import annotations

from collections.abc import Callable
from datetime import datetime, timezone

from fastapi import Request, status
from fastapi.responses import JSONResponse
from jose import JWTError, jwt
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from app.core.config import settings

RATE_LIMIT_WINDOW_SECONDS = 60
RATE_LIMIT_BUCKETS: dict[str, list[float]] = {}

PUBLIC_PATHS = {
    "/api/v1/health",
    "/api/v1/auth/login",
    "/api/v1/auth/register",
    "/api/v1/openapi.json",
    "/docs",
    "/redoc",
}


class AccessControlMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)

    async def dispatch(self, request: Request, call_next: Callable):
        path = request.url.path
        if path in PUBLIC_PATHS:
            return await call_next(request)

        if path.startswith("/api/v1/files/"):
            return await call_next(request)

        token = self._extract_token(request)
        if token is None:
            return JSONResponse(status_code=status.HTTP_401_UNAUTHORIZED, content={"detail": "Not authenticated"})

        try:
            payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        except JWTError:
            return JSONResponse(status_code=status.HTTP_401_UNAUTHORIZED, content={"detail": "Invalid or expired token"})

        role = payload.get("role")
        request.state.token_payload = payload

        if path.startswith("/api/v1/admin") and role != "admin":
            return JSONResponse(status_code=status.HTTP_403_FORBIDDEN, content={"detail": "Admin role required"})

        if (path.startswith("/api/v1/qr") or path.endswith("/participants")) and role not in {"scanner", "admin"}:
            return JSONResponse(status_code=status.HTTP_403_FORBIDDEN, content={"detail": "Scanner role required"})

        if path.startswith("/api/v1/qr"):
            limiter_key = self._rate_limit_key(request, token)
            if not self._allow_request(limiter_key):
                return JSONResponse(status_code=status.HTTP_429_TOO_MANY_REQUESTS, content={"detail": "Rate limit exceeded"})

        return await call_next(request)

    def _extract_token(self, request: Request) -> str | None:
        authorization = request.headers.get("authorization")
        if not authorization:
            return None
        scheme, _, token = authorization.partition(" ")
        if scheme.lower() != "bearer" or not token:
            return None
        return token

    def _rate_limit_key(self, request: Request, token: str) -> str:
        client_host = request.client.host if request.client else "unknown"
        return f"{client_host}:{token}"

    def _allow_request(self, key: str) -> bool:
        now = datetime.now(timezone.utc).timestamp()
        window_start = now - RATE_LIMIT_WINDOW_SECONDS
        entries = [timestamp for timestamp in RATE_LIMIT_BUCKETS.get(key, []) if timestamp >= window_start]
        if len(entries) >= settings.QR_RATE_LIMIT_PER_MINUTE:
            RATE_LIMIT_BUCKETS[key] = entries
            return False
        entries.append(now)
        RATE_LIMIT_BUCKETS[key] = entries
        return True
