from datetime import datetime

from pydantic import BaseModel, Field


class SubmissionLinks(BaseModel):
    """
    The shape stored in user.events[event_id]['submission'].

    Both links are optional individually — a participant may submit only a
    repo, only a deployed app, or both.  At least one must be non-empty for
    the entry to count as a valid submission.
    """
    repoLink: str = Field(default="", max_length=2048)
    deployLink: str = Field(default="", max_length=2048)
    submittedAt: datetime | None = None


class SubmissionRequest(BaseModel):
    """JSON body for POST /events/{event_id}/submit."""
    phase: int = Field(ge=1)
    repo_link: str = Field(default="", max_length=2048)
    deploy_link: str = Field(default="", max_length=2048)

    def has_content(self) -> bool:
        return bool(self.repo_link.strip() or self.deploy_link.strip())


class SubmissionResponse(BaseModel):
    message: str
    event_id: str
    phase: int
    submitted_at: datetime
    submission: SubmissionLinks


class SubmissionFetchResponse(BaseModel):
    event_id: str
    phase: int
    has_submission: bool
    submission: SubmissionLinks | None = None
