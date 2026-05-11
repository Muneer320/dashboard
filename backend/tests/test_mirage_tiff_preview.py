from __future__ import annotations

from io import BytesIO

import numpy as np
from PIL import Image

from app.services.mirage_pipeline_service import _convert_to_browser_preview


def test_convert_to_browser_preview_uses_largest_tiff_frame() -> None:
    thumb = Image.fromarray(np.full((120, 160, 3), 50, dtype=np.uint8), mode="RGB")
    full = Image.fromarray(np.full((1500, 2000, 3), 180, dtype=np.uint8), mode="RGB")

    payload = BytesIO()
    thumb.save(payload, format="TIFF", save_all=True, append_images=[full])

    converted, mime_type, name = _convert_to_browser_preview(
        payload.getvalue(),
        name="sample.tif",
        mime_type="image/tiff",
        max_width=1600,
        quality=92,
    )

    with Image.open(BytesIO(converted)) as preview:
        assert preview.width == 1600
        assert preview.height > 1000
    assert mime_type == "image/jpeg"
    assert name == "sample.jpg"
