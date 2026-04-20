import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class AdminRole(str, enum.Enum):
    ADMIN = "admin"
    EVENT_MANAGER = "eventManager"
    SCANNER = "Scanner"


class Admin(Base):
    __tablename__ = "admins"

    uid: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    role: Mapped[AdminRole] = mapped_column(
        Enum(AdminRole, name="admin_role_enum"), default=AdminRole.ADMIN)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    password_hash: Mapped[str] = mapped_column(String(255))
    events: Mapped[list] = mapped_column(JSONB, nullable=True, default=list)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    mail: Mapped[str] = mapped_column(String(255), unique=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
