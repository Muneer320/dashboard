"""Supabase-backed auth service."""

from __future__ import annotations

import uuid

import asyncpg
import httpx
from fastapi import HTTPException, status
from supabase import AsyncClient

from app.core.config import settings
from app.core.security import create_access_token, get_password_hash, verify_password
from app.db.postgres import db_connection
from app.db.supabase_client import first_row
from app.models.user import User


def _upstream_unreachable_detail(exc: Exception) -> str:
    return (
        "Database REST API unreachable (PostgREST/Supabase). "
        "Check SUPABASE_URL and that the REST gateway is running. "
        f"Original error: {exc}"
    )


async def _fetch_user_by_username_postgres(username: str) -> dict | None:
    async with db_connection() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM public.users WHERE username = $1 LIMIT 1",
            username,
        )
        return dict(row) if row is not None else None


async def _user_exists_by_field_postgres(field: str, value: str) -> bool:
    # Only used with fixed, safe field names from within this module.
    if field not in {"username", "unstop_id"}:
        raise ValueError("Unsupported lookup field.")
    async with db_connection() as conn:
        row = await conn.fetchrow(
            f"SELECT id FROM public.users WHERE {field} = $1 LIMIT 1",
            value,
        )
        return row is not None


async def _insert_user_postgres(user: User) -> User:
    payload = user.to_insert()
    async with db_connection() as conn:
        try:
            row = await conn.fetchrow(
                """
                INSERT INTO public.users
                    (id, username, password_hash, name, unstop_id, is_attending,
                     details, events, food, is_profile_complete, cents, role)
                VALUES
                    ($1, $2, $3, $4, $5, $6,
                     $7, $8, $9, $10, $11, $12)
                RETURNING *
                """,
                payload["id"],
                payload["username"],
                payload["password_hash"],
                payload["name"],
                payload.get("unstop_id"),
                payload.get("is_attending", False),
                payload.get("details") or {},
                payload.get("events") or {},
                payload.get("food") or {},
                payload.get("is_profile_complete", False),
                payload.get("cents", 0),
                payload.get("role", "participant"),
            )
        except asyncpg.UniqueViolationError as exc:
            # Keep the exact 409 errors aligned with the caller's checks.
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Username already exists",
            ) from exc
    if row is None:
        return user
    return User.from_row(dict(row))


async def login_with_credentials(
    supabase: AsyncClient, username: str, password: str
) -> str:
    row: dict | None
    try:
        resp = await (
            supabase.table("users")
            .select("*")
            .eq("username", username)
            .limit(1)
            .execute()
        )
        row = first_row(resp)
    except httpx.RequestError as exc:
        if settings.DATABASE_URL:
            row = await _fetch_user_by_username_postgres(username)
        else:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=_upstream_unreachable_detail(exc),
            ) from exc
    if row is None or not verify_password(password, row["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    # users have no role; role lives in admins table
    return create_access_token(subject=str(row["id"]))


async def register_user(
    supabase: AsyncClient,
    username: str,
    password: str,
    name: str,
    unstop_id: str | None = None,
) -> User:
    # Username uniqueness
    try:
        existing = await (
            supabase.table("users")
            .select("id")
            .eq("username", username)
            .limit(1)
            .execute()
        )
        if first_row(existing) is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                                detail="Username already exists")

        if unstop_id:
            existing_unstop = await (
                supabase.table("users")
                .select("id")
                .eq("unstop_id", unstop_id)
                .limit(1)
                .execute()
            )
            if first_row(existing_unstop) is not None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Unstop user already exists",
                )
    except httpx.RequestError as exc:
        if not settings.DATABASE_URL:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=_upstream_unreachable_detail(exc),
            ) from exc
        if await _user_exists_by_field_postgres("username", username):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Username already exists",
            ) from None
        if unstop_id and await _user_exists_by_field_postgres("unstop_id", unstop_id):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Unstop user already exists",
            ) from None

    user = User(
        id=uuid.uuid4(),
        username=username,
        password_hash=get_password_hash(password),
        name=name,
        unstop_id=unstop_id,
    )

    try:
        insert_resp = await (
            supabase.table("users")
            .insert(user.to_insert())
            .execute()
        )
        inserted = first_row(insert_resp)
        # Supabase returns the inserted row (with server-generated timestamps).
        if inserted is not None:
            return User.from_row(inserted)
        return user
    except httpx.RequestError as exc:
        if settings.DATABASE_URL:
            return await _insert_user_postgres(user)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=_upstream_unreachable_detail(exc),
        ) from exc


async def visitor_signup_user(
    supabase: AsyncClient,
    name: str,
    email: str,
    password: str,
    phone: str | None = None,
    college: str | None = None,
    city: str | None = None,
    branch: str | None = None,
    year: str | None = None,
    gender: str | None = None,
    emergency_contact: str | None = None,
) -> tuple[User, str]:
    """Self-register a walk-in visitor and return (user, jwt_token)."""
    # Email becomes the username (same convention as participant accounts)
    username = email.strip().lower()

    try:
        existing = await (
            supabase.table("users")
            .select("id")
            .eq("username", username)
            .limit(1)
            .execute()
        )
        if first_row(existing) is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this email already exists. Please log in.",
            )
    except httpx.RequestError as exc:
        if not settings.DATABASE_URL:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=_upstream_unreachable_detail(exc),
            ) from exc
        if await _user_exists_by_field_postgres("username", username):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this email already exists. Please log in.",
            ) from None

    details = {
        k: v for k, v in {
            "phone": phone,
            "college": college,
            "city": city,
            "branch": branch,
            "year": year,
            "gender": gender,
            "emergency_contact": emergency_contact or "",
        }.items() if v is not None
    }

    user = User(
        id=uuid.uuid4(),
        username=username,
        password_hash=get_password_hash(password),
        name=name.strip(),
        role="visitor",
        details=details,
        events={},
        food={},
    )

    try:
        insert_resp = await (
            supabase.table("users")
            .insert(user.to_insert())
            .execute()
        )
        inserted = first_row(insert_resp)
        if inserted is not None:
            user = User.from_row(inserted)
    except httpx.RequestError as exc:
        if settings.DATABASE_URL:
            user = await _insert_user_postgres(user)
        else:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=_upstream_unreachable_detail(exc),
            ) from exc

    token = create_access_token(subject=str(user.id))
    return user, token
