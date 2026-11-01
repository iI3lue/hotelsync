#!/usr/bin/env python3
"""Render every Mermaid source in docs/diagramas to PNG through Kroki.

Kroki requires a browser-like User-Agent (it answers 403 otherwise). The
script keeps the .mmd sources as the single source of truth and is safe to
re-run: it overwrites docs/diagramas/png/<name>.png.
"""

from __future__ import annotations

import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "docs" / "diagramas"
OUT = SRC / "png"
URL = "https://kroki.io/mermaid/png"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) HotelSync-Docs/1.0"
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


def render(source: Path, target: Path) -> None:
    body = source.read_bytes()
    request = urllib.request.Request(
        URL,
        data=body,
        method="POST",
        headers={"Content-Type": "text/plain", "User-Agent": UA},
    )
    last_error: Exception | None = None
    for attempt in range(1, 4):
        try:
            with urllib.request.urlopen(request, timeout=90) as response:
                payload = response.read()
            if not payload.startswith(PNG_SIGNATURE):
                raise RuntimeError(f"respuesta no es PNG ({len(payload)} bytes)")
            target.write_bytes(payload)
            print(f"OK   {target.relative_to(ROOT)} ({len(payload) // 1024} KB)")
            return
        except (urllib.error.URLError, TimeoutError, RuntimeError) as error:
            last_error = error
            print(f"retry {attempt} {source.name}: {error}", file=sys.stderr)
            time.sleep(3 * attempt)
    raise SystemExit(f"FALLO {source.name}: {last_error}")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    sources = sorted(SRC.glob("*.mmd"))
    if not sources:
        raise SystemExit("no hay fuentes .mmd en docs/diagramas")
    for index, source in enumerate(sources, start=1):
        render(source, OUT / f"{source.stem}.png")
        if index < len(sources):
            time.sleep(1.5)
    print(f"{len(sources)} diagramas renderizados en {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
