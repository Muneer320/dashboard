from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

import numpy as np

PROCESSOR_ROOT = Path(__file__).resolve().parents[1]
if str(PROCESSOR_ROOT) not in sys.path:
    sys.path.insert(0, str(PROCESSOR_ROOT))

from mirage_processor.index_store import EventIndexStore
from mirage_processor.matcher import accumulate_photo_matches, select_candidate_match


class SelectCandidateMatchTests(unittest.TestCase):
    def test_accepts_best_match_when_score_and_margin_clear_thresholds(self) -> None:
        accepted = select_candidate_match(
            [
                ({"person_id": "person-a"}, 0.68),
                ({"person_id": "person-b"}, 0.51),
            ],
            threshold=0.42,
            margin=0.1,
        )

        self.assertIsNotNone(accepted)
        assert accepted is not None
        self.assertEqual(accepted.person_id, "person-a")


class EventIndexStoreTests(unittest.TestCase):
    def test_accumulate_photo_matches_keeps_highest_score_per_person(self) -> None:
        accepted = accumulate_photo_matches(
            [
                {
                    "bbox": {"x1": 1.0, "y1": 1.0, "x2": 2.0, "y2": 2.0},
                    "matches": [
                        ({"person_id": "person-a"}, 0.62),
                        ({"person_id": "person-b"}, 0.40),
                    ],
                },
                {
                    "bbox": {"x1": 3.0, "y1": 3.0, "x2": 4.0, "y2": 4.0},
                    "matches": [
                        ({"person_id": "person-a"}, 0.71),
                        ({"person_id": "person-c"}, 0.50),
                    ],
                },
            ],
            threshold=0.42,
            margin=0.1,
        )

        self.assertEqual(accepted["person-a"]["score"], 0.71)
        self.assertEqual(accepted["person-a"]["bbox"]["x1"], 3.0)

    def test_index_keeps_multiple_embeddings_for_same_person(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            store = EventIndexStore(Path(tmp_dir), "unit-test", dimension=2)
            store.upsert(
                person_id="person-a",
                faiss_label=1,
                display_name="A",
                embedding=np.asarray([1.0, 0.0], dtype=np.float32),
                anchor_key="anchor-1",
            )
            store.upsert(
                person_id="person-a",
                faiss_label=2,
                display_name="A",
                embedding=np.asarray([0.99, 0.01], dtype=np.float32),
                anchor_key="anchor-2",
            )

            self.assertEqual(len(store.labels), 2)
            self.assertEqual(store.labels[0]["person_id"], "person-a")
            self.assertEqual(store.labels[1]["person_id"], "person-a")

    def test_search_returns_ranked_matches(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            store = EventIndexStore(Path(tmp_dir), "unit-test", dimension=2)
            store.upsert(
                person_id="person-a",
                faiss_label=1,
                display_name="A",
                embedding=np.asarray([1.0, 0.0], dtype=np.float32),
                anchor_key="anchor-1",
            )
            store.upsert(
                person_id="person-a",
                faiss_label=2,
                display_name="A",
                embedding=np.asarray([0.99, 0.01], dtype=np.float32),
                anchor_key="anchor-2",
            )
            store.upsert(
                person_id="person-b",
                faiss_label=3,
                display_name="B",
                embedding=np.asarray([0.0, 1.0], dtype=np.float32),
                anchor_key="anchor-3",
            )

            matches = store.search(np.asarray([1.0, 0.0], dtype=np.float32), k=3)

            self.assertEqual(
                [match[0]["person_id"] for match in matches[:2]],
                ["person-a", "person-a"],
            )
            self.assertEqual(matches[2][0]["person_id"], "person-b")

    def test_rejects_best_match_below_threshold(self) -> None:
        self.assertIsNone(
            select_candidate_match(
                [({"person_id": "person-a"}, 0.39)],
                threshold=0.42,
                margin=0.1,
            )
        )

    def test_rejects_when_competing_person_is_too_close(self) -> None:
        self.assertIsNone(
            select_candidate_match(
                [
                    ({"person_id": "person-a"}, 0.58),
                    ({"person_id": "person-b"}, 0.54),
                ],
                threshold=0.42,
                margin=0.05,
            )
        )

    def test_ignores_same_person_runner_up_from_second_anchor(self) -> None:
        accepted = select_candidate_match(
            [
                ({"person_id": "person-a", "anchor_key": "anchor-1"}, 0.68),
                ({"person_id": "person-a", "anchor_key": "anchor-2"}, 0.66),
                ({"person_id": "person-b", "anchor_key": "anchor-3"}, 0.61),
            ],
            threshold=0.42,
            margin=0.05,
        )

        self.assertIsNotNone(accepted)
        assert accepted is not None
        self.assertEqual(accepted.person_id, "person-a")


if __name__ == "__main__":
    unittest.main()
