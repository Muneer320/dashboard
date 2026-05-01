from __future__ import annotations

import sys
import unittest
from pathlib import Path

PROCESSOR_ROOT = Path(__file__).resolve().parents[1]
if str(PROCESSOR_ROOT) not in sys.path:
    sys.path.insert(0, str(PROCESSOR_ROOT))

from testing.build_riseup_dataset import ProbedAnchorCandidate, select_single_face_anchors
from testing.run_benchmark import BenchmarkCase, build_sweep_cases, parse_metric_values


class BuildRiseUpDatasetHelperTests(unittest.TestCase):
    def test_select_single_face_anchors_keeps_first_n_solo_candidates(self) -> None:
        selected = select_single_face_anchors(
            [
                ProbedAnchorCandidate(url="u1", file_id="f1", face_count=2),
                ProbedAnchorCandidate(url="u2", file_id="f2", face_count=1),
                ProbedAnchorCandidate(url="u3", file_id="f3", face_count=1),
                ProbedAnchorCandidate(url="u4", file_id="f4", face_count=1),
            ],
            anchors_per_person=2,
        )

        self.assertEqual([candidate.file_id for candidate in selected], ["f2", "f3"])


class RunBenchmarkHelperTests(unittest.TestCase):
    def test_parse_metric_values_uses_default_when_flag_missing(self) -> None:
        self.assertEqual(parse_metric_values(None, fallback=0.42), [0.42])

    def test_parse_metric_values_splits_csv_and_strips_whitespace(self) -> None:
        self.assertEqual(parse_metric_values("0.42, 0.45 ,0.48", fallback=0.0), [0.42, 0.45, 0.48])

    def test_build_sweep_cases_produces_cartesian_product(self) -> None:
        cases = build_sweep_cases(
            thresholds=[0.42, 0.45],
            margins=[0.08, 0.12],
        )

        self.assertEqual(
            cases,
            [
                BenchmarkCase(threshold=0.42, margin=0.08),
                BenchmarkCase(threshold=0.42, margin=0.12),
                BenchmarkCase(threshold=0.45, margin=0.08),
                BenchmarkCase(threshold=0.45, margin=0.12),
            ],
        )


if __name__ == "__main__":
    unittest.main()
