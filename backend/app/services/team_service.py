"""Supabase-backed team service."""

from __future__ import annotations

import uuid

from fastapi import HTTPException, status
from supabase import AsyncClient

from app.db.supabase_client import first_row, rows
from app.models.team import Team
from app.models.user import User


async def get_my_team(
    supabase: AsyncClient, user: User, event_id: str
) -> dict | None:
    """
    Fetch the user's team for the specified event, including all members.
    Returns None if the user is not in a team for this event.
    """
    events_data = user.events or {}
    event_entry = events_data.get(event_id)
    if not event_entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not registered for this event",
        )

    team_id_str = event_entry.get("teamId")
    if not team_id_str:
        return None  # No team

    try:
        team_uuid = uuid.UUID(team_id_str)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid team ID in user profile",
        ) from exc

    # Fetch the team details (includes member_ids column)
    team_resp = await (
        supabase.table("teams")
        .select("*")
        .eq("id", str(team_uuid))
        .limit(1)
        .execute()
    )
    team_row = first_row(team_resp)
    if team_row is None:
        return None

    team = Team.from_row(team_row)

    # Use member_ids stored on the team row for an efficient targeted lookup
    member_id_strings = [str(m) for m in team.member_ids]

    if member_id_strings:
        members_resp = await (
            supabase.table("users")
            .select("id, name")
            .in_("id", member_id_strings)
            .execute()
        )
        member_rows = rows(members_resp)
    else:
        # Fallback: scan users by JSONB teamId (handles legacy rows not yet backfilled)
        try:
            members_resp = await (
                supabase.table("users")
                .select("id, name, events")
                .filter(f"events->{event_id}->>teamId", "eq", team_id_str)
                .execute()
            )
            member_rows = rows(members_resp)
        except Exception:
            all_resp = await (
                supabase.table("users")
                .select("id, name, events")
                .execute()
            )
            member_rows = [
                r
                for r in rows(all_resp)
                if ((r.get("events") or {}).get(event_id) or {}).get("teamId")
                == team_id_str
            ]

    leader_id_str = str(team.leader_id) if team.leader_id else None

    members = []
    for member in member_rows:
        member_id_str = str(member["id"])
        role = "leader" if leader_id_str == member_id_str else "member"
        members.append(
            {
                "user_id": member_id_str,
                "name": member["name"],
                "role": role,
                "is_me": member_id_str == str(user.id),
            }
        )

    return {
        "team_id": str(team.id),
        "name": team.name,
        "member_ids": [str(m) for m in team.member_ids],
        "members": members,
    }
