"""
Rating service — submit and read per-event ratings.
Upserts on (user_id, event_id) so a user can update their rating any time.
"""

from __future__ import annotations

import uuid

from supabase import AsyncClient

from app.db.supabase_client import first_row, rows


async def submit_rating(
    supabase: AsyncClient,
    user_id: str,
    event_id: str,
    value: int,
    feedback: str | None,
) -> dict:
    """
    Create or update a user's rating for an event.
    Returns the saved rating dict.

    Uses PostgREST `upsert` with `on_conflict` targeting the composite
    unique constraint `(user_id, event_id)`.
    """
    user_uuid = str(uuid.UUID(user_id))
    event_uuid = str(uuid.UUID(event_id))

    payload = {
        "user_id": user_uuid,
        "event_id": event_uuid,
        "value": value,
        "feedback": feedback,
    }

    resp = await (
        supabase.table("ratings")
        .upsert(payload, on_conflict="user_id,event_id")
        .execute()
    )
    row = first_row(resp) or payload
    return {
        "event_id": event_id,
        "value": row.get("value", value),
        "feedback": row.get("feedback", feedback),
    }


async def get_my_rating(
    supabase: AsyncClient,
    user_id: str,
    event_id: str,
) -> dict | None:
    """Return the calling user's rating for an event, or None if not rated."""
    resp = await (
        supabase.table("ratings")
        .select("*")
        .eq("user_id", str(uuid.UUID(user_id)))
        .eq("event_id", str(uuid.UUID(event_id)))
        .limit(1)
        .execute()
    )
    row = first_row(resp)
    if row is None:
        return None
    return {
        "event_id": event_id,
        "value": row["value"],
        "feedback": row.get("feedback"),
    }


async def get_rating_summary(
    supabase: AsyncClient,
    event_id: str,
) -> dict:
    """
    Return average star rating and total count for an event.

    PostgREST doesn't expose SQL aggregate functions directly to arbitrary
    clients, so we pull the rating values for this event and aggregate in
    Python. The number of ratings per event is bounded (one per attending
    user), so this is cheap in practice.
    """
    resp = await (
        supabase.table("ratings")
        .select("value")
        .eq("event_id", str(uuid.UUID(event_id)))
        .execute()
    )
    values = [int(r["value"]) for r in rows(resp) if r.get("value") is not None]
    count = len(values)
    avg_val = (sum(values) / count) if count else 0.0
    return {
        "event_id": event_id,
        "avg": round(float(avg_val), 2),
        "count": count,
    }
