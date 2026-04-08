from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=6, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class MeResponse(BaseModel):
    id: str
    username: str
    name: str
    role: str


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=6, max_length=128)
    name: str = Field(min_length=1, max_length=255)
    unstop_id: str | None = Field(default=None, max_length=128)


class RegisterResponse(BaseModel):
    id: str
    username: str
    name: str
    role: str
