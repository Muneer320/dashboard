from typing import Optional

from pydantic import BaseModel


# ── Overview ──────────────────────────────────────────────────────────────────

class StatsResponse(BaseModel):
    totalRegistered: int
    attending: int
    restricted: int
    foodClaimed: int
    entryScanned: int
    submitted: int
    eventCount: int


class EventStatsItem(BaseModel):
    id: str
    name: str
    category: str
    date: Optional[str]
    venue: list[str]
    maxParticipants: int
    registered: int
    attended: int
    submitted: int
    restricted: int


# ── Participants ───────────────────────────────────────────────────────────────

class ParticipantItem(BaseModel):
    id: str
    name: str
    username: str
    eventId: str
    eventName: str
    teamId: Optional[str]
    status: str                  # "active" | "restricted"
    isAttending: bool            # event-level gate
    foodClaimed: bool
    entryScanned: bool           # campus-level gate (user.is_attending)
    submitted: bool              # True once ANY phase has a completed submission


class RestrictRequest(BaseModel):
    event_id: str
    restricted: bool


class RestrictResponse(BaseModel):
    user_id: str
    event_id: str
    restricted: bool


# ── My Events ─────────────────────────────────────────────────────────────────

class MyEventParticipant(BaseModel):
    id: str
    name: str
    teamId: Optional[str]
    status: str
    submitted: bool              # True once ANY phase has a completed submission
    isAttending: bool


class MyEventItem(BaseModel):
    id: str
    name: str
    venue: list[str]
    date: Optional[str]
    maxParticipants: int
    registered: int
    submitted: int
    attended: int
    participants: list[MyEventParticipant]


# ── Contact Info ──────────────────────────────────────────────────────────────

class EventManagerItem(BaseModel):
    uid: int
    username: str
    name: str
    phone: Optional[str]
    mail: str
    events: list                 # list as stored in JSONB (names or IDs)


# ── Event Manager CRUD ────────────────────────────────────────────────────────

class EventManagerCreate(BaseModel):
    """Body for POST /event-managers — creates a new eventManager account."""
    username: str
    name: str
    password: str                # plain-text; will be hashed server-side
    mail: str
    phone: Optional[str] = None
    # list of event ID strings to assign immediately
    events: list[str] = []


class EventManagerUpdate(BaseModel):
    """Body for PATCH /event-managers/{uid} — all fields optional."""
    name: Optional[str] = None
    mail: Optional[str] = None
    phone: Optional[str] = None
    events: Optional[list[str]] = None  # full replacement of the events list


class EventManagerResponse(BaseModel):
    """Returned by POST / PATCH / DELETE on event-managers."""
    uid: int
    username: str
    name: str
    phone: Optional[str]
    mail: str
    events: list
    message: str
