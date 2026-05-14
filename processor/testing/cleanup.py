"""Remove Mirage test rows from Supabase and the local FAISS test index.

Deletes, for the test event slug only:

- rows in ``photo_people`` whose photo has ``external_photo_id`` prefixed
  ``mirage-test:``
- rows in ``event_photos`` linking the test event to those photos
- those ``photos`` rows
- the test ``event`` row
- any ``people`` rows whose display_name ends with ``(test)``
- the local FAISS index dir for the test event slug

Run from repo root:

    python -m processor.testing.cleanup
"""

from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

_PROCESSOR_ROOT = Path(__file__).resolve().parents[1]
if str(_PROCESSOR_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROCESSOR_ROOT))

from mirage_processor.config import load_settings
from mirage_processor.database import MirageDatabase

HERE = Path(__file__).resolve().parent
EXPECTED_JSON = HERE / "dataset" / "expected.json"
BENCHMARK_REPORT = HERE / "dataset" / "benchmark_report.json"


def main() -> int:
    if not EXPECTED_JSON.exists():
        raise SystemExit("expected.json missing; nothing to clean up.")

    data = json.loads(EXPECTED_JSON.read_text(encoding="utf-8"))
    event_slug: str = data["event"]["slug"]
    prefix: str = data["external_id_prefix"]

    settings = load_settings()
    db = MirageDatabase(settings)

    photos = (
        db.client.table("photos")
        .select("id, external_photo_id")
        .like("external_photo_id", f"{prefix}%")
        .execute()
        .data
    )
    photo_ids = [row["id"] for row in photos]

    if photo_ids:
        db.client.table("photo_people").delete().in_("photo_id", photo_ids).execute()
        db.client.table("event_photos").delete().in_("photo_id", photo_ids).execute()
        db.client.table("photos").delete().in_("id", photo_ids).execute()
        print(f"deleted {len(photo_ids)} test photo row(s) and their mappings")

    db.client.table("events").delete().eq("slug", event_slug).execute()
    print(f"deleted event '{event_slug}' if it existed")

    db.client.table("people").delete().like("display_name", "%(test)").execute()
    print("deleted test people (display_name ending in '(test)')")

    faiss_dir = settings.data_dir / "events" / event_slug
    if faiss_dir.exists():
        shutil.rmtree(faiss_dir)
        print(f"removed local FAISS index dir {faiss_dir}")

    if BENCHMARK_REPORT.exists():
        BENCHMARK_REPORT.unlink()
        print(f"removed {BENCHMARK_REPORT.name}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
