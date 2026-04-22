"""
Schemas for the question-based submission system.

Flow
----
1. User fetches GET /events/{id}/questions?phase=1  → sees the question list.
2. User POSTs  POST /events/{id}/submit              → sends answers.
3. Service validates answers against question definitions, then writes:
     users.events[event_id].submission.phase1   — latest snapshot (user row)
     events.participants[user_id].submission.phase1 — history + scoring slot
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, field_validator


# ---------------------------------------------------------------------------
# Answer item — one answer to one question
# ---------------------------------------------------------------------------

class AnswerItem(BaseModel):
    """
    A single question/answer pair inside a submission.

    `answer` is typed as Any because different question types produce
    different Python types:
      text / text-long / url / email  → str
      numeric                          → int   (coerced from str by validator)
      mcq                              → str   (one option value)
      multi-choice                     → list[str]
      declaration                      → list[str]  (the acknowledged statements)
    """

    question_id: str = Field(min_length=1)
    answer: Any

    @field_validator("question_id")
    @classmethod
    def strip_id(cls, v: str) -> str:
        return v.strip()


# ---------------------------------------------------------------------------
# Submission request
# ---------------------------------------------------------------------------

class SubmissionRequest(BaseModel):
    """JSON body for POST /events/{event_id}/submit."""

    phase: int = Field(ge=1)
    answers: list[AnswerItem] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Per-phase submission record (stored in both user and event rows)
# ---------------------------------------------------------------------------

class PhaseSubmissionRecord(BaseModel):
    """The shape stored in DB for one phase's submission."""

    submitted: bool = False
    submitted_at: datetime | None = None
    answers: list[AnswerItem] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------

class SubmissionResponse(BaseModel):
    message: str
    event_id: str
    phase: int
    phase_key: str
    submitted_at: datetime
    answers: list[AnswerItem]


class SubmissionFetchResponse(BaseModel):
    event_id: str
    phase: int
    phase_key: str
    has_submission: bool
    submitted_at: datetime | None = None
    answers: list[AnswerItem] = Field(default_factory=list)
