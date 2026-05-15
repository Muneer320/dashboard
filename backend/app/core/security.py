from datetime import datetime, timedelta, timezone
from typing import Any
import bcrypt

from jose import JWTError, jwt
from app.core.config import settings

class TokenError(Exception):
    """Raised when token decode fails."""


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a hash."""
    try:
        # bcrypt.checkpw expects bytes
        password_bytes = plain_password.encode('utf-8')
        hashed_bytes = hashed_password.encode('utf-8')
        return bcrypt.checkpw(password_bytes, hashed_bytes)
    except Exception:
        # Fallback for old/broken hashes or if something goes wrong
        return False


def get_password_hash(password: str) -> str:
    """Generate a bcrypt hash for a password."""
    # bcrypt.hashpw expects bytes
    password_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')


def create_access_token(
    subject: str,
    role: str | None = None,
    expires_delta: timedelta | None = None,
    extra_claims: dict[str, Any] | None = None,
) -> str:
    """Create a signed JWT.

    `extra_claims` is merged into the payload — used by the Sidequest
    booth_volunteer flow to carry a `booth_id` so the booth tool can
    enforce that a volunteer awards only at their assigned booth.
    Reserved keys (`sub`, `exp`, `role`) are not overwritable via this arg.
    """
    if expires_delta is None:
        expires_delta = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    expire = datetime.now(timezone.utc) + expires_delta
    to_encode: dict[str, Any] = {"sub": subject, "exp": expire}
    if role is not None:
        to_encode["role"] = role
    if extra_claims:
        for k, v in extra_claims.items():
            if k in {"sub", "exp", "role"}:
                continue
            to_encode[k] = v
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    except JWTError as exc:
        raise TokenError("Invalid or expired token") from exc
