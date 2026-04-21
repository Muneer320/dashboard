"""Team row dataclass."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from app.models._util import coerce_datetime, coerce_optional_uuid, coerce_uuid


@dataclass
class Team:
    id: uuid.UUID
    name: str
    event_id: uuid.UUID
    leader_id: uuid.UUID | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    @classmethod
    def from_row(cls, row: dict[str, Any]) -> "Team":
        return cls(
            id=coerce_uuid(row["id"]),
            name=row["name"],
            event_id=coerce_uuid(row["event_id"]),
            leader_id=coerce_optional_uuid(row.get("leader_id")),
            created_at=coerce_datetime(row.get("created_at")),
            updated_at=coerce_datetime(row.get("updated_at")),
        )
