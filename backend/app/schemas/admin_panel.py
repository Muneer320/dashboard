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
    communityLink: Optional[str] = None


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
    submissionData: Optional[dict] = None  # raw submission JSONB from users.events[eid]


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
    communityLink: Optional[str] = None


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


# ── Meals ─────────────────────────────────────────────────────────────────────

class EventMealsItem(BaseModel):
    """One row in the per-event meals_count table."""
    id: str
    name: str
    meals_count: int


class EventMealsUpdate(BaseModel):
    """Body for PATCH /admin-panel/events/{event_id}/meals-count."""
    meals_count: int


class UserMealClaim(BaseModel):
    """One meal slot in the per-user claim matrix."""
    meal_id: str        # e.g. "meal1"
    claimed: bool


class UserMealsRow(BaseModel):
    """All meal claims for a single user, plus their allowance summary."""
    user_id: str
    name: str
    username: str
    allowance: int       # sum(events.meals_count) across registered events
    claimed: int         # count of True entries in users.food
    claims: list[UserMealClaim]  # covers meal1..meal{allowance}


class UserMealsResponse(BaseModel):
    """
    GET /admin-panel/meals/users — per-user claim matrix.
    ``max_meals_count`` is the sum of meals_count across all events, useful
    for sizing the UI table columns.
    """
    max_meals_count: int
    users: list[UserMealsRow]


class MealEntryResponse(BaseModel):
    """Response for manual add/remove of a single meal entry for a user."""
    user_id: str
    meal_id: str
    claimed: bool
    message: str


# ── Bulk Enroll ───────────────────────────────────────────────────────────────

class BulkEnrollCredential(BaseModel):
    """One new user created by the bulk-enroll flow. Sent back so admins can
    email credentials out to participants."""
    email: str
    password: str
    name: str
    event: str
    event_id: str


class BulkEnrollExistingRow(BaseModel):
    """A user that already existed and had the event added to their list."""
    email: str
    user_id: str
    name: str


class BulkEnrollDuplicate(BaseModel):
    """A user that was already enrolled in this specific event — skipped."""
    row: int
    email: str


class BulkEnrollError(BaseModel):
    """A row that couldn't be processed (bad email, DB error, …)."""
    row: int
    email: str
    reason: str


class BulkEnrollSummary(BaseModel):
    total_rows: int
    created: int
    added_to_existing: int
    duplicates: int
    errors: int


class BulkEnrollEvent(BaseModel):
    id: str
    name: str


class BulkEnrollResponse(BaseModel):
    """
    Response for POST /admin-panel/users/bulk-enroll.
    ``new_credentials`` holds the rows the frontend should export to CSV so the
    admin can mail logins out.
    """
    event: BulkEnrollEvent
    summary: BulkEnrollSummary
    new_credentials: list[BulkEnrollCredential]
    added_to_existing: list[BulkEnrollExistingRow]
    duplicates_detail: list[BulkEnrollDuplicate]
    errors_detail: list[BulkEnrollError]
