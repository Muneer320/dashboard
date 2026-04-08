from datetime import datetime

from pydantic import BaseModel, Field


class SubmissionRequest(BaseModel):
    phase: int = Field(ge=1)
    submission_type: str = Field(pattern="^(url|file)$")
    value: str = Field(min_length=1, max_length=2048)


class SubmissionResponse(BaseModel):
    message: str
    event_id: str
    phase: int
    submitted_at: datetime
