"""
FastAPI dependencies.

The old SQLAlchemy `get_db_session` has been retired; every route now takes
a Supabase `AsyncClient` via `get_supabase`. The auth dependencies here
query the relevant tables through the SDK.
"""

from __future__ import annotations

import uuid

from fastapi import Depends, HTTPException, Query, Request, status
from fastapi.security import OAuth2PasswordBearer
from supabase import AsyncClient

from app.core.security import TokenError, decode_access_token
from app.db.supabase_client import first_row, get_supabase
from app.models.admin import Admin
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

# Roles allowed to perform scanning / gate management
_SCANNER_ROLES = {"Scanner", "eventManager", "admin"}


async def _resolve_user_from_token(
    token: str,
    supabase: AsyncClient,
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


async def get_current_user(
    supabase: AsyncClient = Depends(get_supabase),
    token: str = Depends(oauth2_scheme),
) -> User:
    return await _resolve_user_from_token(token, supabase)


async def get_current_user_from_header_or_query(
    request: Request,
    token_query: str | None = Query(None, alias="token"),
    supabase: AsyncClient = Depends(get_supabase),
) -> User:
    auth_header = request.headers.get("Authorization", "")
    token = ""
    if auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1].strip()
    elif token_query:
        token = token_query.strip()

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    return await _resolve_user_from_token(token, supabase)


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


# ----------------------------- sidequest role deps -----------------------------

# `admin` and `ops_lead` always count as one tier above `prm_lead`, which
# always counts above `prm_volunteer`. Booth volunteers are isolated.
_PRM_VOLUNTEER_ROLES = {"prm_volunteer", "prm_lead", "ops_lead", "admin"}
_PRM_LEAD_ROLES = {"prm_lead", "ops_lead", "admin"}
_OPS_LEAD_ROLES = {"ops_lead", "admin"}


async def get_prm_volunteer_or_above(
    admin: Admin = Depends(get_current_admin),
) -> Admin:
    """UGC queue access — prm_volunteer, prm_lead, ops_lead, admin."""
    if admin.role.value not in _PRM_VOLUNTEER_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="PRM volunteer or above required",
        )
    return admin


async def get_prm_lead_or_above(
    admin: Admin = Depends(get_current_admin),
) -> Admin:
    """Snapshot, manual adjust, surprise drop — prm_lead, ops_lead, admin."""
    if admin.role.value not in _PRM_LEAD_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="PRM lead or above required",
        )
    return admin


async def get_ops_lead_or_above(
    admin: Admin = Depends(get_current_admin),
) -> Admin:
    """Audit log read — ops_lead, admin."""
    if admin.role.value not in _OPS_LEAD_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Ops lead or above required",
        )
    return admin


async def get_booth_volunteer(
    supabase: AsyncClient = Depends(get_supabase),
    token: str = Depends(oauth2_scheme),
) -> dict:
    """
    Booth volunteer dependency. Returns a dict with `admin` and the
    `booth_id` claim from the JWT — booth award routes require this
    claim to scope writes to the volunteer's assigned booth.
    """
    try:
        payload = decode_access_token(token)
        sub = payload.get("sub", "")
        booth_id = payload.get("booth_id")
    except TokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

    if not sub.startswith("admin:"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Booth credentials required",
        )
    if not booth_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="booth_id missing from token",
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
    admin = Admin.from_row(row)
    if admin.role.value not in {"booth_volunteer", "admin"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Booth volunteer role required",
        )
    return {"admin": admin, "booth_id": booth_id}
