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
    user_events = user.events or {}
    event_key = str(event.id)

    event_entry = user_events.get(event_key)
    if not event_entry:
        return "User not registered for this event"

    if event_entry.get("restricted"):
        return "User is restricted from this event"

    if event_entry.get("isAttending"):
        return "User already scanned for this event"

    event_entry["isAttending"] = True
    user_events[event_key] = event_entry
    user.events = user_events

    session.add(user)
    await session.commit()
    return "Attendance marked successfully"
