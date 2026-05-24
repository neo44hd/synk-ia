# ═══════════════════════════════════════════════════════════════════════════════
# Dockerfile — SynK-IA (multi-stage build)
#
# Uso:
#   docker build -t synkia:latest .
#   docker compose up -d
# ═══════════════════════════════════════════════════════════════════════════════

# ── Stage 1: Build + deps ────────────────────────────────────────────────────
FROM node:22-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.12 \
    python3.12-venv \
    python3-pip \
    build-essential \
    poppler-utils \
    libpoppler-cpp-dev \
    libreoffice \
    unzip \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Instalar Node deps (sin devDependencies para producción)
COPY package.json package-lock.json ./
RUN mkdir -p server/node_modules && \
    cd server && \
    npm ci --omit=dev 2>/dev/null || npm ci

# ── Stage 2: Runtime ────────────────────────────────────────────────────────
FROM node:22-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.12 \
    python3.12-venv \
    poppler-utils \
    libreoffice \
    unzip \
    procps \
    curl \
    jq \
    && rm -rf /var/lib/apt/lists/*

# Crear venv de Markitdown
RUN python3.12 -m venv /opt/markitdown-venv
ENV PATH="/opt/markitdown-venv/bin:$PATH"

# Instalar Markitdown en el venv
COPY --from=builder /app/server/node_modules /app/server/node_modules

WORKDIR /app

# Copiar código fuente
COPY . .

# Crear directorios de runtime
RUN mkdir -p /app/uploads /app/data /app/logs

# Crear venv con Markitdown (se hace en runtime para que el layer sea reutilizable)
RUN /opt/markitdown-venv/bin/pip install --no-cache-dir \
    markitdown \
    openpyxl \
    python-pptx \
    odfpy \
    beautifulsoup4 \
    lxml \
    && /opt/markitdown-venv/bin/pip cache purge

# Copiar el script de inicio
COPY scripts/container-startup.sh /scripts/container-startup.sh
RUN chmod +x /scripts/container-startup.sh

EXPOSE 3001

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3001/api/health || exit 1

ENTRYPOINT ["/scripts/container-startup.sh"]