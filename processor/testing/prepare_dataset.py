"""Turn the raw test dataset into the CSVs + folders the Mirage processor expects.

Produces, under ``processor/testing/dataset/``:

- ``anchors/``         one anchor image per person (copied from raw/anchors)
- ``event_photos/``    event photos (copied from raw/event_photos) that ``process``
                       will read through the CSV manifest
- ``people.csv``       columns: display_name, alias, anchor_filename, consent
- ``manifest.csv``     columns: event_slug, photo_id, local_path, public_url,
                       caption, storage_path, sort_order, is_featured
- ``expected.json``    ground truth consumed by run_test.py to verify matches

Test isolation: every photo id is prefixed with ``mirage-test:`` so cleanup.py
can safely delete just the rows created by this harness.

Run from the repo root (recommended) after ``download_samples.py``:

    python -m processor.testing.prepare_dataset
"""

from __future__ import annotations

import csv
import json
import shutil
from pathlib import Path

HERE = Path(__file__).resolve().parent
SOURCES_PATH = HERE / "dataset_sources.json"
DATASET_ROOT = HERE / "dataset"
RAW_ANCHORS_DIR = DATASET_ROOT / "raw" / "anchors"
RAW_EVENT_DIR = DATASET_ROOT / "raw" / "event_photos"
ANCHORS_DIR = DATASET_ROOT / "anchors"
EVENT_PHOTOS_DIR = DATASET_ROOT / "event_photos"
PEOPLE_CSV = DATASET_ROOT / "people.csv"
MANIFEST_CSV = DATASET_ROOT / "manifest.csv"
EXPECTED_JSON = DATASET_ROOT / "expected.json"

EXTERNAL_ID_PREFIX = "mirage-test:"


def _copy(src: Path, dest: Path) -> None:
    if not src.exists():
        raise SystemExit(
            f"missing source file: {src}. Run download_samples.py first, or add the file manually.",
        )
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(src, dest)


def main() -> int:
    sources = json.loads(SOURCES_PATH.read_text(encoding="utf-8"))
    event_slug: str = sources["event"]["slug"]

    ANCHORS_DIR.mkdir(parents=True, exist_ok=True)
    EVENT_PHOTOS_DIR.mkdir(parents=True, exist_ok=True)

    with PEOPLE_CSV.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=["display_name", "alias", "anchor_filename", "consent"],
        )
        writer.writeheader()
        for person in sources["people"]:
            anchor_name = person["anchor"]["filename"]
            _copy(RAW_ANCHORS_DIR / anchor_name, ANCHORS_DIR / anchor_name)
            writer.writerow(
                {
                    "display_name": person["display_name"],
                    "alias": person.get("alias", ""),
                    "anchor_filename": anchor_name,
                    "consent": "true",
                }
            )

    expected: dict[str, list[str]] = {}

    with MANIFEST_CSV.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "event_slug",
                "photo_id",
                "local_path",
                "public_url",
                "caption",
                "storage_path",
                "sort_order",
                "is_featured",
            ],
        )
        writer.writeheader()
        for index, photo in enumerate(sources["event_photos"]):
            name = photo["filename"]
            stem = Path(name).stem
            photo_id = f"{EXTERNAL_ID_PREFIX}{stem}"
            _copy(RAW_EVENT_DIR / name, EVENT_PHOTOS_DIR / name)
            writer.writerow(
                {
                    "event_slug": event_slug,
                    "photo_id": photo_id,
                    "local_path": f"event_photos/{name}",
                    "public_url": f"https://example.invalid/mirage-test/{name}",
                    "caption": photo.get("caption", ""),
                    "storage_path": "",
                    "sort_order": index,
                    "is_featured": "false",
                }
            )
            expected[photo_id] = list(photo["expected_people"])

    EXPECTED_JSON.write_text(
        json.dumps(
            {
                "event": sources["event"],
                "external_id_prefix": EXTERNAL_ID_PREFIX,
                "expected_matches": expected,
            },
            indent=2,
            sort_keys=True,
        ),
        encoding="utf-8",
    )

    print("Test dataset prepared:")
    print(f"  anchors dir : {ANCHORS_DIR}")
    print(f"  event photos: {EVENT_PHOTOS_DIR}")
    print(f"  people.csv  : {PEOPLE_CSV}")
    print(f"  manifest.csv: {MANIFEST_CSV}")
    print(f"  expected    : {EXPECTED_JSON}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
