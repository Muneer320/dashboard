from __future__ import annotations

import json
import threading
import time
from contextlib import contextmanager
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Iterator


def _utc_now_iso() -> str:
    return datetime.now(UTC).isoformat()


class JsonlTelemetrySink:
    def __init__(self, path: Path) -> None:
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()

    def write(self, event: dict[str, Any]) -> None:
        payload = {**event, "timestamp": event.get("timestamp") or _utc_now_iso()}
        line = json.dumps(payload, ensure_ascii=True, default=str)
        with self._lock:
            with self.path.open("a", encoding="utf-8") as handle:
                handle.write(line)
                handle.write("\n")


@dataclass
class RunTelemetry:
    sink: JsonlTelemetrySink
    kind: str
    job_id: str | None = None
    history_limit: int = 80
    run_started_at: float = field(default_factory=time.perf_counter)
    current_stage: str | None = None
    current_stage_started_at: float | None = None
    recent_events: list[dict[str, Any]] = field(default_factory=list)
    stage_summaries: dict[str, dict[str, Any]] = field(default_factory=dict)

    def _append_event(self, event: dict[str, Any]) -> dict[str, Any]:
        payload = {
            "kind": self.kind,
            "jobId": self.job_id,
            **event,
        }
        self.sink.write(payload)
        self.recent_events.append(payload)
        if len(self.recent_events) > self.history_limit:
            self.recent_events = self.recent_events[-self.history_limit :]
        return payload

    def event(self, name: str, **fields: Any) -> dict[str, Any]:
        return self._append_event({"event": name, **fields})

    @contextmanager
    def span(self, name: str, **fields: Any) -> Iterator[None]:
        started_at = time.perf_counter()
        self.event(f"{name}.start", **fields)
        try:
            yield
        except Exception as exc:
            duration_ms = round((time.perf_counter() - started_at) * 1000, 2)
            end_fields = dict(fields)
            if "status" in end_fields:
                end_fields["entityStatus"] = end_fields.pop("status")
            self.event(f"{name}.end", durationMs=duration_ms, status="error", error=str(exc), **end_fields)
            raise
        else:
            duration_ms = round((time.perf_counter() - started_at) * 1000, 2)
            end_fields = dict(fields)
            if "status" in end_fields:
                end_fields["entityStatus"] = end_fields.pop("status")
            self.event(f"{name}.end", durationMs=duration_ms, status="ok", **end_fields)

    def record_progress(
        self,
        *,
        stage: str,
        current: int,
        total: int,
        percent: int | float | None = None,
        message: str | None = None,
    ) -> None:
        now = time.perf_counter()
        if self.current_stage != stage:
            self._close_current_stage(now)
            self.current_stage = stage
            self.current_stage_started_at = now
            self.stage_summaries.setdefault(
                stage,
                {
                    "firstStartedAt": _utc_now_iso(),
                    "elapsedMs": 0.0,
                    "current": 0,
                    "total": max(int(total), 0),
                    "percent": 0,
                    "message": message,
                },
            )
            self.event(
                "stage.start",
                stage=stage,
                current=current,
                total=total,
                percent=percent,
                message=message,
            )

        summary = self.stage_summaries.setdefault(
            stage,
            {
                "firstStartedAt": _utc_now_iso(),
                "elapsedMs": 0.0,
                "current": 0,
                "total": max(int(total), 0),
                "percent": 0,
                "message": message,
            },
        )
        if self.current_stage_started_at is not None:
            summary["elapsedMs"] = round((now - self.current_stage_started_at) * 1000, 2)
        summary["current"] = max(int(current), 0)
        summary["total"] = max(int(total), 0)
        summary["percent"] = int(percent if percent is not None else 0)
        summary["message"] = message

        self.event(
            "stage.progress",
            stage=stage,
            current=current,
            total=total,
            percent=percent,
            message=message,
        )

    def _close_current_stage(self, now: float | None = None) -> None:
        if self.current_stage is None or self.current_stage_started_at is None:
            return
        current_time = now if now is not None else time.perf_counter()
        summary = self.stage_summaries.setdefault(
            self.current_stage,
            {
                "firstStartedAt": _utc_now_iso(),
                "elapsedMs": 0.0,
                "current": 0,
                "total": 0,
                "percent": 0,
                "message": None,
            },
        )
        summary["elapsedMs"] = round((current_time - self.current_stage_started_at) * 1000, 2)
        self.event(
            "stage.end",
            stage=self.current_stage,
            elapsedMs=summary["elapsedMs"],
            current=summary.get("current"),
            total=summary.get("total"),
            percent=summary.get("percent"),
            message=summary.get("message"),
        )
        self.current_stage = None
        self.current_stage_started_at = None

    def snapshot(self) -> dict[str, Any]:
        now = time.perf_counter()
        stages = {key: dict(value) for key, value in self.stage_summaries.items()}
        if self.current_stage and self.current_stage_started_at is not None:
            summary = stages.setdefault(self.current_stage, {})
            summary["elapsedMs"] = round((now - self.current_stage_started_at) * 1000, 2)
        return {
            "runElapsedMs": round((now - self.run_started_at) * 1000, 2),
            "currentStage": self.current_stage,
            "stages": stages,
            "recentEvents": self.recent_events[-20:],
        }

    def finalize(self, status: str) -> dict[str, Any]:
        now = time.perf_counter()
        self._close_current_stage(now)
        summary = {
            "status": status,
            "runElapsedMs": round((now - self.run_started_at) * 1000, 2),
            "stages": {key: dict(value) for key, value in self.stage_summaries.items()},
            "recentEvents": self.recent_events[-20:],
        }
        self.event("run.complete", status=status, runElapsedMs=summary["runElapsedMs"])
        return summary
