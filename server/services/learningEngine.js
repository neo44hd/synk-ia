/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LEARNING ENGINE — Aprendizaje Continuo e Inteligencia Adaptativa
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Responsabilidades:
 * 1. Registrar predicciones y correcciones del usuario
 * 2. Calcular métricas de precisión (global y por tipo)
 * 3. Mantener historial de mejoras
 * 4. Detectar anomalías en patrones
 * 5. Preparar datos para reentrenamiento incremental
 * 
 * Almacenamiento:
 * - data/learning.json: registros de predicciones/correcciones
 * - data/learningFeedback.json: feedback del usuario
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const LEARNING_FILE = path.join(DATA_DIR, 'learning.json');
const FEEDBACK_FILE = path.join(DATA_DIR, 'learningFeedback.json');

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS DE LECTURA/ESCRITURA
// ─────────────────────────────────────────────────────────────────────────────

async function readLearningData() {
  try {
    const content = await fs.readFile(LEARNING_FILE, 'utf-8');
    return JSON.parse(content || '[]');
  } catch {
    return [];
  }
}

async function writeLearningData(data) {
  await fs.writeFile(LEARNING_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

async function readFeedbackData() {
  try {
    const content = await fs.readFile(FEEDBACK_FILE, 'utf-8');
    return JSON.parse(content || '[]');
  } catch {
    return [];
  }
}

async function writeFeedbackData(data) {
  await fs.writeFile(FEEDBACK_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// ─────────────────────────────────────────────────────────────────────────────
// REGISTRAR PREDICCIÓN
// ─────────────────────────────────────────────────────────────────────────────

export async function recordPrediction(input) {
  const {
    type,           // e.g., "document_classification", "price_extraction"
    prediction,     // predicción del modelo
    confidence,     // 0-1
    rawInput,       // entrada original
    agentName,      // qué agente hizo la predicción
  } = input;

  const record = {
    id: generateId(),
    type,
    prediction,
    confidence,
    rawInput: typeof rawInput === 'string' ? rawInput.slice(0, 500) : JSON.stringify(rawInput).slice(0, 500),
    agentName,
    timestamp: new Date().toISOString(),
    correction: null,           // se rellena después si hay feedback
    isCorrect: null,            // se calcula al recibir corrección
    correctionTimestamp: null,
    feedbackQuality: null,      // 1-5 (luego)
  };

  const data = await readLearningData();
  data.push(record);
  await writeLearningData(data);

  return record;
}

// ─────────────────────────────────────────────────────────────────────────────
// REGISTRAR CORRECCIÓN
// ─────────────────────────────────────────────────────────────────────────────

export async function recordCorrection(input) {
  const {
    predictionId,   // ID del record a corregir
    correction,     // valor correcto
    reason,         // por qué estuvo mal
    userEmail,      // quién corrige
  } = input;

  const data = await readLearningData();
  const record = data.find(r => r.id === predictionId);

  if (!record) {
    throw new Error(`Predicción ${predictionId} no encontrada`);
  }

  record.correction = correction;
  record.correctionTimestamp = new Date().toISOString();
  record.isCorrect = false; // asumimos que fue corregida, luego se verifica
  record.correctionReason = reason;
  record.correctedBy = userEmail;

  // Comparar si predicción == corrección
  if (compareValues(record.prediction, correction)) {
    record.isCorrect = true;
  }

  await writeLearningData(data);
  return record;
}

// ─────────────────────────────────────────────────────────────────────────────
// REGISTRAR FEEDBACK DEL USUARIO
// ─────────────────────────────────────────────────────────────────────────────

export async function recordFeedback(input) {
  const {
    predictionId,   // relacionado con este record
    quality,        // 1-5 (1=malo, 5=excelente)
    usefulness,     // 1-5 (1=inútil, 5=muy útil)
    suggestion,     // sugerencia de mejora
    userEmail,
  } = input;

  const feedback = {
    id: generateId(),
    predictionId,
    quality: Math.max(1, Math.min(5, quality || 3)),
    usefulness: Math.max(1, Math.min(5, usefulness || 3)),
    suggestion,
    userEmail,
    timestamp: new Date().toISOString(),
  };

  const feedbackData = await readFeedbackData();
  feedbackData.push(feedback);
  await writeFeedbackData(feedbackData);

  // Actualizar el record de predicción
  const data = await readLearningData();
  const record = data.find(r => r.id === predictionId);
  if (record) {
    record.feedbackQuality = quality;
    record.feedbackTimestamp = new Date().toISOString();
    await writeLearningData(data);
  }

  return feedback;
}

// ─────────────────────────────────────────────────────────────────────────────
// CALCULAR MÉTRICAS
// ─────────────────────────────────────────────────────────────────────────────

export async function calculateMetrics() {
  const data = await readLearningData();
  const feedbackData = await readFeedbackData();

  if (data.length === 0) {
    return {
      totalPredictions: 0,
      correctedPredictions: 0,
      globalAccuracy: 0,
      averageConfidence: 0,
      averageQuality: 0,
      averageUsefulness: 0,
      byType: {},
      recentTrend: { last7Days: 0, last30Days: 0 },
      anomalies: [],
    };
  }

  // Precisión global
  const corrected = data.filter(r => r.correction !== null);
  const correct = corrected.filter(r => r.isCorrect === true);
  const globalAccuracy = corrected.length > 0 ? (correct.length / corrected.length) * 100 : 0;

  // Por tipo
  const byType = {};
  data.forEach(r => {
    if (!byType[r.type]) {
      byType[r.type] = {
        total: 0,
        corrected: 0,
        correct: 0,
        accuracy: 0,
        avgConfidence: 0,
        avgQuality: 0,
        confidences: [],
        qualities: [],
      };
    }
    byType[r.type].total++;
    if (r.confidence) byType[r.type].confidences.push(r.confidence);
    if (r.feedbackQuality) byType[r.type].qualities.push(r.feedbackQuality);

    if (r.correction !== null) {
      byType[r.type].corrected++;
      if (r.isCorrect) byType[r.type].correct++;
    }
  });

  Object.keys(byType).forEach(type => {
    const t = byType[type];
    t.accuracy = t.corrected > 0 ? (t.correct / t.corrected) * 100 : 0;
    t.avgConfidence = t.confidences.length > 0
      ? t.confidences.reduce((a, b) => a + b, 0) / t.confidences.length
      : 0;
    t.avgQuality = t.qualities.length > 0
      ? t.qualities.reduce((a, b) => a + b, 0) / t.qualities.length
      : 0;
  });

  // Tendencias
  const now = new Date();
  const last7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const last30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const recentCorrections7 = corrected.filter(r => new Date(r.correctionTimestamp) > last7);
  const recentCorrections30 = corrected.filter(r => new Date(r.correctionTimestamp) > last30);

  const recentCorrect7 = recentCorrections7.filter(r => r.isCorrect).length;
  const recentCorrect30 = recentCorrections30.filter(r => r.isCorrect).length;

  const trend7 = recentCorrections7.length > 0 ? (recentCorrect7 / recentCorrections7.length) * 100 : 0;
  const trend30 = recentCorrections30.length > 0 ? (recentCorrect30 / recentCorrections30.length) * 100 : 0;

  // Promedio de confianza
  const avgConfidence = data.reduce((sum, r) => sum + (r.confidence || 0), 0) / data.length;

  // Feedback promedio
  const avgQuality = feedbackData.length > 0
    ? feedbackData.reduce((sum, f) => sum + f.quality, 0) / feedbackData.length
    : 0;

  const avgUsefulness = feedbackData.length > 0
    ? feedbackData.reduce((sum, f) => sum + f.usefulness, 0) / feedbackData.length
    : 0;

  // Detección de anomalías
  const anomalies = detectAnomalies(data, byType);

  return {
    totalPredictions: data.length,
    correctedPredictions: corrected.length,
    globalAccuracy: Math.round(globalAccuracy * 100) / 100,
    averageConfidence: Math.round(avgConfidence * 100) / 100,
    averageQuality: Math.round(avgQuality * 100) / 100,
    averageUsefulness: Math.round(avgUsefulness * 100) / 100,
    byType,
    recentTrend: {
      last7Days: Math.round(trend7 * 100) / 100,
      last30Days: Math.round(trend30 * 100) / 100,
    },
    anomalies,
    generatedAt: new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DETECCIÓN DE ANOMALÍAS
// ─────────────────────────────────────────────────────────────────────────────

function detectAnomalies(data, byType) {
  const anomalies = [];

  // 1. Tipos con baja precisión
  Object.entries(byType).forEach(([type, stats]) => {
    if (stats.corrected >= 10 && stats.accuracy < 70) {
      anomalies.push({
        severity: 'high',
        type: 'low_accuracy',
        message: `Tipo "${type}" con precisión baja (${Math.round(stats.accuracy)}%)`,
        metadata: { type, accuracy: stats.accuracy, sampleSize: stats.corrected },
      });
    }
  });

  // 2. Confianza alta pero predicciones incorrectas
  const highConfWrong = data.filter(
    r => r.correction && r.confidence > 0.8 && r.isCorrect === false
  );
  if (highConfWrong.length > 5) {
    anomalies.push({
      severity: 'medium',
      type: 'overconfidence',
      message: `${highConfWrong.length} predicciones con alta confianza pero incorrectas`,
      metadata: { count: highConfWrong.length },
    });
  }

  // 3. Agentes con bajo desempeño
  const byAgent = {};
  data.forEach(r => {
    if (!byAgent[r.agentName]) {
      byAgent[r.agentName] = { total: 0, correct: 0, corrected: 0 };
    }
    byAgent[r.agentName].total++;
    if (r.correction) {
      byAgent[r.agentName].corrected++;
      if (r.isCorrect) byAgent[r.agentName].correct++;
    }
  });

  Object.entries(byAgent).forEach(([agent, stats]) => {
    if (stats.corrected >= 5) {
      const acc = (stats.correct / stats.corrected) * 100;
      if (acc < 60) {
        anomalies.push({
          severity: 'high',
          type: 'low_agent_accuracy',
          message: `Agente "${agent}" con precisión baja (${Math.round(acc)}%)`,
          metadata: { agent, accuracy: acc, sampleSize: stats.corrected },
        });
      }
    }
  });

  // 4. Tendencia de degradación
  const last30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recent = data.filter(r => r.correctionTimestamp && new Date(r.correctionTimestamp) > last30);
  if (recent.length > 10) {
    const recentCorrect = recent.filter(r => r.isCorrect).length;
    const recentAcc = (recentCorrect / recent.length) * 100;
    if (recentAcc < 50) {
      anomalies.push({
        severity: 'critical',
        type: 'performance_degradation',
        message: `Degradación del desempeño en últimos 30 días (${Math.round(recentAcc)}%)`,
        metadata: { accuracy: recentAcc, recentSampleSize: recent.length },
      });
    }
  }

  return anomalies;
}

// ─────────────────────────────────────────────────────────────────────────────
// HISTORIAL DE MEJORAS
// ─────────────────────────────────────────────────────────────────────────────

export async function getImprovalHistory(options = {}) {
  const {
    limit = 50,
    startDate = null,
    endDate = null,
    type = null,
    agentName = null,
  } = options;

  const data = await readLearningData();
  let filtered = data.filter(r => r.correction !== null); // Solo registros corregidos

  // Filtrar por fecha
  if (startDate) {
    filtered = filtered.filter(r => new Date(r.correctionTimestamp) >= new Date(startDate));
  }
  if (endDate) {
    filtered = filtered.filter(r => new Date(r.correctionTimestamp) <= new Date(endDate));
  }

  // Filtrar por tipo
  if (type) {
    filtered = filtered.filter(r => r.type === type);
  }

  // Filtrar por agente
  if (agentName) {
    filtered = filtered.filter(r => r.agentName === agentName);
  }

  // Ordenar descendente por timestamp
  filtered.sort((a, b) => new Date(b.correctionTimestamp) - new Date(a.correctionTimestamp));

  return filtered.slice(0, limit);
}

// ─────────────────────────────────────────────────────────────────────────────
// PREPARAR DATOS PARA REENTRENAMIENTO
// ─────────────────────────────────────────────────────────────────────────────

export async function getTrainingData(options = {}) {
  const {
    type = null,
    minSamples = 5,
    onlyCorrect = false,
  } = options;

  const data = await readLearningData();
  let corrected = data.filter(r => r.correction !== null);

  if (type) {
    corrected = corrected.filter(r => r.type === type);
  }

  if (onlyCorrect) {
    corrected = corrected.filter(r => r.isCorrect === true);
  }

  // Agrupar por tipo
  const byType = {};
  corrected.forEach(r => {
    if (!byType[r.type]) byType[r.type] = [];
    byType[r.type].push({
      input: r.rawInput,
      prediction: r.prediction,
      correction: r.correction,
      confidence: r.confidence,
      timestamp: r.timestamp,
    });
  });

  // Filtrar tipos con al menos minSamples
  const result = {};
  Object.entries(byType).forEach(([t, samples]) => {
    if (samples.length >= minSamples) {
      result[t] = samples;
    }
  });

  return {
    totalSamples: corrected.length,
    byType: result,
    generatedAt: new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// BÚSQUEDA Y FILTRADO
// ─────────────────────────────────────────────────────────────────────────────

export async function searchRecords(query) {
  const data = await readLearningData();
  const q = query.toLowerCase();

  return data.filter(r =>
    r.type.toLowerCase().includes(q) ||
    r.agentName.toLowerCase().includes(q) ||
    (r.rawInput && r.rawInput.toLowerCase().includes(q)) ||
    (r.correction && JSON.stringify(r.correction).toLowerCase().includes(q))
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILIDADES
// ─────────────────────────────────────────────────────────────────────────────

function generateId() {
  return `learn_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function compareValues(val1, val2) {
  if (typeof val1 === 'string' && typeof val2 === 'string') {
    return val1.toLowerCase().trim() === val2.toLowerCase().trim();
  }
  if (typeof val1 === 'object' && typeof val2 === 'object') {
    return JSON.stringify(val1) === JSON.stringify(val2);
  }
  return val1 === val2;
}

export default {
  recordPrediction,
  recordCorrection,
  recordFeedback,
  calculateMetrics,
  getImprovalHistory,
  getTrainingData,
  searchRecords,
};
