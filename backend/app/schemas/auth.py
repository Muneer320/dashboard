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
    role: str = "participant"


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


class VisitorSignupRequest(BaseModel):
    """Public self-registration for walk-in visitors."""
    name: str = Field(min_length=1, max_length=255)
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=8, max_length=128)
    phone: str | None = Field(default=None, max_length=32)
    college: str | None = Field(default=None, max_length=512)
    city: str | None = Field(default=None, max_length=255)
    branch: str | None = Field(default=None, max_length=255)
    year: str | None = Field(default=None, max_length=16)
    gender: str | None = Field(default=None, max_length=4)
    emergency_contact: str | None = Field(default=None, max_length=32)


class VisitorSignupResponse(BaseModel):
    id: str
    username: str
    name: str
    access_token: str
