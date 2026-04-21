"""Supabase-backed QR scan service (food + entry gates)."""

from __future__ import annotations

from supabase import AsyncClient

from app.models.event import Event
from app.models.user import User


async def scan_food(supabase: AsyncClient, user: User, meal: str) -> str:
    food = user.food or {"meal1": False, "meal2": False, "meal3": False}

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

    await (
        supabase.table("users")
        .update({"events": user_events})
        .eq("id", str(user.id))
        .execute()
    )
    return "Attendance marked successfully"
