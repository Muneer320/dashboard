"""
Announcements routes
─────────────────────────────────────────────────────────────────────────────
GET    /announcements           → flat list of all announcements (user)
POST   /announcements           → create a new announcement (admin)
PATCH  /announcements/{id}      → update announcement (admin)
DELETE /announcements/{id}      → delete announcement (admin)
"""
from datetime import date

from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel
from supabase import AsyncClient

from app.api.deps import get_admin_only, get_current_user
from app.db.supabase_client import get_supabase
from app.models.admin import Admin
from app.models.user import User
from app.schemas.schedule import AnnouncementItem
from app.services.announcement_service import (
    create_announcement,
    list_announcements,
    update_announcement,
    delete_announcement,
)

router = APIRouter()


# ── Response models ────────────────────────────────────────────────────────────

class AddAnnouncementBody(BaseModel):
    """Admin POST body to add an announcement."""
    title: str = ""      # Optional heading/subject
    announcement: str
    time: str | None = None  # ISO-8601 datetime string, optional
    category: str = "general"
    is_pinned: bool = False


class UpdateAnnouncementBody(BaseModel):
    """Admin PATCH body to update an existing announcement."""
    title: str | None = None
    announcement: str | None = None
    time: str | None = None
    category: str | None = None
    is_pinned: bool | None = None


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.get("", response_model=list[AnnouncementItem])
async def get_announcements(
    limit: int = Query(50, ge=1, le=500),
    category: str | None = Query(
        None,
        description="Filter announcements to this category (e.g. 'general', 'alert').",
    ),
    supabase: AsyncClient = Depends(get_supabase),
    _: User = Depends(get_current_user),
) -> list[AnnouncementItem]:
    """
    Return a flat, time-sorted (newest first) list of announcements across
    all event days. Filter by ``category`` and paginate via ``limit``.
    """
    items = await list_announcements(supabase, limit=limit, category=category)
    return [AnnouncementItem(**i) for i in items]


@router.post("", response_model=AnnouncementItem, status_code=201)
async def post_announcement(
    body: AddAnnouncementBody,
    supabase: AsyncClient = Depends(get_supabase),
    _: Admin = Depends(get_admin_only),
) -> AnnouncementItem:
    """
    Admin: create a new announcement.
    """
    row = await create_announcement(
        supabase,
        title=body.title,
        announcement=body.announcement,
        time=body.time,
        category=body.category,
        is_pinned=body.is_pinned,
    )
    return AnnouncementItem(**row)


@router.patch("/{announcement_id}", response_model=AnnouncementItem)
async def patch_announcement(
    announcement_id: str,
    body: UpdateAnnouncementBody,
    supabase: AsyncClient = Depends(get_supabase),
    _: Admin = Depends(get_admin_only),
) -> AnnouncementItem:
    """
    Admin: update an existing announcement.
    """
    row = await update_announcement(
        supabase,
        announcement_id=announcement_id,
        update_data=body.model_dump(exclude_none=True),
    )
    if not row:
        raise HTTPException(status_code=404, detail="Announcement not found")
    return AnnouncementItem(**row)


@router.delete("/{announcement_id}", status_code=204)
async def remove_announcement(
    announcement_id: str,
    supabase: AsyncClient = Depends(get_supabase),
    _: Admin = Depends(get_admin_only),
) -> None:
    """
    Admin: delete an announcement.
    """
    success = await delete_announcement(supabase, announcement_id)
    if not success:
        raise HTTPException(status_code=404, detail="Announcement not found")
