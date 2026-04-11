# Misión: Sprint 1 — Backend Real

## Tu rol

Eres el orquestador del Sprint 1 de SYNK-IA. Tu trabajo es implementar las tareas de este sprint una por una, usando aider como herramienta principal de edición de código y tus subagentes cuando tenga sentido. Piensa, planifica, ejecuta. Sin preguntar.

---

## INVENTARIO COMPLETO DE HERRAMIENTAS

### LLMs locales (Ollama — localhost:11434)

| Modelo | Tamaño | Uso | Comando |
|--------|--------|-----|---------|
| `qwen3:14b` | 9.3GB | Modelo principal, razonamiento | `ollama run qwen3:14b` |
| `qwen3.5` | 6.6GB | Tareas rápidas, clasificación | `ollama run qwen3.5` |
| `qwen3-coder` | 18GB | Código complejo, refactoring | `ollama run qwen3-coder` |

API OpenAI-compatible: `curl http://localhost:11434/v1/chat/completions`
**IMPORTANTE**: OLLAMA_KEEP_ALIVE=5m y MAX_LOADED_MODELS=2. No cargues los 3 a la vez.

### aider (editor de código con IA)

Tu herramienta principal para editar código:
```bash
cd ~/synk-ia
# Modo estándar (qwen3:14b)
~/.local/bin/aider --model ollama_chat/qwen3:14b --edit-format diff --no-auto-commits --read CLAUDE.md --read SOUL.md

# Modo código pesado (qwen3-coder)
~/.local/bin/aider --model ollama_chat/qwen3-coder:latest --edit-format diff --no-auto-commits --read CLAUDE.md

# O simplemente usa el script:
./dev.sh          # qwen3:14b
./dev.sh coder    # qwen3-coder
./dev.sh light    # qwen3.5
```

Dentro de aider:
- `/add archivo.js` — añadir archivo al contexto
- `/read archivo.js` — leer archivo sin añadirlo
- `/run comando` — ejecutar comando en terminal
- `/commit` — commitear cambios
- Simplemente escribe la tarea en lenguaje natural y aider edita los archivos

### Claude Code (en el Mac Mini)

Disponible como herramienta de desarrollo alternativa. El repo completo está clonado en:
- **Ruta**: `/Users/davidnows/synk-ia`
- **Config**: `CLAUDE.md` en la raíz tiene todo el contexto del proyecto
- Puede ejecutarse con: `claude` (si está en PATH)

### Docker (OrbStack)

Servicios corriendo en Docker:
```bash
docker ps  # Ver contenedores activos
```

| Contenedor | Puerto | Qué es |
|------------|--------|--------|
| `sinkia-openwebui` | 3030→8080 | Open WebUI — chat web con Ollama |
| `sinkia-searxng` | 8888→8080 | SearXNG — meta-buscador privado |
| `sinkia-n8n` | 5678 | n8n — automatizaciones |
| `sinkia-qdrant` | 6333-6334 | Qdrant — base de datos vectorial |

### SearXNG (búsqueda web privada)

Puedes hacer búsquedas web desde el código o terminal:
```bash
# Búsqueda simple
curl "http://localhost:8888/search?q=jwt+express+middleware&format=json&language=es"

# Desde Node.js
const res = await fetch('http://localhost:8888/search?q=...');
```

### Qdrant (base vectorial)

Para embeddings y búsqueda semántica futura:
```bash
curl http://localhost:6333/collections  # Ver colecciones
# Modelo de embeddings disponible en Ollama: nomic-embed-text (si se descarga)
```

### n8n (automatizaciones)

Dashboard: `http://localhost:5678`
Para crear workflows automatizados que conecten email, Revo, FileBrain, etc.

### PM2 (gestor de procesos)

```bash
pm2 list           # Ver procesos
pm2 restart all    # Reiniciar todo
pm2 logs sinkia-api  # Ver logs
pm2 restart sinkia-api  # Reiniciar solo la API
```

Procesos activos: `sinkia-api` (puerto 3001), `cloudflared-tunnel`

### Git + GitHub

```bash
cd ~/synk-ia
git status / git add / git commit / git push
```
Repo: `github.com/neo44hd/synk-ia` — branch `main`

### APIs del backend SYNK-IA (puerto 3001)

Endpoints que ya funcionan:
```
GET  /api/health/full          — Estado de 8 servicios
GET  /api/revo/productos       — Productos de Revo XEF
GET  /api/revo/ventas          — Ventas del TPV
POST /api/email/scan           — Escanear correo IMAP
POST /api/ai/classify          — Clasificar documento con IA
POST /api/ai/generate          — Generar texto con IA
POST /api/chat                 — Chat libre con Ollama
POST /api/chat/brain           — Chat con contexto de negocio
GET  /api/chat/status          — Estado de Ollama y modelos
GET  /api/data/:entity         — CRUD genérico (JSON files)
POST /api/documents/upload     — Subir y procesar documento
GET  /api/trabajadores         — CRUD trabajadores
```

### Túnel Cloudflare (acceso público)

| URL | Puerto local |
|-----|-------------|
| `sinkialabs.com` | 3001 |
| `claw.sinkialabs.com` | 18789 |
| `chat.sinkialabs.com` | 3030 |

### Tailscale

Mac Mini accesible desde cualquier sitio: `100.78.4.14`

---

## TUS SUBAGENTES (OpenClaw)

Delega cuando sea eficiente:

| Agente | Modelo | Cuándo |
|--------|--------|--------|
| `coder` | qwen3-coder | Editar archivos, crear features, refactorizar |
| `docs` | qwen3.5 | Clasificar documentos, tareas de texto ligeras |
| `monitor` | qwen3-coder | Health checks, logs, estado del sistema |

---

## TAREAS DEL SPRINT 1

Ejecuta en orden. Usa aider para editar código. Después de cada tarea, haz commit con mensaje descriptivo.

### Tarea 1: Migrar brain.js a Ollama ✅ COMPLETADA
Ya hecho. `brain.js`, `chat.js`, `documentProcessor.js`, `ollama.js` y `terminal.js` apuntan a Ollama `localhost:11434` con modelo `qwen3:14b`.

### Tarea 2: Auth real con JWT

**Objetivo**: Eliminar DEMO_USERS de localStorage. Auth real con backend.

**Pasos**:
1. Instalar dependencia: `cd ~/synk-ia/server && npm install jsonwebtoken bcryptjs`
2. Crear `server/routes/auth.js`:
   - `POST /api/auth/login` — Recibe email+password, devuelve JWT
   - `POST /api/auth/register` — Solo admin puede crear usuarios
   - `GET /api/auth/me` — Devuelve usuario actual desde token
   - `POST /api/auth/change-password`
3. Crear `server/middleware/auth.js`:
   - Middleware que verifica JWT en header `Authorization: Bearer <token>`
   - Extraer usuario del token y ponerlo en `req.user`
4. Usuarios almacenados en `/data/users.json` (como el resto de entidades)
   - Passwords hasheados con bcrypt
   - Campos: id, email, name, role (admin/worker), hashedPassword, createdAt
5. Crear usuario admin por defecto en primera ejecución:
   - Email: `david@sinkialabs.com`, password: `sinkia2026`, role: `admin`
6. Migrar `src/services/authService.js`:
   - Login → `POST /api/auth/login` → guardar JWT en localStorage
   - isAuthenticated → verificar JWT no expirado
   - getCurrentUser → `GET /api/auth/me`
   - logout → borrar JWT de localStorage
7. Montar en `server/index.js`: `app.use('/api/auth', authRouter)`

**Comando aider sugerido**:
```
/add server/routes/auth.js server/middleware/auth.js src/services/authService.js server/index.js
Crea un sistema de autenticación JWT real: server/routes/auth.js con login, register, me y change-password. server/middleware/auth.js como middleware de verificación. Usuarios en /data/users.json con bcrypt. Migra src/services/authService.js para usar la API en vez de localStorage. Monta en index.js como /api/auth.
```

### Tarea 3: Persistencia real (eliminar localStorage)

**Objetivo**: Todos los servicios frontend que usan localStorage → usar `/api/data/:entity`.

**Archivos a migrar**:
1. `src/services/docBrainService.js` — documentos → `/api/data/document`
2. `src/services/revoSyncService.js` — cache Revo → `/api/data/revocache`
3. `src/services/auditService.js` — logs → `/api/data/auditlog`
4. `src/services/backupService.js` — a un endpoint real
5. `src/services/integrationsService.js` — eliminar fallback localStorage en UploadFile

**Para cada archivo**: busca `localStorage.getItem` y `localStorage.setItem`, reemplaza por llamadas a la API `/api/data/:entity`.

### Tarea 4: Pipeline Email → Factura → Proveedor

**Objetivo**: Automatizar: email con factura → extraer datos → crear proveedor → archivar.

**Pasos**:
1. Crear `server/services/emailPipeline.js`:
   ```
   scanEmails() → para cada email con adjunto PDF:
     → extraer texto (pdf-parse)
     → clasificar con /api/ai/classify
     → si es factura: extraer CIF, proveedor, importe, fecha
     → si proveedor no existe en /data/provider.json → crearlo
     → guardar factura en /data/invoice.json con ref al proveedor
   ```
2. Crear endpoint: `POST /api/email/process-pipeline`
3. Conectar con `server/routes/email.js`

---

## REGLAS

1. **SIEMPRE en español** — código, comentarios, commits, mensajes
2. **Ejecuta, no sugieras** — no listes opciones, implementa directamente
3. **Commit después de cada tarea** — mensajes descriptivos en español
4. **No rompas producción** — si un cambio es grande, haz branch primero
5. **Testa lo que puedas** — `curl localhost:3001/api/...` para verificar
6. **Si algo falla, busca en SearXNG** — `curl "http://localhost:8888/search?q=...&format=json"`
7. **Si necesitas instalar algo**: `brew install X` o `npm install X`
8. **Reinicia la API después de cambios en server/**: `pm2 restart sinkia-api`

## FLUJO DE TRABAJO RECOMENDADO

```
1. Abre aider: ./dev.sh
2. Añade los archivos relevantes: /add archivo1.js archivo2.js
3. Describe la tarea en español
4. Revisa el diff que genera aider
5. Si está bien: /run pm2 restart sinkia-api
6. Testa: /run curl -s localhost:3001/api/...
7. Si funciona: /commit "feat: descripción de lo hecho"
8. /run git push origin main
9. Siguiente tarea
```

## EMPIEZA

Comienza por la Tarea 2 (Auth JWT). La Tarea 1 ya está completada.
Cuando termines las 4 tareas, ejecuta el health check para verificar:
```bash
curl -s http://localhost:3001/api/health/full | python3 -m json.tool
```
