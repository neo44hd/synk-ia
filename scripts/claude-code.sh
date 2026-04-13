#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# claude-code.sh — Arranca Claude Code original vía proxy Ollama
#
# Redirige todas las llamadas de Claude Code a localhost:3001/claude
# que traduce Anthropic API → OpenAI API → Ollama (qwen2.5-coder:14b)
#
# Uso:
#   ./scripts/claude-code.sh              # arranca Claude Code interactivo
#   ./scripts/claude-code.sh "fix bug"    # arranca con prompt directo
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── Limpiar tokens previos (evita "Auth conflict" con login de pago) ───────
unset ANTHROPIC_AUTH_TOKEN 2>/dev/null || true

# ── Configuración del proxy ────────────────────────────────────────────────────
export ANTHROPIC_BASE_URL="http://localhost:3001/claude"
export ANTHROPIC_API_KEY="local-free"

# Forzar modelo — Claude Code usa ANTHROPIC_MODEL como modelo principal
# El proxy traduce cualquier model name → qwen2.5-coder:14b en Ollama
export ANTHROPIC_MODEL="claude-3-5-sonnet-20241022"

# Mapear todos los alias (opus/sonnet/haiku) al mismo proxy
export ANTHROPIC_DEFAULT_OPUS_MODEL="claude-3-5-sonnet-20241022"
export ANTHROPIC_DEFAULT_SONNET_MODEL="claude-3-5-sonnet-20241022"
export ANTHROPIC_DEFAULT_HAIKU_MODEL="claude-3-5-sonnet-20241022"
export CLAUDE_CODE_SUBAGENT_MODEL="claude-3-5-sonnet-20241022"

# Desactivar telemetría, updates, y thinking (no soportado por Ollama)
export CLAUDE_CODE_DISABLE_TELEMETRY=1
export CLAUDE_CODE_SKIP_UPDATE_CHECK=1
export CLAUDE_CODE_DISABLE_THINKING=1
export DISABLE_UPGRADE_COMMAND=1

# ── Verificaciones ─────────────────────────────────────────────────────────────
echo "🔍 Verificando servicios..."

# 1. Comprobar que Ollama responde
if ! curl -sf http://localhost:11434/api/version >/dev/null 2>&1; then
  echo "❌ Ollama no está corriendo en localhost:11434"
  echo "   Arrancalo con: ollama serve"
  exit 1
fi
echo "   ✅ Ollama OK"

# 2. Comprobar que SynK-IA (proxy) responde
if ! curl -sf http://localhost:3001/claude/v1/models >/dev/null 2>&1; then
  echo "❌ SynK-IA proxy no responde en localhost:3001/claude"
  echo "   Arrancalo con: cd ~/sinkia && pm2 start sinkia-api"
  exit 1
fi
echo "   ✅ Proxy Claude OK"

# 3. Comprobar que qwen2.5-coder:14b está disponible (via API, más fiable que grep)
if ! curl -sf http://localhost:11434/api/show -d '{"name":"qwen2.5-coder:14b"}' >/dev/null 2>&1; then
  echo "⚠️  qwen2.5-coder:14b no encontrado en Ollama"
  echo "   Descárgalo con: ollama pull qwen2.5-coder:14b"
  exit 1
fi
echo "   ✅ qwen2.5-coder:14b disponible"

# ── Lanzar Claude Code ─────────────────────────────────────────────────────────
echo ""
echo "🚀 Claude Code → qwen2.5-coder:14b vía proxy Ollama"
echo "   Proxy:  $ANTHROPIC_BASE_URL"
echo "   Modelo: qwen2.5-coder:14b (real) ← $ANTHROPIC_MODEL (aparente)"
echo ""

CLAUDE_BIN="/opt/homebrew/bin/claude"

if [ ! -x "$CLAUDE_BIN" ]; then
  echo "❌ Claude Code no encontrado en $CLAUDE_BIN"
  exit 1
fi

# Pasar --model explícito para máxima prioridad
if [ $# -gt 0 ]; then
  exec "$CLAUDE_BIN" --model "$ANTHROPIC_MODEL" "$@"
else
  exec "$CLAUDE_BIN" --model "$ANTHROPIC_MODEL"
fi
