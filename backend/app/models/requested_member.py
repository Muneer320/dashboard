"""RequestedMember row dataclass (credentials request)."""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from app.models._util import coerce_datetime, coerce_uuid


@dataclass
class RequestedMember:
    id: uuid.UUID
    ticket_id: str
    name: str
    college: str
    email: str
    phone: str
    areas_of_interest: list[str] = field(default_factory=list)
    description: str | None = None
    status: str = "pending"
    created_at: datetime | None = None
    updated_at: datetime | None = None

    @classmethod
    def from_row(cls, row: dict[str, Any]) -> "RequestedMember":
        return cls(
            id=coerce_uuid(row["id"]),
            ticket_id=row["ticket_id"],
            name=row["name"],
            college=row["college"],
            email=row["email"],
            phone=row["phone"],
            areas_of_interest=list(row.get("areas_of_interest") or []),
            description=row.get("description"),
            status=row.get("status") or "pending",
            created_at=coerce_datetime(row.get("created_at")),
            updated_at=coerce_datetime(row.get("updated_at")),
        )
