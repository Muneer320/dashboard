from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import faiss
import numpy as np


class EventIndexStore:
    def __init__(self, data_dir: Path, event_slug: str, dimension: int = 512) -> None:
        self.dimension = dimension
        self.event_dir = data_dir / "events" / event_slug
        self.labels_path = self.event_dir / "labels.json"
        self.embeddings_path = self.event_dir / "embeddings.npy"
        self.index_path = self.event_dir / "index.faiss"
        self.labels: list[dict[str, Any]] = []
        self.embeddings = np.zeros((0, dimension), dtype=np.float32)
        self.load()

    def load(self) -> None:
        if self.labels_path.exists():
            self.labels = json.loads(self.labels_path.read_text(encoding="utf-8"))
        if self.embeddings_path.exists():
            self.embeddings = np.load(self.embeddings_path).astype(np.float32)

    def save(self) -> None:
        self.event_dir.mkdir(parents=True, exist_ok=True)
        self.labels_path.write_text(
            json.dumps(self.labels, indent=2, sort_keys=True),
            encoding="utf-8",
        )
        np.save(self.embeddings_path, self.embeddings)

        index = faiss.IndexFlatIP(self.dimension)
        if len(self.embeddings) > 0:
            index.add(self.embeddings)
        faiss.write_index(index, str(self.index_path))

    def next_faiss_label(self) -> int:
        if not self.labels:
            return 1
        return max(int(label["faiss_label"]) for label in self.labels) + 1

    def label_for_person(self, person_id: str) -> int | None:
        for label in self.labels:
            if label["person_id"] == person_id:
                return int(label["faiss_label"])
        return None

    def label_for_anchor(self, person_id: str, anchor_key: str) -> int | None:
        for label in self.labels:
            label_anchor_key = str(label.get("anchor_key", "__default__"))
            if label["person_id"] == person_id and label_anchor_key == anchor_key:
                return int(label["faiss_label"])
        return None

    def upsert(
        self,
        person_id: str,
        faiss_label: int,
        display_name: str,
        embedding: np.ndarray,
        anchor_key: str = "__default__",
    ) -> None:
        normalized = embedding.astype(np.float32).reshape(1, self.dimension)
        for index, label in enumerate(self.labels):
            label_anchor_key = str(label.get("anchor_key", "__default__"))
            if label["person_id"] == person_id and label_anchor_key == anchor_key:
                self.labels[index] = {
                    "person_id": person_id,
                    "faiss_label": faiss_label,
                    "display_name": display_name,
                    "anchor_key": anchor_key,
                }
                self.embeddings[index] = normalized[0]
                return

        self.labels.append(
            {
                "person_id": person_id,
                "faiss_label": faiss_label,
                "display_name": display_name,
                "anchor_key": anchor_key,
            }
        )
        self.embeddings = np.vstack([self.embeddings, normalized])

    def remove_person(self, person_id: str) -> bool:
        kept_labels: list[dict[str, Any]] = []
        kept_embeddings: list[np.ndarray] = []
        removed = False

        for label, embedding in zip(self.labels, self.embeddings, strict=True):
            if label["person_id"] == person_id:
                removed = True
            else:
                kept_labels.append(label)
                kept_embeddings.append(embedding)

        self.labels = kept_labels
        self.embeddings = (
            np.vstack(kept_embeddings).astype(np.float32)
            if kept_embeddings
            else np.zeros((0, self.dimension), dtype=np.float32)
        )
        return removed

    def search(self, embedding: np.ndarray, k: int = 1) -> list[tuple[dict[str, Any], float]]:
        if len(self.embeddings) == 0:
            return []

        index = faiss.IndexFlatIP(self.dimension)
        index.add(self.embeddings)
        scores, positions = index.search(embedding.astype(np.float32).reshape(1, -1), k)

        matches: list[tuple[dict[str, Any], float]] = []
        for score, position in zip(scores[0], positions[0], strict=True):
            if position < 0:
                continue
            matches.append((self.labels[int(position)], float(score)))
        return matches
