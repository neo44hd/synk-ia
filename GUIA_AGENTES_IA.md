# 🤖 Guía de Agentes de IA - SYNK-IA

## Índice
1. [Introducción](#introducción)
2. [CEO Brain Agent](#1-ceo-brain-agent)
3. [HR Agent](#2-hr-agent)
4. [Central Agent](#3-central-agent)
5. [Biloop Agent](#4-biloop-agent)
6. [Arquitectura Técnica](#arquitectura-técnica)
7. [Configuración y Personalización](#configuración-y-personalización)

---

## Introducción

SYNK-IA cuenta con **4 agentes de inteligencia artificial especializados** que trabajan de forma coordinada para automatizar y optimizar diferentes áreas de tu negocio.

Cada agente tiene:
- ✅ **Especialización específica** en su área
- ✅ **Acceso a datos relevantes** del sistema
- ✅ **Capacidad de análisis** y generación de insights
- ✅ **Interfaz conversacional** natural
- ✅ **Integración con SYNK-IA** para acciones en tiempo real

---

## 1. CEO BRAIN AGENT

### 🎯 Propósito
Cerebro ejecutivo con control total del sistema. Diseñado para análisis estratégico, métricas empresariales y toma de decisiones de alto nivel.

### 🔐 Acceso Restringido
Solo accesible para usuarios con email:
- `ruben@loffresco.com`
- `ruben@lofrfresco.com`
- O rol de administrador

### 📊 Capacidades

#### 1. Análisis de Métricas Empresariales
- **Facturas**: Total, pendientes, pagadas, importe total
- **Ventas**: Facturación mensual, número de facturas, ticket medio
- **Clientes**: Total de clientes, clientes activos
- **Gastos**: Total de gastos y análisis de costes

#### 2. Visualización de Dashboard
El agente muestra automáticamente:
```
┌─────────────┬──────────────┬──────────────┬─────────────┐
│ Facturas    │ Facturación  │ Clientes     │ Ticket Medio│
│ Total: 150  │ €45,230      │ Total: 89    │ €301        │
│ Pend.: 23   │ Este mes     │ Activos: 67  │ Promedio    │
└─────────────┴──────────────┴──────────────┴─────────────┘
```

#### 3. Análisis de Tendencias
- Detecta facturas pendientes vs pagadas
- Identifica variaciones en facturación
- Genera alertas automáticas de situaciones críticas

#### 4. Insights Estratégicos
Genera recomendaciones basadas en:
- Análisis de flujo de caja
- Tendencias de ventas
- Comparación de periodos
- Predicciones basadas en histórico

### 💬 Ejemplos de Consultas

```
"Dame un resumen ejecutivo del negocio"
"¿Cuál es el estado de las facturas pendientes?"
"Analiza la facturación del último mes"
"¿Qué tendencias financieras detectas?"
"Hazme una factura para el cliente X"
"Crea un presupuesto para el proyecto Y"
```

### 🎤 Características Especiales

#### Reconocimiento de Voz
- Activar con botón de micrófono
- Habla en español natural
- Transcripción en tiempo real

#### Acceso Total
- Control completo de datos
- Capacidad de crear/modificar registros
- Acceso a todos los módulos del sistema

#### Navegación Inteligente
Botones de acceso rápido a:
- Control Total de Datos (Biloop Import)
- Acciones Directas (Automation Hub)
- Diagnóstico Sistema (API Diagnostics)
- Búsqueda Web (System Overview)

### 📈 Panel de Métricas
Visible en la pantalla de bienvenida con actualización automática:
- Facturas totales y pendientes
- Facturación mensual
- Clientes totales y activos
- Ticket medio de ventas

---

## 2. HR AGENT

### 🎯 Propósito
Asistente especializado en Recursos Humanos y gestión de nóminas. Ayuda a empleados con consultas laborales, nóminas, vacaciones y más.

### 👥 Acceso
Disponible para todos los empleados. Cada usuario solo ve su propia información.

### 📊 Capacidades

#### 1. Análisis de Nóminas
- Visualización de última nómina
- Desglose de conceptos salariales
- Explicación de deducciones
- Histórico de nóminas

```
Última Nómina Visualizada:
┌──────────────────┬──────────────────┬────────────────┐
│ Salario Bruto    │ Salario Neto     │ Deducciones    │
│ €2,500.00        │ €1,875.50        │ €624.50        │
└──────────────────┴──────────────────┴────────────────┘
Periodo: Diciembre 2024
```

#### 2. Detección de Anomalías
Analiza automáticamente:
- Variaciones significativas (>20% respecto al promedio)
- Cambios inesperados en conceptos
- Alertas de irregularidades

#### 3. Gestión de Vacaciones
- Días totales disponibles
- Días usados
- Días restantes
- Estado de solicitudes pendientes

#### 4. Explicación de Conceptos
Proporciona explicaciones claras de:
- **Salario Base**: Tu sueldo fijo mensual
- **IRPF**: Retención de impuestos (Hacienda)
- **Seguridad Social**: Cotizaciones (~6.35%)
- **Plus Transporte**: Complemento de desplazamiento
- **Plus Comida**: Complemento de alimentación
- **Horas Extra**: Pago adicional por horas extras

### 💬 Ejemplos de Consultas

```
"Muéstrame mi última nómina"
"¿Qué es el IRPF?"
"¿Cuántos días de vacaciones me quedan?"
"Explícame las deducciones de mi nómina"
"Necesito información sobre mi contrato"
"¿Por qué ha variado mi nómina este mes?"
```

### 🔒 Seguridad y Privacidad
- Cada empleado solo accede a sus datos
- Información confidencial protegida
- Cumplimiento con normativa laboral (LOPD)

### 🎨 Interfaz Amigable
- Diseño en tonos rosa/morado
- Emojis para facilitar comprensión
- Tarjetas visuales con información clave
- Respuestas empáticas y cercanas

---

## 3. CENTRAL AGENT

### 🎯 Propósito
Coordinador central del sistema. Gestiona procesos automáticos, búsquedas inteligentes y coordina a otros agentes especializados.

### 🌐 Acceso
Disponible para todos los usuarios autorizados.

### 📊 Capacidades

#### 1. Búsqueda Inteligente
Busca en TODO el sistema:
- Facturas
- Clientes
- Proveedores
- Emails
- Documentos

```javascript
Resultados de búsqueda "Acme Corp":
├── Facturas: 12 encontradas
├── Clientes: 1 coincidencia
├── Proveedores: 0 coincidencias
└── Emails: 45 conversaciones
```

#### 2. Análisis de Oportunidades de Ahorro
Detecta automáticamente:
- Variaciones de precio entre proveedores
- Facturas duplicadas
- Oportunidades de optimización
- Comparaciones de precios

```
💰 Oportunidades de Ahorro Detectadas:
- Proveedor A: Variación del 25% en precios (ahorro potencial: €450)
- Proveedor B: Facturas similares con diferente importe
- Sugerencia: Negociar con Proveedor A por volumen
```

#### 3. Resumen del Sistema
Genera vista general completa:
- Total de facturas y estado
- Clientes activos
- Proveedores registrados
- Oportunidades de mejora

#### 4. Procesamiento de Emails
- Análisis automático de emails
- Extracción de datos relevantes
- Creación de facturas desde emails
- Registro de proveedores

#### 5. Coordinación de Automatizaciones
- Ejecuta procesos automáticos
- Coordina flujos de trabajo
- Integra diferentes módulos
- Genera reportes ejecutivos

### 💬 Ejemplos de Consultas

```
"Analiza todo el sistema"
"Busca facturas de 'Proveedor X'"
"¿Qué oportunidades de ahorro hay?"
"Dame un resumen del negocio"
"Automatiza el procesamiento de facturas"
"Compara precios entre proveedores"
"Busca todos los emails de este cliente"
```

### 🚀 Acciones Rápidas Sugeridas
- 🔍 Analizar todo el sistema
- 💰 Buscar ahorros ahora
- ⚡ Automatizar procesos

### 🎨 Diseño
- Tonos morado/índigo
- Icono de cerebro (Brain)
- Énfasis en la coordinación
- Vista panorámica del negocio

---

## 4. BILOOP AGENT

### 🎯 Propósito
Especialista en procesamiento inteligente de documentos contables y gestión de Biloop.

### 📄 Formatos Soportados
- ✅ **CSV** - Archivos de texto separados por comas
- ✅ **Excel** (XLSX, XLS) - Hojas de cálculo
- ✅ **PDF** - Facturas escaneadas
- ✅ **Imágenes** (JPG, PNG) - Fotos de documentos
- ✅ **ZIP** - Múltiples archivos comprimidos

### 📊 Capacidades

#### 1. Extracción Inteligente de Datos
Automáticamente extrae:
- Nombre del proveedor
- Fecha de la factura
- Número de factura
- Importe total
- IVA y retenciones
- Conceptos y líneas de factura

#### 2. Identificación de Proveedores
- Detecta proveedores automáticamente
- Registra nuevos proveedores
- Asocia facturas a proveedores existentes
- Actualiza información de proveedores

#### 3. Validaciones Automáticas
- Verifica formato de datos
- Valida importes y cálculos
- Detecta inconsistencias
- Alerta sobre posibles errores

#### 4. Clasificación Automática
- Categoriza gastos
- Asigna centros de coste
- Clasifica por tipo de gasto
- Genera informes por categoría

#### 5. Análisis de Gastos
```
📊 Análisis de Últimos 30 Días:
├── Total Facturas: 45
├── Importe Total: €12,456.78
└── Por Categoría:
    ├── Suministros: €3,200
    ├── Servicios: €5,100
    ├── Material: €2,850
    └── Otros: €1,306.78
```

#### 6. Comparación de Precios
Compara precios entre proveedores:
```
🔍 Comparación para "Material de oficina":
├── Proveedor A: €245/mes (Promedio)
├── Proveedor B: €310/mes (27% más caro)
└── Ahorro potencial: €780/año cambiando a Proveedor A
```

### 💬 Ejemplos de Consultas

```
"Analiza las últimas facturas"
"¿Cuánto hemos gastado este mes?"
"Compara precios de suministros"
"Busca oportunidades de ahorro"
"Dame un resumen de gastos"
"¿Qué facturas están pendientes?"
```

### 📤 Proceso de Upload

#### 1. Seleccionar Archivo
Botón de upload en la interfaz

#### 2. Validación Automática
- Tamaño máximo: 20MB
- Tipos permitidos: CSV, Excel, PDF, imágenes, ZIP

#### 3. Procesamiento
```
⏳ Procesando archivo...
✓ Archivo leído correctamente
✓ Datos extraídos: 12 facturas
✓ Proveedores detectados: 5
✓ Validación completada
✓ Facturas creadas en el sistema
```

#### 4. Confirmación
El agente informa del resultado:
- Número de facturas procesadas
- Proveedores nuevos registrados
- Errores o advertencias
- Acciones realizadas

### 🎨 Diseño
- Tonos azul/índigo
- Icono de bot
- Foco en procesamiento de documentos
- Interfaz limpia para upload

### ⚙️ Configuración de Validaciones

#### Validaciones de Archivo
```javascript
// Tipos válidos
const validTypes = ['.csv', '.xlsx', '.xls', '.pdf', '.zip', '.jpg', '.jpeg', '.png'];

// Tamaño máximo
const maxSize = 20 * 1024 * 1024; // 20MB
```

#### Validaciones de Datos
- Formato de fechas
- Formato de importes
- CIF/NIF válidos
- Campos obligatorios

---

## Arquitectura Técnica

### 🏗️ Estructura de Servicios

Cada agente tiene un servicio asociado en `/src/services/agents/`:

```
src/services/agents/
├── ceoBrainService.js      # Servicios del CEO Brain
├── hrAgentService.js        # Servicios de RRHH
├── centralAgentService.js   # Servicios Central
└── biloopAgentService.js    # Servicios de Biloop
```

### 🔧 Funcionalidades Comunes

#### 1. Enriquecimiento de Contexto
Todos los agentes enriquecen los mensajes con contexto relevante:

```javascript
const enriched = await AgentService.enrichMessageWithContext(userMessage);

if (enriched.enriched && enriched.context) {
  messageContent = `${userMessage}\n\n[Contexto]\n${JSON.stringify(enriched.context, null, 2)}`;
}
```

#### 2. Gestión de Conversaciones
Usando SYNK-IA:

```javascript
// Crear conversación
const conversation = await SYNK-IA.agents.createConversation({
  agent_name: "agent_name",
  metadata: { name: "Session Name" }
});

// Suscribirse a actualizaciones
SYNK-IA.agents.subscribeToConversation(conversation.id, (data) => {
  setMessages(data.messages || []);
});

// Enviar mensaje
await SYNK-IA.agents.addMessage(conversation, {
  role: "user",
  content: messageContent
});
```

#### 3. Prompts del Sistema
Cada agente tiene un prompt optimizado que define:
- Su personalidad y tono
- Capacidades específicas
- Cómo debe responder
- Datos a los que tiene acceso
- Restricciones y seguridad

### 🔗 Integración con SYNK-IA

#### Entidades Disponibles
```javascript
SYNK-IA.entities.Invoice     // Facturas
SYNK-IA.entities.Client      // Clientes
SYNK-IA.entities.Provider    // Proveedores
SYNK-IA.entities.Payroll     // Nóminas
SYNK-IA.entities.Employee    // Empleados
```

#### Servicios de Integración
```javascript
SYNK-IA.integrations.Core.UploadFile()     // Subir archivos
SYNK-IA.integrations.Core.ExtractData()    // Extraer datos
```

#### Autenticación
```javascript
SYNK-IA.auth.me()  // Obtener usuario actual
```

### 📊 Flujo de Datos

```
Usuario
  ↓
Interfaz (React)
  ↓
Servicio del Agente
  ↓
SYNK-IA
  ↓
API Backend
  ↓
Base de Datos
```

---

## Configuración y Personalización

### 🎨 Personalizar Prompts

Editar los archivos de servicio en `/src/services/agents/`:

```javascript
export const AgentService = {
  systemPrompt: `
    Personaliza aquí el comportamiento del agente
    - Define su personalidad
    - Especifica capacidades
    - Establece restricciones
  `
};
```

### 🔐 Configurar Accesos

#### CEO Brain Agent
Editar array de emails autorizados en `/src/pages/CEOBrain.jsx`:

```javascript
const CEO_EMAILS = [
  "ruben@loffresco.com",
  "ruben@lofrfresco.com",
  "nuevo@email.com"  // Añadir aquí
];
```

### 🎯 Añadir Nuevas Capacidades

#### 1. Crear función en el servicio
```javascript
// En el archivo de servicio correspondiente
async nuevaCapacidad(parametros) {
  try {
    // Implementar lógica
    const resultado = await SYNK-IA.entities.Entity.list();
    return resultado;
  } catch (error) {
    console.error("Error:", error);
    return null;
  }
}
```

#### 2. Integrar en el agente
```javascript
// En el componente del agente
const handleAction = async () => {
  const resultado = await AgentService.nuevaCapacidad(params);
  // Usar resultado
};
```

### 📈 Añadir Métricas Personalizadas

En el servicio correspondiente:

```javascript
async getCustomMetric() {
  try {
    const data = await SYNK-IA.entities.Entity.list();
    const metric = {
      total: data.length,
      // Cálculos personalizados
    };
    return metric;
  } catch (error) {
    return { total: 0 };
  }
}
```

### 🎨 Personalizar UI

#### Colores de Agentes
Cada agente tiene su paleta de colores:

- **CEO Brain**: Cyan (`#06B6D4`)
- **HR Agent**: Rosa/Morado (`#EC4899`, `#9333EA`)
- **Central Agent**: Morado/Índigo (`#9333EA`, `#6366F1`)
- **Biloop Agent**: Azul (`#3B82F6`)

Modificar en el componente correspondiente.

---

## 📝 Notas Importantes

### Seguridad
- ✅ Autenticación requerida para todos los agentes
- ✅ Control de acceso por usuario/rol
- ✅ Datos sensibles protegidos
- ✅ Validación de inputs

### Performance
- ✅ Caché de métricas
- ✅ Lazy loading de datos
- ✅ Paginación en listados grandes
- ✅ Optimización de consultas

### Mantenimiento
- ✅ Logs de errores
- ✅ Manejo de excepciones
- ✅ Feedback al usuario
- ✅ Documentación actualizada

---

## 🚀 Próximas Mejoras

### Planificadas
- [ ] Análisis predictivo con ML
- [ ] Integración con más fuentes de datos
- [ ] Exportación de reportes
- [ ] Notificaciones push
- [ ] Modo offline
- [ ] Análisis de sentimiento
- [ ] Sugerencias proactivas

### En Consideración
- [ ] Integración con WhatsApp Business
- [ ] API pública para terceros
- [ ] Dashboard personalizable
- [ ] Alertas configurables
- [ ] Integración con calendarios

---

## 📞 Soporte

Para dudas o problemas:
- 📧 Email: soporte@synk-ia.com
- 📱 WhatsApp: Disponible en cada agente
- 📖 Documentación: Este archivo

---

**Versión**: 1.0.0  
**Última actualización**: Enero 2025  
**Autores**: Equipo de Desarrollo SYNK-IA
