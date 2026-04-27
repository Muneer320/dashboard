from __future__ import annotations

import uuid
from datetime import datetime

from supabase import AsyncClient

from app.db.supabase_client import first_row, rows


async def list_announcements(
    supabase: AsyncClient,
    limit: int = 50,
    category: str | None = None,
) -> list[dict]:
    """
    List announcements ordered by is_pinned first, then created_at.
    """
    query = supabase.table("announcements").select("*")
    if category is not None:
        query = query.eq("category", category)
    
    # Supabase allows chaining multiple orderings
    resp = await (
        query
        .order("is_pinned", desc=True)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    
    results = rows(resp)
    # Map the "body" column to "announcement" and "created_at" to "time" for backward compatibility
    # with the frontend components.
    out = []
    for r in results:
        out.append({
            "id": str(r["id"]),
            "title": r.get("title", ""),
            "announcement": r.get("body", ""),
            "category": r.get("category", "general"),
            "is_pinned": bool(r.get("is_pinned")),
            "time": r.get("created_at"),
            "date": r.get("created_at"), # Provided for backward compatibility if needed
        })
    return out


async def create_announcement(
    supabase: AsyncClient,
    announcement: str,
    time: str | None = None,
    title: str = "",
    category: str = "general",
    is_pinned: bool = False,
) -> dict:
    """
    Insert a new announcement.
    """
    new_id = str(uuid.uuid4())
    data = {
        "id": new_id,
        "title": title,
        "body": announcement,
        "category": category,
        "is_pinned": is_pinned,
    }
    # Only supply created_at if a custom time is provided, else let DB default to now()
    if time:
        data["created_at"] = time

    resp = await (
        supabase.table("announcements")
        .insert(data)
        .execute()
    )
    r = first_row(resp)
    if not r:
        r = data
    
    return {
        "id": str(r["id"]),
        "title": r.get("title", ""),
        "announcement": r.get("body", ""),
        "category": r.get("category", "general"),
        "is_pinned": bool(r.get("is_pinned")),
        "time": r.get("created_at", time),
    }


async def update_announcement(
    supabase: AsyncClient,
    announcement_id: str,
    update_data: dict,
) -> dict | None:
    """
    Update an existing announcement.
    """
    db_update = {}
    if "announcement" in update_data:
        db_update["body"] = update_data["announcement"]
    if "title" in update_data:
        db_update["title"] = update_data["title"]
    if "category" in update_data:
        db_update["category"] = update_data["category"]
    if "is_pinned" in update_data:
        db_update["is_pinned"] = update_data["is_pinned"]
    if "time" in update_data:
        db_update["created_at"] = update_data["time"]

    if not db_update:
        # Nothing to update, return the existing row
        resp = await supabase.table("announcements").select("*").eq("id", announcement_id).execute()
        r = first_row(resp)
        if not r:
            return None
    else:
        resp = await (
            supabase.table("announcements")
            .update(db_update)
            .eq("id", announcement_id)
            .execute()
        )
        r = first_row(resp)
        if not r:
            return None

    return {
        "id": str(r["id"]),
        "title": r.get("title", ""),
        "announcement": r.get("body", ""),
        "category": r.get("category", "general"),
        "is_pinned": bool(r.get("is_pinned")),
        "time": r.get("created_at"),
    }


async def delete_announcement(
    supabase: AsyncClient,
    announcement_id: str,
) -> bool:
    """
    Remove an announcement.
    Returns True if successfully deleted, False if not found.
    """
    resp = await (
        supabase.table("announcements")
        .delete()
        .eq("id", announcement_id)
        .execute()
    )
    # The SDK usually returns the deleted rows
    return len(rows(resp)) > 0
