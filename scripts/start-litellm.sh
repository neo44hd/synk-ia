#!/bin/bash
# start-litellm.sh — Proxy Anthropic para Claude Code con modelo local
# Instala y arranca LiteLLM apuntando a Ollama

set -e

# Instalar si no está
if ! command -v litellm &>/dev/null; then
  echo "[LiteLLM] Instalando..."
  pip3 install 'litellm[proxy]' --quiet
fi

OLLAMA_URL=${OLLAMA_URL:-http://localhost:11434}
MODEL=${LOCAL_LLM_MODEL:-qwen2.5-coder:14b}

echo "[LiteLLM] Arrancando proxy en puerto 8082..."
echo "[LiteLLM] → Ollama: ${OLLAMA_URL}"
echo "[LiteLLM] → Modelo: ${MODEL}"

export OPENAI_API_KEY=ollama

exec litellm \
  --model "openai/${MODEL}" \
  --api_base "${OLLAMA_URL}/v1" \
  --port 8082 \
  --host 0.0.0.0 \
  --drop_params \
  --set_verbose False
