import uuid
from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Event(Base):
    __tablename__ = "events"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), index=True)
    description: Mapped[str] = mapped_column(Text, default="")

    start_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True)
    end_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True)

    venue: Mapped[list[str]] = mapped_column(ARRAY(Text), default=list)
    judges: Mapped[list[str]] = mapped_column(ARRAY(Text), default=list)

    rounds: Mapped[dict] = mapped_column(JSONB, default=dict)
    participants: Mapped[dict] = mapped_column(JSONB, default=dict)

    rules: Mapped[str] = mapped_column(Text, default="")
    max_participants: Mapped[int] = mapped_column(Integer, default=500)
    registration_deadline: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
