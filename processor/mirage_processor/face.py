from __future__ import annotations

from pathlib import Path
from typing import Any

import cv2
import numpy as np
from insightface.app import FaceAnalysis

from .config import Settings


class FaceEngine:
    def __init__(self, settings: Settings) -> None:
        self.app = FaceAnalysis(
            name=settings.insightface_model,
            providers=settings.onnx_providers,
        )
        self.app.prepare(ctx_id=-1, det_size=(640, 640))

    def detect(self, image_path: Path) -> list[Any]:
        image = cv2.imread(str(image_path))
        if image is None:
            raise RuntimeError(f"Unable to read image: {image_path}")
        return self.app.get(image)

    def require_single_embedding(self, image_path: Path) -> np.ndarray:
        faces = self.detect(image_path)
        if len(faces) != 1:
            raise RuntimeError(
                f"Expected exactly one face in {image_path}, found {len(faces)}"
            )
        return self.embedding(faces[0])

    @staticmethod
    def embedding(face: Any) -> np.ndarray:
        vector = getattr(face, "normed_embedding", None)
        if vector is None:
            vector = getattr(face, "embedding")
            norm = np.linalg.norm(vector)
            if norm == 0:
                raise RuntimeError("Face embedding has zero length")
            vector = vector / norm
        return np.asarray(vector, dtype=np.float32)

    @staticmethod
    def bbox(face: Any) -> dict[str, float]:
        x1, y1, x2, y2 = [float(value) for value in face.bbox]
        return {"x1": x1, "y1": y1, "x2": x2, "y2": y2}
