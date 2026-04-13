#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
#  SINKIA AI LOCAL — Script de instalación automática
#  Mac Mini M4 Pro · Apple Silicon
#  Uso: bash setup.sh
# ═══════════════════════════════════════════════════════════════════════════

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║        SINKIA AI LOCAL — Setup           ║${NC}"
echo -e "${BLUE}║     Mac Mini M4 Pro · Apple Silicon      ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}"
echo ""

# ── 1. Verificar dependencias ─────────────────────────────────────────────
echo -e "${YELLOW}[1/5] Verificando dependencias...${NC}"

if ! command -v docker &> /dev/null; then
  echo -e "${RED}✗ Docker no encontrado.${NC}"
  echo ""
  echo "  Opciones:"
  echo "  • OrbStack (recomendado para Apple Silicon, gratis):"
  echo "    https://orbstack.dev"
  echo "  • Docker Desktop:"
  echo "    https://docs.docker.com/desktop/install/mac-install/"
  echo ""
  exit 1
fi

if ! docker compose version &> /dev/null 2>&1; then
  echo -e "${RED}✗ Docker Compose no encontrado (necesitas Docker Desktop o OrbStack).${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Docker encontrado: $(docker --version)${NC}"

# ── 2. Verificar Ollama ──────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}[2/5] Verificando Ollama...${NC}"

OLLAMA_URL=${OLLAMA_URL:-http://localhost:11434}
if curl -s --max-time 3 "${OLLAMA_URL}/v1/models" > /dev/null 2>&1; then
  MODEL=$(curl -s "${OLLAMA_URL}/v1/models" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data'][0]['id'] if d.get('data') else 'desconocido')" 2>/dev/null || echo "activo")
  echo -e "${GREEN}✓ Ollama activo — modelo: ${MODEL}${NC}"
else
  echo -e "${YELLOW}⚠ Ollama no detectado en ${OLLAMA_URL}.${NC}"
  echo "  → Arranca Ollama: brew services start ollama"
  echo "  → El stack arrancará igualmente."
fi

# ── 3. Verificar LiteLLM (Sinkia) ────────────────────────────────────────
echo ""
if curl -s --max-time 2 http://localhost:8082/health > /dev/null 2>&1; then
  echo -e "${GREEN}✓ LiteLLM (Sinkia) activo en puerto 8082${NC}"
else
  echo -e "${YELLOW}⚠ LiteLLM no detectado (normal si Sinkia no está corriendo).${NC}"
fi

# ── 4. Crear directorios necesarios ──────────────────────────────────────
echo ""
echo -e "${YELLOW}[3/5] Preparando directorios...${NC}"

mkdir -p config/searxng
mkdir -p n8n/workflows

# Asegurar que el settings.yml de SearXNG existe
if [ ! -f config/searxng/settings.yml ]; then
  echo -e "${RED}✗ Falta config/searxng/settings.yml${NC}"
  echo "  Asegúrate de que todos los archivos del ZIP están extraídos correctamente."
  exit 1
fi

echo -e "${GREEN}✓ Directorios listos${NC}"

# ── 5. Arrancar servicios ─────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}[4/5] Descargando imágenes y arrancando servicios...${NC}"
echo "  (La primera vez puede tardar 2-5 minutos)"
echo ""

docker compose pull
echo ""
docker compose up -d

# ── 6. Esperar a que los servicios estén listos ───────────────────────────
echo ""
echo -e "${YELLOW}[5/5] Esperando a que los servicios arranquen...${NC}"

wait_for_service() {
  local name=$1
  local url=$2
  local max=30
  local i=0
  while [ $i -lt $max ]; do
    if curl -s --max-time 2 "$url" > /dev/null 2>&1; then
      echo -e "${GREEN}✓ $name listo${NC}"
      return 0
    fi
    sleep 2
    i=$((i+1))
  done
  echo -e "${YELLOW}⚠ $name tardando en arrancar — revisa: docker compose logs $name${NC}"
}

wait_for_service "SearXNG"   "http://localhost:8888"
wait_for_service "Qdrant"    "http://localhost:6333"
wait_for_service "Open WebUI" "http://localhost:3030"
wait_for_service "n8n"       "http://localhost:5678"

# ── Resumen final ─────────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║              ✓ STACK ARRANCADO                       ║${NC}"
echo -e "${BLUE}╠══════════════════════════════════════════════════════╣${NC}"
echo -e "${BLUE}║${NC}  ${GREEN}Open WebUI  ${NC}→  http://localhost:3030              ${BLUE}║${NC}"
echo -e "${BLUE}║${NC}  ${GREEN}n8n         ${NC}→  http://localhost:5678              ${BLUE}║${NC}"
echo -e "${BLUE}║${NC}  ${YELLOW}SearXNG     ${NC}→  http://localhost:8888  (interno)  ${BLUE}║${NC}"
echo -e "${BLUE}║${NC}  ${YELLOW}Qdrant      ${NC}→  http://localhost:6333  (interno)  ${BLUE}║${NC}"
echo -e "${BLUE}╠══════════════════════════════════════════════════════╣${NC}"
echo -e "${BLUE}║${NC}  Ollama     →  http://localhost:11434  (ya existía) ${BLUE}║${NC}"
echo -e "${BLUE}║${NC}  Sinkia API →  http://localhost:3001   (ya existía) ${BLUE}║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}Próximo paso: abre http://localhost:3030 y crea tu cuenta admin.${NC}"
echo -e "${GREEN}Lee el README.md para la configuración inicial de Open WebUI.${NC}"
echo ""
