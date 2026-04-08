from pydantic import BaseModel, Field


class UnstopUserItem(BaseModel):
    unstop_id: str = Field(min_length=1, max_length=128)
    username: str = Field(min_length=3, max_length=64)
    name: str = Field(min_length=1, max_length=255)
    details: dict = Field(default_factory=dict)
    access_level: str = Field(default="ROUND1")
    is_profile_complete: bool = False


class UnstopSyncRequest(BaseModel):
    users: list[UnstopUserItem]


class UnstopSyncCreatedCredential(BaseModel):
    unstop_id: str
    username: str
    temporary_password: str


class UnstopSyncResponse(BaseModel):
    created: int
    updated: int
    created_credentials: list[UnstopSyncCreatedCredential]
