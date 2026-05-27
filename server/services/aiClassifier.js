/**
 * AI Classifier Service
 * Clasificación automática de documentos con reglas locales + Ollama
 * 
 * Categorías:
 * - Tipo: Factura, Presupuesto, Contrato, PO, Recibo, Otro
 * - Departamento: Compras, RRHH, Legal, Finanzas, IT, Otro
 * - Urgencia: Normal, Urgente, Critical
 * - Estado: Nuevo, Procesado, Archivado
 */

import { OllamaService } from './ollamaService.js';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// Rutas de datos
const DATA_DIR = process.env.DATA_DIR || './data';
const CLASSIFICATIONS_FILE = join(DATA_DIR, 'classifications.json');

// Palabras clave para reglas
const KEYWORDS = {
  tipo: {
    'Factura': ['factura', 'invoice', 'fact.', 'f-', 'nif', 'cif', 'eur', '€', 'total:', 'subtotal'],
    'Presupuesto': ['presupuesto', 'cotización', 'quote', 'budget', 'proposal', 'estimado'],
    'Contrato': ['contrato', 'agreement', 'terms', 'acuerdo', 'términos', 'cláusula', 'confidencial'],
    'PO': ['purchase order', 'po', 'pedido', 'orden de compra', 'order number'],
    'Recibo': ['recibo', 'receipt', 'comprobante', 'talón', 'tíquet'],
  },
  departamento: {
    'Compras': ['compra', 'proveedor', 'producto', 'suministro', 'pedido', 'adquisición'],
    'RRHH': ['empleado', 'nómina', 'vacaciones', 'contrato laboral', 'recursos humanos', 'personal'],
    'Legal': ['contrato', 'acuerdo', 'término', 'confidencial', 'legal', 'derecho'],
    'Finanzas': ['factura', 'pago', 'presupuesto', 'tesorería', 'contabilidad', 'balance'],
    'IT': ['software', 'licencia', 'servidor', 'infraestructura', 'sistema', 'tech'],
  },
  urgencia: {
    'Critical': ['crítico', 'urgente', 'inmediato', 'critical', 'asap', 'hoy', 'ya'],
    'Urgente': ['urgente', 'rápido', 'pronto', 'urgent', 'fast', 'soon', 'vencido', 'vence'],
    'Normal': [], // por defecto
  },
  estado: {
    'Procesado': ['procesado', 'revisado', 'aprobado', 'ok', 'pagado', 'realizado'],
    'Archivado': ['archivado', 'antiguo', '2024', '2023'],
    'Nuevo': [], // por defecto
  }
};

// Ponderación de palabras clave
const KEYWORD_WEIGHTS = {
  tipo: 1.0,
  departamento: 0.8,
  urgencia: 0.9,
  estado: 0.7
};

class AIClassifier {
  constructor() {
    this.classifications = this.loadClassifications();
    this.ollamaAvailable = null; // null = no verificado, true/false después
  }

  /**
   * Cargar historial de clasificaciones
   */
  loadClassifications() {
    if (!existsSync(CLASSIFICATIONS_FILE)) {
      return { feedback: [], stats: { total: 0, correct: 0 } };
    }
    try {
      return JSON.parse(readFileSync(CLASSIFICATIONS_FILE, 'utf-8'));
    } catch {
      return { feedback: [], stats: { total: 0, correct: 0 } };
    }
  }

  /**
   * Guardar historial de clasificaciones
   */
  saveClassifications() {
    try {
      writeFileSync(CLASSIFICATIONS_FILE, JSON.stringify(this.classifications, null, 2));
    } catch (err) {
      console.error('[AIClassifier] Error saving classifications:', err.message);
    }
  }

  /**
   * Verificar disponibilidad de Ollama
   */
  async checkOllamaAvailability() {
    if (this.ollamaAvailable !== null) return this.ollamaAvailable;
    try {
      const available = await OllamaService.isAvailable();
      this.ollamaAvailable = available;
      return available;
    } catch {
      this.ollamaAvailable = false;
      return false;
    }
  }

  /**
   * Clasificación basada en reglas locales
   */
  classifyByRules(text) {
    const lowerText = text.toLowerCase().substring(0, 5000); // limitar a 5k chars
    const results = {};

    // Clasificación de Tipo
    results.tipo = this.matchCategory('tipo', lowerText);

    // Clasificación de Departamento
    results.departamento = this.matchCategory('departamento', lowerText);

    // Clasificación de Urgencia
    results.urgencia = this.matchCategory('urgencia', lowerText);

    // Clasificación de Estado
    results.estado = this.matchCategory('estado', lowerText);

    return results;
  }

  /**
   * Encontrar categoría con mejor puntuación
   */
  matchCategory(categoryType, text) {
    const categoryKeywords = KEYWORDS[categoryType];
    const scores = {};

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      let score = 0;
      for (const keyword of keywords) {
        const count = (text.match(new RegExp(keyword, 'g')) || []).length;
        score += count;
      }
      scores[category] = score;
    }

    // Encontrar mejor match
    const bestMatch = Object.entries(scores).reduce((prev, current) =>
      current[1] > prev[1] ? current : prev,
      ['Otro', 0]
    );

    return {
      value: bestMatch[0],
      confidence: Math.min(100, Math.round((bestMatch[1] / 3) * 10)), // conf 0-100%
      scores: scores
    };
  }

  /**
   * Enriquecimiento con Ollama (si disponible)
   */
  async enrichWithOllama(text, classification) {
    const available = await this.checkOllamaAvailability();
    if (!available) {
      return classification; // Return classification as-is if Ollama unavailable
    }

    try {
      const model = process.env.OLLAMA_MODEL || 'harmonic-hermes-9b:latest';
      const prompt = this.buildClassificationPrompt(text, classification);

      // Llamar a Ollama via fetch
      const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt,
          stream: false,
          temperature: 0.3,
          num_predict: 200,
        }),
        signal: AbortSignal.timeout(15000), // 15s timeout
      });

      if (!response.ok) {
        console.warn('[AIClassifier] Ollama response not ok:', response.status);
        return classification;
      }

      const data = await response.json();
      const ollamaResult = this.parseOllamaResponse(data.response);

      // Fusionar resultados
      return this.mergeClassifications(classification, ollamaResult);
    } catch (err) {
      console.warn('[AIClassifier] Ollama enrichment failed:', err.message);
      return classification; // Fallback a reglas
    }
  }

  /**
   * Construir prompt para Ollama
   */
  buildClassificationPrompt(text, classification) {
    const preview = text.substring(0, 2000);
    return `Classifica el siguiente documento.

Texto:
${preview}

Tipo actual: ${classification.tipo.value} (conf: ${classification.tipo.confidence}%)
Departamento actual: ${classification.departamento.value} (conf: ${classification.departamento.confidence}%)
Urgencia actual: ${classification.urgencia.value} (conf: ${classification.urgencia.confidence}%)
Estado actual: ${classification.estado.value} (conf: ${classification.estado.confidence}%)

Valores posibles:
- Tipo: Factura, Presupuesto, Contrato, PO, Recibo, Otro
- Departamento: Compras, RRHH, Legal, Finanzas, IT, Otro
- Urgencia: Normal, Urgente, Critical
- Estado: Nuevo, Procesado, Archivado

Responde en JSON exacto: {"tipo":"value","departamento":"value","urgencia":"value","estado":"value"}`;
  }

  /**
   * Parsear respuesta de Ollama
   */
  parseOllamaResponse(text) {
    try {
      // Buscar JSON en la respuesta
      const jsonMatch = text.match(/\{[^{}]*\}/);
      if (!jsonMatch) return null;
      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validar estructura
      if (!parsed.tipo || !parsed.departamento || !parsed.urgencia || !parsed.estado) {
        return null;
      }

      return {
        tipo: { value: parsed.tipo, confidence: 75 },
        departamento: { value: parsed.departamento, confidence: 70 },
        urgencia: { value: parsed.urgencia, confidence: 75 },
        estado: { value: parsed.estado, confidence: 65 },
        source: 'ollama'
      };
    } catch {
      return null;
    }
  }

  /**
   * Fusionar clasificaciones (reglas + Ollama)
   */
  mergeClassifications(rules, ollama) {
    if (!ollama) return rules;

    return {
      tipo: this.mergeSingleClassification(rules.tipo, ollama.tipo),
      departamento: this.mergeSingleClassification(rules.departamento, ollama.departamento),
      urgencia: this.mergeSingleClassification(rules.urgencia, ollama.urgencia),
      estado: this.mergeSingleClassification(rules.estado, ollama.estado),
    };
  }

  /**
   * Fusionar una clasificación individual
   */
  mergeSingleClassification(rules, ollama) {
    // Si Ollama tiene confianza alta, usarlo
    if (ollama && ollama.confidence > 70) {
      return {
        value: ollama.value,
        confidence: Math.round((rules.confidence + ollama.confidence) / 2),
        source: 'merged'
      };
    }
    // Si no, usar reglas
    return rules;
  }

  /**
   * Clasificación completa de un documento/texto
   */
  async classify(text, metadata = {}) {
    if (!text || text.trim().length === 0) {
      throw new Error('Text cannot be empty');
    }

    // Reglas locales
    const ruleClassification = this.classifyByRules(text);

    // Enriquecimiento con Ollama
    const enrichedClassification = await this.enrichWithOllama(text, ruleClassification);

    // Preparar resultado
    const result = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      classification: enrichedClassification,
      metadata: {
        textLength: text.length,
        ...metadata
      },
      feedback: null,
      ollamaUsed: await this.checkOllamaAvailability()
    };

    // Guardar para aprendizaje
    this.classifications.feedback.push(result);
    this.classifications.stats.total += 1;
    this.saveClassifications();

    return result;
  }

  /**
   * Registrar feedback del usuario
   */
  recordFeedback(classificationId, correctedValues) {
    const idx = this.classifications.feedback.findIndex(f => f.id === classificationId);
    if (idx === -1) return false;

    this.classifications.feedback[idx].feedback = correctedValues;
    
    // Verificar si la corrección es útil para aprendizaje
    const original = this.classifications.feedback[idx].classification;
    let correct = true;
    for (const category of Object.keys(correctedValues)) {
      if (original[category]?.value !== correctedValues[category]) {
        correct = false;
        break;
      }
    }

    if (correct) {
      this.classifications.stats.correct += 1;
    }

    this.saveClassifications();
    return true;
  }

  /**
   * Obtener estadísticas del clasificador
   */
  getStats() {
    const stats = this.classifications.stats;
    const accuracy = stats.total > 0 ? 
      Math.round((stats.correct / stats.total) * 100) : 0;

    return {
      total_classifications: stats.total,
      correct_classifications: stats.correct,
      accuracy_percentage: accuracy,
      classifications_per_category: this.getBreakdown(),
    };
  }

  /**
   * Desglose de clasificaciones por categoría
   */
  getBreakdown() {
    const breakdown = {
      tipo: {},
      departamento: {},
      urgencia: {},
      estado: {}
    };

    for (const item of this.classifications.feedback) {
      const { classification } = item;
      for (const [category, values] of Object.entries(classification)) {
        const value = values.value || 'Desconocido';
        breakdown[category][value] = (breakdown[category][value] || 0) + 1;
      }
    }

    return breakdown;
  }

  /**
   * Generar ID único
   */
  generateId() {
    return `cls_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export default new AIClassifier();
