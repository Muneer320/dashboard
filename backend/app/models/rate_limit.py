"""Rate-limit bucket row dataclass."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from app.models._util import coerce_datetime, coerce_uuid


@dataclass
class RateLimitEntry:
    id: uuid.UUID
    rate_key: str
    request_count: int = 0
    window_started_at: datetime | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    @classmethod
    def from_row(cls, row: dict[str, Any]) -> "RateLimitEntry":
        return cls(
            id=coerce_uuid(row["id"]),
            rate_key=row["rate_key"],
            request_count=int(row.get("request_count") or 0),
            window_started_at=coerce_datetime(row.get("window_started_at")),
            created_at=coerce_datetime(row.get("created_at")),
            updated_at=coerce_datetime(row.get("updated_at")),
        )
