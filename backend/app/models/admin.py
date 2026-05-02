"""Admin row dataclass."""

from __future__ import annotations

import enum
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from app.models._util import coerce_datetime


class AdminRole(str, enum.Enum):
    ADMIN = "admin"
    EVENT_MANAGER = "eventManager"
    SCANNER = "Scanner"
    # Sidequest roles
    BOOTH_VOLUNTEER = "booth_volunteer"
    PRM_VOLUNTEER = "prm_volunteer"
    PRM_LEAD = "prm_lead"
    OPS_LEAD = "ops_lead"


@dataclass
class Admin:
    uid: int
    username: str
    name: str
    password_hash: str
    mail: str
    role: AdminRole = AdminRole.ADMIN
    events: list = field(default_factory=list)
    phone: str | None = None
    booth_id: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    @classmethod
    def from_row(cls, row: dict[str, Any]) -> "Admin":
        raw_role = row.get("role") or AdminRole.ADMIN.value
        try:
            role = AdminRole(raw_role)
        except ValueError:
            role = AdminRole.ADMIN
        return cls(
            uid=int(row["uid"]),
            username=row["username"],
            name=row["name"],
            password_hash=row["password_hash"],
            mail=row["mail"],
            role=role,
            events=row.get("events") or [],
            phone=row.get("phone"),
            booth_id=row.get("booth_id"),
            created_at=coerce_datetime(row.get("created_at")),
            updated_at=coerce_datetime(row.get("updated_at")),
        )

    def to_insert(self) -> dict[str, Any]:
        """Insert payload — omits `uid` so Postgres autoincrement fires."""
        return {
            "username": self.username,
            "name": self.name,
            "password_hash": self.password_hash,
            "mail": self.mail,
            "role": self.role.value,
            "events": self.events,
            "phone": self.phone,
            "booth_id": self.booth_id,
        }
