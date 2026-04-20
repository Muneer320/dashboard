import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    unstop_id: Mapped[str | None] = mapped_column(
        String(128), unique=True, nullable=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    name: Mapped[str] = mapped_column(String(255))

    # Campus-level attendance (marked at the college entry gate)
    is_attending: Mapped[bool] = mapped_column(Boolean, default=False)

    details: Mapped[dict] = mapped_column(JSONB, default=dict)
    # Keyed by event UUID string. See event_service for the per-event shape.
    events: Mapped[dict] = mapped_column(JSONB, default=dict)
    food: Mapped[dict] = mapped_column(
        JSONB, default=lambda: {"meal1": False, "meal2": False, "meal3": False})

    is_profile_complete: Mapped[bool] = mapped_column(Boolean, default=False)

    # In-event currency / points
    cents: Mapped[int] = mapped_column(Integer, default=0)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
