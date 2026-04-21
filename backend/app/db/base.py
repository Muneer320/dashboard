"""
Legacy SQLAlchemy Base shim.

The backend no longer uses SQLAlchemy — everything talks to Postgres through
supabase-py. This module is kept only so that any lingering import statement
resolves without an error while the codebase finishes migrating.
"""

from __future__ import annotations


class Base:  # pragma: no cover - compatibility shim
    """No-op placeholder. Do not use for anything."""
    pass
