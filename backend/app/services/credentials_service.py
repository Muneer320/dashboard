"""
Credentials-request service.
Writes to the requested_members table (created in migration 010).
"""
import random
import string

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.requested_member import RequestedMember


def _generate_ticket_id() -> str:
    """Generate a short human-readable ticket ID like ASC-482910."""
    digits = "".join(random.choices(string.digits, k=6))
    return f"ASC-{digits}"


async def create_credentials_request(
    session: AsyncSession,
    name: str,
    college: str,
    email: str,
    phone: str,
    events_of_interest: list[str],
    note: str | None,
) -> dict:
    """Persist a credential request and return a ticket reference."""
    record = RequestedMember(
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
        "ticket_id": _generate_ticket_id(),
        "status": "pending_verify",
    }
