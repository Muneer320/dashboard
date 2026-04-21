"""
Anonymous feedback dataclass.

No user_id — deliberate privacy contract.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from app.models._util import coerce_datetime, coerce_uuid


@dataclass
class Feedback:
    id: uuid.UUID
    scores: dict = field(default_factory=dict)
    fix: str | None = None
    highlight: str | None = None
    created_at: datetime | None = None

    @classmethod
    def from_row(cls, row: dict[str, Any]) -> "Feedback":
        return cls(
            id=coerce_uuid(row["id"]),
            scores=row.get("scores") or {},
            fix=row.get("fix"),
            highlight=row.get("highlight"),
            created_at=coerce_datetime(row.get("created_at")),
        )
