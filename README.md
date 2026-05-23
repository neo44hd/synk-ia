# SYNK-IA

**No promete magia. Promete orden.**

Plataforma de gestión inteligente para PYMES. Cada documento en su lugar, cada empleado con acceso a lo suyo, cada decisión basada en datos reales.

---

## Arquitectura

```
Mac Mini M4 Pro (24GB RAM) — macOS
├── SSD interno (460 GB) — solo sistema + apps + código
│   └── ~/sinkia/                    ← repo + servidor Node.js
│
├── Disco externo "Disco local" (1 TB)
│   └── /Volumes/Disco local/sinkia-hub/
│       ├── ollama/data/             ← modelos IA (symlink → ~/.ollama)
│       ├── models/                  ← modelos GGUF (legacy)
│       ├── models-gguf/             ← archivos GGUF sueltos
│       ├── backups/                 ← backups manuales
│       └── desktop-old/             ← archivos movidos del Desktop
│
├── PM2 (gestión de procesos)
│   ├── sinkia-api    (ID 8)  → puerto 3001  → sinkialabs.com
│   └── ollama-proxy  (ID 1)  → puerto 11435
│
├── Docker / OrbStack
│   ├── sinkia-openwebui          → puerto 3030 → chat.sinkialabs.com
│   ├── sinkia-searxng            → puerto 8888
│   ├── sinkia-n8n                → puerto 5678
│   └── sinkia-qdrant             → puerto 6333
│
├── Ollama                        → puerto 11434
│   ├── harmonic-hermes-9b:latest (5.0 GB)  — chat, razonamiento, código
│   ├── qwen2.5-coder:0.5b-instruct (0.4 GB) — código rápido, extracción
│   └── glm-ocr:latest            (2.1 GB)   — OCR de documentos
│
├── LM Studio                     → puerto 1234
│   └── negentropy-claude-opus-4.7-9b (≈2GB) — modelo principal (todas las tareas)
│
├── Mission Control (/mc)         → interfaz web de gestión
│   ├── Panel Hermes Agent        — chat + configuración del modelo
│   └── Panel OpenCode            — agente de código + configuración
│
├── OpenClaw                      → puerto 18789 (HTTP + WebSocket)
│   └── Proxy WS: /ws/openclaw en sinkia-api → localhost:18789
│
└── Cloudflare Tunnel
    ├── sinkialabs.com            → localhost:3001
    ├── chat.sinkialabs.com       → localhost:3030
    └── claw.sinkialabs.com       → localhost:18789
```

### Symlink de Ollama al disco externo

Los modelos de Ollama se almacenan en el disco externo para no ocupar SSD:

```
~/.ollama → /Volumes/Disco local/sinkia-hub/ollama/data
```

Ollama lee y escribe en `~/.ollama` como siempre, pero físicamente los datos están en el disco externo.

**Configuración Ollama:**
- `OLLAMA_MAX_LOADED_MODELS=2` — máximo 2 modelos en RAM simultáneamente
- `OLLAMA_KEEP_ALIVE=5m` — descarga modelo de RAM tras 5 min sin uso
- `OLLAMA_NUM_PARALLEL=2` — 2 peticiones paralelas por modelo
- `OLLAMA_HOST=http://0.0.0.0:11434` — accesible en red local

---

## 5 Cerebros — Chat IA

La interfaz `/chat` ofrece 5 pestañas con diferentes modelos y backends:

| Pestaña | Color | Modelo | Backend | Uso |
|---------|-------|--------|---------|-----|
| **Chat IA** | Verde | harmonic-hermes-9b | `/api/chat` (SSE) | Conversación libre |
| **Brain** | Cyan | negentropy-claude-opus-4.7-9b | `/api/chat/brain` (SSE) | Consultas de negocio |
| **OpenClaw** | Morado | harmonic-hermes-9b | `/ws/openclaw` (WebSocket) | Agente de funciones |
| **Claude Code** | Naranja | harmonic-hermes-9b | `/api/aider` (SSE) | Asistente de código |
| **Hermes** | Púrpura | negentropy-claude-opus-4.7-9b | `/api/hermes` (SSE) | Asistente conversacional |
| **OpenCode** | Cian | negentropy-claude-opus-4.7-9b | `/api/opencode` (SSE) | Agente de código |

---

## OpenClaw — Agentes

OpenClaw orquesta múltiples agentes locales con diferentes modelos:

| Agente | Rol | Modelo | Herramientas |
|--------|-----|--------|--------------|
| **brain** | Orquestador principal | configurable | read, write, edit, exec, fetch, subagent |
| **coder** | Código y refactoring | configurable | read, write, edit, exec, apply_patch |
| **docs** | Documentación | configurable | read, write, exec, glob, grep |
| **monitor** | Salud del sistema | configurable | read, exec, glob, grep, fetch |

Configuración: `openclaw.json` en la raíz del repo.
Misiones: `.openclaw/missions/synkia-master.md`

---
## Seguridad OpenClaw (hardening aplicado)

Hardening aplicado en la configuración activa del gateway: `~/.openclaw/openclaw.json`
- `channels.telegram.groupPolicy: "allowlist"` (se cerró `open` para grupos).
- `agents.defaults.sandbox.mode: "all"` y agentes `main/brain/coder/docs/monitor` con sandbox activo.
- `tools.deny: ["group:web", "browser"]` para bloquear herramientas web y navegador.
- `tools.fs.workspaceOnly: true` para limitar acceso de archivos al workspace.
- `tools.elevated.enabled: false` para desactivar herramientas elevadas por defecto.

Verificación recomendada:
```bash
openclaw security audit --deep
openclaw gateway status
```

Resultado esperado tras hardening:
- `0 critical` en auditoría de seguridad.
- `1 warn` residual por heurística de confianza multiusuario (informativo si el entorno es de operador único).
- Gateway en estado `running` y usando el archivo de configuración activo.

---

## Servicios del servidor

### PM2

```bash
pm2 list                         # Ver procesos
pm2 restart sinkia-api           # Reiniciar API
pm2 logs sinkia-api --lines 50   # Ver logs
```

### Variables de entorno (`server/.env`)

```env
|OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=harmonic-hermes-9b:latest
OLLAMA_CHAT_MODEL=harmonic-hermes-9b
OLLAMA_CLASSIFY_MODEL=qwen2.5-coder:0.5b-instruct
AIDER_MODEL=ollama/harmonic-hermes-9b
PORT=3001
ADMIN_TOKEN=sinkia2026
```

---

## API — Endpoints principales

### Auth
```
POST /api/auth/login              — { email, password } → { token }
POST /api/auth/register           — Crear usuario (admin)
GET  /api/auth/me                 — Usuario actual
```

### IA
```
POST /api/chat                    — Chat libre (qwen3.5, SSE)
POST /api/chat/brain              — Chat con contexto de negocio (SSE)
POST /api/ai/classify             — Clasificar texto/documento
POST /api/ai/generate             — Generar texto
POST /api/aider                   — Instrucciones a Aider (SSE)
GET  /api/aider/status            — Estado de Aider
```

### Email
```
POST /api/email/sync              — Sync IMAP → facturas + proveedores
GET  /api/email/invoices          — Facturas extraídas
GET  /api/email/payslips          — Nóminas por mes
```

### FileBrain
```
POST /api/filebrain/classify-all  — Clasificar todos los docs
GET  /api/filebrain/tree          — Árbol virtual (?by=category|provider|date|type)
GET  /api/filebrain/stats         — Estadísticas
GET  /api/filebrain/search        — Búsqueda (?q=&provider=&type=)
POST /api/filebrain/link-payslips — Vincular nóminas a trabajadores
```

### Trabajadores
```
GET    /api/trabajadores                     — Listar (admin)
POST   /api/trabajadores/fichar              — Fichar con PIN
GET    /api/trabajadores/fichajes/hoy        — Quién está trabajando
POST   /api/trabajadores/:id/vacaciones      — Solicitar vacaciones
GET    /api/trabajadores/:id/nominas         — Mis nóminas
GET    /api/trabajadores/informe/mensual     — Informe mensual
```

### Health
```
GET  /api/health                  — Estado básico
GET  /api/health/full             — Estado de todos los servicios
GET  /api/health/ai               — Estado del modelo LLM
GET  /api/health/config           — Variables de entorno
```

---

## Datos reales en producción

- **22 proveedores** clasificados (alimentación, suministros, servicios, laboral, tecnología)
- **144 documentos** (103 facturas, 13 recibos, 6 nóminas, 18 otros)
- **8 trabajadores reales** con PIN, DNI, NSS (extraídos de nóminas)
- Rango temporal: Feb 2026 — Abr 2026

---

## Desarrollo

```bash
# Instalar dependencias
cd server && npm install
cd .. && npm install

# Desarrollo
npm run dev          # Frontend (Vite)
cd server && npm run dev  # Backend (Node --watch)

# Build producción
npm run build

# Desplegar
cd ~/sinkia && git pull origin main && pm2 restart sinkia-api
```

---

## URLs públicas

| Servicio | URL |
|----------|-----|
| Panel CEO | https://sinkialabs.com |
| Chat 4 Cerebros | https://sinkialabs.com/chat |
| Admin / Mission Control | https://sinkialabs.com/admin |
| Open WebUI | https://chat.sinkialabs.com |
| OpenClaw | https://claw.sinkialabs.com |

---

**SYNK-IA** · Orden. Tranquilidad. Control Real.
