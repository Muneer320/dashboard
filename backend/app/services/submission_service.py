from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.event import Event
from app.models.user import User
from app.services.access_control import validate_event_access


async def submit_for_event(
    session: AsyncSession,
    user: User,
    event: Event,
    phase: int,
    submission_type: str,
    value: str,
) -> datetime:
    event_entry = validate_event_access(user, event, phase)
    user_events = user.events or {}
    participants = event.participants or {}

    event_key = str(event.id)
    user_key = str(user.id)
    phase_key = f"phase{phase}"
    submitted_at = datetime.now(timezone.utc)
    submitted_iso = submitted_at.isoformat()

    if submission_type == "url":
        event_entry["submissionURL"] = value
        event_entry["submissionFile"] = None
    else:
        event_entry["submissionFile"] = value
        event_entry["submissionURL"] = None

    event_entry["submission"] = True
    event_entry["submissionType"] = submission_type
    event_entry["submissionTime"] = submitted_iso
    user_events[event_key] = event_entry

    participant_entry = participants.get(user_key, {})
    participant_submission = participant_entry.get("submission", {})
    participant_submission[phase_key] = {
        "type": submission_type,
        "value": value,
        "submittedAt": submitted_iso,
    }
    participant_entry["submission"] = participant_submission
    participants[user_key] = participant_entry

    user.events = user_events
    event.participants = participants

    async with session.begin_nested():
        session.add(user)
        session.add(event)

    await session.commit()
    return submitted_at


def build_file_submission_value(signed_url: str, storage_path: str | None = None) -> str:
    if storage_path:
        return f"{signed_url}|{storage_path}"
    return signed_url


def split_file_submission_value(value: str) -> tuple[str, str | None]:
    if "|" not in value:
        return value, None
    signed_url, storage_path = value.split("|", 1)
    return signed_url, storage_path or None


def get_submission_for_phase(user: User, event: Event, phase: int) -> dict:
    participants = event.participants or {}
    participant_entry = participants.get(str(user.id), {})
    phase_key = f"phase{phase}"
    submission = (participant_entry.get("submission") or {}).get(phase_key)

    return {
        "event_id": str(event.id),
        "phase": phase,
        "has_submission": submission is not None,
        "submission": submission,
    }
