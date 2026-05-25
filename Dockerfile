# Dockerfile — Sinkia Next (multi-stage build)
#
# Uso:
#   docker build -t sinkia:latest .
#   docker compose up -d

FROM node:22-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.12 python3.12-venv python3-pip build-essential \
    poppler-utils libpoppler-cpp-dev libreoffice unzip curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN mkdir -p server/node_modules && \
    cd server && npm ci --omit=dev 2>/dev/null || npm ci

FROM node:22-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.12 python3.12-venv poppler-utils libreoffice \
    unzip procps curl jq \
    && rm -rf /var/lib/apt/lists/*

RUN python3.12 -m venv /opt/markitdown-venv
ENV PATH="/opt/markitdown-venv/bin:$PATH"

COPY --from=builder /app/server/node_modules /app/server/node_modules

WORKDIR /app
COPY . .

RUN mkdir -p /app/uploads /app/data /app/logs

RUN /opt/markitdown-venv/bin/pip install --no-cache-dir \
    markitdown openpyxl python-pptx odfpy beautifulsoup4 lxml \
    && /opt/markitdown-venv/bin/pip cache purge

COPY scripts/container-startup.sh /scripts/container-startup.sh
RUN chmod +x /scripts/container-startup.sh

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3001/api/health || exit 1

ENTRYPOINT ["/scripts/container-startup.sh"]