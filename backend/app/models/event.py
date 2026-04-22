"""Event row dataclass."""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from app.models._util import coerce_datetime, coerce_uuid


# Per-event default — the number of meal slots this event contributes to a
# registered user's overall allowance. Summed across all events a user is
# registered for to determine their total meals_count.
DEFAULT_EVENT_MEALS_COUNT = 3


@dataclass
class Event:
    id: uuid.UUID
    name: str
    description: str = ""
    start_date: datetime | None = None
    end_date: datetime | None = None
    venue: list[str] = field(default_factory=list)
    judges: list[str] = field(default_factory=list)
    category: str = ""
    rounds: dict = field(default_factory=dict)
    participants: dict = field(default_factory=dict)
    schedule: list = field(default_factory=list)
    rules: str = ""
    community_link: str | None = None
    max_participants: int = 500
    meals_count: int = DEFAULT_EVENT_MEALS_COUNT
    registration_deadline: datetime | None = None
    # Keyed by phase: { "phase1": [ <QuestionDefinition dict>, ... ], ... }
    questions: dict = field(default_factory=dict)
    created_at: datetime | None = None
    updated_at: datetime | None = None

    @classmethod
    def from_row(cls, row: dict[str, Any]) -> "Event":
        return cls(
            id=coerce_uuid(row["id"]),
            name=row["name"],
            description=row.get("description") or "",
            category=row.get("category") or "",
            start_date=coerce_datetime(row.get("start_date")),
            end_date=coerce_datetime(row.get("end_date")),
            venue=list(row.get("venue") or []),
            judges=list(row.get("judges") or []),
            rounds=row.get("rounds") or {},
            participants=row.get("participants") or {},
            schedule=row.get("schedule") or [],
            rules=row.get("rules") or "",
            community_link=row.get("community_link") or None,
            max_participants=int(row.get("max_participants") or 500),

            meals_count=int(
                row.get("meals_count")
                if row.get("meals_count") is not None
                else DEFAULT_EVENT_MEALS_COUNT
            ),

            registration_deadline=coerce_datetime(
                row.get("registration_deadline")
            ),

            questions=row.get("questions") or {},

            created_at=coerce_datetime(row.get("created_at")),
            updated_at=coerce_datetime(row.get("updated_at")),
        )