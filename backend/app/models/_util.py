"""Shared coercion helpers for model dataclasses."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any


def coerce_uuid(value: Any) -> uuid.UUID:
    if isinstance(value, uuid.UUID):
        return value
    return uuid.UUID(str(value))


def coerce_optional_uuid(value: Any) -> uuid.UUID | None:
    if value is None:
        return None
    return coerce_uuid(value)


def coerce_datetime(value: Any) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    # PostgREST returns ISO 8601 strings
    s = str(value)
    # Python's fromisoformat <3.11 doesn't accept 'Z'; we do.
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    try:
        return datetime.fromisoformat(s)
    except ValueError:
        return None


def coerce_date(value: Any) -> date | None:
    if value is None:
        return None
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.date()
    try:
        return date.fromisoformat(str(value))
    except ValueError:
        return None
