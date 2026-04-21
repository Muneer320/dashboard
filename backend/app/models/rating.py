import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Rating(Base):
    """
    User rating for an event.
    One row per (user_id, event_id) — upserted on submit.
    """
    __tablename__ = "ratings"
    __table_args__ = (
        UniqueConstraint("user_id", "event_id", name="uq_rating_user_event"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )

    # Star rating 1-5
    value: Mapped[int] = mapped_column(Integer, nullable=False)

    # Optional text review
    feedback: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
