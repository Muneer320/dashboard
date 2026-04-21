import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.team import Team
from app.models.user import User


async def get_my_team(session: AsyncSession, user: User, event_id: str) -> dict | None:
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

    # Fetch the team details
    result = await session.execute(select(Team).where(Team.id == team_uuid))
    team = result.scalar_one_or_none()
    if not team:
        return None

    # Fetch all members of this team for this event
    # Query the JSONB field where user.events[event_id]["teamId"] == team_id_str
    # Postgres syntax: users.events -> 'event_id' ->> 'teamId' = 'team_id_str'
    users_result = await session.execute(
        select(User).where(User.events[event_id]["teamId"].astext == team_id_str)
    )
    team_users = users_result.scalars().all()

    leader_id_str = str(team.leader_id) if team.leader_id else None

    members = []
    for member in team_users:
        member_id_str = str(member.id)
        # Check if they are the leader
        role = "leader" if leader_id_str == member_id_str else "member"
        members.append(
            {
                "user_id": member_id_str,
                "name": member.name,
                "role": role,
                "is_me": member_id_str == str(user.id),
            }
        )

    return {
        "team_id": str(team.id),
        "name": team.name,
        "members": members,
    }
