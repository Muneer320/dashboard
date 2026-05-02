"""Supabase-backed event service."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from supabase import AsyncClient

from app.db.supabase_client import first_row, rows
from app.models.event import Event
from app.models.user import User

# Columns returned for event listings — excludes the heavy `participants` JSONB
# (can be many KB per event as it holds all users' submission answers).
# Single-event fetches (get_event) still use select("*") so submissions work.
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
        .select("*")
        .eq("id", str(event_uuid))
        .limit(1)
        .execute()
    )
    row = first_row(resp)
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    return Event.from_row(row)


async def register_for_event(
    supabase: AsyncClient, user: User, event: Event
) -> None:
    """
    Register `user` for `event`. Writes to TWO tables (events.participants,
    users.events) — without SQL transactions those two writes are independent.
    We persist the event row first because that's the one we checked capacity
    against; if the user row write fails, a stale entry in event.participants
    is recoverable, the other way around leaks quota.
    """
    participants = event.participants or {}
    user_events = user.events or {}
    event_key = str(event.id)
    user_key = str(user.id)

    if event.registration_deadline and datetime.now(timezone.utc) > event.registration_deadline:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Registration deadline passed")

    if user_key in participants:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Already registered")

    if len(participants) >= event.max_participants:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Event is at capacity")

    now_iso = datetime.now(timezone.utc).isoformat()

    participants[user_key] = {
        "registeredAt": now_iso,
        "currentPhase": 1,
        "status": "active",
        "attendance": {},
        "submission": {},
    }
    user_events[event_key] = {
        "isAttending": False,           # flipped to True at the event gate scanner
        "phase": 1,
        "status": "active",             # active | completed | eliminated
        "restricted": False,            # set True to ban from further participation
        # submission: null = not submitted; object = submitted
        # Shape: { repoLink: str, deployLink: str, submittedAt: iso | null }
        "submission": None,
        "teamId": None,                 # assigned when the user joins a team for this event
        "score": 0,
        "rank": None,
    }

    # Write the event row first (source of truth for capacity).
    await (
        supabase.table("events")
        .update({"participants": participants})
        .eq("id", event_key)
        .execute()
    )

    # Then the user row.
    await (
        supabase.table("users")
        .update({"events": user_events})
        .eq("id", user_key)
        .execute()
    )

    event.participants = participants
    user.events = user_events


def get_event_participants_payload(event: Event) -> dict:
    participants = event.participants or {}
    return {
        "event_id": str(event.id),
        "participants_count": len(participants),
        "participants": participants,
    }


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
