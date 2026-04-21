"""Event row dataclass."""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from app.models._util import coerce_datetime, coerce_uuid


@dataclass
class Event:
    id: uuid.UUID
    name: str
    description: str = ""
    start_date: datetime | None = None
    end_date: datetime | None = None
    venue: list[str] = field(default_factory=list)
    judges: list[str] = field(default_factory=list)
    rounds: dict = field(default_factory=dict)
    participants: dict = field(default_factory=dict)
    schedule: list = field(default_factory=list)
    rules: str = ""
    max_participants: int = 500
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
            start_date=coerce_datetime(row.get("start_date")),
            end_date=coerce_datetime(row.get("end_date")),
            venue=list(row.get("venue") or []),
            judges=list(row.get("judges") or []),
            rounds=row.get("rounds") or {},
            participants=row.get("participants") or {},
            schedule=row.get("schedule") or [],
            rules=row.get("rules") or "",
            max_participants=int(row.get("max_participants") or 500),
            registration_deadline=coerce_datetime(
                row.get("registration_deadline")),
            questions=row.get("questions") or {},
            created_at=coerce_datetime(row.get("created_at")),
            updated_at=coerce_datetime(row.get("updated_at")),
        )
