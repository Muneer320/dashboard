"""
User row representation.

The backend runs on supabase-py — every query returns plain dicts. This
class is a thin dataclass wrapper so the rest of the codebase can keep
using attribute access (user.name, user.events[...]). Services that
mutate JSONB columns mutate the dict in place and then persist with
the helper on the class.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from app.models._util import coerce_datetime, coerce_uuid


def _default_food() -> dict:
    """
    Empty dict by default.

    A meal key is only present after the user has actually been scanned for
    that meal — `food["meal2"] = True` means meal 2 has been claimed. Absent
    keys mean "not claimed". This keeps the shape flexible as the admin can
    raise/lower the festival-wide meals_count without having to migrate
    existing user rows.
    """
    return {}


@dataclass
class User:
    id: uuid.UUID
    username: str
    password_hash: str
    name: str
    unstop_id: str | None = None
    is_attending: bool = False
    details: dict = field(default_factory=dict)
    # Keyed by event UUID string.
    events: dict = field(default_factory=dict)
    food: dict = field(default_factory=_default_food)
    is_profile_complete: bool = False
    cents: int = 0
    role: str = "participant"  # 'participant' | 'visitor'
    created_at: datetime | None = None
    updated_at: datetime | None = None

    @classmethod
    def from_row(cls, row: dict[str, Any]) -> "User":
        return cls(
            id=coerce_uuid(row["id"]),
            username=row["username"],
            password_hash=row.get("password_hash", ""),
            name=row["name"],
            unstop_id=row.get("unstop_id"),
            is_attending=bool(row.get("is_attending", False)),
            details=row.get("details") or {},
            events=row.get("events") or {},
            food=row.get("food") or _default_food(),
            is_profile_complete=bool(row.get("is_profile_complete", False)),
            cents=int(row.get("cents") or 0),
            role=row.get("role") or "participant",
            created_at=coerce_datetime(row.get("created_at")),
            updated_at=coerce_datetime(row.get("updated_at")),
        )

    def to_insert(self) -> dict[str, Any]:
        """Dict ready for supabase.table('users').insert(...)."""
        return {
            "id": str(self.id),
            "username": self.username,
            "password_hash": self.password_hash,
            "name": self.name,
            "unstop_id": self.unstop_id,
            "is_attending": self.is_attending,
            "details": self.details,
            "events": self.events,
            "food": self.food,
            "is_profile_complete": self.is_profile_complete,
            "cents": self.cents,
            "role": self.role,
        }
