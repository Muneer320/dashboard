"""Postgres-backed admin auth service."""

from __future__ import annotations

from fastapi import HTTPException, status

from app.core.security import create_access_token, verify_password
from app.db.postgres import db_connection


async def _fetch_admin_by_username_postgres(username: str) -> dict | None:
    async with db_connection() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM public.admins WHERE username = $1 LIMIT 1",
            username,
        )
        return dict(row) if row is not None else None


async def admin_login(username: str, password: str) -> str:
    """Authenticate against the admins table and return a JWT with role embedded."""
    row = await _fetch_admin_by_username_postgres(username)

    if row is None or not verify_password(password, row["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid admin credentials",
        )

    if row.get("deleted_at") is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been deactivated.",
        )

    role = row.get("role") or "admin"

    # Booth volunteers must carry their assigned booth_id in the token —
    # /api/v1/booth/* routes refuse the request otherwise.
    extra_claims: dict | None = None
    booth_id = row.get("booth_id")
    if role == "booth_volunteer":
        if not booth_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Booth volunteer has no booth assigned. Ask an admin to assign a booth.",
            )
        extra_claims = {"booth_id": booth_id}

    # JWT subject is prefixed with "admin:" so deps can distinguish user vs admin tokens
    return create_access_token(
        subject=f"admin:{row['uid']}",
        role=role,
        extra_claims=extra_claims,
    )
