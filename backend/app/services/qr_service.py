from sqlalchemy.ext.asyncio import AsyncSession

from app.models.event import Event
from app.models.user import User


async def scan_food(session: AsyncSession, user: User, meal: str) -> str:
    food = user.food or {"meal1": False, "meal2": False, "meal3": False}

    if food.get(meal):
        return "Meal already consumed"

    food[meal] = True
    user.food = food
    session.add(user)
    await session.commit()
    return "Meal marked as consumed"


async def scan_college_entry(session: AsyncSession, user: User) -> str:
    if user.is_attending:
        return "User already attending"
    
    user.is_attending = True
    session.add(user)
    await session.commit()
    return "College entry marked successfully"


async def scan_event_entry(session: AsyncSession, user: User, event: Event) -> str:
    participants = event.participants or {}
    
    if str(user.id) not in participants:
        return "User not registered for this event"
        
    participant_entry = participants[str(user.id)]

    if participant_entry.get("isAttending"):
        return "User already scanned for this event"

    participant_entry["isAttending"] = True
    participants[str(user.id)] = participant_entry
    
    event.participants = participants

    session.add(event)
    await session.commit()
    return "Attendance marked successfully"
