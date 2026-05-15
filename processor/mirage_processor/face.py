from __future__ import annotations

import os
import io
from pathlib import Path
from typing import Any

import cv2
import numpy as np
import onnxruntime as ort
from insightface.app import FaceAnalysis
from PIL import Image, ImageOps, ImageSequence

try:
    from pillow_heif import register_heif_opener

    register_heif_opener()
except Exception:  # pragma: no cover - optional dependency.
    pass

from .config import Settings


def _largest_tiff_frame(image: Image.Image) -> Image.Image:
    largest = image
    largest_area = image.width * image.height
    try:
        for frame in ImageSequence.Iterator(image):
            area = int(frame.width) * int(frame.height)
            if area > largest_area:
                largest = frame.copy()
                largest_area = area
    except Exception:
        return image
    return largest if largest is not image else image.copy()


def _add_windows_cuda_dll_dirs() -> None:
    if os.name != "nt":
        return

    site_packages = Path(ort.__file__).resolve().parent.parent
    candidate_dirs = [
        site_packages / "nvidia" / "cublas" / "bin",
        site_packages / "nvidia" / "cuda_runtime" / "bin",
        site_packages / "nvidia" / "cuda_nvrtc" / "bin",
        site_packages / "nvidia" / "cufft" / "bin",
        site_packages / "nvidia" / "cudnn" / "bin",
        site_packages / "nvidia" / "nvjitlink" / "bin",
    ]

    existing_dirs: list[str] = []
    for directory in candidate_dirs:
        if directory.is_dir():
            directory_str = str(directory)
            os.add_dll_directory(directory_str)
            existing_dirs.append(directory_str)

    if existing_dirs:
        current_path = os.environ.get("PATH", "")
        os.environ["PATH"] = os.pathsep.join(existing_dirs + [current_path])


class FaceEngine:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        if any(provider != "CPUExecutionProvider" for provider in settings.onnx_providers):
            # On Windows, ONNX Runtime GPU needs CUDA/cuDNN DLLs preloaded from
            # the venv's nvidia packages before InsightFace creates sessions.
            _add_windows_cuda_dll_dirs()
            ort.preload_dlls(directory="")
        self.app = FaceAnalysis(
            name=settings.insightface_model,
            providers=settings.onnx_providers,
        )
        ctx_id = 0 if any(provider != "CPUExecutionProvider" for provider in settings.onnx_providers) else -1
        self.app.prepare(
            ctx_id=ctx_id,
            det_thresh=settings.detection_threshold,
            det_size=(settings.detection_size, settings.detection_size),
        )

    def detect(self, image_path: Path) -> list[Any]:
        image = self.load_image(image_path)
        return self.app.get(image)

    def detect_anchor(self, image_path: Path) -> list[Any]:
        """Detect a single-user anchor face with selfie-friendly fallbacks.

        Some clear anchor selfies place the face very close to the image edge.
        SCRFD can miss those crops even when the same face is detected after a
        small border is added. Keep the normal strict detector first, then only
        try padding fallbacks when no face was found.
        """
        image = self.load_image(image_path)
        faces = list(self.app.get(image))
        if faces:
            return faces

        for pad_percent in (0.10, 0.20, 0.35):
            padded = self._pad_image(image, pad_percent)
            padded_faces = list(self.app.get(padded))
            if padded_faces:
                return padded_faces
        return []

    @staticmethod
    def _pad_image(image: np.ndarray, pad_percent: float) -> np.ndarray:
        height, width = image.shape[:2]
        pad_y = max(1, int(height * pad_percent))
        pad_x = max(1, int(width * pad_percent))
        return cv2.copyMakeBorder(
            image,
            pad_y,
            pad_y,
            pad_x,
            pad_x,
            cv2.BORDER_REPLICATE,
        )

    @staticmethod
    def load_image(image_path: Path) -> np.ndarray:
        try:
            if image_path.suffix.lower() in {".tif", ".tiff"}:
                with Image.open(image_path) as image:
                    largest_frame = _largest_tiff_frame(image)
                image = ImageOps.exif_transpose(largest_frame).convert("RGB")
                return cv2.cvtColor(np.asarray(image), cv2.COLOR_RGB2BGR)

            if image_path.suffix.lower() == ".nef":
                try:
                    import rawpy

                    with rawpy.imread(str(image_path)) as raw:
                        rgb = raw.postprocess()
                    return cv2.cvtColor(np.asarray(rgb), cv2.COLOR_RGB2BGR)
                except Exception:
                    pass

            image = Image.open(image_path)
            image = ImageOps.exif_transpose(image).convert("RGB")
            return cv2.cvtColor(np.asarray(image), cv2.COLOR_RGB2BGR)
        except Exception:  # noqa: BLE001 - fallback keeps odd formats working when PIL fails.
            image = cv2.imread(str(image_path), cv2.IMREAD_COLOR)
            if image is None:
                raise RuntimeError(f"Unable to read image: {image_path}")
            return image

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

    @staticmethod
    def landmarks(face: Any) -> list[dict[str, float]]:
        keypoints = getattr(face, "kps", None)
        if keypoints is None:
            return []
        return [
            {"x": float(point[0]), "y": float(point[1])}
            for point in np.asarray(keypoints, dtype=np.float32)
        ]

    @staticmethod
    def quality_score(face: Any) -> float:
        score = getattr(face, "det_score", None)
        return float(score) if score is not None else 0.0

    def has_valid_landmarks(self, face: Any) -> bool:
        points = self.landmarks(face)
        if len(points) != 5:
            return False

        box = self.bbox(face)
        width = max(1.0, box["x2"] - box["x1"])
        height = max(1.0, box["y2"] - box["y1"])
        if width <= 0 or height <= 0:
            return False

        for point in points:
            if not (box["x1"] - width * 0.2 <= point["x"] <= box["x2"] + width * 0.2):
                return False
            if not (box["y1"] - height * 0.2 <= point["y"] <= box["y2"] + height * 0.2):
                return False
        return True
