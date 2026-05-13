"""Supabase-backed user service."""

from __future__ import annotations

import uuid

from fastapi import HTTPException, status
from supabase import AsyncClient

from app.db.supabase_client import first_row
from app.models.event import Event
from app.models.user import User

_PAGE_SIZE = 1000


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
    current_user_id: str,
) -> dict:
    return {
        "rank": rank,
        "user_id": str(row["id"]),
        "name": row.get("name") or "Unnamed",
        "username": row.get("username") or "",
        "cents": int(row.get("cents") or 0),
        "is_current_user": str(row["id"]) == current_user_id,
    }


async def build_my_leaderboard_payload(
    supabase: AsyncClient,
    current_user: User,
    all_events: list[Event],
    top_limit: int = 100,
) -> dict:
    user_rows = await _fetch_users_for_leaderboard(supabase)
    current_user_id = str(current_user.id)

    ranked_global = _sort_leaderboard_rows(user_rows)
    global_top: list[dict] = []
    global_me: dict | None = None
    for index, row in enumerate(ranked_global, start=1):
        entry = _to_leaderboard_entry(row, index, current_user_id)
        if index <= top_limit:
            global_top.append(entry)
        if entry["is_current_user"]:
            global_me = entry

    event_name_by_id = {str(event.id): event.name for event in all_events}
    current_user_event_ids = list((current_user.events or {}).keys())

    event_boards: list[dict] = []
    for event_id in current_user_event_ids:
        participants = []
        for row in user_rows:
            event_map = row.get("events") or {}
            if isinstance(event_map, dict) and event_id in event_map:
                participants.append(row)

        ranked_event = _sort_leaderboard_rows(participants)
        event_top: list[dict] = []
        event_me: dict | None = None
        for index, row in enumerate(ranked_event, start=1):
            entry = _to_leaderboard_entry(row, index, current_user_id)
            if index <= top_limit:
                event_top.append(entry)
            if entry["is_current_user"]:
                event_me = entry

        event_boards.append(
            {
                "event_id": event_id,
                "event_name": event_name_by_id.get(event_id, "Event"),
                "total_participants": len(ranked_event),
                "top": event_top,
                "me": event_me,
            }
        )

    event_boards.sort(
        key=lambda board: (board.get("me") or {}).get("rank", 10**9)
    )

    return {
        "global_board": {
            "total_users": len(ranked_global),
            "top": global_top,
            "me": global_me,
        },
        "event_boards": event_boards,
    }
