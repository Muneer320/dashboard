from pydantic import BaseModel, Field


class UserProfileUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=255)
    details: dict | None = None
    is_profile_complete: bool | None = None


class UserResponse(BaseModel):
    id: str
    username: str
    name: str
    details: dict
    events: dict
    food: dict
    access_level: str
    role: str
    is_profile_complete: bool
