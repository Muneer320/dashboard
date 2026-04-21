"""
Schedule service — event-specific and global schedule reads/writes.
Also handles announcements (stored on the same global table row).

Supabase-backed: all operations go through PostgREST.
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
        "schedule": row.get("schedule") or [],
        "announcements": row.get("announcements") or [],
    }


async def _get_or_create_row(supabase: AsyncClient, day: date) -> dict:
    """Fetch the row for `day` or create a fresh empty one."""
    day_iso = day.isoformat()
    resp = await (
        supabase.table("global")
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
        "schedule": [],
        "announcements": [],
    }
    insert_resp = await (
        supabase.table("global")
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
        supabase.table("global")
        .select("*")
        .order("date")
        .execute()
    )
    return [_row_to_dict(r) for r in rows(resp)]


async def get_global_schedule_by_date(
    supabase: AsyncClient, day: date
) -> dict | None:
    """Return the global schedule (+ announcements) for a specific date."""
    resp = await (
        supabase.table("global")
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
    announcements: list[dict] | None = None,
) -> dict:
    """Create or replace the global schedule (and optionally announcements) for a date.

    Pass announcements=None to leave existing announcements untouched.
    """
    row = await _get_or_create_row(supabase, day)
    patch: dict = {"schedule": items}
    if announcements is not None:
        patch["announcements"] = announcements

    update_resp = await (
        supabase.table("global")
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


# ── Announcements ──────────────────────────────────────────────────────────────

async def list_all_announcements(
    supabase: AsyncClient,
    limit: int = 50,
    category: str | None = None,
) -> list[dict]:
    """
    Aggregate announcements from all global days, sorted by time descending.
    Returns a flat list of { date, announcement, time, category } dicts.

    If ``category`` is provided, only announcements tagged with that category
    are returned. Legacy rows without a category default to ``"general"``.
    """
    resp = await (
        supabase.table("global")
        .select("date, announcements")
        .order("date", desc=True)
        .execute()
    )
    rows_data = rows(resp)

    flat: list[dict] = []
    for row in rows_data:
        raw_date = row.get("date")
        iso_date = raw_date if isinstance(raw_date, str) else raw_date.isoformat()
        for item in (row.get("announcements") or []):
            item_category = item.get("category") or "general"
            if category is not None and item_category != category:
                continue
            flat.append({
                "date": iso_date,
                "announcement": item.get("announcement", ""),
                "time": item.get("time", ""),
                "category": item_category,
            })

    # Sort by time desc (ISO strings sort correctly)
    flat.sort(key=lambda x: x["time"], reverse=True)
    return flat[:limit]


async def add_announcement(
    supabase: AsyncClient,
    day: date,
    announcement: str,
    time: str,
    category: str = "general",
) -> dict:
    """
    Append an announcement to a specific day's row (admin only).
    Creates the row for that date if it doesn't exist yet.
    Returns the full updated row dict.
    """
    row = await _get_or_create_row(supabase, day)
    existing = list(row.get("announcements") or [])
    existing.append({
        "announcement": announcement,
        "time": time,
        "category": category,
    })

    update_resp = await (
        supabase.table("global")
        .update({"announcements": existing})
        .eq("id", row["id"])
        .execute()
    )
    updated = first_row(update_resp)
    if updated is not None:
        return _row_to_dict(updated)
    return _row_to_dict({**row, "announcements": existing})
