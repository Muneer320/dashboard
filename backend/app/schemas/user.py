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


class LeaderboardEntry(BaseModel):
    rank: int
    user_id: str
    name: str
    username: str
    cents: int
    is_current_user: bool = False


class GlobalLeaderboardResponse(BaseModel):
    total_users: int
    filtered_users: int | None = None
    top: list[LeaderboardEntry]
    me: LeaderboardEntry | None = None
    page: int = 1
    page_size: int = 100
    total_pages: int = 0
    search: str | None = None


class EventLeaderboardItem(BaseModel):
    event_id: str
    event_name: str
    total_participants: int
    filtered_participants: int | None = None
    top: list[LeaderboardEntry]
    me: LeaderboardEntry | None = None
    page: int = 1
    page_size: int = 100
    total_pages: int = 0
    search: str | None = None


class MyLeaderboardResponse(BaseModel):
    global_board: GlobalLeaderboardResponse
    event_boards: list[EventLeaderboardItem]
