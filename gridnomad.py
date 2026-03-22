from __future__ import annotations

import sys
from pathlib import Path


SRC_PATH = Path(__file__).resolve().parent / "src"
src = str(SRC_PATH)
if src not in sys.path:
    sys.path.insert(0, src)

from gridnomad.cli import main


if __name__ == "__main__":
    raise SystemExit(main())
