from sqlalchemy.ext.asyncio import AsyncSession

from app.models.event import Event
from app.models.user import User
from app.services.access_control import validate_event_access


async def scan_food(session: AsyncSession, user: User, meal: str) -> str:
    food = user.food or {"meal1": False, "meal2": False, "meal3": False}

    if food.get(meal):
        return "Meal already consumed"

    food[meal] = True
    user.food = food
    session.add(user)
    await session.commit()
    return "Meal marked as consumed"


async def scan_event_entry(session: AsyncSession, user: User, event: Event, phase: int) -> str:
    validate_event_access(user, event, phase)
    participants = event.participants or {}
    participant_entry = participants.get(str(user.id), {})

    attendance = participant_entry.get("attendance", {})
    phase_key = f"phase{phase}"
    if attendance.get(phase_key):
        return "Already marked present"

    attendance[phase_key] = True
    participant_entry["attendance"] = attendance
    participants[str(user.id)] = participant_entry
    event.participants = participants

    session.add(event)
    await session.commit()
    return "Attendance marked"
