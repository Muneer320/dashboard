"""
Credentials-request service.
Writes to the requested_members table (created in migration 010).

A given email may only hold **one** active request at a time. "Active" means
status in ('pending', 'approved') — i.e. anything that hasn't been rejected.
Submitting again while an active request exists returns the existing ticket
(HTTPException 409 from the route). A rejected email is free to resubmit.
"""
import random
import string

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.requested_member import RequestedMember

# Statuses that count as "already submitted — don't accept another".
ACTIVE_STATUSES = ("pending", "approved")


def _generate_ticket_id() -> str:
    """Generate a short human-readable ticket ID like ASC-482910."""
    digits = "".join(random.choices(string.digits, k=6))
    return f"ASC-{digits}"


async def _allocate_unique_ticket_id(session: AsyncSession) -> str:
    """
    Generate a ticket_id that isn't already taken. 6 digits = 1M ids, so
    collisions are extremely rare, but loop defensively so we never persist
    a duplicate.
    """
    for _ in range(10):
        candidate = _generate_ticket_id()
        result = await session.execute(
            select(RequestedMember.id).where(
                RequestedMember.ticket_id == candidate
            )
        )
        if result.scalar_one_or_none() is None:
            return candidate
    # Extremely unlikely — but don't loop forever.
    raise RuntimeError("could not allocate a unique ticket_id after 10 tries")


async def _find_active_request(
    session: AsyncSession, email: str
) -> RequestedMember | None:
    """Return any pending/approved request already on file for this email."""
    result = await session.execute(
        select(RequestedMember).where(
            RequestedMember.email == email,
            RequestedMember.status.in_(ACTIVE_STATUSES),
        )
    )
    return result.scalar_one_or_none()


class DuplicateCredentialsRequest(Exception):
    """Raised when the email already has an active (pending/approved) request."""

    def __init__(self, ticket_id: str, status: str):
        self.ticket_id = ticket_id
        self.status = status
        super().__init__(
            f"Credentials request already exists for this email "
            f"(ticket {ticket_id}, status {status})"
        )


async def create_credentials_request(
    session: AsyncSession,
    name: str,
    college: str,
    email: str,
    phone: str,
    events_of_interest: list[str],
    note: str | None,
) -> dict:
    """
    Persist a credential request and return a ticket reference.

    Raises ``DuplicateCredentialsRequest`` if this email already has a
    pending/approved request — the route layer converts that to a 409.
    """
    # 1. Guard: one active request per email.
    existing = await _find_active_request(session, email)
    if existing is not None:
        raise DuplicateCredentialsRequest(
            ticket_id=existing.ticket_id,
            status=existing.status,
        )

    # 2. Allocate a stable ticket_id up front and store it on the row.
    ticket_id = await _allocate_unique_ticket_id(session)

    record = RequestedMember(
        ticket_id=ticket_id,
        name=name,
        college=college,
        email=email,
        phone=phone,
        areas_of_interest=events_of_interest,
        description=note,
        status="pending",
    )
    session.add(record)
    await session.commit()
    await session.refresh(record)

    return {
        "ticket_id": record.ticket_id,
        "status": "pending_verify",
    }
