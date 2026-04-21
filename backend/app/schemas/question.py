"""
Schemas for event question definitions and the admin endpoints that manage them.

Question types
--------------
text          Short free-text answer; optional word_limit (default 50).
text-long     Long free-text answer; optional word_limit (default 500).
url           A URL string; validated to start with http:// or https://.
mcq           Single-choice from `options` list.
multi-choice  One or more choices from `options` list.
numeric       Integer answer.
email         RFC-5322-ish e-mail string.
declaration   User must acknowledge every statement in `declarations`.
"""

from __future__ import annotations

import re
from typing import Annotated, Any, Literal

from pydantic import BaseModel, field_validator, model_validator

# ---------------------------------------------------------------------------
# Supported question type literals
# ---------------------------------------------------------------------------

QuestionType = Literal[
    "text",
    "text-long",
    "url",
    "mcq",
    "multi-choice",
    "numeric",
    "email",
    "declaration",
]

_URL_RE = re.compile(r"^https?://", re.IGNORECASE)
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


# ---------------------------------------------------------------------------
# Single question definition
# ---------------------------------------------------------------------------

class QuestionDefinition(BaseModel):
    """One question inside an event phase."""

    question_id: str
    question_text: str
    question_type: QuestionType
    required: bool = True

    # Optional per-type extras — validated in model_validator below
    word_limit: int | None = None          # text / text-long
    options: list[str] | None = None       # mcq / multi-choice
    declarations: list[str] | None = None  # declaration

    @field_validator("question_id")
    @classmethod
    def question_id_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("question_id must not be empty")
        return v.strip()

    @field_validator("question_text")
    @classmethod
    def question_text_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("question_text must not be empty")
        return v.strip()

    @model_validator(mode="after")
    def validate_type_extras(self) -> "QuestionDefinition":
        qt = self.question_type

        if qt in ("mcq", "multi-choice"):
            if not self.options:
                raise ValueError(
                    f"question_type '{qt}' requires a non-empty options list"
                )

        if qt == "declaration":
            if not self.declarations:
                raise ValueError(
                    "question_type 'declaration' requires a non-empty declarations list"
                )

        if qt not in ("text", "text-long") and self.word_limit is not None:
            raise ValueError("word_limit is only valid for 'text' and 'text-long' types")

        return self


# ---------------------------------------------------------------------------
# Phase question list (validates uniqueness of question_id within a phase)
# ---------------------------------------------------------------------------

class PhaseQuestions(BaseModel):
    """Ordered list of questions for a single event phase."""

    questions: list[QuestionDefinition]

    @field_validator("questions")
    @classmethod
    def unique_question_ids(cls, v: list[QuestionDefinition]) -> list[QuestionDefinition]:
        seen: set[str] = set()
        for q in v:
            if q.question_id in seen:
                raise ValueError(
                    f"Duplicate question_id '{q.question_id}' within phase"
                )
            seen.add(q.question_id)
        return v


# ---------------------------------------------------------------------------
# Full event questions payload (all phases)
# ---------------------------------------------------------------------------

class EventQuestionsPayload(BaseModel):
    """
    Body for PUT /events/{event_id}/questions.
    Keys must be 'phase1', 'phase2', etc.
    Value for each key is the ordered list of questions for that phase.
    """

    questions: dict[str, list[QuestionDefinition]]

    @field_validator("questions")
    @classmethod
    def validate_phase_keys(
        cls, v: dict[str, list[QuestionDefinition]]
    ) -> dict[str, list[QuestionDefinition]]:
        import re as _re
        bad = [k for k in v if not _re.match(r"^phase\d+$", k)]
        if bad:
            raise ValueError(
                f"Invalid phase key(s): {bad}. Keys must match 'phase<N>' (e.g. 'phase1')."
            )
        # Enforce uniqueness of question_ids within each phase
        for phase_key, questions in v.items():
            ids: set[str] = set()
            for q in questions:
                if q.question_id in ids:
                    raise ValueError(
                        f"Duplicate question_id '{q.question_id}' in {phase_key}"
                    )
                ids.add(q.question_id)
        return v


# ---------------------------------------------------------------------------
# Response shapes
# ---------------------------------------------------------------------------

class PhaseQuestionsResponse(BaseModel):
    """Returned by GET /events/{event_id}/questions?phase=1."""

    event_id: str
    phase: int
    phase_key: str
    questions: list[QuestionDefinition]


class EventQuestionsResponse(BaseModel):
    """Returned by PUT /events/{event_id}/questions."""

    event_id: str
    questions: dict[str, list[QuestionDefinition]]
    message: str
