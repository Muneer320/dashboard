import tempfile
import time
import unittest
from pathlib import Path

from processor.mirage_processor.telemetry import JsonlTelemetrySink, RunTelemetry


class TelemetryTests(unittest.TestCase):
    def test_run_telemetry_tracks_stage_progress_and_writes_log(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            sink = JsonlTelemetrySink(Path(temp_dir) / "mirage-latency.jsonl")
            telemetry = RunTelemetry(sink=sink, kind="optimize-assets", job_id="job-1")

            telemetry.record_progress(stage="downloading", current=1, total=4, percent=25, message="Downloading...")
            time.sleep(0.01)
            telemetry.record_progress(stage="downloading", current=4, total=4, percent=100, message="Downloading...")
            telemetry.record_progress(stage="optimizing", current=1, total=4, percent=25, message="Optimizing...")
            summary = telemetry.finalize("completed")

            self.assertEqual(summary["status"], "completed")
            self.assertGreaterEqual(summary["runElapsedMs"], 0)
            self.assertIn("downloading", summary["stages"])
            self.assertIn("optimizing", summary["stages"])
            self.assertGreater(summary["stages"]["downloading"]["elapsedMs"], 0)
            self.assertGreaterEqual(summary["stages"]["optimizing"]["elapsedMs"], 0)

            log_text = (Path(temp_dir) / "mirage-latency.jsonl").read_text(encoding="utf-8")
            self.assertIn('"event": "stage.start"', log_text)
            self.assertIn('"event": "run.complete"', log_text)

