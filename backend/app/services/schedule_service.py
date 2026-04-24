"""
Schedule service — event-specific and global schedule reads/writes.
Also handles announcements (stored on the same global table row).

Supabase-backed: all operations go through PostgREST.

Note: meals_count used to live here (festival-wide on the ``global`` table)
but has been moved to a per-event column on ``events``. A user's total meal
allowance = sum(event.meals_count) across the events they're registered for.
"""

from __future__ import annotations

import uuid
from datetime import date

from supabase import AsyncClient

from app.db.supabase_client import first_row, rows


# ── Helpers ───────────────────────────────────────────────────────────────────

def _row_to_dict(row: dict) -> dict:
    raw_date = row.get("date")
    iso_date = raw_date if isinstance(raw_date, str) else raw_date.isoformat()
    return {
        "id": str(row["id"]),
        "date": iso_date,
        "items": row.get("items") or [],
    }


async def _get_or_create_row(supabase: AsyncClient, day: date) -> dict:
    """Fetch the row for `day` or create a fresh empty one."""
    day_iso = day.isoformat()
    resp = await (
        supabase.table("global_schedule")
        .select("*")
        .eq("date", day_iso)
        .limit(1)
        .execute()
    )
    row = first_row(resp)
    if row is not None:
        return row

    # Create a new row. Client-generated UUID so we don't have to rely on the
    # insert response shape.
    new_row = {
        "id": str(uuid.uuid4()),
        "date": day_iso,
        "items": [],
    }
    insert_resp = await (
        supabase.table("global_schedule")
        .insert(new_row)
        .execute()
    )
    echoed = first_row(insert_resp)
    return echoed if echoed is not None else new_row


# ── Event schedule ─────────────────────────────────────────────────────────────

async def get_event_schedule(
    supabase: AsyncClient, event_id: str
) -> dict | None:
    """Return the schedule array for a single event."""
    resp = await (
        supabase.table("events")
        .select("id, name, schedule")
        .eq("id", event_id)
        .limit(1)
        .execute()
    )
    row = first_row(resp)
    if row is None:
        return None

    return {
        "event_id": str(row["id"]),
        "event_name": row["name"],
        "schedule": row.get("schedule") or [],
    }


async def set_event_schedule(
    supabase: AsyncClient, event_id: str, items: list[dict]
) -> dict | None:
    """Replace the full schedule array for an event (admin only)."""
    # Make sure the event exists so callers can 404 consistently.
    exist = await (
        supabase.table("events")
        .select("id, name")
        .eq("id", event_id)
        .limit(1)
        .execute()
    )
    existing = first_row(exist)
    if existing is None:
        return None

    update_resp = await (
        supabase.table("events")
        .update({"schedule": items})
        .eq("id", event_id)
        .execute()
    )
    row = first_row(update_resp) or {**existing, "schedule": items}
    return {
        "event_id": str(row["id"]),
        "event_name": row.get("name") or existing["name"],
        "schedule": row.get("schedule") or items,
    }


# ── Global schedule ────────────────────────────────────────────────────────────

async def list_global_schedule(supabase: AsyncClient) -> list[dict]:
    """Return all global rows, ordered by date."""
    resp = await (
        supabase.table("global_schedule")
        .select("*")
        .order("date")
        .execute()
    )
    return [_row_to_dict(r) for r in rows(resp)]


async def get_global_schedule_by_date(
    supabase: AsyncClient, day: date
) -> dict | None:
    """Return the global schedule for a specific date."""
    resp = await (
        supabase.table("global_schedule")
        .select("*")
        .eq("date", day.isoformat())
        .limit(1)
        .execute()
    )
    row = first_row(resp)
    return _row_to_dict(row) if row else None


async def upsert_global_schedule(
    supabase: AsyncClient,
    day: date,
    items: list[dict],
) -> dict:
    """Create or replace the global schedule for a date."""
    row = await _get_or_create_row(supabase, day)
    patch: dict = {"items": items}

    update_resp = await (
        supabase.table("global_schedule")
        .update(patch)
        .eq("id", row["id"])
        .execute()
    )
    updated = first_row(update_resp)
    if updated is not None:
        return _row_to_dict(updated)
    # Fallback: merge our patch into the pre-update row
    merged = {**row, **patch}
    return _row_to_dict(merged)



