#!/usr/bin/env python3
"""
Convierte archivos a Markdown usando MarkItDown
Entrada: sys.argv[1] = ruta del archivo
Salida: JSON con {success, markdown, error}
"""

import sys
import json
import shutil
import subprocess
from pathlib import Path

def convert_file(file_path):
    """Convierte un archivo a Markdown"""
    try:
        path = Path(file_path)
        if not path.exists():
            return {"success": False, "error": f"Archivo no encontrado: {file_path}"}
        
        markitdown_bin = shutil.which("markitdown") or "/opt/homebrew/bin/markitdown"
        if Path(markitdown_bin).exists():
            cmd = [markitdown_bin, str(path)]
            cwd = None
        else:
            cmd = [sys.executable, "-m", "markitdown", str(path)]
            cwd = None

        result = subprocess.run(
            cmd,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=60,
        )

        if result.returncode != 0:
            return {"success": False, "error": result.stderr or result.stdout or "Conversión fallida"}
        
        return {
            "success": True,
            "markdown": result.stdout,
            "title": path.stem,
            "file": str(path)
        }
    except subprocess.TimeoutExpired:
        return {"success": False, "error": "Timeout convirtiendo archivo (>60s)"}
    except Exception as e:
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "Uso: python3 convert-to-markdown.py <ruta>"}))
        sys.exit(1)
    
    result = convert_file(sys.argv[1])
    print(json.dumps(result, ensure_ascii=False, indent=2))
