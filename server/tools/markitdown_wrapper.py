#!/usr/bin/env python3
"""
markitdown_wrapper.py — Wrapper para invocar MarkItDown desde Node.js
Uso: node llama a este script pasándole el filepath como argumento.
Portable: no requiere rutas hardcodeadas.
"""

import sys
import json
import os
import site


def _ensure_markitdown():
    """Asegura que markitdown esté importable desde el venv del contenedor."""
    # Rutas conocidas donde puede estar el venv
    venv_candidates = [
        "/opt/markitdown-venv",                      # Contenedor Docker
        os.path.expanduser("~/markitdown-venv"),     # Desarrollo macOS
        os.path.expanduser("~/.venv"),                # Venv genérico
        os.path.expanduser("~/.virtualenvs/markitdown"),  # virtualenvwrapper
    ]

    for venv_root in venv_candidates:
        site_packages = os.path.join(venv_root, "lib", "python3.12", "site-packages")
        if os.path.isdir(site_packages):
            if site_packages not in sys.path:
                sys.path.insert(0, site_packages)
            break

    try:
        from markitdown import MarkItDown
        return MarkItDown
    except ImportError:
        # Fallback: intentar instalar o usar path local del repo
        local_markitdown = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "markitdown", "packages", "markitdown", "src",
        )
        if os.path.isdir(local_markitdown):
            sys.path.insert(0, local_markitdown)
        try:
            from markitdown import MarkItDown
            return MarkItDown
        except ImportError:
            return None


MarkItDown = _ensure_markitdown()


def convert_file(filepath: str) -> dict:
    """Convierte un archivo a Markdown usando MarkItDown."""
    if MarkItDown is None:
        return {
            "ok": False,
            "error": "MarkItDown no disponible. Instalar: pip install markitdown",
        }

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
            "error": f"{type(e).__name__}: {e}",
        }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"ok": False, "error": "Uso: markitdown_wrapper.py <filepath>"}))
        sys.exit(1)

    filepath = sys.argv[1]
    result = convert_file(filepath)
    print(json.dumps(result, ensure_ascii=False))