"""
Schedule service — event-specific and global schedule reads/writes.
Also handles announcements (stored on the same global table row).
"""
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.event import Event
from app.models.global_schedule import GlobalSchedule


# ── Helpers ───────────────────────────────────────────────────────────────────

def _row_to_dict(row: GlobalSchedule) -> dict:
    return {
        "id": str(row.id),
        "date": row.date.isoformat(),
        "schedule": row.schedule or [],
        "announcements": row.announcements or [],
    }


async def _get_or_create_row(session: AsyncSession, day: date) -> GlobalSchedule:
    result = await session.execute(
        select(GlobalSchedule).where(GlobalSchedule.date == day)
    )
    row = result.scalar_one_or_none()
    if row is None:
        row = GlobalSchedule(date=day, schedule=[], announcements=[])
        session.add(row)
        await session.flush()  # get the PK without committing
    return row


# ── Event schedule ─────────────────────────────────────────────────────────────

async def get_event_schedule(session: AsyncSession, event_id: str) -> dict:
    """Return the schedule array for a single event."""
    result = await session.execute(
        select(Event).where(Event.id == event_id)
    )
    event = result.scalar_one_or_none()
    if event is None:
        return None  # caller raises 404

    return {
        "event_id": str(event.id),
        "event_name": event.name,
        "schedule": event.schedule or [],
    }


async def set_event_schedule(
    session: AsyncSession, event_id: str, items: list[dict]
) -> dict:
    """Replace the full schedule array for an event (admin only)."""
    result = await session.execute(
        select(Event).where(Event.id == event_id)
    )
    event = result.scalar_one_or_none()
    if event is None:
        return None  # caller raises 404

    event.schedule = items
    session.add(event)
    await session.commit()
    await session.refresh(event)
    return {
        "event_id": str(event.id),
        "event_name": event.name,
        "schedule": event.schedule,
    }


# ── Global schedule ────────────────────────────────────────────────────────────

async def list_global_schedule(session: AsyncSession) -> list[dict]:
    """Return all global rows, ordered by date."""
    result = await session.execute(
        select(GlobalSchedule).order_by(GlobalSchedule.date)
    )
    return [_row_to_dict(r) for r in result.scalars().all()]


async def get_global_schedule_by_date(session: AsyncSession, day: date) -> dict | None:
    """Return the global schedule (+ announcements) for a specific date."""
    result = await session.execute(
        select(GlobalSchedule).where(GlobalSchedule.date == day)
    )
    row = result.scalar_one_or_none()
    return _row_to_dict(row) if row else None


async def upsert_global_schedule(
    session: AsyncSession, day: date, items: list[dict], announcements: list[dict] | None = None
) -> dict:
    """Create or replace the global schedule (and optionally announcements) for a date.
    
    Pass announcements=None to leave existing announcements untouched.
    """
    row = await _get_or_create_row(session, day)
    row.schedule = items
    if announcements is not None:
        row.announcements = announcements
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return _row_to_dict(row)


# ── Announcements ──────────────────────────────────────────────────────────────

async def list_all_announcements(
    session: AsyncSession,
    limit: int = 50,
    category: str | None = None,
) -> list[dict]:
    """
    Aggregate announcements from all global days, sorted by time descending.
    Returns a flat list of { date, announcement, time, category } dicts.

    If ``category`` is provided, only announcements tagged with that category
    are returned. Legacy rows without a category default to ``"general"``.
    """
    result = await session.execute(
        select(GlobalSchedule).order_by(GlobalSchedule.date.desc())
    )
    rows = result.scalars().all()

    flat: list[dict] = []
    for row in rows:
        for item in (row.announcements or []):
            item_category = item.get("category") or "general"
            if category is not None and item_category != category:
                continue
            flat.append({
                "date": row.date.isoformat(),
                "announcement": item.get("announcement", ""),
                "time": item.get("time", ""),
                "category": item_category,
            })

    # Sort by time desc (ISO strings sort correctly)
    flat.sort(key=lambda x: x["time"], reverse=True)
    return flat[:limit]


async def add_announcement(
    session: AsyncSession,
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
    row = await _get_or_create_row(session, day)
    existing = list(row.announcements or [])
    existing.append({
        "announcement": announcement,
        "time": time,
        "category": category,
    })
    row.announcements = existing
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return _row_to_dict(row)
