from pydantic import BaseModel, Field


class RatingSubmit(BaseModel):
    """Body for POST /events/{event_id}/rating."""
    value: int = Field(ge=1, le=5, description="Star rating 1-5")
    feedback: str | None = Field(default=None, max_length=2000)


class RatingResponse(BaseModel):
    """My rating for this event."""
    event_id: str
    value: int
    feedback: str | None


class RatingSummary(BaseModel):
    """Aggregate stats for an event's ratings."""
    event_id: str
    avg: float
    count: int
