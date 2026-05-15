from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

import numpy as np
from PIL import Image

PROCESSOR_ROOT = Path(__file__).resolve().parents[1]
if str(PROCESSOR_ROOT) not in sys.path:
    sys.path.insert(0, str(PROCESSOR_ROOT))

from mirage_processor.face import FaceEngine


class FaceEngineImageLoadTests(unittest.TestCase):
    def test_load_image_supports_tiff(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            image_path = Path(tmp_dir) / "anchor.tif"
            Image.fromarray(np.full((12, 18, 3), 180, dtype=np.uint8), mode="RGB").save(image_path)

            loaded = FaceEngine.load_image(image_path)

            self.assertEqual(tuple(loaded.shape), (12, 18, 3))
            self.assertEqual(loaded.dtype, np.uint8)

    def test_load_image_uses_largest_tiff_frame(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            image_path = Path(tmp_dir) / "multiframe.tif"
            thumb = Image.fromarray(np.full((120, 160, 3), 50, dtype=np.uint8), mode="RGB")
            full = Image.fromarray(np.full((1500, 2000, 3), 180, dtype=np.uint8), mode="RGB")
            thumb.save(image_path, save_all=True, append_images=[full])

            loaded = FaceEngine.load_image(image_path)

            self.assertEqual(tuple(loaded.shape), (1500, 2000, 3))
            self.assertEqual(loaded.dtype, np.uint8)


if __name__ == "__main__":
    unittest.main()
