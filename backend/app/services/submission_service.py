"""
Submission service -- question-based submission handling.

Flow
----
1.  Load event.questions[phaseN] to get question definitions.
2.  Validate every submitted answer against its question definition.
3.  Enforce that all *required* questions have a non-empty answer.
4.  Write the submission into both:
      users.events[event_id].submission.phaseN   (latest snapshot, user row)
      events.participants[user_id].submission.phaseN  (history + scoring slot)
    User row first -- failure on the event row leaves a recoverable state.
"""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException, status
from supabase import AsyncClient

from app.models.event import Event
from app.models.user import User
from app.schemas.question import QuestionDefinition, QuestionType
from app.schemas.submission import AnswerItem
from app.services.access_control import validate_event_access
from app.services.question_service import get_questions_for_phase

_URL_RE = re.compile(r"^https?://", re.IGNORECASE)
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


# ---------------------------------------------------------------------------
# Answer validation helpers
# ---------------------------------------------------------------------------

def _validate_answer(q: QuestionDefinition, raw_answer: Any) -> Any:
    """
    Type-check and coerce a single answer value.
    Returns the normalised answer on success; raises HTTPException on failure.
    """
    qt: QuestionType = q.question_type
    qid = q.question_id

    if qt == "text":
        if not isinstance(raw_answer, str):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"[{qid}] Expected a text string.",
            )
        answer = raw_answer.strip()
        if q.required and not answer:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"[{qid}] Answer must not be empty.",
            )
        if q.word_limit is not None:
            word_count = len(answer.split())
            if word_count > q.word_limit:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=(
                        f"[{qid}] Answer exceeds word limit "
                        f"({word_count} words, limit {q.word_limit})."
                    ),
                )
        return answer

    if qt == "text-long":
        if not isinstance(raw_answer, str):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"[{qid}] Expected a text string.",
            )
        answer = raw_answer.strip()
        if q.required and not answer:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"[{qid}] Answer must not be empty.",
            )
        limit = q.word_limit or 500
        word_count = len(answer.split())
        if word_count > limit:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    f"[{qid}] Answer exceeds word limit "
                    f"({word_count} words, limit {limit})."
                ),
            )
        return answer

    if qt == "url":
        if not isinstance(raw_answer, str):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"[{qid}] Expected a URL string.",
            )
        answer = raw_answer.strip()
        if q.required and not answer:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"[{qid}] A URL is required.",
            )
        if answer and not _URL_RE.match(answer):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"[{qid}] URL must start with http:// or https://.",
            )
        return answer

    if qt == "email":
        if not isinstance(raw_answer, str):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"[{qid}] Expected an e-mail string.",
            )
        answer = raw_answer.strip()
        if q.required and not answer:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"[{qid}] An e-mail address is required.",
            )
        if answer and not _EMAIL_RE.match(answer):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"[{qid}] '{answer}' is not a valid e-mail address.",
            )
        return answer

    if qt == "numeric":
        try:
            return int(raw_answer)
        except (ValueError, TypeError):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"[{qid}] Expected an integer value.",
            )

    if qt == "mcq":
        if not isinstance(raw_answer, str):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"[{qid}] Expected a single option string.",
            )
        answer = raw_answer.strip()
        if answer not in (q.options or []):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    f"[{qid}] '{answer}' is not a valid option. "
                    f"Valid options: {q.options}."
                ),
            )
        return answer

    if qt == "multi-choice":
        if not isinstance(raw_answer, list):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"[{qid}] Expected a list of selected options.",
            )
        invalid = [a for a in raw_answer if a not in (q.options or [])]
        if invalid:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    f"[{qid}] Invalid option(s): {invalid}. "
                    f"Valid options: {q.options}."
                ),
            )
        return raw_answer

    if qt == "declaration":
        if not isinstance(raw_answer, list):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"[{qid}] Expected a list of acknowledged declaration strings.",
            )
        expected = set(q.declarations or [])
        provided = set(raw_answer)
        missing = expected - provided
        if missing:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    f"[{qid}] You must acknowledge all declarations. "
                    f"Missing: {list(missing)}."
                ),
            )
        return raw_answer

    # Fallback (should never hit given Literal enforcement on QuestionType)
    return raw_answer


def _validate_answers(
    questions: list[QuestionDefinition],
    answers: list[AnswerItem],
) -> list[AnswerItem]:
    """
    Validate all submitted answers against the phase's question list.

    - Required questions with no submitted answer -> 422.
    - Submitted question_ids not in the definition list -> 422.
    - Each answer is type-validated and coerced.

    Returns the normalised answer list.
    """
    q_map: dict[str, QuestionDefinition] = {q.question_id: q for q in questions}
    a_map: dict[str, AnswerItem] = {a.question_id: a for a in answers}

    # Reject unknown question IDs
    unknown = [qid for qid in a_map if qid not in q_map]
    if unknown:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unknown question_id(s): {unknown}.",
        )

    # Check required questions have an answer
    for q in questions:
        if q.required and q.question_id not in a_map:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"[{q.question_id}] This question is required.",
            )

    # Type-validate and coerce each provided answer
    normalised: list[AnswerItem] = []
    for qid, answer_item in a_map.items():
        q = q_map[qid]
        coerced = _validate_answer(q, answer_item.answer)
        normalised.append(AnswerItem(question_id=qid, answer=coerced))

    return normalised


# ---------------------------------------------------------------------------
# Core submission writer
# ---------------------------------------------------------------------------

async def submit_for_event(
    supabase: AsyncClient,
    user: User,
    event: Event,
    phase: int,
    answers: list[AnswerItem],
) -> tuple[datetime, list[AnswerItem]]:
    """
    Validate and record a question-based submission for a user in an event phase.

    Stores:
      users.events[event_id].submission.phaseN = { submitted, submitted_at, answers }
      events.participants[user_id].submission.phaseN = { submitted, submitted_at,
                                                          answers, score, feedback }

    Writes user row first; failure on the event row leaves a recoverable state.
    """
    event_entry = validate_event_access(user, event, phase)

    # Load + validate questions for the phase
    questions = get_questions_for_phase(event, phase)
    normalised_answers = _validate_answers(questions, answers)

    user_events = user.events or {}
    participants = event.participants or {}
    event_key = str(event.id)
    user_key = str(user.id)
    phase_key = f"phase{phase}"
    submitted_at = datetime.now(timezone.utc)
    submitted_iso = submitted_at.isoformat()

    answers_payload = [
        {"question_id": a.question_id, "answer": a.answer}
        for a in normalised_answers
    ]

    # User row: update submission map for this phase
    existing_submission = event_entry.get("submission")
    if not isinstance(existing_submission, dict):
        existing_submission = {}  # migrate any old bool/None/object value

    existing_submission[phase_key] = {
        "submitted": True,
        "submitted_at": submitted_iso,
        "answers": answers_payload,
    }
    event_entry["submission"] = existing_submission
    user_events[event_key] = event_entry

    # Event row: per-phase history with scoring slots
    participant_entry = participants.get(user_key, {})
    phase_submissions = participant_entry.get("submission", {})
    if not isinstance(phase_submissions, dict):
        phase_submissions = {}

    # Preserve existing score/feedback if an admin already wrote them
    existing_phase = phase_submissions.get(phase_key, {})
    phase_submissions[phase_key] = {
        "submitted": True,
        "submitted_at": submitted_iso,
        "answers": answers_payload,
        "score": existing_phase.get("score"),
        "feedback": existing_phase.get("feedback"),
    }
    participant_entry["submission"] = phase_submissions
    participants[user_key] = participant_entry

    user.events = user_events
    event.participants = participants

    # Persist: user row first, then event row
    await (
        supabase.table("users")
        .update({"events": user_events})
        .eq("id", user_key)
        .execute()
    )
    await (
        supabase.table("events")
        .update({"participants": participants})
        .eq("id", event_key)
        .execute()
    )

    return submitted_at, normalised_answers


# ---------------------------------------------------------------------------
# Read helper
# ---------------------------------------------------------------------------

def get_submission_for_phase(user: User, event: Event, phase: int) -> dict:
    """
    Return the user's stored submission for a given phase.
    Reads from users.events (the latest-snapshot row).
    """
    phase_key = f"phase{phase}"
    event_entry = (user.events or {}).get(str(event.id))
    if event_entry is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not registered for this event.",
        )

    submission_map = event_entry.get("submission") or {}
    if not isinstance(submission_map, dict):
        submission_map = {}

    phase_data = submission_map.get(phase_key)

    has_submission = bool(phase_data and phase_data.get("submitted"))
    answers: list[AnswerItem] = []
    submitted_at = None

    if has_submission and isinstance(phase_data, dict):
        submitted_at = phase_data.get("submitted_at")
        raw_answers = phase_data.get("answers") or []
        answers = [
            AnswerItem(question_id=a["question_id"], answer=a["answer"])
            for a in raw_answers
            if isinstance(a, dict)
        ]

    return {
        "event_id": str(event.id),
        "phase": phase,
        "phase_key": phase_key,
        "has_submission": has_submission,
        "submitted_at": submitted_at,
        "answers": answers,
    }
