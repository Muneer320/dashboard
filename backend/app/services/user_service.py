"""Supabase-backed user service."""

from __future__ import annotations

import math
import uuid

from fastapi import HTTPException, status
from supabase import AsyncClient

from app.db.supabase_client import first_row
from app.models.event import Event
from app.models.user import User
from app.services.cache_service import get_or_set_json
from app.core.config import settings

_PAGE_SIZE = 1000
_LEADERBOARD_ROWS_CACHE_KEY = "leaderboard:rows:v1"
_LEADERBOARD_SNAPSHOT_CACHE_KEY = "leaderboard:snapshot:v1"


async def get_user_by_id(supabase: AsyncClient, user_id: str) -> User:
    try:
        user_uuid = uuid.UUID(user_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user id") from exc

    resp = await (
        supabase.table("users")
        .select("*")
        .eq("id", str(user_uuid))
        .limit(1)
        .execute()
    )
    row = first_row(resp)
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return User.from_row(row)


async def update_user_profile(
    supabase: AsyncClient, user: User, payload: dict
) -> User:
    patch: dict = {}

    if payload.get("name") is not None:
        patch["name"] = payload["name"]
        user.name = payload["name"]

    if payload.get("details") is not None:
        patch["details"] = payload["details"]
        user.details = payload["details"]

    if payload.get("is_profile_complete") is not None:
        patch["is_profile_complete"] = payload["is_profile_complete"]
        user.is_profile_complete = payload["is_profile_complete"]

    if not patch:
        return user

    resp = await (
        supabase.table("users")
        .update(patch)
        .eq("id", str(user.id))
        .execute()
    )
    row = first_row(resp)
    if row is not None:
        return User.from_row(row)
    return user


def get_user_events_payload(user: User) -> dict:
    return {
        "user_id": str(user.id),
        "events": user.events or {},
    }


async def _fetch_users_for_leaderboard(supabase: AsyncClient) -> list[dict]:
    """
    Pull only columns needed for leaderboard calculations.
    """
    all_rows: list[dict] = []
    offset = 0
    while True:
        resp = await (
            supabase.table("users")
            .select("id,name,username,cents,events")
            .range(offset, offset + _PAGE_SIZE - 1)
            .execute()
        )
        page = list(resp.data or [])
        all_rows.extend(page)
        if len(page) < _PAGE_SIZE:
            break
        offset += _PAGE_SIZE
    return all_rows


def _normalize_search(search: str | None) -> str | None:
    if search is None:
        return None
    token = search.strip().lower()
    return token if token else None


def _filter_rows(rows: list[dict], search: str | None) -> list[dict]:
    token = _normalize_search(search)
    if token is None:
        return rows

    filtered: list[dict] = []
    for row in rows:
        name = (row.get("name") or "").lower()
        username = (row.get("username") or "").lower()
        if token in name or token in username:
            filtered.append(row)
    return filtered


def _paginate_rows(rows: list[dict], page: int, page_size: int) -> tuple[list[dict], dict]:
    total = len(rows)
    if total == 0:
        return [], {
            "page": 1,
            "page_size": page_size,
            "total": 0,
            "total_pages": 0,
        }

    total_pages = math.ceil(total / page_size)
    safe_page = min(max(page, 1), total_pages)
    start = (safe_page - 1) * page_size
    end = start + page_size
    return rows[start:end], {
        "page": safe_page,
        "page_size": page_size,
        "total": total,
        "total_pages": total_pages,
    }


async def _get_cached_leaderboard_rows(supabase: AsyncClient) -> list[dict]:
    async def _fetch() -> list[dict]:
        return await _fetch_users_for_leaderboard(supabase)

    cached = await get_or_set_json(
        key=_LEADERBOARD_ROWS_CACHE_KEY,
        ttl_seconds=settings.LEADERBOARD_CACHE_TTL_SECONDS,
        fetcher=_fetch,
    )
    if isinstance(cached, list):
        return cached
    return []


def _sort_leaderboard_rows(rows: list[dict]) -> list[dict]:
    return sorted(
        rows,
        key=lambda row: (
            -(int(row.get("cents") or 0)),
            (row.get("name") or "").lower(),
            str(row.get("id") or ""),
        ),
    )


def _to_leaderboard_entry(
    row: dict,
    rank: int,
) -> dict:
    return {
        "rank": rank,
        "user_id": str(row["id"]),
        "name": row.get("name") or "Unnamed",
        "username": row.get("username") or "",
        "cents": int(row.get("cents") or 0),
        "is_current_user": False,
    }


def _attach_current_user(entries: list[dict], current_user_id: str) -> list[dict]:
    return [
        {
            **entry,
            "is_current_user": entry["user_id"] == current_user_id,
        }
        for entry in entries
    ]


async def _build_cached_leaderboard_snapshot(supabase: AsyncClient) -> dict:
    user_rows = await _get_cached_leaderboard_rows(supabase)

    ranked_global = _sort_leaderboard_rows(user_rows)
    global_top: list[dict] = []
    for index, row in enumerate(ranked_global, start=1):
        entry = _to_leaderboard_entry(row, index)
        global_top.append(entry)
    event_rows_by_id: dict[str, list[dict]] = {}
    for row in user_rows:
        event_map = row.get("events") or {}
        if not isinstance(event_map, dict):
            continue
        for event_id in event_map.keys():
            event_rows_by_id.setdefault(str(event_id), []).append(row)

    event_boards: dict[str, dict] = {}
    for event_id, participants in event_rows_by_id.items():
        ranked_event = _sort_leaderboard_rows(participants)
        event_top: list[dict] = []
        for index, row in enumerate(ranked_event, start=1):
            entry = _to_leaderboard_entry(row, index)
            event_top.append(entry)
        event_boards[event_id] = {
            "total_participants": len(ranked_event),
            "entries": event_top,
        }

    return {
        "total_users": len(ranked_global),
        "global_entries": global_top,
        "event_boards": event_boards,
    }


async def _get_cached_leaderboard_snapshot(supabase: AsyncClient) -> dict:
    async def _fetch() -> dict:
        return await _build_cached_leaderboard_snapshot(supabase)

    cached = await get_or_set_json(
        key=_LEADERBOARD_SNAPSHOT_CACHE_KEY,
        ttl_seconds=settings.LEADERBOARD_CACHE_TTL_SECONDS,
        fetcher=_fetch,
    )
    if isinstance(cached, dict):
        return cached
    return {"total_users": 0, "global_entries": [], "event_boards": {}}


async def build_my_leaderboard_payload(
    supabase: AsyncClient,
    current_user: User,
    all_events: list[Event],
    page: int = 1,
    page_size: int = 100,
    search: str | None = None,
) -> dict:
    snapshot = await _get_cached_leaderboard_snapshot(supabase)
    current_user_id = str(current_user.id)
    global_entries = _attach_current_user(
        list(snapshot.get("global_entries") or []),
        current_user_id,
    )
    global_me = next((entry for entry in global_entries if entry["is_current_user"]), None)
    filtered_global = _filter_rows(global_entries, search)
    paginated_global, global_pagination = _paginate_rows(filtered_global, page, page_size)

    event_name_by_id = {str(event.id): event.name for event in all_events}
    current_user_event_ids = list((current_user.events or {}).keys())
    raw_event_boards = snapshot.get("event_boards") or {}

    event_boards: list[dict] = []
    for event_id in current_user_event_ids:
        raw_event = raw_event_boards.get(event_id) or {}
        event_entries = _attach_current_user(
            list(raw_event.get("entries") or []),
            current_user_id,
        )
        event_me = next((entry for entry in event_entries if entry["is_current_user"]), None)
        filtered_event = _filter_rows(event_entries, search)
        paginated_event, event_pagination = _paginate_rows(filtered_event, page, page_size)

        event_boards.append(
            {
                "event_id": event_id,
                "event_name": event_name_by_id.get(event_id, "Event"),
                "total_participants": int(raw_event.get("total_participants") or 0),
                "filtered_participants": event_pagination["total"],
                "top": paginated_event,
                "me": event_me,
                "page": event_pagination["page"],
                "page_size": event_pagination["page_size"],
                "total_pages": event_pagination["total_pages"],
                "search": _normalize_search(search),
            }
        )

    event_boards.sort(key=lambda board: (board.get("me") or {}).get("rank", 10**9))

    return {
        "global_board": {
            "total_users": int(snapshot.get("total_users") or 0),
            "filtered_users": global_pagination["total"],
            "top": paginated_global,
            "me": global_me,
            "page": global_pagination["page"],
            "page_size": global_pagination["page_size"],
            "total_pages": global_pagination["total_pages"],
            "search": _normalize_search(search),
        },
        "event_boards": event_boards,
    }
