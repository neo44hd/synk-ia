# ═══════════════════════════════════════════════════════════════════════════════
# Dockerfile — SynK-IA (multi-stage: build + runtime)
# ═══════════════════════════════════════════════════════════════════════════════
#
# Build:  docker build -t sinkia:latest .
# Run:    docker compose up -d
#
# Platforms: linux/amd64, linux/arm64 (Apple Silicon / OrbStack)
# ═══════════════════════════════════════════════════════════════════════════════

# ── STAGE 1: Builder — instala deps y buildea frontend ──────────────────────
FROM node:22-slim AS builder

# Dependencias de sistema para markitdown (Python) y compilación
# NOTA: Bookworm usa Python 3.11, no 3.12
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-venv python3-pip build-essential curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

# ── Install root deps (frontend) ──────────────────────────────────────────
COPY package.json package-lock.json ./
RUN npm ci

# ── Build frontend React → dist/ ──────────────────────────────────────────
COPY src/       ./src/
COPY public/    ./public/
COPY vite.config.js index.html tailwind.config.js postcss.config.js ./
RUN npm run build

# ── Install server deps ───────────────────────────────────────────────────
WORKDIR /build/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev

# ═══════════════════════════════════════════════════════════════════════════════
# STAGE 2: Runtime — imagen ligera con solo lo necesario
# ═══════════════════════════════════════════════════════════════════════════════
FROM node:22-slim AS runtime

# Dependencias de runtime: Python para markitdown (OCR/PDF/Office)
# poppler-utils = pdftotext (extracción de PDF)
# tesseract-ocr = OCR de imágenes escaneadas
# LibreOffice   = conversión de .docx/.pptx/.odt (headless)
# NOTA: LibreOffice se instala sin recomendaciones para reducir tamaño
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-venv \
    poppler-utils tesseract-ocr \
    libreoffice-core libreoffice-writer libreoffice-calc \
    unzip procps curl jq \
    && rm -rf /var/lib/apt/lists/*

# Python virtualenv para markitdown
RUN python3 -m venv /opt/markitdown-venv
ENV PATH="/opt/markitdown-venv/bin:$PATH"

# Instalar markitdown y extractores de documentos
RUN /opt/markitdown-venv/bin/pip install --no-cache-dir \
    markitdown openpyxl python-pptx odfpy beautifulsoup4 lxml && \
    /opt/markitdown-venv/bin/pip cache purge

# Crear directorios de la app
WORKDIR /app
RUN mkdir -p /app/uploads /app/data /app/logs /app/server/uploads

# ── Copy pre-built frontend (del stage builder) ────────────────────────────
COPY --from=builder /build/dist        /app/dist
COPY --from=builder /build/public      /app/public

# ── Copy servidor y dependencias (del stage builder) ───────────────────────
COPY --from=builder /build/server       /app/server
COPY --from=builder /build/node_modules /app/node_modules
COPY --from=builder /build/package.json /app/package.json

# ── Copiar código del servidor y fuentes React (para dev si se necesita) ───
COPY src/       /app/src/
COPY vite.config.js index.html tailwind.config.js postcss.config.js /app/

# ── Copiar scripts y config ────────────────────────────────────────────────
COPY scripts/container-startup.sh /scripts/container-startup.sh
RUN chmod +x /scripts/container-startup.sh

# Variables por defecto (override via docker-compose environment o .env)
ENV PORT=3001
ENV NODE_ENV=production
ENV OLLAMA_URL=http://sinkia-ollama:11434
ENV OLLAMA_HOST=0.0.0.0
ENV OLLAMA_PORT=11434
ENV OLLAMA_MODEL=harmonic-hermes-9b:latest
ENV CLASSIFY_MODEL=harmonic-hermes-9b:latest
ENV EXTRACT_MODEL=harmonic-hermes-9b:latest
ENV DEEP_MODEL=harmonic-hermes-9b:latest
ENV CHAT_MODEL=harmonic-hermes-9b:latest
ENV NUM_CTX=8192
ENV NUM_PREDICT=2048
ENV TEMPERATURE=0.1
ENV CONFIDENCE_THRESHOLD=0.6
ENV UPLOADS_DIR=/app/uploads
ENV DATA_DIR=/app/data

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=5 \
    CMD curl -sf http://localhost:3001/api/health || exit 1

ENTRYPOINT ["/scripts/container-startup.sh"]