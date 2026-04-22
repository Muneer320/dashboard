"""
Unit tests for the question-based submission service.

All tests are pure Python — no Supabase connection required.
They cover:
  - _validate_answer for every question type
  - _validate_answers (required enforcement, unknown ID rejection)
  - get_submission_for_phase (read helper)
  - _has_any_submission (admin panel helper)
"""

from __future__ import annotations

from uuid import uuid4

import pytest

from app.models.event import Event
from app.models.user import User
from app.schemas.question import QuestionDefinition
from app.schemas.submission import AnswerItem
from app.services.admin_panel_service import _has_any_submission
from app.services.submission_service import (
    _validate_answer,
    _validate_answers,
    get_submission_for_phase,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

def _make_question(**kwargs) -> QuestionDefinition:
    defaults = {
        "question_id": "q1",
        "question_text": "Test question",
        "question_type": "text",
        "required": True,
    }
    defaults.update(kwargs)
    return QuestionDefinition.model_validate(defaults)


def _make_user(event_id: str, submission: dict | None = None) -> User:
    from uuid import uuid4
    uid = uuid4()
    return User(
        id=uid,
        username="tester",
        password_hash="hash",
        name="Tester",
        events={
            event_id: {
                "isAttending": False,
                "phase": 1,
                "status": "active",
                "restricted": False,
                "submission": submission if submission is not None else {},
                "teamId": None,
                "score": 0,
                "rank": None,
            }
        },
    )


def _make_event(event_id: str, questions: dict | None = None) -> Event:
    return Event(
        id=event_id,  # type: ignore[arg-type]  — coerce_uuid handles str
        name="Test Event",
        rounds={"phase1": {"is_active": True, "is_locked": False}},
        questions=questions or {},
    )


# ---------------------------------------------------------------------------
# _validate_answer — happy paths
# ---------------------------------------------------------------------------

class TestValidateAnswerHappy:
    def test_text_stripped(self):
        q = _make_question(question_type="text", word_limit=10)
        assert _validate_answer(q, "  hello world  ") == "hello world"

    def test_text_long_within_limit(self):
        q = _make_question(question_type="text-long", word_limit=5)
        assert _validate_answer(q, "one two three") == "one two three"

    def test_url_valid(self):
        q = _make_question(question_type="url")
        assert _validate_answer(q, "https://github.com/test") == "https://github.com/test"

    def test_url_http_also_valid(self):
        q = _make_question(question_type="url")
        assert _validate_answer(q, "http://example.com") == "http://example.com"

    def test_email_valid(self):
        q = _make_question(question_type="email")
        assert _validate_answer(q, "user@example.com") == "user@example.com"

    def test_numeric_int(self):
        q = _make_question(question_type="numeric")
        assert _validate_answer(q, 5) == 5

    def test_numeric_string_coerced(self):
        q = _make_question(question_type="numeric")
        assert _validate_answer(q, "42") == 42

    def test_mcq_valid_option(self):
        q = _make_question(question_type="mcq", options=["A", "B", "C"])
        assert _validate_answer(q, "B") == "B"

    def test_multi_choice_subset(self):
        q = _make_question(question_type="multi-choice", options=["X", "Y", "Z"])
        assert _validate_answer(q, ["X", "Z"]) == ["X", "Z"]

    def test_declaration_all_acknowledged(self):
        decls = ["I agree to T&C.", "I declare info is accurate."]
        q = _make_question(question_type="declaration", declarations=decls)
        result = _validate_answer(q, decls)
        assert set(result) == set(decls)


# ---------------------------------------------------------------------------
# _validate_answer — failure paths
# ---------------------------------------------------------------------------

class TestValidateAnswerFailures:
    def test_text_exceeds_word_limit(self):
        from fastapi import HTTPException
        q = _make_question(question_type="text", word_limit=3)
        with pytest.raises(HTTPException) as exc_info:
            _validate_answer(q, "one two three four")
        assert exc_info.value.status_code == 422
        assert "word limit" in exc_info.value.detail

    def test_text_empty_required(self):
        from fastapi import HTTPException
        q = _make_question(question_type="text", required=True)
        with pytest.raises(HTTPException) as exc_info:
            _validate_answer(q, "   ")
        assert exc_info.value.status_code == 422

    def test_url_bad_scheme(self):
        from fastapi import HTTPException
        q = _make_question(question_type="url")
        with pytest.raises(HTTPException) as exc_info:
            _validate_answer(q, "ftp://bad.url")
        assert exc_info.value.status_code == 422

    def test_email_invalid_format(self):
        from fastapi import HTTPException
        q = _make_question(question_type="email")
        with pytest.raises(HTTPException) as exc_info:
            _validate_answer(q, "not-an-email")
        assert exc_info.value.status_code == 422

    def test_numeric_non_numeric(self):
        from fastapi import HTTPException
        q = _make_question(question_type="numeric")
        with pytest.raises(HTTPException) as exc_info:
            _validate_answer(q, "abc")
        assert exc_info.value.status_code == 422

    def test_mcq_invalid_option(self):
        from fastapi import HTTPException
        q = _make_question(question_type="mcq", options=["A", "B"])
        with pytest.raises(HTTPException) as exc_info:
            _validate_answer(q, "C")
        assert exc_info.value.status_code == 422

    def test_multi_choice_invalid_option(self):
        from fastapi import HTTPException
        q = _make_question(question_type="multi-choice", options=["X", "Y"])
        with pytest.raises(HTTPException) as exc_info:
            _validate_answer(q, ["X", "INVALID"])
        assert exc_info.value.status_code == 422

    def test_declaration_missing_one(self):
        from fastapi import HTTPException
        decls = ["I agree.", "I declare."]
        q = _make_question(question_type="declaration", declarations=decls)
        with pytest.raises(HTTPException) as exc_info:
            _validate_answer(q, ["I agree."])  # missing second
        assert exc_info.value.status_code == 422
        assert "Missing" in exc_info.value.detail


# ---------------------------------------------------------------------------
# _validate_answers — batch validation
# ---------------------------------------------------------------------------

class TestValidateAnswers:
    def _questions(self) -> list[QuestionDefinition]:
        return [
            _make_question(question_id="q1", question_type="url", required=True),
            _make_question(question_id="q2", question_type="text", required=False, word_limit=10),
        ]

    def test_valid_required_only(self):
        questions = self._questions()
        answers = [AnswerItem(question_id="q1", answer="https://github.com/test")]
        result = _validate_answers(questions, answers)
        assert len(result) == 1
        assert result[0].question_id == "q1"

    def test_valid_all_answered(self):
        questions = self._questions()
        answers = [
            AnswerItem(question_id="q1", answer="https://github.com/test"),
            AnswerItem(question_id="q2", answer="short answer"),
        ]
        result = _validate_answers(questions, answers)
        assert len(result) == 2

    def test_missing_required_raises(self):
        from fastapi import HTTPException
        questions = self._questions()
        with pytest.raises(HTTPException) as exc_info:
            _validate_answers(questions, [])  # q1 required, not provided
        assert exc_info.value.status_code == 422
        assert "q1" in exc_info.value.detail

    def test_unknown_question_id_raises(self):
        from fastapi import HTTPException
        questions = self._questions()
        answers = [
            AnswerItem(question_id="q1", answer="https://github.com/test"),
            AnswerItem(question_id="UNKNOWN", answer="something"),
        ]
        with pytest.raises(HTTPException) as exc_info:
            _validate_answers(questions, answers)
        assert exc_info.value.status_code == 422
        assert "Unknown" in exc_info.value.detail


# ---------------------------------------------------------------------------
# get_submission_for_phase — read helper
# ---------------------------------------------------------------------------

class TestGetSubmissionForPhase:
    def test_no_submission_returns_empty(self):
        event_id = str(uuid4())
        user = _make_user(event_id, submission={})
        event = _make_event(event_id)
        result = get_submission_for_phase(user, event, 1)
        assert result["has_submission"] is False
        assert result["answers"] == []
        assert result["submitted_at"] is None

    def test_existing_submission_returned(self):
        event_id = str(uuid4())
        submission = {
            "phase1": {
                "submitted": True,
                "submitted_at": "2026-04-22T14:30:00+00:00",
                "answers": [{"question_id": "q1", "answer": "https://github.com/test"}],
            }
        }
        user = _make_user(event_id, submission=submission)
        event = _make_event(event_id)
        result = get_submission_for_phase(user, event, 1)
        assert result["has_submission"] is True
        assert result["submitted_at"] == "2026-04-22T14:30:00+00:00"
        assert len(result["answers"]) == 1
        assert result["answers"][0].question_id == "q1"

    def test_not_registered_raises_403(self):
        from fastapi import HTTPException
        event_id = str(uuid4())
        other_id = str(uuid4())
        user = _make_user(other_id, submission={})  # registered for different event
        event = _make_event(event_id)
        with pytest.raises(HTTPException) as exc_info:
            get_submission_for_phase(user, event, 1)
        assert exc_info.value.status_code == 403

    def test_phase2_not_submitted(self):
        event_id = str(uuid4())
        submission = {
            "phase1": {"submitted": True, "submitted_at": "2026-04-22T14:30:00+00:00", "answers": []},
        }
        user = _make_user(event_id, submission=submission)
        event = _make_event(event_id)
        result = get_submission_for_phase(user, event, 2)
        assert result["has_submission"] is False
        assert result["phase_key"] == "phase2"


# ---------------------------------------------------------------------------
# _has_any_submission — admin panel helper
# ---------------------------------------------------------------------------

class TestHasAnySubmission:
    def test_new_shape_submitted(self):
        entry = {"submission": {"phase1": {"submitted": True, "submitted_at": "...", "answers": []}}}
        assert _has_any_submission(entry) is True

    def test_new_shape_not_submitted(self):
        entry = {"submission": {"phase1": {"submitted": False, "submitted_at": None, "answers": []}}}
        assert _has_any_submission(entry) is False

    def test_empty_submission_map(self):
        entry = {"submission": {}}
        assert _has_any_submission(entry) is False

    def test_legacy_bool_false(self):
        entry = {"submission": False}
        assert _has_any_submission(entry) is False

    def test_legacy_bool_true(self):
        # Old True value — migration should have converted it, but guard anyway
        entry = {"submission": True}
        assert _has_any_submission(entry) is False  # bool is not dict

    def test_no_submission_key(self):
        entry = {}
        assert _has_any_submission(entry) is False

    def test_multiple_phases_one_submitted(self):
        entry = {
            "submission": {
                "phase1": {"submitted": True, "submitted_at": "...", "answers": []},
                "phase2": {"submitted": False, "submitted_at": None, "answers": []},
            }
        }
        assert _has_any_submission(entry) is True
