# 🤖 SYNK-IA Agents - README Técnico

## Descripción General

Sistema de 4 agentes de IA especializados construidos sobre Base44 SDK para automatizar y optimizar diferentes áreas del negocio.

---

## 📋 Tabla de Contenidos

1. [Instalación](#instalación)
2. [Estructura del Proyecto](#estructura-del-proyecto)
3. [Agentes Implementados](#agentes-implementados)
4. [Servicios y APIs](#servicios-y-apis)
5. [Testing](#testing)
6. [Deployment](#deployment)
7. [Troubleshooting](#troubleshooting)

---

## Instalación

### Prerrequisitos

```bash
Node.js >= 18.0.0
npm >= 9.0.0
```

### Dependencias Principales

```json
{
  "@base44/sdk": "^0.1.2",
  "react": "^18.2.0",
  "react-router-dom": "^7.2.0",
  "@tanstack/react-query": "latest",
  "lucide-react": "^0.475.0",
  "sonner": "^2.0.1"
}
```

### Setup

```bash
# Clonar el proyecto
cd /home/ubuntu/synk-ia

# Instalar dependencias
npm install

# Configurar variables de entorno
# (El appId ya está configurado en base44Client.js)

# Iniciar en desarrollo
npm run dev

# Build para producción
npm run build
```

---

## Estructura del Proyecto

```
synk-ia/
├── src/
│   ├── pages/
│   │   ├── CEOBrain.jsx           # CEO Brain Agent UI
│   │   ├── HRAgent.jsx             # HR Agent UI
│   │   ├── CentralAgent.jsx        # Central Agent UI
│   │   └── BiloopAgent.jsx         # Biloop Agent UI
│   │
│   ├── services/
│   │   └── agents/
│   │       ├── ceoBrainService.js      # Lógica CEO Brain
│   │       ├── hrAgentService.js        # Lógica HR
│   │       ├── centralAgentService.js   # Lógica Central
│   │       └── biloopAgentService.js    # Lógica Biloop
│   │
│   ├── components/
│   │   └── agents/
│   │       └── MessageBubble.jsx   # Componente de mensajes
│   │
│   └── api/
│       └── base44Client.js         # Cliente Base44 configurado
│
├── GUIA_AGENTES_IA.md              # Guía de usuario
├── AGENTES_README_TECNICO.md       # Este archivo
└── package.json
```

---

## Agentes Implementados

### 1. CEO Brain Agent

**Archivo**: `src/pages/CEOBrain.jsx`  
**Servicio**: `src/services/agents/ceoBrainService.js`  
**Agente Base44**: `ceo_brain`

#### Características Técnicas
- Acceso restringido por email
- Reconocimiento de voz (Web Speech API)
- Métricas en tiempo real
- Enriquecimiento de contexto automático

#### Endpoints Usados
```javascript
base44.entities.Invoice.list()
base44.entities.Client.list()
base44.entities.Payroll.list()
base44.agents.createConversation()
base44.agents.addMessage()
base44.agents.subscribeToConversation()
```

#### Métricas Calculadas
```javascript
{
  invoices: {
    total: number,
    totalAmount: number,
    pending: number,
    paid: number,
    averageAmount: number
  },
  sales: {
    monthlyRevenue: number,
    monthlyInvoiceCount: number,
    averageTicket: number
  },
  clients: {
    total: number,
    active: number
  },
  expenses: {
    total: number,
    totalAmount: number
  }
}
```

### 2. HR Agent

**Archivo**: `src/pages/HRAgent.jsx`  
**Servicio**: `src/services/agents/hrAgentService.js`  
**Agente Base44**: `hr_assistant`

#### Características Técnicas
- Carga automática de datos del empleado
- Análisis de nóminas
- Detección de anomalías
- Privacidad por usuario

#### Endpoints Usados
```javascript
base44.auth.me()
base44.entities.Payroll.list({ employee_email })
base44.agents.createConversation()
```

#### Análisis de Nómina
```javascript
{
  period: string,
  grossSalary: number,
  netSalary: number,
  deductions: number,
  bonuses: number,
  concepts: Array
}
```

#### Detección de Anomalías
- Umbral de variación: 20%
- Comparación con promedio histórico
- Niveles de severidad: low, medium, high

### 3. Central Agent

**Archivo**: `src/pages/CentralAgent.jsx`  
**Servicio**: `src/services/agents/centralAgentService.js`  
**Agente Base44**: `central_coordinator`

#### Características Técnicas
- Búsqueda multi-entidad
- Análisis de oportunidades de ahorro
- Upload de archivos
- Vista general del sistema

#### Capacidades de Búsqueda
```javascript
searchAll(query) {
  // Busca en:
  - Facturas
  - Clientes
  - Proveedores
  - Emails
}
```

#### Análisis de Ahorros
```javascript
analyzeSavingsOpportunities() {
  // Detecta:
  - Variaciones de precio (>20%)
  - Facturas duplicadas
  - Oportunidades de negociación
}
```

### 4. Biloop Agent

**Archivo**: `src/pages/BiloopAgent.jsx`  
**Servicio**: `src/services/agents/biloopAgentService.js`  
**Agente Base44**: `biloop_assistant`

#### Características Técnicas
- Procesamiento multi-formato
- Extracción automática de datos
- Validaciones integradas
- Análisis de gastos

#### Formatos Soportados
```javascript
{
  pdf: ['application/pdf'],
  image: ['image/jpeg', 'image/png', 'image/jpg'],
  csv: ['text/csv'],
  excel: ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  zip: ['application/zip']
}
```

#### Validaciones de Upload
```javascript
// Tamaño máximo
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

// Validación
if (file.size > MAX_FILE_SIZE) {
  throw new Error('Archivo demasiado grande');
}
```

#### Procesamiento de Archivo
```javascript
processBiloopFile(fileUrl, fileName) {
  // 1. Detectar tipo
  // 2. Extraer datos
  // 3. Validar información
  // 4. Crear registros
  // 5. Retornar resultado
}
```

---

## Servicios y APIs

### Estructura de un Servicio

```javascript
export const AgentService = {
  // Configuración
  agentName: "agent_name",
  agentTitle: "Agent Title",
  systemPrompt: `...`,
  
  // Métodos principales
  async getMetrics() { },
  async analyzeData() { },
  async processAction() { },
  
  // Enriquecimiento de contexto
  async enrichMessageWithContext(userMessage) {
    // Lógica de enriquecimiento
    return {
      userMessage,
      context: {},
      enriched: boolean
    };
  }
};
```

### Base44 SDK - Métodos Clave

#### Agentes
```javascript
// Crear conversación
const conv = await base44.agents.createConversation({
  agent_name: "agent_name",
  metadata: { name: "Session" }
});

// Listar conversaciones
const convs = await base44.agents.listConversations({ 
  agent_name: "agent_name" 
});

// Obtener conversación
const conv = await base44.agents.getConversation(conversationId);

// Enviar mensaje
await base44.agents.addMessage(conversation, {
  role: "user",
  content: "message",
  file_urls: ["url"]
});

// Suscribirse a actualizaciones
base44.agents.subscribeToConversation(conversationId, (data) => {
  // Callback con mensajes actualizados
});

// URL de WhatsApp
const url = base44.agents.getWhatsAppConnectURL('agent_name');
```

#### Entidades
```javascript
// Listar
const items = await base44.entities.Entity.list();
const items = await base44.entities.Entity.list({ filter: value });

// Crear
const item = await base44.entities.Entity.create(data);

// Actualizar
const item = await base44.entities.Entity.update(id, data);

// Eliminar
await base44.entities.Entity.delete(id);
```

#### Integraciones
```javascript
// Subir archivo
const { file_url } = await base44.integrations.Core.UploadFile({ 
  file: fileObject 
});

// Extraer datos
const data = await base44.integrations.Core.ExtractData({
  file_url: "url",
  extraction_type: "invoice|spreadsheet"
});
```

#### Autenticación
```javascript
// Usuario actual
const user = await base44.auth.me();
// Returns: { email, name, role, ... }
```

---

## Testing

### Unit Tests

```bash
# Ejecutar tests
npm test

# Con coverage
npm test -- --coverage

# Watch mode
npm test -- --watch
```

### Test de Servicios

```javascript
import { CEOBrainService } from '@/services/agents/ceoBrainService';

describe('CEOBrainService', () => {
  test('should get business metrics', async () => {
    const metrics = await CEOBrainService.getBusinessMetrics();
    expect(metrics).toHaveProperty('invoices');
    expect(metrics).toHaveProperty('sales');
  });
  
  test('should enrich message with context', async () => {
    const result = await CEOBrainService.enrichMessageWithContext('análisis');
    expect(result.enriched).toBe(true);
  });
});
```

### Test de Componentes

```javascript
import { render, screen } from '@testing-library/react';
import CEOBrain from '@/pages/CEOBrain';

test('renders CEO Brain agent', () => {
  render(<CEOBrain />);
  expect(screen.getByText('CEO Brain')).toBeInTheDocument();
});
```

### Testing Manual

#### 1. CEO Brain Agent
```
1. Acceder como usuario autorizado
2. Verificar que muestra métricas
3. Enviar mensaje: "Dame un resumen"
4. Verificar respuesta con contexto
5. Probar reconocimiento de voz
```

#### 2. HR Agent
```
1. Acceder como empleado
2. Verificar que muestra última nómina
3. Enviar mensaje: "Explícame el IRPF"
4. Verificar respuesta personalizada
```

#### 3. Central Agent
```
1. Acceder al agente
2. Enviar mensaje: "Busca facturas de enero"
3. Verificar búsqueda multi-entidad
4. Probar upload de archivo
```

#### 4. Biloop Agent
```
1. Acceder al agente
2. Subir archivo CSV de prueba
3. Verificar procesamiento
4. Enviar mensaje: "Analiza gastos"
5. Verificar análisis de datos
```

---

## Deployment

### Build de Producción

```bash
# Build
npm run build

# Preview
npm run preview
```

### Variables de Entorno

```bash
# .env
VITE_BASE44_APP_ID=6909eb511f749a49b63df48c
```

### Nginx Configuration

```nginx
server {
    listen 80;
    server_name synk-ia.com;
    
    root /var/www/synk-ia/dist;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # Agentes
    location /ceo-brain {
        try_files $uri /index.html;
    }
    
    location /hr-agent {
        try_files $uri /index.html;
    }
    
    location /central-agent {
        try_files $uri /index.html;
    }
    
    location /biloop-agent {
        try_files $uri /index.html;
    }
}
```

### Docker Deployment

```dockerfile
FROM node:18-alpine as builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

```bash
# Build Docker image
docker build -t synk-ia-agents .

# Run
docker run -p 80:80 synk-ia-agents
```

---

## Troubleshooting

### Problemas Comunes

#### 1. "Error al iniciar conversación"

**Causa**: Base44 SDK no inicializado correctamente

**Solución**:
```javascript
// Verificar en base44Client.js
export const base44 = createClient({
  appId: "6909eb511f749a49b63df48c",
  requiresAuth: true
});
```

#### 2. "Usuario no autorizado"

**Causa**: Email no en la lista de autorizados (CEO Brain)

**Solución**:
```javascript
// Añadir email en CEOBrain.jsx
const CEO_EMAILS = [
  "ruben@loffresco.com",
  "nuevo@email.com"
];
```

#### 3. "Error al cargar métricas"

**Causa**: Permisos insuficientes o datos no disponibles

**Solución**:
```javascript
// Añadir manejo de errores
try {
  const metrics = await service.getMetrics();
} catch (error) {
  console.error("Error:", error);
  // Mostrar datos por defecto
  setMetrics(defaultMetrics);
}
```

#### 4. "Archivo no soportado"

**Causa**: Tipo de archivo no permitido

**Solución**:
```javascript
// Verificar validTypes en BiloopAgent
const validTypes = ['.csv', '.xlsx', '.xls', '.pdf', '.zip', '.jpg', '.jpeg', '.png'];
```

#### 5. "Contexto no enriquecido"

**Causa**: Servicio de enriquecimiento falló silenciosamente

**Solución**:
```javascript
// Añadir logs
const enriched = await service.enrichMessageWithContext(message);
console.log('Enriched:', enriched);

if (!enriched.enriched) {
  console.warn('Context enrichment failed');
}
```

### Debugging

#### Modo Debug

```javascript
// Activar en development
const DEBUG = process.env.NODE_ENV === 'development';

if (DEBUG) {
  console.log('[Agent] Message:', message);
  console.log('[Service] Context:', context);
  console.log('[API] Response:', response);
}
```

#### Base44 SDK Debug

```javascript
// En base44Client.js
export const base44 = createClient({
  appId: "6909eb511f749a49b63df48c",
  requiresAuth: true,
  debug: true  // Activa logs detallados
});
```

### Logs

#### Estructura de Logs

```javascript
// Formato consistente
console.error('[AgentName] Error in method:', error);
console.warn('[AgentName] Warning:', message);
console.log('[AgentName] Info:', data);
console.debug('[AgentName] Debug:', details);
```

#### Ejemplo
```javascript
try {
  const result = await someAction();
  console.log('[CEOBrain] Metrics loaded:', result);
} catch (error) {
  console.error('[CEOBrain] Error loading metrics:', error);
  toast.error('Error al cargar métricas');
}
```

---

## Performance Optimization

### 1. Lazy Loading

```javascript
// Cargar agentes bajo demanda
const CEOBrain = React.lazy(() => import('@/pages/CEOBrain'));
const HRAgent = React.lazy(() => import('@/pages/HRAgent'));
```

### 2. Memoization

```javascript
// Memorizar cálculos pesados
const metrics = useMemo(() => 
  calculateMetrics(data), 
  [data]
);
```

### 3. Debouncing

```javascript
// Debounce en búsquedas
const debouncedSearch = useMemo(
  () => debounce((value) => handleSearch(value), 500),
  []
);
```

### 4. Cache de Métricas

```javascript
// React Query para cache
const { data: metrics } = useQuery({
  queryKey: ['business-metrics'],
  queryFn: () => CEOBrainService.getBusinessMetrics(),
  staleTime: 5 * 60 * 1000, // 5 minutos
  cacheTime: 10 * 60 * 1000 // 10 minutos
});
```

---

## Security Checklist

- [x] Autenticación requerida en todos los agentes
- [x] Validación de roles y permisos
- [x] Sanitización de inputs
- [x] Validación de archivos subidos
- [x] Protección contra XSS
- [x] Rate limiting (implementado por Base44)
- [x] HTTPS en producción
- [x] Datos sensibles no en logs
- [x] Tokens no expuestos en cliente

---

## API Reference

### CEOBrainService

```typescript
interface CEOBrainService {
  agentName: string;
  agentTitle: string;
  systemPrompt: string;
  
  getBusinessMetrics(): Promise<BusinessMetrics>;
  getInvoiceMetrics(): Promise<InvoiceMetrics>;
  getSalesMetrics(): Promise<SalesMetrics>;
  getClientMetrics(): Promise<ClientMetrics>;
  getExpenseMetrics(): Promise<ExpenseMetrics>;
  analyzeTrends(): Promise<Insight[]>;
  generateExecutiveSummary(): Promise<Summary>;
  enrichMessageWithContext(message: string): Promise<EnrichedMessage>;
}
```

### HRAgentService

```typescript
interface HRAgentService {
  agentName: string;
  agentTitle: string;
  systemPrompt: string;
  
  getEmployeePayrolls(email: string): Promise<Payroll[]>;
  analyzeLatestPayroll(email: string): Promise<PayrollAnalysis>;
  detectPayrollAnomalies(email: string): Promise<Anomaly[]>;
  getVacationInfo(email: string): Promise<VacationInfo>;
  explainPayrollConcept(concept: string): ConceptExplanation;
  enrichMessageWithContext(message: string, email: string): Promise<EnrichedMessage>;
}
```

### CentralAgentService

```typescript
interface CentralAgentService {
  agentName: string;
  agentTitle: string;
  systemPrompt: string;
  
  searchAll(query: string): Promise<SearchResults>;
  analyzeSavingsOpportunities(): Promise<Opportunity[]>;
  generateSystemOverview(): Promise<SystemOverview>;
  processAutomationCommand(command: string): Promise<any>;
  enrichMessageWithContext(message: string): Promise<EnrichedMessage>;
}
```

### BiloopAgentService

```typescript
interface BiloopAgentService {
  agentName: string;
  agentTitle: string;
  systemPrompt: string;
  
  processBiloopFile(fileUrl: string, fileName: string): Promise<ProcessResult>;
  detectFileType(fileName: string): FileType;
  extractFromDocument(fileUrl: string, fileName: string): Promise<ExtractionResult>;
  extractFromSpreadsheet(fileUrl: string, fileName: string): Promise<ExtractionResult>;
  createInvoicesFromData(invoices: InvoiceData[]): Promise<CreateResult>;
  analyzeRecentExpenses(days: number): Promise<ExpenseAnalysis>;
  compareProviderPrices(product: string): Promise<Comparison>;
  enrichMessageWithContext(message: string): Promise<EnrichedMessage>;
}
```

---

## Contributing

### Coding Standards

1. **Nomenclatura**
   - Componentes: PascalCase
   - Funciones: camelCase
   - Constantes: UPPER_SNAKE_CASE

2. **Estructura de Archivos**
   - Un componente por archivo
   - Servicios en `/services/`
   - Utilidades en `/utils/`

3. **Comentarios**
   - JSDoc para funciones públicas
   - Comentarios inline para lógica compleja

4. **Error Handling**
   - Try-catch en todas las llamadas async
   - Mensajes de error descriptivos
   - Toast para feedback al usuario

### Pull Request Process

1. Fork del repositorio
2. Crear branch feature: `git checkout -b feature/nueva-funcionalidad`
3. Commit changes: `git commit -m 'Add nueva funcionalidad'`
4. Push: `git push origin feature/nueva-funcionalidad`
5. Crear Pull Request

---

## License

Propietario - SYNK-IA © 2025

---

## Contact

- **Desarrollo**: dev@synk-ia.com
- **Soporte**: soporte@synk-ia.com
- **Documentación**: docs.synk-ia.com

---

**Última actualización**: Enero 2025  
**Versión del documento**: 1.0.0
