"""
FastAPI dependencies.

The old SQLAlchemy `get_db_session` has been retired; every route now takes
a Supabase `AsyncClient` via `get_supabase`. The auth dependencies here
query the relevant tables through the SDK.
"""

from __future__ import annotations

import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from supabase import AsyncClient

from app.core.security import TokenError, decode_access_token
from app.db.supabase_client import first_row, get_supabase
from app.models.admin import Admin
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

# Roles allowed to perform scanning / gate management
_SCANNER_ROLES = {"Scanner", "eventManager", "admin"}


async def get_current_user(
    supabase: AsyncClient = Depends(get_supabase),
    token: str = Depends(oauth2_scheme),
) -> User:
    try:
        payload = decode_access_token(token)
        user_id = payload.get("sub")
    except TokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

    try:
        user_uuid = uuid.UUID(user_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Invalid token payload") from exc

    resp = await (
        supabase.table("users")
        .select("*")
        .eq("id", str(user_uuid))
        .limit(1)
        .execute()
    )
    row = first_row(resp)
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    return User.from_row(row)


async def get_current_admin(
    supabase: AsyncClient = Depends(get_supabase),
    token: str = Depends(oauth2_scheme),
) -> Admin:
    """Dependency that requires an admin JWT (issued via POST /auth/admin/login)."""
    try:
        payload = decode_access_token(token)
        sub = payload.get("sub", "")
    except TokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

    if not sub.startswith("admin:"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin credentials required",
        )

    try:
        admin_uid = int(sub.split("admin:", 1)[1])
    except (ValueError, IndexError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        ) from exc

    resp = await (
        supabase.table("admins")
        .select("*")
        .eq("uid", admin_uid)
        .limit(1)
        .execute()
    )
    row = first_row(resp)
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Admin not found")

    return Admin.from_row(row)


async def get_scanner_or_above(
    admin: Admin = Depends(get_current_admin),
) -> Admin:
    """Requires scanner, eventManager, or admin role."""
    if admin.role.value not in _SCANNER_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Scanner, Event Manager, or Admin role required",
        )
    return admin


async def get_admin_only(
    admin: Admin = Depends(get_current_admin),
) -> Admin:
    """Requires admin role only."""
    if admin.role.value != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin role required",
        )
    return admin


async def get_admin_or_em(
    admin: Admin = Depends(get_current_admin),
) -> Admin:
    """
    Requires admin or eventManager role.
    Scanner is explicitly blocked — they have no data-read access beyond lookup.
    """
    if admin.role.value not in {"admin", "eventManager"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin or Event Manager role required",
        )
    return admin
