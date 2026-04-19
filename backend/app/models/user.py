import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class AccessLevel(str, enum.Enum):
    ROUND1 = "ROUND1"
    FINAL = "FINAL"
    FULL = "FULL"


class UserRole(str, enum.Enum):
    USER = "user"
    ADMIN = "admin"
    SCANNER = "scanner"
    SUPERADMIN = "superAdmin"
    EVENTMANAGE = "eventManage"
    EM = "EM"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    unstop_id: Mapped[str | None] = mapped_column(
        String(128), unique=True, nullable=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    name: Mapped[str] = mapped_column(String(255))

    details: Mapped[dict] = mapped_column(JSONB, default=dict)
    events: Mapped[dict] = mapped_column(JSONB, default=dict)
    food: Mapped[dict] = mapped_column(
        JSONB, default=lambda: {"meal1": False, "meal2": False, "meal3": False})

    access_level: Mapped[AccessLevel] = mapped_column(
        Enum(AccessLevel, name="access_level"), default=AccessLevel.ROUND1)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role"), default=UserRole.USER)
    is_profile_complete: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
