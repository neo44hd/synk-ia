/**
 * Analizador de Markdown Estructurado para Facturas
 * 
 * Procesa markdown de facturas y extrae:
 * - Anomalías
 * - Alertas de calidad
 * - Insights inteligentes
 * - Recomendaciones
 */

/**
 * Genera prompt para LLM analizar factura en markdown
 * @param {string} markdown - Markdown de factura
 * @returns {string} Prompt para enviar al LLM
 */
function generateInvoiceAnalysisPrompt(markdown) {
  return `Eres un analista experto en facturas y datos financieros. Analiza la siguiente factura en markdown y extrae insights detallados.

FACTURA:
---
${markdown}
---

TAREAS A REALIZAR:
1. **Validación de Datos**: Identifica campos faltantes, incompletos o sospechosos
2. **Anomalías**: Detecta valores fuera de rango, inconsistencias, duplicados potenciales
3. **Alertas**: Genera alertas de riesgo, calidad o atención requerida
4. **Insights**: Extrae conclusiones útiles sobre gasto, proveedor, patrones
5. **Recomendaciones**: Sugiere acciones (renegociación, búsqueda alternativas, validación, etc)

RESPONDE SOLO en JSON válido, sin explicaciones adicionales:
{
  "validacion": {
    "campos_faltantes": ["campo1", "campo2"],
    "campos_incompletos": ["campo1"],
    "campos_sospechosos": [{"campo": "nombre", "valor": "valor_sospechoso", "razon": "explicación"}]
  },
  "anomalias": [
    {"tipo": "tipo_anomalia", "severidad": "baja|media|alta", "descripcion": "descripción", "valor_esperado": "...", "valor_actual": "..."}
  ],
  "alertas": [
    {"tipo": "tipo_alerta", "nivel": "info|warning|error", "mensaje": "mensaje claro", "accion_recomendada": "qué hacer"}
  ],
  "insights": [
    {"titulo": "Título del insight", "descripcion": "descripción detallada", "impacto": "impacto observado"}
  ],
  "recomendaciones": [
    {"prioridad": "alta|media|baja", "categoria": "categoria", "accion": "acción específica", "beneficio": "beneficio esperado"}
  ],
  "score_calidad": 0.0,
  "confianza_analisis": 0.85
}`;
}

/**
 * Genera prompt para comparar múltiples facturas de un proveedor
 * @param {string} providerMarkdown - Markdown del proveedor con facturas
 * @returns {string} Prompt para análisis comparativo
 */
function generateProviderAnalysisPrompt(providerMarkdown) {
  return `Eres un analista experto en gestión de proveedores. Analiza el siguiente perfil de proveedor y sus facturas.

PERFIL DE PROVEEDOR:
---
${providerMarkdown}
---

TAREAS A REALIZAR:
1. **Tendencias**: Identifica patrones en gasto, precios, frecuencia
2. **Riesgos**: Detecta riesgos potenciales (dependencia, volatilidad, confiabilidad)
3. **Oportunidades**: Encuentra oportunidades de ahorro, negociación, alternativas
4. **Recomendaciones**: Acciones estratégicas (renegociar, buscar alternativas, profundizar relación)
5. **Segmentación**: Clasifica proveedor por importancia, riesgo, oportunidad

RESPONDE SOLO en JSON válido:
{
  "clasificacion_proveedor": {
    "importancia": "critico|alto|medio|bajo",
    "riesgo_general": "bajo|medio|alto",
    "confiabilidad": 0.0,
    "recomendacion_estado": "aprobado|pendiente_revision|rechazar|investigar"
  },
  "tendencias": [
    {"aspecto": "aspecto_analizado", "tendencia": "subiendo|bajando|estable", "magnitud": "%, valor", "periodo": "últimos X meses"}
  ],
  "riesgos": [
    {"tipo": "tipo_riesgo", "severidad": "baja|media|alta", "descripcion": "descripción del riesgo", "impacto_potencial": "impacto si ocurre"}
  ],
  "oportunidades": [
    {"tipo": "tipo_oportunidad", "beneficio_potencial": "valor o %", "probabilidad": "baja|media|alta", "accion": "acción para aprovechar"}
  ],
  "recomendaciones_estrategicas": [
    {"prioridad": "alta|media|baja", "tipo": "renegociacion|alternativas|profundizar|auditar", "descripcion": "descripción", "beneficio_estimado": "valor"}
  ],
  "alertas_especiales": [
    {"alerta": "descripción de alerta", "nivel": "info|warning|error|critico"}
  ],
  "score_relacion": 0.0,
  "confianza_analisis": 0.85
}`;
}

/**
 * Simula análisis de LLM (sin llamada real, solo estructura)
 * Para testing y validación del flujo
 * @param {string} markdown - Markdown a analizar
 * @param {string} type - 'invoice' | 'provider'
 * @returns {Object} Análisis simulado
 */
function simulateLLMAnalysis(markdown, type = 'invoice') {
  if (type === 'invoice') {
    return {
      validacion: {
        campos_faltantes: [],
        campos_incompletos: [],
        campos_sospechosos: []
      },
      anomalias: [],
      alertas: [
        {
          tipo: 'formato_consistente',
          nivel: 'info',
          mensaje: 'Markdown estructurado correctamente procesable',
          accion_recomendada: 'Continuar con análisis'
        }
      ],
      insights: [
        {
          titulo: 'Estructura clara',
          descripcion: 'La factura cuenta con todas las secciones requeridas',
          impacto: 'Facilita análisis automático y validación'
        }
      ],
      recomendaciones: [
        {
          prioridad: 'media',
          categoria: 'validacion',
          accion: 'Validar que líneas de producto sumen correctamente',
          beneficio: 'Prevenir discrepancias matemáticas'
        }
      ],
      score_calidad: 0.85,
      confianza_analisis: 0.85
    };
  } else if (type === 'provider') {
    return {
      clasificacion_proveedor: {
        importancia: 'medio',
        riesgo_general: 'bajo',
        confiabilidad: 0.8,
        recomendacion_estado: 'pendiente_revision'
      },
      tendencias: [
        {
          aspecto: 'volumen_facturas',
          tendencia: 'estable',
          magnitud: '0%',
          periodo: 'últimos 3 meses'
        }
      ],
      riesgos: [],
      oportunidades: [
        {
          tipo: 'renegociacion',
          beneficio_potencial: '5-10%',
          probabilidad: 'media',
          accion: 'Solicitar revisión de precios en próxima orden'
        }
      ],
      recomendaciones_estrategicas: [
        {
          prioridad: 'media',
          tipo: 'profundizar',
          descripcion: 'Establecer SLA y términos de pago formales',
          beneficio_estimado: 'Mejora de confiabilidad y claridad'
        }
      ],
      alertas_especiales: [
        {
          alerta: 'Proveedor sin validación formal',
          nivel: 'warning'
        }
      ],
      score_relacion: 0.7,
      confianza_analisis: 0.85
    };
  }
  
  return null;
}

/**
 * Procesa análisis de LLM y extrae datos estructurados
 * @param {Object} llmResponse - Respuesta del LLM en JSON
 * @returns {Object} Datos estructurados normalizados
 */
function processLLMResponse(llmResponse) {
  if (!llmResponse) return null;
  
  return {
    validacion: llmResponse.validacion || {},
    anomalias: llmResponse.anomalias || [],
    alertas: llmResponse.alertas || [],
    insights: llmResponse.insights || [],
    recomendaciones: llmResponse.recomendaciones || [],
    recomendaciones_estrategicas: llmResponse.recomendaciones_estrategicas || [],
    clasificacion: llmResponse.clasificacion_proveedor,
    score_calidad: llmResponse.score_calidad,
    score_relacion: llmResponse.score_relacion,
    confianza: llmResponse.confianza_analisis || 0.85,
    timestamp: new Date().toISOString()
  };
}

/**
 * Convierte análisis a alertas visuales para UI
 * @param {Object} analysis - Análisis procesado
 * @returns {Array} Alertas formateadas para UI
 */
function analysisToUIAlerts(analysis) {
  if (!analysis) return [];
  
  const alerts = [];
  
  // Agregar alertas del análisis
  if (analysis.alertas) {
    analysis.alertas.forEach((alert) => {
      alerts.push({
        type: alert.nivel === 'error' || alert.nivel === 'critico' ? 'danger' : alert.nivel === 'warning' ? 'warning' : 'info',
        message: alert.mensaje || alert.alerta,
        action: alert.accion_recomendada || alert.accion
      });
    });
  }
  
  // Agregar anomalías como alertas de warning
  if (analysis.anomalias && analysis.anomalias.length > 0) {
    alerts.push({
      type: analysis.anomalias[0].severidad === 'alta' ? 'danger' : 'warning',
      message: `Se detectaron ${analysis.anomalias.length} anomalía(s) en los datos`,
      action: 'Revisar sección de Anomalías'
    });
  }
  
  // Agregar recomendaciones de alta prioridad
  if (analysis.recomendaciones) {
    analysis.recomendaciones
      .filter((r) => r.prioridad === 'alta')
      .slice(0, 2)
      .forEach((rec) => {
        alerts.push({
          type: 'warning',
          message: rec.accion,
          action: rec.beneficio
        });
      });
  }
  
  return alerts;
}

export {
  generateInvoiceAnalysisPrompt,
  generateProviderAnalysisPrompt,
  simulateLLMAnalysis,
  processLLMResponse,
  analysisToUIAlerts,
};
