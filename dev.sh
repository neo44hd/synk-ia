#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
#  SYNK-IA — Script de desarrollo con aider + Ollama
#  Uso: ./dev.sh              → aider con qwen3:14b (por defecto)
#       ./dev.sh coder        → aider con qwen3-coder (código complejo)
#       ./dev.sh light        → aider con qwen3.5 (rápido, tareas simples)
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Directorio del script
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# ── Verificar Ollama ────────────────────────────────────────────────────────
echo -e "${CYAN}Verificando Ollama...${NC}"
if ! curl -sf http://localhost:11434/api/tags > /dev/null 2>&1; then
  echo -e "${RED}✗ Ollama no responde en localhost:11434${NC}"
  echo -e "${YELLOW}  Ejecuta: ollama serve${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Ollama activo${NC}"

# ── Seleccionar modelo ──────────────────────────────────────────────────────
MODE="${1:-default}"
case "$MODE" in
  coder)
    MODEL="ollama_chat/qwen3-coder:latest"
    DESC="qwen3-coder (18GB — código complejo)"
    ;;
  light)
    MODEL="ollama_chat/qwen3.5:latest"
    DESC="qwen3.5 (6.6GB — tareas rápidas)"
    ;;
  *)
    MODEL="ollama_chat/qwen3:14b"
    DESC="qwen3:14b (9.3GB — equilibrio)"
    ;;
esac

echo -e "${CYAN}Modelo: ${GREEN}${DESC}${NC}"
echo -e "${CYAN}Contexto: CLAUDE.md + SOUL.md${NC}"
echo ""

# ── Verificar que el modelo está descargado ─────────────────────────────────
MODEL_NAME=$(echo "$MODEL" | sed 's|ollama_chat/||')
if ! ollama list 2>/dev/null | grep -q "${MODEL_NAME%%:*}"; then
  echo -e "${YELLOW}⚠ Modelo ${MODEL_NAME} no encontrado. Descargando...${NC}"
  ollama pull "$MODEL_NAME"
fi

# ── Arrancar aider ──────────────────────────────────────────────────────────
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  SYNK-IA Dev Environment${NC}"
echo -e "${GREEN}  Modelo: ${DESC}${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ "$MODE" != "default" ]; then
  # Override del modelo — no usar .aider.conf.yml para el modelo
  ~/.local/bin/aider \
    --model "$MODEL" \
    --edit-format diff \
    --no-auto-commits \
    --no-gitignore \
    --read CLAUDE.md \
    --read SOUL.md \
    --auto-lint \
    --show-diffs
else
  # Usa .aider.conf.yml (ya tiene todo configurado)
  ~/.local/bin/aider
fi
