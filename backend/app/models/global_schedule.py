import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class GlobalSchedule(Base):
    """
    One row per event day.

    Table is named ``global`` in the DB (quoted to avoid the SQL reserved-word
    clash). Holds the day's public timeline (schedule) and any announcements
    posted for that day.
    """
    __tablename__ = "global"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # The calendar date this row covers, e.g. 2026-05-10
    date: Mapped[date] = mapped_column(Date, nullable=False, unique=True, index=True)

    # Array of schedule items: [{title, start_time, end_time, venue}]
    schedule: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)

    # Announcements for this day.
    # Shape: [{ "announcement": str, "time": iso-datetime-str }]
    announcements: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
