#!/bin/bash
# start-litellm.sh — Proxy Anthropic para Claude Code con modelo local
# Instala y arranca LiteLLM apuntando a LM Studio

set -e

# Instalar si no está
if ! command -v litellm &>/dev/null; then
  echo "[LiteLLM] Instalando..."
  pip3 install 'litellm[proxy]' --quiet
fi

MODEL=${LOCAL_LLM_MODEL:-qwen3-vl-32b-gemini-heretic-uncensored-thinking-i1}

echo "[LiteLLM] Arrancando proxy en puerto 8082..."
echo "[LiteLLM] → LM Studio: http://localhost:12345"
echo "[LiteLLM] → Modelo: ${MODEL}"

export OPENAI_API_KEY=local

exec litellm \
  --model "openai/${MODEL}" \
  --api_base http://localhost:12345/v1 \
  --port 8082 \
  --host 0.0.0.0 \
  --drop_params \
  --set_verbose False
