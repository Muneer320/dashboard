"""Supabase-backed QR scan service (food + entry gates)."""

from __future__ import annotations

import re

from fastapi import HTTPException, status
from supabase import AsyncClient

from app.models.event import Event
from app.models.user import User
from app.services.schedule_service import get_meals_count


_MEAL_KEY_RE = re.compile(r"^meal(\d+)$")


def _meal_index(meal: str) -> int | None:
    """Return 1-based index from a key like 'meal3', or None if malformed."""
    m = _MEAL_KEY_RE.match(meal or "")
    if not m:
        return None
    return int(m.group(1))


async def scan_food(supabase: AsyncClient, user: User, meal: str) -> str:
    """
    Mark a meal as claimed for the user.

    ``users.food`` starts as an empty dict. On a valid scan we add/set the
    entry ``food[meal_id] = True``. A duplicate scan (key already True)
    returns an "already consumed" message. The meal key must be of the form
    ``meal<N>`` where ``1 <= N <= current meals_count`` (admin-configured on
    the ``global`` table).
    """
    idx = _meal_index(meal)
    if idx is None or idx < 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid meal key '{meal}' — expected 'meal1', 'meal2', …",
        )

    meals_count = await get_meals_count(supabase)
    if idx > meals_count:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Meal '{meal}' is out of range — only {meals_count} meals "
                f"are configured. Ask an admin to raise the meals count first."
            ),
        )

    food = user.food or {}

    if food.get(meal):
        return "Meal already consumed"

    food[meal] = True
    user.food = food

    await (
        supabase.table("users")
        .update({"food": food})
        .eq("id", str(user.id))
        .execute()
    )
    return "Meal marked as consumed"


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
