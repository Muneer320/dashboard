from pydantic import BaseModel, Field


class UserProfileUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=255)
    details: dict | None = None
    is_profile_complete: bool | None = None


class UserResponse(BaseModel):
    id: str
    username: str
    name: str
    is_attending: bool
    details: dict
    events: dict
    food: dict
    is_profile_complete: bool
    cents: int


class UserEventsResponse(BaseModel):
    user_id: str
    events: dict


class MyEventResponse(BaseModel):
    """Full event details merged with the user's per-event status."""
    id: str
    name: str
    description: str
    venue: list[str]
    participants_count: int
    user_status: dict  # {isAttending, phase, status, score, ...}
