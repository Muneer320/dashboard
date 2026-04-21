"""
Schedule service — event-specific and global schedule reads/writes.
Also handles announcements (stored on the same global table row) and the
festival-wide ``meals_count`` (how many meals are being served overall).

Supabase-backed: all operations go through PostgREST.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

from supabase import AsyncClient

from app.db.supabase_client import first_row, rows
from app.models.global_schedule import DEFAULT_MEALS_COUNT


# ── Helpers ───────────────────────────────────────────────────────────────────

def _row_to_dict(row: dict) -> dict:
    raw_date = row.get("date")
    iso_date = raw_date if isinstance(raw_date, str) else raw_date.isoformat()
    return {
        "id": str(row["id"]),
        "date": iso_date,
        "schedule": row.get("schedule") or [],
        "announcements": row.get("announcements") or [],
        "meals_count": int(row.get("meals_count") or DEFAULT_MEALS_COUNT),
    }


async def _get_or_create_row(supabase: AsyncClient, day: date) -> dict:
    """Fetch the row for `day` or create a fresh empty one.

    New rows inherit the current festival-wide ``meals_count`` so the scanner
    doesn't fall back to the model default on a day that hasn't been seeded.
    """
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

    # Inherit the current meals_count from any existing row.
    current_count = await get_meals_count(supabase)

    # Create a new row. Client-generated UUID so we don't have to rely on the
    # insert response shape.
    new_row = {
        "id": str(uuid.uuid4()),
        "date": day_iso,
        "schedule": [],
        "announcements": [],
        "meals_count": current_count,
    }
    insert_resp = await (
        supabase.table("global")
        .insert(new_row)
        .execute()
    )
    echoed = first_row(insert_resp)
    return echoed if echoed is not None else new_row


# ── Meals config (festival-wide) ──────────────────────────────────────────────

async def get_meals_count(supabase: AsyncClient) -> int:
    """
    Return the current festival-wide meals_count.

    Strategy: read the most-recent global row and use its meals_count. If no
    rows exist yet, fall back to the dataclass default (3). This keeps a
    single source of truth even though the column lives on per-date rows.
    """
    resp = await (
        supabase.table("global")
        .select("meals_count")
        .order("date", desc=True)
        .limit(1)
        .execute()
    )
    row = first_row(resp)
    if row is None:
        return DEFAULT_MEALS_COUNT
    return int(row.get("meals_count") or DEFAULT_MEALS_COUNT)


async def set_meals_count(supabase: AsyncClient, count: int) -> int:
    """
    Set the festival-wide meals_count.

    Writes to every existing global row so all days stay in sync. If there
    are no rows yet, seeds one for today so the value is persisted.
    """
    if count < 1 or count > 20:
        raise ValueError("meals_count must be between 1 and 20")

    resp = await supabase.table("global").select("id").execute()
    existing = rows(resp)

    if not existing:
        today = datetime.now(timezone.utc).date()
        new_row = {
            "id": str(uuid.uuid4()),
            "date": today.isoformat(),
            "schedule": [],
            "announcements": [],
            "meals_count": count,
        }
        await supabase.table("global").insert(new_row).execute()
        return count

    # Bulk update — one PATCH per row (PostgREST has no "update all" without a filter).
    for r in existing:
        await (
            supabase.table("global")
            .update({"meals_count": count})
            .eq("id", r["id"])
            .execute()
        )
    return count


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
