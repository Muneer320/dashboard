from pydantic import BaseModel


class TeamMember(BaseModel):
    """A member of a team."""
    user_id: str
    name: str
    role: str       # "leader" or "member"
    is_me: bool


class MyTeamResponse(BaseModel):
    """Response payload for GET /events/{event_id}/my-team."""
    team_id: str
    name: str
    member_ids: list[str] = []
    members: list[TeamMember]
