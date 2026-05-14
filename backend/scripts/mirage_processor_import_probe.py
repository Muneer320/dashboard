"""Exit 0 if Mirage processor deps import; else print failures and exit 1.
Used by start_mirage_processor_server.ps1 and run_mirage_processor.ps1
(inline python -c breaks on Windows when the probe contains quoted strings).
"""
from __future__ import annotations

import importlib
import sys

REQUIRED = [
    "fastapi",
    "httpx",
    "uvicorn",
    "asyncpg",
    "boto3",
    "cv2",
    "numpy",
    "onnxruntime",
    "supabase",
    "insightface",
]

failures: list[str] = []
for name in REQUIRED:
    try:
        importlib.import_module(name)
    except Exception as exc:  # noqa: BLE001 - probe collects all import errors
        failures.append("%s: %s" % (name, exc))

if failures:
    print("\n".join(failures))
    sys.exit(1)
