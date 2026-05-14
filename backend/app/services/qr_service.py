"""Supabase-backed QR scan service (food + entry gates)."""

from __future__ import annotations

import math
from datetime import datetime, timezone

from fastapi import HTTPException, status
from supabase import AsyncClient

from app.db.supabase_client import rows as supabase_rows
from app.models.event import DEFAULT_EVENT_MEALS_COUNT, Event
from app.models.user import User


async def _user_meal_allowance(supabase: AsyncClient, user: User) -> int:
    """
    Sum ``events.meals_count`` across every event this user is registered for
    (restricted events still count — restriction is independent of allowance).
    Returns 0 if the user isn't registered for any event.
    """
    event_ids = list((user.events or {}).keys())
    if not event_ids:
        return 0

    resp = await (
        supabase.table("events")
        .select("id, meals_count")
        .in_("id", event_ids)
        .execute()
    )

    total = 0
    for row in supabase_rows(resp):
        raw = row.get("meals_count")
        total += int(raw if raw is not None else DEFAULT_EVENT_MEALS_COUNT)
    return total


def _next_meal_key(food: dict) -> tuple[str, int]:
    """
    Pick the next meal slot to assign.

    Counts entries currently marked ``True`` in ``food``, then returns
    ``("meal{N+1}", claimed_count)`` so callers know both the new key and the
    existing count. Non-``True`` values (``False`` / missing) are treated as
    unclaimed — consistent with how we render the admin matrix.
    """
    claimed = sum(1 for v in (food or {}).values() if v)
    return f"meal{claimed + 1}", claimed


async def scan_food(supabase: AsyncClient, user: User, event_id: str) -> str:
    """
    Increment meal_count for the user in a specific event.

    Logic:
    1. Check if user is registered for this event
    2. Get event's meals_count limit
    3. Get current meal_count for this event (or 0)
    4. If current < limit, increment and save
    5. Otherwise reject

    Data structure: users.food = { "event_id": { "meal_count": 2 }, ... }
    """
    # Check if user is registered for this event
    if event_id not in (user.events or {}):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not registered for this event",
        )

    # Main gate entry must be completed before food can be claimed
    if not user.is_attending:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User has not completed main gate entry. Entry scan required before food can be claimed.",
        )

    # Get the event to check meals_count limit
    resp = await (
        supabase.table("events")
        .select("meals_count")
        .eq("id", event_id)
        .execute()
    )
    rows = supabase_rows(resp)
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )

    event_limit = int(rows[0].get("meals_count") if rows[0].get("meals_count") is not None else DEFAULT_EVENT_MEALS_COUNT)

    # Get current food object and extract fields for this event
    food = dict(user.food or {})
    event_food = food.get(event_id, {})
    if not isinstance(event_food, dict):
        event_food = {}

    current_count = event_food.get("meal_count", 0)

    # ── 1-hour cooldown between meal claims ──────────────────────────────────
    COOLDOWN_MINUTES = 60
    last_claim_raw = event_food.get("last_claim_time")
    if last_claim_raw:
        try:
            last_claim_dt = datetime.fromisoformat(last_claim_raw)
            # Make timezone-aware if stored as naive UTC
            if last_claim_dt.tzinfo is None:
                last_claim_dt = last_claim_dt.replace(tzinfo=timezone.utc)
            now_utc = datetime.now(timezone.utc)
            elapsed_minutes = (now_utc - last_claim_dt).total_seconds() / 60
            if elapsed_minutes < COOLDOWN_MINUTES:
                wait = math.ceil(COOLDOWN_MINUTES - elapsed_minutes)
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=(
                        f"Meal already claimed recently. "
                        f"Please wait {wait} more minute{'s' if wait != 1 else ''} before the next claim."
                    ),
                )
        except HTTPException:
            raise
        except Exception:
            pass  # Malformed timestamp — let the claim proceed

    # ── Meal limit check ─────────────────────────────────────────────────────
    if current_count >= event_limit:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Already claimed all meals for this event ({current_count}/{event_limit})",
        )

    # ── Increment and record timestamp ───────────────────────────────────────
    event_food["meal_count"]      = current_count + 1
    event_food["last_claim_time"] = datetime.now(timezone.utc).isoformat()
    food[event_id] = event_food
    user.food = food

    await (
        supabase.table("users")
        .update({"food": food})
        .eq("id", str(user.id))
        .execute()
    )

    next_count = current_count + 1
    return f"Meal claimed ({next_count}/{event_limit})"


async def scan_college_entry(supabase: AsyncClient, user: User) -> str:
    if user.is_attending:
        return "User already attending"

    user.is_attending = True

    await (
        supabase.table("users")
        .update({"is_attending": True})
        .eq("id", str(user.id))
        .execute()
    )
    return "College entry marked successfully"


async def scan_event_entry(
    supabase: AsyncClient, user: User, event: Event
) -> str:
    """
    Mark the user as attending a specific event.

    Also flips the top-level ``user.is_attending`` to True — event-entry
    implies main-gate entry, so we don't want the Scanner role to have to
    scan the user twice (once at the gate, once at the event).
    """
    user_events = user.events or {}
    event_key = str(event.id)

    # SECURITY: User must have passed main gate entry first
    if not user.is_attending:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User has not completed main gate entry. Cannot mark event attendance without gate entry.",
        )

    event_entry = user_events.get(event_key)
    if not event_entry:
        return "User not registered for this event"

    if event_entry.get("restricted"):
        return "User is restricted from this event"

    if event_entry.get("isAttending"):
        return "User already scanned for this event"

    event_entry["isAttending"] = True
    user_events[event_key] = event_entry
    user.events = user_events

    patch: dict = {"events": user_events}
    # Cascade main-gate attendance. Only write the column if it actually
    # needs updating — keeps the PATCH minimal for users already at the gate.
    if not user.is_attending:
        user.is_attending = True
        patch["is_attending"] = True

    await (
        supabase.table("users")
        .update(patch)
        .eq("id", str(user.id))
        .execute()
    )
    return "Attendance marked successfully"
