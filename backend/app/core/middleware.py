from __future__ import annotations

from collections.abc import Callable

from fastapi import Request, status
from fastapi.responses import JSONResponse
from jose import JWTError, jwt
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from app.core.config import settings
from app.db.supabase_client import get_client
from app.services.rate_limit_service import allow_rate_limited_action


RATE_LIMIT_DISABLED_STATE_NAME = "disable_rate_limit_checks"

PUBLIC_PATHS = {
    "/api/v1/health",
    "/api/v1/auth/login",
    "/api/v1/auth/admin/login",
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
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"detail": "Not authenticated"},
            )

        try:
            payload = jwt.decode(
                token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM]
            )
        except JWTError:
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"detail": "Invalid or expired token"},
            )

        role = payload.get("role")
        request.state.token_payload = payload

        if path.startswith("/api/v1/admin") and role != "admin":
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={"detail": "Admin role required"},
            )

        # Scanner / QR access — role values match AdminRole enum
        _scanner_roles = {"Scanner", "eventManager", "admin"}
        if (
            path.startswith("/api/v1/qr")
            or path.endswith("/participants")
        ) and role not in _scanner_roles:
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={"detail": "Scanner role required"},
            )

        # QR rate limiting via Supabase
        if path.startswith("/api/v1/qr") and not getattr(
            request.app.state, RATE_LIMIT_DISABLED_STATE_NAME, False
        ):
            limiter_key = self._rate_limit_key(request, token, path)
            supabase = await get_client()
            allowed = await allow_rate_limited_action(
                supabase=supabase,
                rate_key=limiter_key,
                limit=settings.QR_RATE_LIMIT_PER_MINUTE,
                window_seconds=settings.QR_RATE_LIMIT_WINDOW_SECONDS,
            )
            if not allowed:
                return JSONResponse(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    content={"detail": "Rate limit exceeded"},
                )

        return await call_next(request)

    def _extract_token(self, request: Request) -> str | None:
        authorization = request.headers.get("authorization")
        if not authorization:
            return None
        scheme, _, token = authorization.partition(" ")
        if scheme.lower() != "bearer" or not token:
            return None
        return token

    def _rate_limit_key(self, request: Request, token: str, path: str) -> str:
        client_host = request.client.host if request.client else "unknown"
        return f"{client_host}:{token}:{path}"
