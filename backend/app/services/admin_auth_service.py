"""Supabase-backed admin auth service."""

from __future__ import annotations

from fastapi import HTTPException, status
from supabase import AsyncClient

from app.core.security import create_access_token, verify_password
from app.db.supabase_client import first_row


async def admin_login(supabase: AsyncClient, username: str, password: str) -> str:
    """Authenticate against the admins table and return a JWT with role embedded."""
    resp = await (
        supabase.table("admins")
        .select("*")
        .eq("username", username)
        .limit(1)
        .execute()
    )
    row = first_row(resp)
    print("Here")
    print(row)

    if row is None or not verify_password(password, row["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid admin credentials",
        )

    # JWT subject is prefixed with "admin:" so deps can distinguish user vs admin tokens
    return create_access_token(
        subject=f"admin:{row['uid']}",
        role=row.get("role") or "admin",
    )
