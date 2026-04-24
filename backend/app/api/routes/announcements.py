"""
Announcements routes
─────────────────────────────────────────────────────────────────────────────
GET  /announcements              → flat list of all announcements (user)
POST /announcements              → append announcement to a day (admin)
"""
from datetime import date

from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel
from supabase import AsyncClient

from app.api.deps import get_admin_only, get_current_user
from app.db.supabase_client import get_supabase
from app.models.admin import Admin
from app.models.user import User
from app.schemas.schedule import GlobalScheduleItem
from app.services.schedule_service import (
    add_announcement,
    list_all_announcements,
    update_announcement,
    delete_announcement,
)

router = APIRouter()


# ── Response model ─────────────────────────────────────────────────────────────

class AnnouncementFeedItem(BaseModel):
    """Single item in the flat announcements feed."""
    id: str
    date: str            # "2026-05-10"
    announcement: str
    time: str            # ISO-8601 datetime string
    category: str        # "general" | "schedule" | "meal" | "alert" | ...
    is_pinned: bool = False


class AddAnnouncementBody(BaseModel):
    """Admin POST body to add an announcement to a specific day."""
    date: str            # "YYYY-MM-DD"
    announcement: str
    time: str            # ISO-8601 datetime string, e.g. "2026-05-10T09:00:00+05:30"
    category: str = "general"
    is_pinned: bool = False


class UpdateAnnouncementBody(BaseModel):
    """Admin PATCH body to update an existing announcement."""
    announcement: str | None = None
    time: str | None = None
    category: str | None = None
    is_pinned: bool | None = None


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.get("", response_model=list[AnnouncementFeedItem])
async def get_announcements(
    limit: int = Query(50, ge=1, le=500),
    category: str | None = Query(
        None,
        description="Filter announcements to this category (e.g. 'general', 'alert').",
    ),
    supabase: AsyncClient = Depends(get_supabase),
    _: User = Depends(get_current_user),
) -> list[AnnouncementFeedItem]:
    """
    Return a flat, time-sorted (newest first) list of announcements across
    all event days. Filter by ``category`` and paginate via ``limit``.
    """
    items = await list_all_announcements(supabase, limit=limit, category=category)
    return [AnnouncementFeedItem(**i) for i in items]


@router.post("", response_model=GlobalScheduleItem, status_code=201)
async def post_announcement(
    body: AddAnnouncementBody,
    supabase: AsyncClient = Depends(get_supabase),
    _: Admin = Depends(get_admin_only),
) -> GlobalScheduleItem:
    """
    Admin: append a new announcement to the specified day's row.
    Creates the row for that date if it doesn't exist yet.
    Returns the full updated day object (schedule + announcements).
    """
    day = date.fromisoformat(body.date)
    row = await add_announcement(
        supabase,
        day=day,
        announcement=body.announcement,
        time=body.time,
        category=body.category,
        is_pinned=body.is_pinned,
    )
    return GlobalScheduleItem(**row)


@router.patch("/{date_str}/{announcement_id}", response_model=GlobalScheduleItem)
async def patch_announcement(
    date_str: str,
    announcement_id: str,
    body: UpdateAnnouncementBody,
    supabase: AsyncClient = Depends(get_supabase),
    _: Admin = Depends(get_admin_only),
) -> GlobalScheduleItem:
    """
    Admin: update an existing announcement within a specific day.
    """
    day = date.fromisoformat(date_str)
    row = await update_announcement(
        supabase,
        day=day,
        announcement_id=announcement_id,
        update_data=body.model_dump(exclude_none=True),
    )
    if not row:
        raise HTTPException(status_code=404, detail="Announcement not found")
    return GlobalScheduleItem(**row)


@router.delete("/{date_str}/{announcement_id}", response_model=GlobalScheduleItem)
async def remove_announcement(
    date_str: str,
    announcement_id: str,
    supabase: AsyncClient = Depends(get_supabase),
    _: Admin = Depends(get_admin_only),
) -> GlobalScheduleItem:
    """
    Admin: delete an announcement from a specific day.
    """
    day = date.fromisoformat(date_str)
    row = await delete_announcement(supabase, day, announcement_id)
    if not row:
        raise HTTPException(status_code=404, detail="Announcement not found")
    return GlobalScheduleItem(**row)
