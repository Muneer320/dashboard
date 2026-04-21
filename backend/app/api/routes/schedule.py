"""
Schedule routes
─────────────────────────────────────────────────────────────────────────────
GET  /schedule/global              → list all global schedule days          (user)
GET  /schedule/global/{date}       → single day global schedule            (user)
PUT  /schedule/global/{date}       → upsert a day's global schedule        (admin)
GET  /schedule/events/{event_id}   → event-specific schedule               (user)
PUT  /schedule/events/{event_id}   → replace event schedule                (admin)
"""
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_admin_only, get_current_user
from app.db.session import get_db_session
from app.models.admin import Admin
from app.models.user import User
from app.schemas.schedule import (
    AnnouncementItem,
    EventScheduleResponse,
    GlobalScheduleItem,
    GlobalScheduleUpsert,
    ScheduleItem,
)
from app.services.schedule_service import (
    get_event_schedule,
    get_global_schedule_by_date,
    list_global_schedule,
    set_event_schedule,
    upsert_global_schedule,
)

router = APIRouter()


# ── Global schedule ────────────────────────────────────────────────────────────

@router.get("/global", response_model=list[GlobalScheduleItem])
async def get_full_global_schedule(
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_user),
) -> list[GlobalScheduleItem]:
    """Return all days in the global schedule, ordered by date."""
    rows = await list_global_schedule(session)
    return [GlobalScheduleItem(**r) for r in rows]


@router.get("/global/{day}", response_model=GlobalScheduleItem)
async def get_global_schedule_day(
    day: date,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_user),
) -> GlobalScheduleItem:
    """Return the global schedule for a specific date (YYYY-MM-DD)."""
    row = await get_global_schedule_by_date(session, day)
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No global schedule found for {day}",
        )
    return GlobalScheduleItem(**row)


@router.put("/global/{day}", response_model=GlobalScheduleItem, status_code=200)
async def upsert_global_schedule_day(
    day: date,
    body: GlobalScheduleUpsert,
    session: AsyncSession = Depends(get_db_session),
    _: Admin = Depends(get_admin_only),
) -> GlobalScheduleItem:
    """Create or fully replace the global schedule (and announcements) for a given date. Admin only."""
    items = [item.model_dump() for item in body.schedule]
    ann = [a.model_dump() for a in body.announcements]
    row = await upsert_global_schedule(session, day, items, announcements=ann)
    return GlobalScheduleItem(**row)


# ── Event-specific schedule ────────────────────────────────────────────────────

@router.get("/events/{event_id}", response_model=EventScheduleResponse)
async def get_event_schedule_route(
    event_id: str,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_user),
) -> EventScheduleResponse:
    """Return the schedule for a specific event."""
    data = await get_event_schedule(session, event_id)
    if data is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Event not found"
        )
    return EventScheduleResponse(**data)


@router.put("/events/{event_id}", response_model=EventScheduleResponse, status_code=200)
async def set_event_schedule_route(
    event_id: str,
    body: list[ScheduleItem],
    session: AsyncSession = Depends(get_db_session),
    _: Admin = Depends(get_admin_only),
) -> EventScheduleResponse:
    """Replace the full schedule for an event. Admin only.
    
    Send an empty array [] to clear the schedule.
    """
    items = [item.model_dump() for item in body]
    data = await set_event_schedule(session, event_id, items)
    if data is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Event not found"
        )
    return EventScheduleResponse(**data)
