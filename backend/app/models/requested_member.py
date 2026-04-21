import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, Text, func
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class RequestedMember(Base):
    __tablename__ = "requested_members"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # Human-readable ticket reference (e.g. "ASC-482910").
    # Persisted so every call that touches a given record returns the same id.
    ticket_id: Mapped[str] = mapped_column(
        String(32), nullable=False, unique=True, index=True
    )

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    college: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    phone: Mapped[str] = mapped_column(String(32), nullable=False)

    # Array of interest areas e.g. ["Web Dev", "AI/ML", "Robotics"]
    areas_of_interest: Mapped[list[str]] = mapped_column(
        ARRAY(String(128)), nullable=False, default=list
    )

    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Review status: pending → approved / rejected
    status: Mapped[str] = mapped_column(
        String(32), nullable=False, default="pending", index=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
