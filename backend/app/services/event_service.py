import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.event import Event
from app.models.user import User


async def list_events(session: AsyncSession) -> list[Event]:
    result = await session.execute(select(Event).order_by(Event.created_at.desc()))
    return list(result.scalars().all())


async def get_event(session: AsyncSession, event_id: str) -> Event:
    try:
        event_uuid = uuid.UUID(event_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid event id") from exc

    result = await session.execute(select(Event).where(Event.id == event_uuid))
    event = result.scalar_one_or_none()
    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    return event


async def register_for_event(session: AsyncSession, user: User, event: Event) -> None:
    participants = event.participants or {}
    user_events = user.events or {}
    event_key = str(event.id)
    user_key = str(user.id)

    if event.registration_deadline and datetime.now(timezone.utc) > event.registration_deadline:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Registration deadline passed")

    if user_key in participants:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Already registered")

    if len(participants) >= event.max_participants:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Event is at capacity")

    now_iso = datetime.now(timezone.utc).isoformat()

    participants[user_key] = {
        "registeredAt": now_iso,
        "currentPhase": 1,
        "status": "active",
        "attendance": {},
        "submission": {},
    }
    user_events[event_key] = {
        "isAttending": False,           # flipped to True at the event gate scanner
        "phase": 1,
        "status": "active",             # active | completed | eliminated
        "restricted": False,            # set True to ban from further participation
        # submission: null = not submitted; object = submitted
        # Shape: { repoLink: str, deployLink: str, submittedAt: iso | null }
        "submission": None,
        "teamId": None,                 # assigned when the user joins a team for this event
        "score": 0,
        "rank": None,
    }

    event.participants = participants
    user.events = user_events

    async with session.begin_nested():
        session.add(event)
        session.add(user)

    await session.commit()


def get_event_participants_payload(event: Event) -> dict:
    participants = event.participants or {}
    return {
        "event_id": str(event.id),
        "participants_count": len(participants),
        "participants": participants,
    }


async def set_event_phase_state(
    session: AsyncSession,
    event_id: str,
    phase: int,
    is_active: bool | None = None,
    is_locked: bool | None = None,
) -> Event:
    event = await get_event(session, event_id)
    rounds = event.rounds or {}
    phase_key = f"phase{phase}"
    round_data = rounds.get(phase_key)
    if round_data is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Phase not found")

    if is_active is not None:
        round_data["is_active"] = is_active
    if is_locked is not None:
        round_data["is_locked"] = is_locked

    rounds[phase_key] = round_data
    event.rounds = rounds
    session.add(event)
    await session.commit()
    await session.refresh(event)
    return event
