"""Supabase-backed user service."""

from __future__ import annotations

import uuid

from fastapi import HTTPException, status
from supabase import AsyncClient

from app.db.supabase_client import first_row
from app.models.user import User


async def get_user_by_id(supabase: AsyncClient, user_id: str) -> User:
    try:
        user_uuid = uuid.UUID(user_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user id") from exc

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
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return User.from_row(row)


async def update_user_profile(
    supabase: AsyncClient, user: User, payload: dict
) -> User:
    patch: dict = {}

    if payload.get("name") is not None:
        patch["name"] = payload["name"]
        user.name = payload["name"]

    if payload.get("details") is not None:
        patch["details"] = payload["details"]
        user.details = payload["details"]

    if payload.get("is_profile_complete") is not None:
        patch["is_profile_complete"] = payload["is_profile_complete"]
        user.is_profile_complete = payload["is_profile_complete"]

    if not patch:
        return user

    resp = await (
        supabase.table("users")
        .update(patch)
        .eq("id", str(user.id))
        .execute()
    )
    row = first_row(resp)
    if row is not None:
        return User.from_row(row)
    return user


def get_user_events_payload(user: User) -> dict:
    return {
        "user_id": str(user.id),
        "events": user.events or {},
    }
