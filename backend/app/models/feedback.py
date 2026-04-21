import uuid
from datetime import datetime

from sqlalchemy import DateTime, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Feedback(Base):
    """
    Anonymous overall-festival feedback from the /feedback page.

    Deliberately does NOT hold user_id — this is the public "be honest"
    channel, and storing who said what would undermine that contract.
    The route layer still requires a valid JWT so we don't accept
    feedback from random bots, but the auth is verified and then
    thrown away before the row is written.
    """
    __tablename__ = "feedback"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # { organization:int, food:int, events:int, ambiance:int, communication:int }
    # Each score is clamped to 0-10 in the schema layer.
    scores: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    # "One thing we should fix next year"
    fix: Mapped[str | None] = mapped_column(Text, nullable=True)

    # "One thing we nailed"
    highlight: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
