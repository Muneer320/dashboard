"""
Announcements routes
─────────────────────────────────────────────────────────────────────────────
GET  /announcements              → flat list of all announcements (user)
POST /announcements              → append announcement to a day (admin)
"""
from datetime import date

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_admin_only, get_current_user
from app.db.session import get_db_session
from app.models.admin import Admin
from app.models.user import User
from app.schemas.schedule import AnnouncementItem, GlobalScheduleItem
from app.services.schedule_service import add_announcement, list_all_announcements

router = APIRouter()


# ── Response model ─────────────────────────────────────────────────────────────

class AnnouncementFeedItem(BaseModel):
    """Single item in the flat announcements feed."""
    date: str            # "2026-05-10"
    announcement: str
    time: str            # ISO-8601 datetime string
    category: str        # "general" | "schedule" | "meal" | "alert" | ...


class AddAnnouncementBody(BaseModel):
    """Admin POST body to add an announcement to a specific day."""
    date: str            # "YYYY-MM-DD"
    announcement: str
    time: str            # ISO-8601 datetime string, e.g. "2026-05-10T09:00:00+05:30"
    category: str = "general"


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.get("", response_model=list[AnnouncementFeedItem])
async def get_announcements(
    limit: int = Query(50, ge=1, le=500),
    category: str | None = Query(
        None,
        description="Filter announcements to this category (e.g. 'general', 'alert').",
    ),
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_user),
) -> list[AnnouncementFeedItem]:
    """
    Return a flat, time-sorted (newest first) list of announcements across
    all event days. Filter by ``category`` and paginate via ``limit``.
    """
    items = await list_all_announcements(session, limit=limit, category=category)
    return [AnnouncementFeedItem(**i) for i in items]


@router.post("", response_model=GlobalScheduleItem, status_code=201)
async def post_announcement(
    body: AddAnnouncementBody,
    session: AsyncSession = Depends(get_db_session),
    _: Admin = Depends(get_admin_only),
) -> GlobalScheduleItem:
    """
    Admin: append a new announcement to the specified day's row.
    Creates the row for that date if it doesn't exist yet.
    Returns the full updated day object (schedule + announcements).
    """
    day = date.fromisoformat(body.date)
    row = await add_announcement(
        session,
        day=day,
        announcement=body.announcement,
        time=body.time,
        category=body.category,
    )
    return GlobalScheduleItem(**row)
