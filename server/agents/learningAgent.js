/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LEARNING AGENT — Análisis de Feedback y Mejoras Continuas
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Responsabilidades:
 * 1. Analizar patrones en el feedback del usuario
 * 2. Identificar áreas de mejora
 * 3. Proponer optimizaciones a otros agentes
 * 4. Generar reportes de insights
 * 5. Coordinar reentrenamiento incremental
 * 
 * Integración con LLM local (Ollama) para análisis inteligente
 */

import learningEngine from '../services/learningEngine.js';
import { gatewayChatMessages } from '../services/agentCore.js';

const GATEWAY_MODEL = process?.env?.CHAT_MODEL || 'local-fast';

// ─────────────────────────────────────────────────────────────────────────────
// LLM HELPER — delega al gateway centralizado
// ─────────────────────────────────────────────────────────────────────────────

async function llm(messages, { maxTokens = 1000, temp = 0.5 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  try {
    const { content } = await gatewayChatMessages({
      messages,
      model: GATEWAY_MODEL,
      temperature: temp,
      maxTokens,
    });
    return content?.trim() || '';
  } catch (err) {
    console.error('[LEARNING AGENT] LLM error:', err.message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ANÁLISIS DE FEEDBACK
// ─────────────────────────────────────────────────────────────────────────────

export async function analyzeFeedback() {
  try {
    const metrics = await learningEngine.calculateMetrics();
    const history = await learningEngine.getImprovalHistory({ limit: 20 });

    // Construir contexto para el análisis
    const context = `
MÉTRICAS ACTUALES:
- Precisión global: ${metrics.globalAccuracy}%
- Predicciones totales: ${metrics.totalPredictions}
- Predicciones corregidas: ${metrics.correctedPredictions}
- Confianza promedio: ${metrics.averageConfidence}
- Calidad de feedback: ${metrics.averageQuality}/5
- Utilidad: ${metrics.averageUsefulness}/5

ANOMALÍAS DETECTADAS: ${metrics.anomalies.length}
${metrics.anomalies.map(a => `- [${a.severity}] ${a.message}`).join('\n')}

HISTORIAL RECIENTE (últimas 20 correcciones):
${history.map(h => `- ${h.type} (${h.agentName}): ${h.isCorrect ? '✓' : '✗'}`).join('\n')}

TENDENCIAS:
- Últimos 7 días: ${metrics.recentTrend.last7Days}%
- Últimos 30 días: ${metrics.recentTrend.last30Days}%
`;

    const analysis = await llm([
      {
        role: 'system',
        content: `Eres un analista de mejora continua para SynK-IA. 
Analiza las métricas y anomalías reportadas.
Proporciona insights accionables y recomendaciones específicas para mejorar la precisión.
Sé conciso y enfócate en problemas críticos.`,
      },
      {
        role: 'user',
        content: `${context}\n\nAnaliza estos datos y proporciona 3-5 recomendaciones de mejora prioritarias.`,
      },
    ], { maxTokens: 1500, temp: 0.3 });

    return {
      analysis: analysis || 'No se pudo generar análisis',
      metricsSnapshot: metrics,
      generatedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error('[LEARNING AGENT] analyzeFeedback error:', err);
    return { error: err.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GENERAR INSIGHTS
// ─────────────────────────────────────────────────────────────────────────────

export async function generateInsights() {
  try {
    const metrics = await learningEngine.calculateMetrics();
    const trainingData = await learningEngine.getTrainingData({ minSamples: 3 });

    const insights = [];

    // Insight 1: Tipos con mejor desempeño
    const topTypes = Object.entries(metrics.byType)
      .filter(([_, stats]) => stats.corrected >= 3)
      .sort((a, b) => b[1].accuracy - a[1].accuracy)
      .slice(0, 3);

    if (topTypes.length > 0) {
      insights.push({
        type: 'strength',
        title: 'Tipos de predicción con mayor precisión',
        message: topTypes.map(([t, s]) => `${t}: ${Math.round(s.accuracy)}%`).join(', '),
      });
    }

    // Insight 2: Tipos con bajo desempeño
    const lowTypes = Object.entries(metrics.byType)
      .filter(([_, stats]) => stats.corrected >= 3 && stats.accuracy < 70)
      .sort((a, b) => a[1].accuracy - b[1].accuracy)
      .slice(0, 3);

    if (lowTypes.length > 0) {
      insights.push({
        type: 'weakness',
        title: 'Tipos que necesitan mejora',
        message: lowTypes.map(([t, s]) => `${t}: ${Math.round(s.accuracy)}%`).join(', '),
      });
    }

    // Insight 3: Tendencia de mejora
    if (metrics.recentTrend.last7Days > metrics.recentTrend.last30Days) {
      insights.push({
        type: 'positive_trend',
        title: 'Tendencia ascendente',
        message: `Mejora en últimos 7 días (${metrics.recentTrend.last7Days}% vs ${metrics.recentTrend.last30Days}% en 30 días)`,
      });
    } else if (metrics.recentTrend.last7Days < metrics.recentTrend.last30Days) {
      insights.push({
        type: 'negative_trend',
        title: 'Tendencia descendente',
        message: `Degradación en últimos 7 días (${metrics.recentTrend.last7Days}% vs ${metrics.recentTrend.last30Days}% en 30 días)`,
      });
    }

    // Insight 4: Disponibilidad de datos para reentrenamiento
    const readyTypes = Object.entries(trainingData.byType)
      .map(([t, samples]) => ({ type: t, samples: samples.length }))
      .filter(x => x.samples >= 5);

    if (readyTypes.length > 0) {
      insights.push({
        type: 'retraining_ready',
        title: 'Tipos listos para reentrenamiento',
        message: readyTypes.map(x => `${x.type} (${x.samples} muestras)`).join(', '),
      });
    }

    // Insight 5: Feedback disponible
    if (metrics.averageQuality > 3.5) {
      insights.push({
        type: 'high_quality_feedback',
        title: 'Feedback del usuario es de alta calidad',
        message: `Calidad promedio: ${Math.round(metrics.averageQuality * 10) / 10}/5`,
      });
    }

    return {
      insights,
      totalInsights: insights.length,
      generatedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error('[LEARNING AGENT] generateInsights error:', err);
    return { error: err.message, insights: [] };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RECOMENDACIONES DE OPTIMIZACIÓN
// ─────────────────────────────────────────────────────────────────────────────

export async function getOptimizationRecommendations() {
  try {
    const metrics = await learningEngine.calculateMetrics();
    const recommendations = [];

    // 1. Focus en tipos bajos
    const lowAccuracy = Object.entries(metrics.byType)
      .filter(([_, stats]) => stats.corrected >= 5 && stats.accuracy < 65);

    if (lowAccuracy.length > 0) {
      recommendations.push({
        priority: 'high',
        category: 'model_improvement',
        title: 'Optimizar prompts de agentes de bajo rendimiento',
        action: `Revisar y ajustar prompts del sistema para: ${lowAccuracy.map(([t]) => t).join(', ')}`,
        estimatedImpact: 'Podría mejorar precisión en 10-15%',
      });
    }

    // 2. Overconfidence
    if (metrics.anomalies.some(a => a.type === 'overconfidence')) {
      recommendations.push({
        priority: 'high',
        category: 'calibration',
        title: 'Calibrar scores de confianza',
        action: 'Los modelos predicen con confianza alta pero cometen errores. Reducir temperatura o ajustar threshold.',
        estimatedImpact: 'Mejor detección de errores, más alertas útiles',
      });
    }

    // 3. Reentrenamiento
    const trainingReady = await learningEngine.getTrainingData({ minSamples: 10 });
    if (Object.keys(trainingReady.byType).length > 0) {
      recommendations.push({
        priority: 'medium',
        category: 'retraining',
        title: 'Realizar reentrenamiento incremental',
        action: `Datos listos para ${Object.keys(trainingReady.byType).length} tipos: ${Object.keys(trainingReady.byType).join(', ')}`,
        estimatedImpact: 'Mejora adaptativa basada en feedback real',
      });
    }

    // 4. Aumento de muestras
    const lowSampleTypes = Object.entries(metrics.byType)
      .filter(([_, stats]) => stats.corrected < 5 && stats.total > 0)
      .map(([t]) => t);

    if (lowSampleTypes.length > 0) {
      recommendations.push({
        priority: 'low',
        category: 'data_collection',
        title: 'Recolectar más datos de ciertos tipos',
        action: `Estos tipos tienen pocas correcciones: ${lowSampleTypes.join(', ')}`,
        estimatedImpact: 'Mejor evaluación de desempeño, métricas más confiables',
      });
    }

    // 5. Quality feedback
    if (metrics.averageQuality < 3) {
      recommendations.push({
        priority: 'medium',
        category: 'user_engagement',
        title: 'Mejorar forma de recopilar feedback',
        action: 'El feedback del usuario tiene baja calidad (< 3/5). Simplificar o incentivar feedback más detallado.',
        estimatedImpact: 'Mejor comprensión de qué falla y por qué',
      });
    }

    return {
      recommendations,
      totalRecommendations: recommendations.length,
      generatedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error('[LEARNING AGENT] getOptimizationRecommendations error:', err);
    return { error: err.message, recommendations: [] };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PREPARAR REPORTE DE APRENDIZAJE
// ─────────────────────────────────────────────────────────────────────────────

export async function generateLearningReport() {
  try {
    const metrics = await learningEngine.calculateMetrics();
    const analysis = await analyzeFeedback();
    const insights = await generateInsights();
    const recommendations = await getOptimizationRecommendations();

    return {
      summary: {
        totalPredictions: metrics.totalPredictions,
        correctedPredictions: metrics.correctedPredictions,
        globalAccuracy: metrics.globalAccuracy,
        averageConfidence: metrics.averageConfidence,
        feedback: {
          quality: metrics.averageQuality,
          usefulness: metrics.averageUsefulness,
        },
      },
      metrics,
      analysis,
      insights: insights.insights,
      recommendations: recommendations.recommendations,
      anomalies: metrics.anomalies,
      generatedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error('[LEARNING AGENT] generateLearningReport error:', err);
    return { error: err.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT COMO AGENTE COMPATIBLE CON ORQUESTADOR
// ─────────────────────────────────────────────────────────────────────────────

export async function process(input) {
  const { action = 'report', ...params } = input;

  switch (action) {
    case 'report':
      return await generateLearningReport();
    case 'analyze':
      return await analyzeFeedback();
    case 'insights':
      return await generateInsights();
    case 'recommendations':
      return await getOptimizationRecommendations();
    default:
      return await generateLearningReport();
  }
}

export default {
  process,
  analyzeFeedback,
  generateInsights,
  getOptimizationRecommendations,
  generateLearningReport,
};
