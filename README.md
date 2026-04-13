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
│       ├── models/                  ← modelos antiguos LM Studio
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
│   ├── qwen3.5:latest   (6.6 GB)  — chat general, razonamiento
│   ├── codegemma:7b     (5.0 GB)  — clasificación docs/emails
│   ├── functiongemma    (291 MB)   — function calling (OpenClaw)
│   ├── gemma4:26b       (~15 GB)   — razonamiento avanzado, visión
│   ├── qwen2.5-coder:14b (~10 GB) — código y refactoring
│   ├── deepseek-r1:14b  (~9 GB)   — razonamiento profundo (chain-of-thought)
│   ├── phi4:14b         (~10 GB)   — matemáticas y lógica
│   ├── glm-ocr          (~1 GB)    — OCR de documentos
│   ├── llama3.2-vision:11b (~8 GB) — análisis de imágenes
│   ├── gemma4:e4b       (~5 GB)    — tareas rápidas con visión
│   └── phi4-mini        (~3 GB)    — clasificaciones ligeras
│
├── OpenClaw                      → puerto 18789 (HTTP + WebSocket)
│   └── Proxy WS: /ws/openclaw en sinkia-api → localhost:18789
│
└── Cloudflare Tunnel
    ├── sinkialabs.com       → localhost:3001
    ├── chat.sinkialabs.com  → localhost:3030
    └── claw.sinkialabs.com  → localhost:18789
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

## 4 Cerebros — Chat IA

La interfaz `/chat` ofrece 4 pestañas con diferentes modelos y backends:

| Pestaña | Color | Modelo | Backend | Uso |
|---------|-------|--------|---------|-----|
| **Chat IA** | Verde | qwen3.5 | `/api/chat` (SSE) | Conversación libre |
| **Brain** | Cyan | codegemma:7b + qwen3.5 | `/api/chat/brain` (SSE) | Consultas de negocio |
| **OpenClaw** | Morado | functiongemma | `/ws/openclaw` (WebSocket proxy) | Agente de funciones |
| **Claude Code** | Naranja | Aider + ollama/qwen3.5 | `/api/aider` (SSE) | Asistente de código |

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

## Servicios del servidor

### PM2

```bash
pm2 list                         # Ver procesos
pm2 restart sinkia-api           # Reiniciar API
pm2 logs sinkia-api --lines 50   # Ver logs
```

### Variables de entorno (`server/.env`)

```env
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=qwen3.5:latest
OLLAMA_CHAT_MODEL=qwen3.5
OLLAMA_CLASSIFY_MODEL=codegemma:7b
AIDER_MODEL=ollama/qwen3.5
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
