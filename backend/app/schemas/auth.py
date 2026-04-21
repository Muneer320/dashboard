from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    """
    User login payload.

    The frontend sends the user's email address in the ``email`` field.
    Internally this maps 1-to-1 to ``users.username`` because organisers
    provision accounts where the email IS the username.
    """
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=6, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class MeResponse(BaseModel):
    id: str
    username: str
    name: str
    is_attending: bool


# ── Internal-only (used by unstop/sync, not exposed to public UI) ─────────────

class RegisterRequest(BaseModel):
    """Internal use only — organiser-triggered account creation."""
    username: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=6, max_length=128)
    name: str = Field(min_length=1, max_length=255)
    unstop_id: str | None = Field(default=None, max_length=128)


class RegisterResponse(BaseModel):
    id: str
    username: str
    name: str
