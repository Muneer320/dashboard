"""GlobalSchedule row dataclass — table name is ``global``."""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any

from app.models._util import coerce_date, coerce_datetime, coerce_uuid


@dataclass
class GlobalSchedule:
    id: uuid.UUID
    date: date
    schedule: list = field(default_factory=list)
    announcements: list = field(default_factory=list)
    created_at: datetime | None = None
    updated_at: datetime | None = None

    @classmethod
    def from_row(cls, row: dict[str, Any]) -> "GlobalSchedule":
        row_date = coerce_date(row.get("date"))
        if row_date is None:
            raise ValueError(f"global row missing date: {row!r}")
        return cls(
            id=coerce_uuid(row["id"]),
            date=row_date,
            schedule=list(row.get("schedule") or []),
            announcements=list(row.get("announcements") or []),
            created_at=coerce_datetime(row.get("created_at")),
            updated_at=coerce_datetime(row.get("updated_at")),
        )
