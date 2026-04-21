"""Rating row dataclass (one row per user/event pair)."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from app.models._util import coerce_datetime, coerce_uuid


@dataclass
class Rating:
    id: uuid.UUID
    user_id: uuid.UUID
    event_id: uuid.UUID
    value: int
    feedback: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    @classmethod
    def from_row(cls, row: dict[str, Any]) -> "Rating":
        return cls(
            id=coerce_uuid(row["id"]),
            user_id=coerce_uuid(row["user_id"]),
            event_id=coerce_uuid(row["event_id"]),
            value=int(row["value"]),
            feedback=row.get("feedback"),
            created_at=coerce_datetime(row.get("created_at")),
            updated_at=coerce_datetime(row.get("updated_at")),
        )
