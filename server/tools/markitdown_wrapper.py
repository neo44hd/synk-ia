#!/usr/bin/env python3
"""
markitdown_wrapper.py — Wrapper para invocar MarkItDown desde Node.js
Uso: node llama a este script pasándole el filepath como argumento.
"""

import sys
import json
import os

# Asegurar que el venv de Markitdown esté activo
VENV_SITE_PACKAGES = "/Users/davidnows/markitdown-venv/lib/python3.12/site-packages"
if VENV_SITE_PACKAGES not in sys.path:
    sys.path.insert(0, VENV_SITE_PACKAGES)

# También permitir ruta local del paquete
MARKITDOWN_SRC = "/Users/davidnows/markitdown/packages/markitdown/src"
if MARKITDOWN_SRC not in sys.path:
    sys.path.insert(0, MARKITDOWN_SRC)

from markitdown import MarkItDown


def convert_file(filepath: str) -> dict:
    """Convierte un archivo a Markdown usando MarkItDown."""
    try:
        md = MarkItDown()
        result = md.convert(filepath)
        return {
            "ok": True,
            "markdown": result.markdown,
            "title": result.title or os.path.basename(filepath),
            "length": len(result.markdown),
        }
    except Exception as e:
        return {
            "ok": False,
            "error": str(e),
        }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"ok": False, "error": "Uso: markitdown_wrapper.py <filepath>"}))
        sys.exit(1)

    filepath = sys.argv[1]
    result = convert_file(filepath)
    print(json.dumps(result, ensure_ascii=False))