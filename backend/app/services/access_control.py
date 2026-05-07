from datetime import datetime, timezone

from fastapi import HTTPException, status

from app.models.event import Event
from app.models.user import User


def validate_event_access(user: User, event: Event, phase: int) -> dict:
    user_events = user.events or {}
    event_entry = user_events.get(str(event.id))
    if not event_entry:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="User is not registered for this event")

    if event_entry.get("restricted"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="User is restricted from this event")

    phase_key = f"phase{phase}"
    round_data = (event.rounds or {}).get(phase_key)
    if not round_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid event phase")

    if not round_data.get("is_active") or round_data.get("is_locked"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Phase is not active")

    # Enforce end_time deadline — reject submissions even if the admin hasn't
    # manually locked the phase yet.
    end_time_str = round_data.get("end_time")
    if end_time_str:
        try:
            end_time = datetime.fromisoformat(end_time_str)
            if end_time.tzinfo is None:
                end_time = end_time.replace(tzinfo=timezone.utc)
            if datetime.now(timezone.utc) > end_time:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Phase submission deadline has passed")
        except ValueError:
            pass  # Malformed end_time — fail open to avoid blocking legitimate submissions

    return event_entry
