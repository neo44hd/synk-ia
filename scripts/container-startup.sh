#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# container-startup.sh — Entrypoint del contenedor SynK-IA
# ═══════════════════════════════════════════════════════════════════════════════
set -e

SINKIA_DIR="/app"
MARKITDOWN_VENV="/opt/markitdown-venv"

echo "╔══════════════════════════════════════════════════════╗"
echo "║            🚀 SYNK-IA Container Startup             ║"
echo "╚══════════════════════════════════════════════════════╝"

# ── 1. Validar variables críticas ───────────────────────────────────────────
if [ -z "$ADMIN_TOKEN" ]; then
    echo "⚠️  ADMIN_TOKEN no definido, usando valor por defecto"
    export ADMIN_TOKEN="sinkia2026"
fi

# ── 2. Ajustar paths para contenedor ────────────────────────────────────────
export MARKITDOWN_EXE="${MARKITDOWN_VENV}/bin/python"
export MARKITDOWN_WRAPPER="${SINKIA_DIR}/server/tools/markitdown_wrapper.py"

# Asegurar que el .env apunta al path correcto del venv
if [ -f "${SINKIA_DIR}/server/.env" ]; then
    sed -i "s|/Users/davidnows/markitdown-venv|${MARKITDOWN_VENV}|g" "${SINKIA_DIR}/server/.env"
    sed -i "s|/Users/davidnows/synkia-app|${SINKIA_DIR}|g" "${SINKIA_DIR}/server/.env"
fi

# ── 3. Esperar a Ollama (si corre en otro contenedor) ───────────────────────
echo "⏳ Esperando a Ollama..."
for i in {1..30}; do
    if curl -s http://${OLLAMA_HOST:-localhost}:${OLLAMA_PORT:-11434}/api/tags > /dev/null 2>&1; then
        echo "✅ Ollama listo"
        break
    fi
    if [ "$i" -eq 30 ]; then
        echo "⚠️  Ollama no responde — continuando sin él"
    fi
    sleep 2
done

# ── 4. Verificar Markitdown ─────────────────────────────────────────────────
echo "🔧 Verificando Markitdown..."
if "${MARKITDOWN_VENV}/bin/python" -c "from markitdown import MarkItDown; print('✅ Markitdown OK')" 2>/dev/null; then
    echo "✅ Markitdown operativo"
else
    echo "⚠️  Markitdown no disponible, el pipeline usará extractores nativos"
fi

# ── 5. Arrancar servidor ────────────────────────────────────────────────────
echo ""
echo "🚀 Iniciando servidor SynK-IA en puerto ${PORT:-3001}..."
cd "${SINKIA_DIR}/server"
exec node --experimental-vm-modules --require ./node-startup.cjs index.js