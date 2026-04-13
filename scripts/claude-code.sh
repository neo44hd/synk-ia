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

# ── Configuración del proxy ────────────────────────────────────────────────────
export ANTHROPIC_BASE_URL="http://localhost:3001/claude"
export ANTHROPIC_API_KEY="local-free"

# Modelo que Claude Code solicitará (el proxy lo ignora y usa qwen2.5-coder:14b,
# pero Claude Code necesita un valor válido en su config)
export ANTHROPIC_MODEL="claude-3-5-sonnet-20241022"

# Desactivar telemetría y auto-updates de Claude Code
export CLAUDE_CODE_DISABLE_TELEMETRY=1
export CLAUDE_CODE_SKIP_UPDATE_CHECK=1

# ── Verificaciones ─────────────────────────────────────────────────────────────
# 1. Comprobar que Ollama responde
if ! curl -sf http://localhost:11434/api/version >/dev/null 2>&1; then
  echo "❌ Ollama no está corriendo en localhost:11434"
  echo "   Arrancalo con: ollama serve"
  exit 1
fi

# 2. Comprobar que SynK-IA (proxy) responde
if ! curl -sf http://localhost:3001/claude/v1/models >/dev/null 2>&1; then
  echo "❌ SynK-IA proxy no responde en localhost:3001/claude"
  echo "   Arrancalo con: cd ~/sinkia && pm2 start sinkia-api"
  exit 1
fi

# 3. Comprobar que qwen2.5-coder:14b está disponible
if ! ollama list 2>/dev/null | grep -q "qwen2.5-coder:14b"; then
  echo "⚠️  qwen2.5-coder:14b no aparece en ollama list"
  echo "   Descárgalo con: ollama pull qwen2.5-coder:14b"
  exit 1
fi

# ── Lanzar Claude Code ─────────────────────────────────────────────────────────
echo "🚀 Claude Code → Ollama (qwen2.5-coder:14b) vía proxy localhost:3001/claude"
echo "   ANTHROPIC_BASE_URL=$ANTHROPIC_BASE_URL"
echo "   ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY"
echo ""

CLAUDE_BIN="/opt/homebrew/bin/claude"

if [ ! -x "$CLAUDE_BIN" ]; then
  echo "❌ Claude Code no encontrado en $CLAUDE_BIN"
  exit 1
fi

if [ $# -gt 0 ]; then
  exec "$CLAUDE_BIN" "$@"
else
  exec "$CLAUDE_BIN"
fi
