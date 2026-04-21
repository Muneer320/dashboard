"""Supabase-backed auth service."""

from __future__ import annotations

import uuid

from fastapi import HTTPException, status
from supabase import AsyncClient

from app.core.security import create_access_token, get_password_hash, verify_password
from app.db.supabase_client import first_row
from app.models.user import User


async def login_with_credentials(
    supabase: AsyncClient, username: str, password: str
) -> str:
    resp = await (
        supabase.table("users")
        .select("*")
        .eq("username", username)
        .limit(1)
        .execute()
    )
    row = first_row(resp)
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

    user = User(
        id=uuid.uuid4(),
        username=username,
        password_hash=get_password_hash(password),
        name=name,
        unstop_id=unstop_id,
    )

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
