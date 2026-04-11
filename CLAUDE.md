# CLAUDE.md — Guía de contexto para Claude Code

## ¿Qué es SYNK-IA?

Plataforma SaaS de gestión empresarial integral para PYMEs españolas (hostelería, restauración, comercio).
Dominio: **sinkialabs.com** — servido desde un Mac Mini M4 Pro (24GB RAM) a través de Cloudflare Tunnel.

## Stack técnico

| Capa | Tecnología |
|------|-----------|
| Frontend | React + Vite + Tailwind CSS + Radix UI |
| Backend | Express.js (ESM, puerto 3001) |
| IA local | Ollama + qwen3-coder / node-llama-cpp (modelos GGUF) |
| Email | IMAP directo (Gmail — info@chickenpalace.es) |
| Integraciones | Revo XEF (POS), Biloop (contabilidad), ESEECloud, VeriFactu |
| Procesos | PM2 (sinkia-api, cloudflared-tunnel, litellm-proxy) |
| Túnel | Cloudflare Tunnel (ID: 4298eb1a) → localhost:3001 |
| Red privada | Tailscale |
| Repo | github.com/neo44hd/synk-ia |

## Estructura del proyecto

```
synk-ia/
├── src/                    # Frontend React
│   ├── pages/              # Páginas/vistas principales
│   ├── services/           # Servicios frontend (API calls, lógica de negocio)
│   ├── components/         # Componentes reutilizables
│   ├── hooks/              # Custom hooks (useDocBrain, etc.)
│   ├── contexts/           # AuthContext
│   └── config/             # roles.js
├── server/                 # Backend Express
│   ├── index.js            # Entry point (ESM)
│   ├── routes/             # Endpoints API
│   │   ├── email.js        # Sincronización Gmail IMAP
│   │   ├── revo.js         # Integración Revo XEF (POS)
│   │   ├── biloop.js       # Integración Biloop (contabilidad)
│   │   ├── documents.js    # Gestión documental
│   │   ├── admin.js        # Panel admin (token: ADMIN_TOKEN en .env)
│   │   ├── chat.js         # Chat con modelo local
│   │   ├── claude-proxy.js # Proxy para Claude Code → LM Studio/Ollama
│   │   ├── terminal.js     # Terminal web (node-pty + WebSocket)
│   │   ├── trabajadores.js # Portal del trabajador
│   │   └── health.js       # Health check
│   ├── agents/             # Agentes de sincronización
│   │   ├── emailAgent.js   # Harvester de emails
│   │   └── revoAgent.js    # Sync con Revo POS
│   └── services/
│       ├── brain.js        # DocBrain — clasificación IA de documentos
│       ├── documentProcessor.js
│       └── llamaService.js # Interfaz con modelo local
├── dist/                   # Build de producción (vite build)
├── scripts/                # Utilidades (download-model.js, start-litellm.sh)
└── docker/                 # docker-compose.yml (legacy, no se usa actualmente)
```

## Módulos principales

### DocBrain (el "corazón mágico")
- **server/services/brain.js** + **src/services/docBrainService.js** + **src/hooks/useDocBrain.js**
- Pipeline: Archivo → OCR (si imagen/PDF) → Clasificación IA → Extracción de datos → Auto-vinculación de proveedor
- Tipos: factura, nómina, albarán, contrato, documento legal

### Email Inteligente (SmartMailbox)
- **server/agents/emailAgent.js** + **server/routes/email.js**
- Conecta vía IMAP a Gmail, escanea, clasifica automáticamente
- Frontend: **src/pages/SmartMailbox.jsx** / **SmartMailboxV2.jsx**

### Integraciones externas
- **Revo XEF**: server/agents/revoAgent.js — sync de ventas, productos, trabajadores
- **Biloop**: server/routes/biloop.js — contabilidad y facturación
- **VeriFactu**: src/pages/VeriFactu.jsx — facturación electrónica española

### Portal del trabajador
- **src/pages/WorkerInterface.jsx** / **WorkerMobile.jsx**
- Control horario, nóminas, documentación, vacaciones

### Panel Admin
- Ruta: /admin (protegido con ADMIN_TOKEN)
- Gestión de PM2, logs en tiempo real, health checks

## Comandos esenciales

```bash
# Desarrollo
cd ~/sinkia && npm run dev          # Frontend Vite (localhost:5173)
cd ~/sinkia/server && node index.js # Backend (localhost:3001)

# Producción
cd ~/sinkia && npm run build        # Genera dist/
pm2 restart sinkia-api --update-env # Reinicia backend

# Deploy
git add -A && git commit -m "descripción" && git push origin main

# Logs
pm2 logs sinkia-api --lines 30
pm2 logs cloudflared-tunnel --lines 20

# Modelo IA
ollama list                          # Ver modelos disponibles
ollama run qwen3-coder              # Test interactivo
```

## Variables de entorno (server/.env)

Referencia en `server/.env.example`. Las críticas son:
- `PORT=3001`
- `EMAIL_USER` / `EMAIL_APP_PASSWORD` — Gmail IMAP
- `REVO_TOKEN_LARGO` — API Revo XEF
- `ASSEMPSA_BILOOP_API_KEY` — Biloop
- `AI_MODEL_NAME` — Modelo GGUF para node-llama-cpp
- `ADMIN_TOKEN` — Acceso al panel /admin
- `LOCAL_LLM_MODEL` — Modelo para LiteLLM proxy

## Convenciones

- **Idioma**: Todo el código, comentarios, commits y respuestas en **español**.
- **ESM**: El backend usa ES Modules (`import/export`), no CommonJS.
- **No auto-ejecutar**: Pide confirmación antes de ejecutar comandos destructivos o que modifiquen producción.
- **Commits descriptivos**: En español, formato: `feat: descripción` / `fix: descripción`.
- **Rutas API**: Prefijo `/api/` para todas las rutas del backend.

## Problemas conocidos

- **Revo 404**: El endpoint de Revo puede devolver 404 si el token ha expirado. Revisar `revoAgent.js` y variables `REVO_*` en `.env`.
- **n_ctx vs n_keep**: Si usas LM Studio, el contexto del modelo debe ser >= 32768 para evitar errores con Claude Code / LiteLLM.
- **litellm-proxy restarts**: Se reinicia en bucle (↺ alto en PM2) si el modelo en LM Studio no está cargado o el n_ctx es bajo.

## Arquitectura de despliegue

```
Internet → Cloudflare Tunnel → Mac Mini (localhost:3001 = Express)
                                         ├── Frontend (dist/ servido estático)
                                         ├── API REST (/api/*)
                                         ├── WebSocket (terminal, chat)
                                         └── Ollama (localhost:11434) ← modelos IA
```

## Contexto del negocio

- **Cliente tipo**: Restaurante / bar / comercio en España
- **Ejemplo real**: Chicken Palace Ibiza (info@chickenpalace.es)
- **Objetivo**: Automatizar al máximo la gestión documental, laboral y financiera
- **Diferenciador**: IA local que clasifica documentos "como magia" sin intervención del usuario
