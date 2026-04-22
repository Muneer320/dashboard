from pydantic import BaseModel


class EventResponse(BaseModel):
    id: str
    name: str
    description: str
    venue: list[str]
    rounds: dict
    participants_count: int
    community_link: str | None = None


class EventRegisterResponse(BaseModel):
    message: str
    event_id: str
    user_id: str


class EventParticipantsResponse(BaseModel):
    event_id: str
    participants_count: int
    participants: dict
