from typing import Optional

from pydantic import BaseModel


# ── Overview ──────────────────────────────────────────────────────────────────

class StatsResponse(BaseModel):
    totalRegistered: int
    totalTeams: int
    attending: int
    restricted: int
    foodClaimed: int
    entryScanned: int
    submitted: int         # unique teams (or solo users) that submitted
    submittedTeams: int    # alias same as submitted; keeps naming consistent
    eventCount: int


class EventStatsItem(BaseModel):
    id: str
    name: str
    title: str = ""
    category: str
    date: Optional[str]
    venue: list[str]
    maxParticipants: int
    registered: int
    teams: int             # unique teams registered (0 for solo events)
    attended: int
    submitted: int         # unique teams (or solo users) that submitted
    submittedTeams: int    # same value, explicit label for UI
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
    title: str = ""
    venue: list[str]
    date: Optional[str]
    maxParticipants: int
    registered: int
    teams: int
    submitted: int
    submittedTeams: int
    attended: int
    participants: list[MyEventParticipant]
    communityLink: Optional[str] = None


# ── Event Detail (single event with full data) ────────────────────────────────

class EventUpdateRequest(BaseModel):
    """Body for PATCH /admin-panel/events/{event_id} — all fields optional."""
    name: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    venue: Optional[list[str]] = None
    date: Optional[str] = None               # maps to start_date  (ISO date)
    end_date: Optional[str] = None           # maps to end_date    (ISO datetime)
    registration_deadline: Optional[str] = None  # ISO datetime
    category: Optional[str] = None
    maxParticipants: Optional[int] = None
    communityLink: Optional[str] = None
    rules: Optional[str] = None
    judges: Optional[list[str]] = None
    rounds: Optional[dict] = None            # full rounds JSONB replacement
    questions: Optional[dict] = None         # full questions JSONB replacement


class EventDetailResponse(BaseModel):
    """Full event detail returned by GET /admin-panel/events/{event_id}."""
    id: str
    name: str
    title: str = ""
    description: Optional[str] = None
    category: str
    date: Optional[str]                      # start_date
    end_date: Optional[str] = None
    registration_deadline: Optional[str] = None
    venue: list[str]
    maxParticipants: int
    registered: int
    teams: int             # unique teams registered for this event
    attended: int
    submitted: int         # unique teams (or solo users) that submitted
    submittedTeams: int    # same value, explicit label
    restricted: int
    communityLink: Optional[str] = None
    rules: Optional[str] = None
    judges: list[str] = []
    rounds: dict = {}
    questions: dict = {}
    participants: list[MyEventParticipant]


# ── Contact Info & Admins ─────────────────────────────────────────────────────

class AdminUserItem(BaseModel):
    uid: int
    username: str
    name: str
    role: str
    phone: Optional[str]
    mail: Optional[str]
    events: list                 # list as stored in JSONB (names or IDs)


# ── Admin User CRUD ───────────────────────────────────────────────────────────

class AdminUserCreate(BaseModel):
    """Body for POST /admin-users — creates a new admin account."""
    username: str
    name: str
    role: str
    password: str                # plain-text; will be hashed server-side
    mail: Optional[str] = None
    phone: Optional[str] = None
    # list of event ID strings to assign immediately
    events: list[str] = []


class AdminUserUpdate(BaseModel):
    """Body for PATCH /admin-users/{uid} — all fields optional."""
    name: Optional[str] = None
    role: Optional[str] = None
    password: Optional[str] = None
    mail: Optional[str] = None
    phone: Optional[str] = None
    events: Optional[list[str]] = None  # full replacement of the events list


class AdminUserResponse(BaseModel):
    """Returned by POST / PATCH / DELETE on admin-users."""
    uid: int
    username: str
    name: str
    role: str
    phone: Optional[str]
    mail: Optional[str]
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


# ── Requested Members (credentials-request admin review) ──────────────────────

class RequestedMemberItem(BaseModel):
    """One row from requested_members, shaped for the admin panel table."""
    id: str
    ticket_id: str
    name: str
    college: str
    email: str
    phone: str
    areas_of_interest: list[str]
    description: Optional[str] = None
    status: str                 # pending | approved | rejected
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class RequestedMemberStatusUpdate(BaseModel):
    """Body for PATCH /admin-panel/requested-members/{id}."""
    status: str                 # pending | approved | rejected
