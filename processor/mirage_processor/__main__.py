from __future__ import annotations

import sys

from .cli import main as cli_main
from .server import serve as serve_http


if len(sys.argv) > 1 and sys.argv[1] == "serve":
    sys.argv.pop(1)
    serve_http()
else:
    cli_main()
