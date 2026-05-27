#!/bin/bash
set -e

# ═══════════════════════════════════════════════════════════════════════════════
# container-startup.sh — Entrypoint del contenedor SynK-IA
# ═══════════════════════════════════════════════════════════════════════════════

SINKIA_DIR="/app"
MARKITDOWN_VENV="/opt/markitdown-venv"
SERVER_DIR="${SINKIA_DIR}/server"

echo "╔══════════════════════════════════════════════════════╗"
echo "║            🚀 SYNK-IA Container Startup             ║"
echo "╚══════════════════════════════════════════════════════╝"

# ── 1. Adaptar paths de server/.env para contenedor ────────────────────────
if [ -f "${SERVER_DIR}/.env" ]; then
    echo "🔧 Adaptando .env para contenedor..."
    sed -i "s|/Users/davidnows/markitdown-venv|${MARKITDOWN_VENV}|g" "${SERVER_DIR}/.env"
    sed -i "s|/Users/davidnows/synkia-app|${SINKIA_DIR}|g" "${SERVER_DIR}/.env"
    sed -i "s|/Users/davidnows/sinkia-next|${SINKIA_DIR}|g" "${SERVER_DIR}/.env"
fi

# ── 2. Validar variables críticas ──────────────────────────────────────────
if [ -z "${ADMIN_TOKEN}" ]; then
    echo "⚠️  ADMIN_TOKEN no definido, usando valor por defecto"
    export ADMIN_TOKEN="sinkia2026"
fi

# ── 3. Esperar a Ollama ────────────────────────────────────────────────────
echo "⏳ Esperando a Ollama en ${OLLAMA_URL:-http://localhost:11434}..."
for i in $(seq 1 30); do
    if curl -s --max-time 3 "${OLLAMA_URL:-http://localhost:11434}/api/tags" > /dev/null 2>&1; then
        echo "✅ Ollama listo"
        break
    fi
    if [ "$i" -eq 30 ]; then
        echo "⚠️  Ollama no responde — continuando sin él"
    else
        sleep 2
    fi
done

# ── 4. Verificar Markitdown ────────────────────────────────────────────────
echo "🔧 Verificando Markitdown..."
if "${MARKITDOWN_VENV}/bin/python" -c "from markitdown import MarkItDown; print('✅ Markitdown OK')" 2>/dev/null; then
    echo "✅ Markitdown operativo"
else
    echo "⚠️  Markitdown no disponible, el pipeline usará extractores nativos"
fi

# ── 5. Asegurar directorios de datos ───────────────────────────────────────
mkdir -p "${UPLOADS_DIR:-/app/uploads}"
mkdir -p "${DATA_DIR:-/app/data}"
mkdir -p "${SERVER_DIR}/uploads"
mkdir -p /app/logs

echo "📁 Directorios: uploads=${UPLOADS_DIR} data=${DATA_DIR}"

# ── 6. Arrancar servidor ───────────────────────────────────────────────────
echo ""
echo "🚀 Iniciando servidor SynK-IA en puerto ${PORT:-3001}..."
cd "${SERVER_DIR}"
exec node --experimental-vm-modules --require ./node-startup.cjs index.js