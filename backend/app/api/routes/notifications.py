"""
In-app notifications for the current student.

Notifications are written by the notification_service whenever something
happens (UGC approved/rejected, reversal posted, snapshot taken, etc.).
This module just exposes them to the dashboard's bell.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from supabase import AsyncClient

from app.api.deps import get_current_user
from app.db.supabase_client import first_row, get_supabase, rows
from app.models.user import User

router = APIRouter()


@router.get("")
async def list_notifications(
    user: User = Depends(get_current_user),
    supabase: AsyncClient = Depends(get_supabase),
    limit: int = 50,
) -> dict[str, Any]:
    """Return the most recent notifications for this user, plus an unread count."""
    resp = await (
        supabase.table("notifications")
        .select("*")
        .eq("user_id", str(user.id))
        .order("created_at", desc=True)
        .limit(min(limit, 100))
        .execute()
    )
    items = rows(resp)
    unread = sum(1 for n in items if not n.get("read_at"))
    return {"items": items, "unread": unread}


@router.post("/{notification_id}/read")
async def mark_read(
    notification_id: str,
    user: User = Depends(get_current_user),
    supabase: AsyncClient = Depends(get_supabase),
) -> dict[str, Any]:
    # Confirm ownership before update so we can't flip someone else's row.
    own = await (
        supabase.table("notifications")
        .select("id, user_id")
        .eq("id", notification_id)
        .limit(1)
        .execute()
    )
    row = first_row(own)
    if row is None or row["user_id"] != str(user.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Notification not found")

    now_iso = datetime.now(timezone.utc).isoformat()
    await (
        supabase.table("notifications")
        .update({"read_at": now_iso})
        .eq("id", notification_id)
        .execute()
    )
    return {"id": notification_id, "read_at": now_iso}


@router.post("/read-all")
async def mark_all_read(
    user: User = Depends(get_current_user),
    supabase: AsyncClient = Depends(get_supabase),
) -> dict[str, Any]:
    now_iso = datetime.now(timezone.utc).isoformat()
    await (
        supabase.table("notifications")
        .update({"read_at": now_iso})
        .eq("user_id", str(user.id))
        .is_("read_at", "null")
        .execute()
    )
    return {"marked_at": now_iso}
