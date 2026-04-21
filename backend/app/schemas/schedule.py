from pydantic import BaseModel


class ScheduleItem(BaseModel):
    """A single slot in an event or global schedule."""
    title: str
    start_time: str   # ISO-8601 string e.g. "2026-05-10T10:00:00+05:30"
    end_time: str
    venue: str


class AnnouncementItem(BaseModel):
    """A single announcement attached to a day."""
    announcement: str
    time: str         # ISO-8601 datetime string
    category: str = "general"   # free-form tag: general | schedule | meal | alert | ...


class EventScheduleResponse(BaseModel):
    event_id: str
    event_name: str
    schedule: list[ScheduleItem]


class GlobalScheduleItem(BaseModel):
    """One row from the global table."""
    id: str
    date: str          # "2026-05-10"
    schedule: list[ScheduleItem]
    announcements: list[AnnouncementItem] = []


class GlobalScheduleUpsert(BaseModel):
    """Admin payload to create or replace a day's global schedule and announcements."""
    date: str          # "YYYY-MM-DD"
    schedule: list[ScheduleItem]
    announcements: list[AnnouncementItem] = []
