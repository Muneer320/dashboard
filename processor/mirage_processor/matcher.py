from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class CandidateMatch:
    person_id: str
    score: float


def select_candidate_match(
    matches: list[tuple[dict[str, Any], float]],
    *,
    threshold: float,
    margin: float,
) -> CandidateMatch | None:
    if not matches:
        return None

    best_label, best_score = matches[0]
    best_person_id = str(best_label["person_id"])
    runner_up_score = next(
        (
            score
            for label, score in matches[1:]
            if str(label["person_id"]) != best_person_id
        ),
        None,
    )

    if best_score < threshold:
        return None

    if runner_up_score is not None and best_score - runner_up_score < margin:
        return None

    return CandidateMatch(person_id=best_person_id, score=float(best_score))


def accumulate_photo_matches(
    face_results: list[dict[str, Any]],
    *,
    threshold: float,
    margin: float,
) -> dict[str, dict[str, Any]]:
    best_by_person: dict[str, dict[str, Any]] = {}

    for face_result in face_results:
        match = select_candidate_match(
            list(face_result["matches"]),
            threshold=threshold,
            margin=margin,
        )
        if match is None:
            continue

        current = best_by_person.get(match.person_id)
        if current is None or match.score > float(current["score"]):
            best_by_person[match.person_id] = {
                "score": match.score,
                "bbox": face_result["bbox"],
            }

    return best_by_person
