from fastapi import HTTPException, status

from app.models.event import Event
from app.models.user import User

ACCESS_ORDER = {
    "ROUND1": 1,
    "FINAL": 2,
    "FULL": 3,
}


def validate_event_access(user: User, event: Event, phase: int) -> dict:
    user_events = user.events or {}
    event_entry = user_events.get(str(event.id))
    if not event_entry:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="User is not registered for this event")

    phase_key = f"phase{phase}"
    round_data = (event.rounds or {}).get(phase_key)
    if not round_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid event phase")

    if not round_data.get("is_active") or round_data.get("is_locked"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Phase is not active")

    user_access = event_entry.get("accessLevel", "ROUND1")
    required_access = "FINAL" if phase > 1 else "ROUND1"
    if ACCESS_ORDER.get(user_access, 0) < ACCESS_ORDER.get(required_access, 0):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Insufficient access level")

    return event_entry
