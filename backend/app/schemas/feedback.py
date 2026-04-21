from pydantic import BaseModel, Field


class FeedbackScores(BaseModel):
    """Slider scores — each 0-10, all optional so partial submissions don't 422."""
    organization:  int = Field(default=0, ge=0, le=10)
    food:          int = Field(default=0, ge=0, le=10)
    events:        int = Field(default=0, ge=0, le=10)
    ambiance:      int = Field(default=0, ge=0, le=10)
    communication: int = Field(default=0, ge=0, le=10)


class FeedbackSubmit(BaseModel):
    """POST body for /feedback."""
    scores: FeedbackScores = Field(default_factory=FeedbackScores)
    fix:       str | None = Field(default=None, max_length=5000)
    highlight: str | None = Field(default=None, max_length=5000)


class FeedbackResponse(BaseModel):
    """Response after a successful submission."""
    id: str
    message: str = "Thanks for the feedback."
