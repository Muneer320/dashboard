"""Supabase-backed QR scan service (food + entry gates)."""

from __future__ import annotations

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


async def scan_food(supabase: AsyncClient, user: User) -> str:
    """
    Claim the next meal slot for the user.

    Logic: allowance = sum(event.meals_count) over the events the user is
    registered for. Claimed = number of ``True`` entries in ``users.food``.
    If claimed < allowance, assign ``food["meal{claimed+1}"] = True`` and
    succeed. Otherwise reject with a clear message so the scanner UI can
    show a red alert.
    """
    allowance = await _user_meal_allowance(supabase, user)
    if allowance <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not registered for any event — no meal allowance",
        )

    food = dict(user.food or {})
    next_key, claimed = _next_meal_key(food)

    if claimed >= allowance:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"No meals left — already claimed {claimed}/{allowance}"
            ),
        )

    food[next_key] = True
    user.food = food

    await (
        supabase.table("users")
        .update({"food": food})
        .eq("id", str(user.id))
        .execute()
    )
    return f"Meal {next_key} marked as consumed ({claimed + 1}/{allowance})"


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
