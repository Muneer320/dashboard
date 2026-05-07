"""Supabase-backed event service.

Core event metadata lives on the ``events`` table, while registration state
now lives in ``users.events``. The old ``events.participants`` JSON column is
gone from the live database, so participant reads and writes must be derived
from user rows.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from supabase import AsyncClient

from app.db.supabase_client import first_row, rows
from app.models.event import Event
from app.models.user import User

_PAGE_SIZE = 1000
_EVENT_LIST_COLS = (
    "id,name,description,start_date,end_date,venue,judges,category,"
    "rounds,schedule,rules,community_link,max_participants,meals_count,"
    "registration_deadline,questions,created_at,updated_at"
)


async def auto_lock_expired_phases(supabase: AsyncClient, event: Event) -> None:
    """
    Lazily lock any active phases whose end_time has passed.

    Sets is_locked=True + is_active=False on each expired phase and writes
    the updated rounds dict back to the DB.  Designed to be called as a
    FastAPI BackgroundTask so it never blocks the response.
    """
    rounds = dict(event.rounds or {})
    now = datetime.now(timezone.utc)
    updated = False

    for key, phase in rounds.items():
        if not isinstance(phase, dict):
            continue
        # Skip phases that are already locked or not active
        if phase.get("is_locked") or not phase.get("is_active"):
            continue
        end_time_str = phase.get("end_time")
        if not end_time_str:
            continue
        try:
            end_time = datetime.fromisoformat(end_time_str)
            if end_time.tzinfo is None:
                end_time = end_time.replace(tzinfo=timezone.utc)
            if now > end_time:
                phase["is_locked"] = True
                phase["is_active"] = False
                rounds[key] = phase
                updated = True
        except ValueError:
            continue

    if updated:
        await (
            supabase.table("events")
            .update({"rounds": rounds})
            .eq("id", str(event.id))
            .execute()
        )


async def _fetch_all_user_event_rows(supabase: AsyncClient) -> list[dict]:
    """Fetch just enough user data to derive event registrations."""
    all_rows: list[dict] = []
    offset = 0
    while True:
        resp = await (
            supabase.table("users")
            .select("id,username,name,events")
            .range(offset, offset + _PAGE_SIZE - 1)
            .execute()
        )
        page = rows(resp)
        all_rows.extend(page)
        if len(page) < _PAGE_SIZE:
            break
        offset += _PAGE_SIZE
    return all_rows


async def get_event_registration_counts(
    supabase: AsyncClient,
    event_ids: list[str] | set[str] | tuple[str, ...] | None = None,
) -> dict[str, int]:
    """Count registrations per event from ``users.events``."""
    allowed = {str(event_id) for event_id in event_ids} if event_ids is not None else None
    counts: dict[str, int] = {}
    for row in await _fetch_all_user_event_rows(supabase):
        events_map = row.get("events") or {}
        if not isinstance(events_map, dict):
            continue
        for event_id in events_map.keys():
            event_key = str(event_id)
            if allowed is not None and event_key not in allowed:
                continue
            counts[event_key] = counts.get(event_key, 0) + 1
    return counts


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
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid event id",
        ) from exc

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
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )
    return Event.from_row(row)


async def register_for_event(
    supabase: AsyncClient,
    user: User,
    event: Event,
) -> None:
    """Register ``user`` for ``event`` using ``users.events`` as source of truth."""
    user_events = user.events or {}
    event_key = str(event.id)
    user_key = str(user.id)

    if event.registration_deadline and datetime.now(timezone.utc) > event.registration_deadline:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Registration deadline passed",
        )

    if event_key in user_events:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Already registered",
        )

    counts = await get_event_registration_counts(supabase, [event_key])
    if counts.get(event_key, 0) >= event.max_participants:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Event is at capacity",
        )

    now_iso = datetime.now(timezone.utc).isoformat()
    user_events[event_key] = {
        "registeredAt": now_iso,
        "isAttending": False,
        "phase": 1,
        "status": "active",
        "restricted": False,
        "submission": None,
        "teamId": None,
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
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Phase not found",
        )

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

    event.rounds = rounds
    return event
