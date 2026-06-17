# Sinkia Control Brain App — Specification

## Overview
The **Control Brain** is a centralized dashboard and orchestration system for managing all Sinkia AI agents, the LiteLLM gateway, and multi-provider LLM infrastructure. It provides real-time monitoring, agent coordination, model routing, cost tracking, and autonomous task orchestration across local and cloud LLMs.

## 1. Core Purpose
- **Single pane of glass** for all Sinkia agents (classifier, analyzer, documentAgent, learningAgent, extractorAgent, HR, legal, accounting, etc.)
- **Gateway management**: Monitor LiteLLM gateway health, model availability, fallback status, and provider connectivity
- **Intelligent task routing**: Delegate tasks to appropriate agents based on context, confidence, and resource availability
- **Cost optimization**: Track spend per provider (Ollama, LM Studio, OpenRouter, Gemini, NVIDIA, Anthropic) with budget alerts
- **Agent orchestration**: Run multi-step workflows coordinating multiple agents (e.g., classify → analyze → extract → learn)
- **Fallback & resilience**: Auto-switch to cloud models if local backends fail, monitor and auto-restart services

## 2. Architecture

### 2.1 Backend (Node.js/Express)
**Location**: `/Users/davidnows/sinkia-next/server/control-brain/` (new service)

**Responsibilities**:
- REST API for dashboard and agent coordination
- WebSocket server for real-time updates (agent logs, gateway health, task progress)
- Task queue manager (implement or integrate Bull/RabbitMQ for async task scheduling)
- Agent orchestrator: decompose complex tasks into sub-tasks and delegate to best-fit agent
- Metrics collector: consume PM2, gateway, and agent logs to build dashboards
- Cost tracking: API call counters per provider, estimated spend calculation
- Configuration management: persist gateway aliases, agent preferences, routing rules

**Key endpoints**:
```
GET  /api/control/status              # Overall system health
GET  /api/control/agents              # List agents with status
GET  /api/control/agents/:id/logs     # Agent activity logs
POST /api/control/task                # Submit orchestrated task
GET  /api/control/task/:id            # Task status & results
GET  /api/control/gateway             # Gateway health, models, providers
POST /api/control/gateway/restart     # Restart gateway
GET  /api/control/metrics             # System metrics (latency, throughput, costs)
GET  /api/control/alerts              # Active alerts (gateway down, high cost, etc.)
WS   /api/control/ws                  # WebSocket for real-time updates
```

### 2.2 Frontend (React/TypeScript)
**Location**: `/Users/davidnows/sinkia-next/web/control-brain/` (new)

**Key Views**:

#### 2.2.1 Dashboard (Home)
- **System Health**: Gateway status (green/red), uptime, model availability count
- **Active Agents**: Card grid showing agent status, current task, queue depth
- **Recent Tasks**: Last 10 completed/failed tasks with durations
- **Alerts**: High-priority alerts (service down, budget exceeded, errors)
- **Quick Stats**: Total tasks today, avg latency, estimated cost, top provider

#### 2.2.2 Agent Monitor
- **Agent List**: All agents with status (online/offline), uptime, task count
- **Agent Detail View**:
  - Real-time logs (tail -f style)
  - Task queue (pending/processing)
  - Model preference
  - Resource usage (if available via PM2)
  - Action buttons: restart agent, pause, force sync

#### 2.2.3 Gateway Console
- **Models Tab**:
  - All aliases (local-fast, local-reason, cloud-claude, etc.)
  - Backend status (Ollama, LM Studio, OpenRouter, etc.)
  - Fallback chain for each alias
  - Load distribution (% of tasks routed to each model)
- **Providers Tab**:
  - Cloud provider connectivity status
  - API key validity checks
  - Rate limit info
  - Cost per provider (real-time)
- **Health Tab**:
  - Latency histogram (request durations per model)
  - Error rate per provider
  - Gateway restart history
  - Resource usage (CPU, memory via PM2)

#### 2.2.4 Task Orchestrator
- **Manual Task Submission**:
  - Free-form prompt (e.g., "Classify this invoice and extract line items")
  - Model selection (local-fast, local-reason, cloud-claude, auto)
  - Agent selection (auto-route or manual pick)
  - Confidence threshold slider
  - Submit button → polls task/:id for results

- **Workflow Editor** (optional v2):
  - Drag-drop workflow builder
  - Connect agents (classify → analyze → extract)
  - Conditional logic (if confidence < X, escalate to cloud)
  - Save as templates

#### 2.2.5 Metrics & Cost Dashboard
- **Daily/Weekly/Monthly**: Task volume, avg latency, cost breakdown by provider
- **Model Performance**: Which models are used most, error rates, average latency
- **Cost Breakdown**: Pie chart (local % free, cloud % paid), total spend, budget vs. actual
- **Alerts**: Budget exceeded, provider down, high error rate, SLA violation

#### 2.2.6 Settings
- **Gateway Config** (read-only view, edit in file):
  - Current aliases
  - Provider API keys status (safe view)
  - Fallback strategy
- **Agent Preferences**:
  - Default model per agent type
  - Confidence thresholds per agent
  - Queue size limits
  - Enable/disable agents
- **Alerts**:
  - Slack/email integration (optional v2)
  - Budget thresholds
  - Error rate thresholds
  - Service SLA targets

### 2.3 Database / Storage
- **SQLite** (local, simple) or **PostgreSQL** (if hosted):
  - Tasks table: id, prompt, agent, model, status, start_time, end_time, cost, result
  - Agents table: id, name, status, last_heartbeat, uptime
  - Metrics table: timestamp, agent, task_count, latency_p50, latency_p99, cost
  - Alerts table: id, type, message, resolved, created_at
  - Config table: gateway aliases, agent preferences (JSON blobs)

## 3. Integration Points

### 3.1 With Sinkia API
- HTTP calls to `localhost:3001/api/ai/*` endpoints (classify, analyze, document, etc.)
- Assume responses include `{ success: boolean, result: any, confidence?: number, model: string, provider: string, latency_ms: number, estimated_cost: number }`

### 3.2 With LiteLLM Gateway
- HTTP calls to `localhost:4000/v1/models` (list models)
- HTTP calls to `localhost:4000/health/liveliness` (health check)
- HTTP calls to `localhost:4000/v1/chat/completions` (direct model access if needed)

### 3.3 With PM2
- `pm2 list`, `pm2 logs`, `pm2 show <id>` via child_process (already used by some Sinkia code)
- Monitor gateway and sinkia-api processes

### 3.4 With OpenClaw (optional future)
- Same pattern: HTTP calls to OpenClaw agent endpoints if Control Brain needs to orchestrate OpenClaw tasks

## 4. Functional Requirements

### 4.1 Real-Time Monitoring
- [ ] Dashboard updates every 5 sec (gateway, agents, recent tasks)
- [ ] WebSocket push for log streaming (live tail of agent activity)
- [ ] Alert notifications appear in-app (and optionally Slack/email)

### 4.2 Agent Orchestration
- [ ] Accept free-form user prompt → decompose into task (agent + model)
- [ ] Route task to best agent based on:
  - Agent specialization (classifier for class, analyzer for analysis, etc.)
  - Model availability (if local model down, escalate to cloud)
  - Confidence threshold (if confidence < threshold, retry with better model)
- [ ] Support multi-step workflows: classify → analyze → extract → learn

### 4.3 Cost Tracking
- [ ] Log every API call (agent, model, provider, latency, cost_estimate)
- [ ] Calculate cost per provider (Ollama & LM Studio free, cloud providers via API)
- [ ] Show real-time spend and alerts if budget exceeded

### 4.4 Resilience
- [ ] Detect gateway down → auto-restart (trigger PM2)
- [ ] Detect agent down → log alert, offer restart button
- [ ] Fallback routing: if local-reason unavailable, switch to cloud-auto
- [ ] Graceful degradation: if all cloud providers down, queue and retry locally

### 4.5 Logging & Auditing
- [ ] All tasks logged (input, agent, model, result, duration, cost)
- [ ] Searchable task history (filter by agent, date, status, cost range)
- [ ] Agent logs accessible (real-time tail, historical)

## 5. Tech Stack

### Backend
- **Runtime**: Node.js (18+)
- **Framework**: Express.js (already used in sinkia-api)
- **Real-time**: Socket.IO or ws
- **Process monitoring**: PM2 programmatic API
- **Database**: SQLite3 (npm sqlite3) for local, easy setup
- **Task queue**: Optional (Bull/RabbitMQ) if async tasks grow complex
- **Logging**: Winston or pino

### Frontend
- **Framework**: React 18+ (TypeScript)
- **Styling**: Tailwind CSS (already used in sinkia)
- **Charts**: Recharts or Chart.js (for metrics)
- **Real-time**: Socket.IO client
- **Build**: Vite (faster than webpack)
- **UI components**: Headless UI + custom, or Material-UI for richer components

### Deployment
- **Web**: Served from Express (same server as Control Brain API)
- **Mobile**: Responsive design (same React app, no native needed initially)
- **Access**: Via Tailscale (as per local-claude-code's MOBILE.md)

## 6. Project Structure

```
/Users/davidnows/sinkia-next/
├── server/
│   ├── control-brain/             # NEW: Control Brain backend
│   │   ├── src/
│   │   │   ├── index.ts           # Express app, routes
│   │   │   ├── orchestrator.ts    # Agent routing logic
│   │   │   ├── gateway-client.ts  # LiteLLM gateway HTTP client
│   │   │   ├── metrics.ts         # Cost, latency tracking
│   │   │   ├── db.ts              # SQLite interface
│   │   │   └── alerts.ts          # Alert logic
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── agentCore.js               # (existing, used by control-brain)
│   └── .env                        # (existing, shared env)
├── web/
│   └── control-brain/             # NEW: Control Brain frontend
│       ├── src/
│       │   ├── App.tsx
│       │   ├── pages/
│       │   │   ├── Dashboard.tsx
│       │   │   ├── AgentMonitor.tsx
│       │   │   ├── GatewayConsole.tsx
│       │   │   ├── TaskOrchestrator.tsx
│       │   │   ├── Metrics.tsx
│       │   │   └── Settings.tsx
│       │   ├── components/
│       │   │   ├── HealthCard.tsx
│       │   │   ├── AgentCard.tsx
│       │   │   ├── MetricsChart.tsx
│       │   │   └── AlertBanner.tsx
│       │   └── hooks/
│       │       ├── useWebSocket.ts
│       │       ├── useMetrics.ts
│       │       └── useAgent.ts
│       ├── package.json
│       ├── vite.config.ts
│       ├── tailwind.config.js
│       └── tsconfig.json
└── CONTROL_BRAIN_SPEC.md          # THIS FILE
```

## 7. MVP Scope (Phase 1)
1. **Backend**: Express server with `/api/control/status`, `/api/control/agents`, `/api/control/task` endpoints
2. **Frontend**: React dashboard showing:
   - System health (gateway + agents)
   - Agent list with status
   - Recent tasks
   - Basic task submission
3. **Database**: SQLite with tasks and agents tables
4. **Real-time**: WebSocket for agent log streaming (optional if too complex, start with polling)
5. **No auth**: Local-only, assume trusted network

## 8. Future Enhancements (Phase 2+)
- Multi-step workflow builder
- Slack/email alerts
- Cost budgeting & optimization
- Multi-tenant support (if SaaS)
- API rate limiting & API key mgmt
- Advanced metrics (anomaly detection, cost forecasting)
- Agent plugin system
- Mobile native app

## 9. Success Criteria
- [ ] Dashboard loads and shows real-time gateway + agent status
- [ ] Can submit a task via UI and see it routed to correct agent
- [ ] Can view task history and costs
- [ ] Gateway down → auto-restart via button click or watchdog
- [ ] Responsive on mobile (via Tailscale)
- [ ] Latency < 200ms for dashboard updates, < 5s for task response

## 10. Rollout Plan
1. **Week 1**: Backend API skeleton + SQLite, frontend dashboard
2. **Week 2**: WebSocket real-time, task orchestration logic
3. **Week 3**: Cost tracking, metrics views
4. **Week 4**: Mobile responsiveness, final polish
5. **Ongoing**: Bug fixes, agent/gateway integration refinement
