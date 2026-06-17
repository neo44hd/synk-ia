# 🧠 Sinkia Control Brain — MVP Implementado

## Descripción General

Se ha implementado el **MVP (Minimum Viable Product)** del Control Brain, un dashboard centralizado y sistema de orquestación para todos los agentes de Sinkia y el gateway LiteLLM.

### Componentes Creados

**Backend** (Express + TypeScript)
- `server/control-brain/` — Servidor REST con APIs para estado, agentes, gateway, tareas y métricas
- Puerto: **3002** (configurable con env `CONTROL_BRAIN_PORT`)
- Base de datos: SQLite en `server/control-brain/data/control-brain.db`

**Frontend** (React + TypeScript + Vite + Tailwind CSS)
- `web/control-brain/` — Dashboard responsive con navegación y widgets
- Puerto: **3010** (configurable en vite.config.ts)
- Build: Vite con HMR para desarrollo

## Estructura de Archivos

```
server/control-brain/
├── src/
│   ├── index.ts              # Servidor Express principal
│   ├── gateway-client.ts     # Cliente HTTP para LiteLLM gateway
│   ├── sinkia-client.ts      # Cliente HTTP para Sinkia API
│   ├── orchestrator.ts       # Ruteo inteligente de tareas a agentes
│   ├── db.ts                 # Interfaz SQLite
│   └── metrics.ts            # Recolector de métricas y costos
├── package.json
├── tsconfig.json
└── dist/                     # Output compilado

web/control-brain/
├── src/
│   ├── main.tsx              # Punto de entrada React
│   ├── App.tsx               # Componente raíz
│   ├── styles/
│   │   └── globals.css       # Estilos globales (Tailwind)
│   ├── pages/
│   │   └── Dashboard.tsx      # Página principal
│   ├── components/
│   │   └── SystemHealthCard.tsx  # Componente reutilizable
│   └── hooks/
│       └── useApi.ts         # Hook personalizado para API
├── index.html                # HTML base
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
└── package.json
```

## APIs Disponibles (Backend)

### Estado del Sistema
```bash
GET /api/control/status
# Retorna: salud del gateway, agentes, métricas, tareas recientes, alertas
```

### Agentes
```bash
GET /api/control/agents
# Retorna: lista de agentes con estado
```

### Gateway
```bash
GET /api/control/gateway
# Retorna: salud, modelos disponibles, estado del backend
```

### Tareas
```bash
POST /api/control/task
# Body: { prompt: string, preferredAgent?: string, preferredModel?: string }
# Retorna: resultado de la tarea orquestada

GET /api/control/tasks?limit=10
# Retorna: historial de tareas recientes

GET /api/control/task/:id
# Retorna: estado y resultado de una tarea específica
```

### Métricas
```bash
GET /api/control/metrics
# Retorna: estadísticas de costos y latencia por proveedor
```

### Alertas
```bash
GET /api/control/alerts
# Retorna: alertas activas del sistema
```

### Health Check
```bash
GET /health
# Retorna: estado simple del servidor
```

## Instalación y Ejecución

### 1. Backend

```bash
cd /Users/davidnows/sinkia-next/server/control-brain

# Instalar dependencias (ya hecho)
npm install

# Compilar TypeScript
npm run build

# Ejecutar servidor (en desarrollo con ts-node)
npm run dev

# O en producción
npm start
```

**Variables de entorno:**
- `CONTROL_BRAIN_PORT` — Puerto del servidor (default: 3002)

### 2. Frontend

```bash
cd /Users/davidnows/sinkia-next/web/control-brain

# Instalar dependencias (ya hecho)
npm install

# Ejecutar en desarrollo (con HMR)
npm run dev

# Compilar para producción
npm run build

# Preview del build
npm run preview
```

**URLs de desarrollo:**
- Frontend: `http://localhost:3010`
- Backend API: `http://localhost:3002/api/control/*`
- Vite proxy redirige `/api/*` a backend

## Características del MVP

### Dashboard (Página Principal)
- ✅ Estado del sistema (Gateway, Sinkia API, Gateway Online)
- ✅ Estadísticas rápidas: Total de tareas, costo total, latencia promedio
- ✅ Alertas activas (si las hay)
- ✅ Tareas recientes con estado

### Navegación
- ✅ Dashboard (implementado)
- 🔄 Agentes (placeholder para expansión futura)
- 🔄 Gateway (placeholder para expansión futura)
- 🔄 Tareas (placeholder para expansión futura)
- 🔄 Métricas (placeholder para expansión futura)

### Backend Features
- ✅ Cliente HTTP para gateway LiteLLM (health, modelos, chat)
- ✅ Cliente HTTP para Sinkia API (classify, extract, analyze, document)
- ✅ Orquestador inteligente (routeo de tareas basado en keywords)
- ✅ Base de datos SQLite (tasks, agents, alerts, metrics)
- ✅ Recolector de métricas en memoria (costos, latencias)
- ✅ API REST completa con error handling

## Flujo de Orquestación de Tareas

1. **Usuario envía prompt** vía `POST /api/control/task`
2. **Sistema rutea** a agente correcto (basado en keywords)
3. **Sistema ejecuta** tarea vía Sinkia API
4. **Sistema registra** en DB y métricas
5. **Sistema retorna** resultado con metadatos

Ejemplo:
```bash
curl -X POST http://localhost:3002/api/control/task \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Analyze this invoice",
    "preferredAgent": "analyzer"
  }'
```

## Próximos Pasos (Phase 2+)

### Backend
- [ ] WebSocket para actualizaciones en tiempo real
- [ ] Task queue manager (Bull/RabbitMQ) para tareas asincrónicas
- [ ] Integración con PM2 para monitoreo de procesos
- [ ] Alertas por email/Slack
- [ ] Autenticación y autorización
- [ ] Logging estructurado (Winston/Pino)

### Frontend
- [ ] Página de Agentes con logs en tiempo real
- [ ] Consola del Gateway (estado de modelos, providers, fallbacks)
- [ ] Gestor de Tareas (historial, búsqueda, filtros)
- [ ] Métricas avanzadas (gráficos, análisis de costos)
- [ ] Formulario para crear tareas interactivamente
- [ ] Selector de modelos y agentes en la UI
- [ ] Responsividad mejorada para móviles (Tailscale)

## Validación del Sistema

### 1. Verificar que el gateway está corriendo

```bash
curl http://127.0.0.1:4000/health/liveliness
# Retorna: "I'm alive!"
```

### 2. Verificar que Sinkia API está corriendo

```bash
curl http://localhost:3001/api/ai/status | jq .
# Retorna: estado del gateway y modelos disponibles
```

### 3. Iniciar backend del Control Brain

```bash
cd /Users/davidnows/sinkia-next/server/control-brain
npm run dev
# Logs: "🧠 Sinkia Control Brain Backend"
# "📡 Running on http://localhost:3002"
```

### 4. Probar endpoint de status

```bash
curl http://localhost:3002/api/control/status | jq .
# Retorna: system health, metrics, recent_tasks
```

### 5. Iniciar frontend (otra terminal)

```bash
cd /Users/davidnows/sinkia-next/web/control-brain
npm run dev
# Logs: "VITE v5.4.21 ready in xxx ms"
# URL: http://localhost:3010
```

### 6. Abrir en navegador

Visitar `http://localhost:3010` para ver el dashboard.

## Notas Técnicas

### TypeScript
- Strict mode habilitado en ambos proyectos
- ESM modules (import/export)
- Compiled a ES2020

### Seguridad
- No se imprimen secretos en logs
- CORS habilitado para desarrollo
- Variables de entorno en `.env`

### Rendimiento
- Frontend: Vite con ~65KB gzip (production build)
- Backend: SQLite para simplicidad (migratable a PostgreSQL)
- Metrics en memoria con límite de 1000 latencias por provider

## Troubleshooting

**Error: "Cannot find module 'sqlite3'"**
```bash
cd server/control-brain
npm install --build-from-source
```

**Error: "Port 3002 already in use"**
```bash
export CONTROL_BRAIN_PORT=3003
npm run dev
```

**Error: "CORS error" desde frontend**
- Verificar que Vite proxy está correctamente configurado en `vite.config.ts`
- Verificar que backend está escuchando en 3002

**Métricas mostrando "..."**
- Es carga normal, esperar 1-2 segundos
- Si persiste, verificar que el backend está respondiendo en `/api/control/status`

## Licencia

MIT (como el resto del proyecto Sinkia)

---

**Implementado por**: Oz Agent
**Fecha**: Junio 2026
**Estado**: ✅ MVP completado, listo para expansión
