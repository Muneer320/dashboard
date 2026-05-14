"""End-to-end integration test for the Mirage processor.

Flow:

1. Runs ``enroll`` with the test people CSV and anchor dir.
2. Runs ``process`` with the test manifest against the same test event slug.
3. Queries Supabase and asserts that, for every test photo, the rows in
   ``photo_people`` match the ground truth in ``expected.json``.

Run from the repo root:

    python -m processor.testing.run_test

Requirements:

- ``SUPABASE_URL`` + ``SUPABASE_SERVICE_ROLE_KEY`` must be set (same env used
  by the processor itself).
- ``download_samples.py`` and ``prepare_dataset.py`` must have been run first.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
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


def _run_cli(args: list[str]) -> None:
    cmd = [sys.executable, "-m", "mirage_processor", *args]
    print(f"\n>>> {' '.join(cmd)}")
    env = os.environ.copy()
    prev = env.get("PYTHONPATH", "")
    root = str(_PROCESSOR_ROOT)
    env["PYTHONPATH"] = root if not prev else f"{root}{os.pathsep}{prev}"
    completed = subprocess.run(
        cmd,
        check=False,
        cwd=str(_REPO_ROOT),
        env=env,
    )
    if completed.returncode != 0:
        raise SystemExit(f"CLI step failed with exit code {completed.returncode}")


def _fetch_actual_matches(
    db: MirageDatabase,
    event_slug: str,
    expected_ids: list[str],
) -> dict[str, list[str]]:
    photos = (
        db.client.table("photos")
        .select("id, external_photo_id")
        .in_("external_photo_id", expected_ids)
        .execute()
        .data
    )
    if not photos:
        return {}

    by_uuid = {row["id"]: row["external_photo_id"] for row in photos}

    matches = (
        db.client.table("photo_people")
        .select("photo_id, confidence, people(display_name)")
        .in_("photo_id", list(by_uuid.keys()))
        .execute()
        .data
    )

    actual: dict[str, list[str]] = {ext_id: [] for ext_id in by_uuid.values()}
    for row in matches:
        ext_id = by_uuid[row["photo_id"]]
        actual[ext_id].append(row["people"]["display_name"])

    return actual


def main() -> int:
    if not EXPECTED_JSON.exists():
        raise SystemExit(
            "expected.json missing. Run prepare_dataset.py first (and "
            "download_samples.py before that).",
        )

    expected_data = json.loads(EXPECTED_JSON.read_text(encoding="utf-8"))
    event_slug: str = expected_data["event"]["slug"]
    event_name: str = expected_data["event"]["name"]
    expected_matches: dict[str, list[str]] = expected_data["expected_matches"]

    _run_cli(
        [
            "enroll",
            "--event",
            event_name,
            "--people",
            str(PEOPLE_CSV),
            "--anchor-dir",
            str(ANCHORS_DIR),
        ]
    )
    _run_cli(
        [
            "process",
            "--event",
            event_name,
            "--manifest",
            str(MANIFEST_CSV),
        ]
    )

    settings = load_settings()
    db = MirageDatabase(settings)
    actual = _fetch_actual_matches(db, event_slug, list(expected_matches.keys()))

    print("\nVerification:")
    failures: list[str] = []
    for photo_id, expected_people in expected_matches.items():
        got = sorted(actual.get(photo_id, []))
        want = sorted(expected_people)
        status = "OK" if got == want else "FAIL"
        print(f"  [{status}] {photo_id}")
        print(f"      expected: {want}")
        print(f"      actual  : {got}")
        if got != want:
            failures.append(photo_id)

    if failures:
        print(
            f"\n{len(failures)} photo(s) did not match ground truth. "
            "Try raising/lowering the threshold via MIRAGE_DEFAULT_THRESHOLD "
            "(default 0.42) and rerun. Current InsightFace model is buffalo_l.",
            file=sys.stderr,
        )
        return 1

    print("\nAll expected matches verified. Processor is working end-to-end.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
