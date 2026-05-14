"""Run enroll + process on the testing manifest and report person-level accuracy.

Ground truth comes from ``expected.json`` (``expected_matches``): for each test
photo, the set of ``(test)`` display names that ``photos.json`` says should
appear among the **enrolled** identities for that image.

Metrics (micro-averaged over all photos with non-empty expected):

- **Precision** = sum(|E ∩ A|) / sum(|A|)  (matched identities that are correct)
- **Recall**    = sum(|E ∩ A|) / sum(|E|)  (listed enrolled people found)
- **F1**        = harmonic mean of precision and recall
- **Exact**     = fraction of photos where E == A as sets (strict)

``E`` = expected set, ``A`` = actual matched people from Supabase ``photo_people``.

Run from repo root::

    py -3.11 -m processor.testing.run_benchmark
    py -3.11 -m processor.testing.run_benchmark --thresholds 0.42,0.45,0.48 --margins 0.08,0.10,0.12

Requires ``expected.json``, ``people.csv``, ``manifest.csv`` under
``processor/testing/dataset/`` (from ``build_riseup_dataset``).
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

_PROCESSOR_ROOT = Path(__file__).resolve().parents[1]
_REPO_ROOT = _PROCESSOR_ROOT.parent
if str(_PROCESSOR_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROCESSOR_ROOT))

from mirage_processor.config import load_settings
from mirage_processor.database import MirageDatabase

HERE = Path(__file__).resolve().parent
DATASET_ROOT = HERE / "dataset"
ANCHORS_DIR = DATASET_ROOT / "anchors"
PEOPLE_CSV = DATASET_ROOT / "people.csv"
MANIFEST_CSV = DATASET_ROOT / "manifest.csv"
EXPECTED_JSON = DATASET_ROOT / "expected.json"
REPORT_JSON = DATASET_ROOT / "benchmark_report.json"
SWEEP_REPORT_JSON = DATASET_ROOT / "benchmark_sweep.json"


@dataclass(frozen=True)
class BenchmarkCase:
    threshold: float
    margin: float


def parse_metric_values(raw: str | None, *, fallback: float) -> list[float]:
    if raw is None:
        return [fallback]
    values = [segment.strip() for segment in raw.split(",") if segment.strip()]
    if not values:
        return [fallback]
    return [float(value) for value in values]


def build_sweep_cases(
    *,
    thresholds: list[float],
    margins: list[float],
) -> list[BenchmarkCase]:
    return [
        BenchmarkCase(threshold=threshold, margin=margin)
        for threshold in thresholds
        for margin in margins
    ]


def count_people_identities(path: Path) -> int:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        names = {
            (row.get("display_name") or "").strip()
            for row in reader
            if (row.get("display_name") or "").strip()
        }
    return len(names)


def _run_cli(args: list[str], *, extra_env: dict[str, str] | None = None) -> None:
    cmd = [sys.executable, "-m", "mirage_processor", *args]
    print(f"\n>>> {' '.join(cmd)}")
    env = os.environ.copy()
    prev = env.get("PYTHONPATH", "")
    root = str(_PROCESSOR_ROOT)
    env["PYTHONPATH"] = root if not prev else f"{root}{os.pathsep}{prev}"
    if extra_env:
        env.update(extra_env)
    completed = subprocess.run(
        cmd,
        check=False,
        cwd=str(_REPO_ROOT),
        env=env,
    )
    if completed.returncode != 0:
        raise SystemExit(f"CLI step failed with exit code {completed.returncode}")


def _cleanup_test_state() -> None:
    cmd = [sys.executable, "-m", "processor.testing.cleanup"]
    print(f"\n>>> {' '.join(cmd)}")
    completed = subprocess.run(
        cmd,
        check=False,
        cwd=str(_REPO_ROOT),
    )
    if completed.returncode != 0:
        raise SystemExit(f"cleanup failed with exit code {completed.returncode}")


def _fetch_actual_by_photo_ids(
    db: MirageDatabase,
    external_ids: list[str],
) -> dict[str, set[str]]:
    out: dict[str, set[str]] = {eid: set() for eid in external_ids}
    chunk = 150
    for i in range(0, len(external_ids), chunk):
        batch = external_ids[i : i + chunk]
        photos = (
            db.client.table("photos")
            .select("id, external_photo_id")
            .in_("external_photo_id", batch)
            .execute()
            .data
        )
        if not photos:
            continue
        by_uuid = {row["id"]: row["external_photo_id"] for row in photos}
        matches = (
            db.client.table("photo_people")
            .select("photo_id, people(display_name)")
            .in_("photo_id", list(by_uuid.keys()))
            .execute()
            .data
        )
        for row in matches:
            ext = by_uuid[row["photo_id"]]
            out[ext].add(row["people"]["display_name"])
    return out


def _build_report(
    *,
    expected_matches: dict[str, list[str]],
    actual_sets: dict[str, set[str]],
    people_enrolled: int,
    case: BenchmarkCase,
) -> dict[str, object]:
    photo_ids = list(expected_matches.keys())
    sum_tp = sum_fp = sum_fn = 0
    exact_ok = 0
    evaluated = 0
    per_photo: list[dict[str, object]] = []

    for pid in photo_ids:
        expected = set(expected_matches[pid])
        actual = actual_sets.get(pid, set())
        if not expected:
            continue
        evaluated += 1
        tp = len(expected & actual)
        fp = len(actual - expected)
        fn = len(expected - actual)
        sum_tp += tp
        sum_fp += fp
        sum_fn += fn
        if expected == actual:
            exact_ok += 1
        per_photo.append(
            {
                "photo_id": pid,
                "expected": sorted(expected),
                "actual": sorted(actual),
                "tp": tp,
                "fp": fp,
                "fn": fn,
                "exact": expected == actual,
            }
        )

    precision = sum_tp / (sum_tp + sum_fp) if (sum_tp + sum_fp) > 0 else 0.0
    recall = sum_tp / (sum_tp + sum_fn) if (sum_tp + sum_fn) > 0 else 0.0
    f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) > 0 else 0.0
    exact_rate = exact_ok / evaluated if evaluated > 0 else 0.0

    return {
        "threshold": case.threshold,
        "margin": case.margin,
        "photos_evaluated": evaluated,
        "people_enrolled": people_enrolled,
        "micro_precision": round(precision, 6),
        "micro_recall": round(recall, 6),
        "micro_f1": round(f1, 6),
        "exact_set_match_rate": round(exact_rate, 6),
        "sum_tp": sum_tp,
        "sum_fp": sum_fp,
        "sum_fn": sum_fn,
        "exact_set_matches": exact_ok,
        "per_photo_sample": per_photo[:30],
    }


def _run_case(
    *,
    event_name: str,
    expected_matches: dict[str, list[str]],
    case: BenchmarkCase,
    people_enrolled: int,
) -> dict[str, object]:
    photo_ids = list(expected_matches.keys())
    cli_env = {
        "MIRAGE_DEFAULT_THRESHOLD": str(case.threshold),
        "MIRAGE_MATCH_MARGIN": str(case.margin),
    }
    _cleanup_test_state()
    _run_cli(
        [
            "enroll",
            "--event",
            event_name,
            "--people",
            str(PEOPLE_CSV),
            "--anchor-dir",
            str(ANCHORS_DIR),
        ],
        extra_env=cli_env,
    )
    _run_cli(
        [
            "process",
            "--event",
            event_name,
            "--manifest",
            str(MANIFEST_CSV),
            "--threshold",
            str(case.threshold),
        ],
        extra_env=cli_env,
    )

    db = MirageDatabase(load_settings())
    actual_sets = _fetch_actual_by_photo_ids(db, photo_ids)
    return _build_report(
        expected_matches=expected_matches,
        actual_sets=actual_sets,
        people_enrolled=people_enrolled,
        case=case,
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--thresholds")
    parser.add_argument("--margins")
    args = parser.parse_args()

    if not EXPECTED_JSON.exists():
        raise SystemExit("expected.json missing — run build_riseup_dataset first.")

    data = json.loads(EXPECTED_JSON.read_text(encoding="utf-8"))
    event_name: str = data["event"]["name"]
    expected_matches: dict[str, list[str]] = data["expected_matches"]
    settings = load_settings()
    people_enrolled = count_people_identities(PEOPLE_CSV)
    thresholds = parse_metric_values(args.thresholds, fallback=settings.default_threshold)
    margins = parse_metric_values(args.margins, fallback=settings.match_margin)
    cases = build_sweep_cases(thresholds=thresholds, margins=margins)

    reports = [
        _run_case(
            event_name=event_name,
            expected_matches=expected_matches,
            case=case,
            people_enrolled=people_enrolled,
        )
        for case in cases
    ]
    best_report = max(
        reports,
        key=lambda item: (
            item["exact_set_match_rate"],
            item["micro_precision"],
            item["micro_recall"],
        ),
    )

    REPORT_JSON.write_text(json.dumps(best_report, indent=2), encoding="utf-8")
    if len(reports) > 1:
        SWEEP_REPORT_JSON.write_text(
            json.dumps(
                {
                    "cases_run": reports,
                    "best_case": best_report,
                },
                indent=2,
            ),
            encoding="utf-8",
        )

    print("\n" + "=" * 60)
    print("BENCHMARK RESULTS (person labels, enrolled subset vs photos.json)")
    print("=" * 60)
    print(f"  Threshold:                            {best_report['threshold']:.2f}")
    print(f"  Margin:                               {best_report['margin']:.2f}")
    print(f"  Photos evaluated (non-empty expected): {best_report['photos_evaluated']}")
    print(f"  People enrolled:                      {best_report['people_enrolled']}")
    print(f"  Micro-precision:                      {best_report['micro_precision']:.4%}")
    print(f"  Micro-recall:                         {best_report['micro_recall']:.4%}")
    print(f"  Micro-F1:                             {best_report['micro_f1']:.4%}")
    print(f"  Exact set match rate:                 {best_report['exact_set_match_rate']:.4%}")
    print(
        f"  (TP={best_report['sum_tp']}, FP={best_report['sum_fp']}, "
        f"FN={best_report['sum_fn']})"
    )
    print(f"\n  Full report: {REPORT_JSON}")
    if len(reports) > 1:
        print(f"  Sweep report: {SWEEP_REPORT_JSON}")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
