"""Supabase-backed event service."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from supabase import AsyncClient

from app.db.supabase_client import first_row, rows
from app.models.event import Event
from app.models.user import User

# Columns returned for event listings — participants was removed from this table.
_EVENT_LIST_COLS = (
    "id,name,description,category,venue,rounds,community_link,"
    "max_participants,start_date,end_date,registration_deadline,"
    "meals_count,questions,created_at"
)


async def list_events(supabase: AsyncClient) -> list[Event]:
    resp = await (
        supabase.table("events")
        .select(_EVENT_LIST_COLS)
        .order("created_at", desc=True)
        .execute()
    )
    return [Event.from_row(r) for r in rows(resp)]


async def get_event(supabase: AsyncClient, event_id: str) -> Event:
    try:
        event_uuid = uuid.UUID(event_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid event id") from exc

    resp = await (
        supabase.table("events")
        .select(_EVENT_LIST_COLS)
        .eq("id", str(event_uuid))
        .limit(1)
        .execute()
    )
    row = first_row(resp)
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    return Event.from_row(row)


async def _count_event_registrations(supabase: AsyncClient, event_id: str) -> int:
    """
    Count users registered for an event by scanning users.events JSONB.
    Used for capacity checks — replaces the old events.participants count.
    """
    resp = await (
        supabase.table("users")
        .select("id")
        .execute()
    )
    # Count users whose events map contains this event_id as a key.
    count = sum(1 for r in (resp.data or []) if event_id in (r.get("events") or {}))
    return count


async def register_for_event(
    supabase: AsyncClient, user: User, event: Event
) -> None:
    """
    Register `user` for `event`. Only writes to users.events — the old
    events.participants mirror column has been removed.
    """
    user_events = user.events or {}
    event_key = str(event.id)
    user_key = str(user.id)

    if event.registration_deadline and datetime.now(timezone.utc) > event.registration_deadline:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Registration deadline passed")

    if event_key in user_events:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Already registered")

    registered_count = await _count_event_registrations(supabase, event_key)
    if registered_count >= event.max_participants:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Event is at capacity")

    user_events[event_key] = {
        "isAttending": False,           # flipped to True at the event gate scanner
        "phase": 1,
        "status": "active",             # active | completed | eliminated
        "restricted": False,            # set True to ban from further participation
        "submission": None,
        "teamId": None,                 # assigned when the user joins a team for this event
        "score": 0,
        "rank": None,
    }

    await (
        supabase.table("users")
        .update({"events": user_events})
        .eq("id", user_key)
        .execute()
    )

    user.events = user_events


# get_event_participants_payload removed — events.participants column dropped.
# Use the admin-panel /participants endpoint which queries users.events instead.


async def set_event_phase_state(
    supabase: AsyncClient,
    event_id: str,
    phase: int,
    is_active: bool | None = None,
    is_locked: bool | None = None,
) -> Event:
    event = await get_event(supabase, event_id)
    rounds = event.rounds or {}
    phase_key = f"phase{phase}"
    round_data = rounds.get(phase_key)
    if round_data is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Phase not found")

    if is_active is not None:
        round_data["is_active"] = is_active
    if is_locked is not None:
        round_data["is_locked"] = is_locked

    rounds[phase_key] = round_data

    resp = await (
        supabase.table("events")
        .update({"rounds": rounds})
        .eq("id", str(event.id))
        .execute()
    )
    row = first_row(resp)
    if row is not None:
        return Event.from_row(row)

    # Fallback: return the locally-mutated event if the SDK didn't echo the row
    event.rounds = rounds
    return event
