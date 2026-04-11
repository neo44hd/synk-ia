#!/bin/bash
# ── SYNK-IA Startup Script ──────────────────────────────────────────────────
# Levanta todos los servicios en PM2 de una sola vez.
# Uso: bash ~/sinkia/scripts/startup.sh
# ─────────────────────────────────────────────────────────────────────────────

set -e

SINKIA_DIR="$HOME/sinkia"
cd "$SINKIA_DIR"

echo "🔧 Arrancando servicios SYNK-IA..."

# ── 1. Esperar a que Ollama esté listo (arranca con macOS) ──────────────────
echo "⏳ Esperando a Ollama..."
for i in {1..30}; do
  if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo "✅ Ollama listo"
    break
  fi
  [ "$i" -eq 30 ] && echo "⚠️  Ollama no responde — continúo sin él"
  sleep 2
done

# ── 2. Limpiar procesos PM2 anteriores ─────────────────────────────────────
pm2 delete all 2>/dev/null || true

# ── 3. Levantar servicios ──────────────────────────────────────────────────
# Backend API
pm2 start "$SINKIA_DIR/server/index.js" \
  --name sinkia-api \
  --cwd "$SINKIA_DIR/server" \
  --node-args="--experimental-vm-modules"

# Cloudflare Tunnel
pm2 start cloudflared \
  --name cloudflared-tunnel \
  -- tunnel run sinkia

# LiteLLM Proxy (solo si existe el script)
if [ -f "$SINKIA_DIR/scripts/start-litellm.sh" ]; then
  pm2 start "$SINKIA_DIR/scripts/start-litellm.sh" \
    --name litellm-proxy
else
  echo "⏭️  start-litellm.sh no encontrado — omitiendo litellm-proxy"
fi

# ── 4. Guardar estado para pm2 resurrect ───────────────────────────────────
pm2 save

# ── 5. Verificar ───────────────────────────────────────────────────────────
sleep 3
echo ""
echo "📊 Estado de los servicios:"
pm2 list

# Health check del backend
echo ""
echo "🏥 Health check:"
curl -s http://localhost:3001/api/health 2>/dev/null || echo "⚠️  Backend aún arrancando..."

echo ""
echo "🚀 SYNK-IA lista → https://sinkialabs.com"
