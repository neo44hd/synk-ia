/**
 * DOCBRAIN SERVICE - El Cerebro Magico de Archivo Inteligente
 *
 * Pipeline completo: Archivo entra -> se lee -> se entiende -> se clasifica -> se archiva
 * Auto-crea proveedores, detecta duplicados, asigna rutas inteligentes.
 *
 * Migrado: localStorage → /api/data (persistencia en servidor)
 * Entidades: document (existente), docbrainqueue, docbrainlog
 */

import { invoiceExtractor, DOCUMENT_TYPES } from './invoiceExtractorService';
import { base44 } from '@/api/base44Client';

// ==========================================
// CONSTANTES Y CONFIGURACION
// ==========================================

const API_QUEUE = '/api/data/docbrainqueue';
const API_LOG = '/api/data/docbrainlog';
const API_DOCS = '/api/data/document';
const MAX_LOG_ENTRIES = 500;

// Cachés en memoria
let _processedCache = null;
let _logCache = null;

// Helpers API
async function apiFetch(url, options = {}) {
  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[DocBrain] API no disponible:', err.message);
    return null;
  }
}

async function apiBulkReplace(endpoint, records) {
  return apiFetch(`${endpoint}/bulk`, {
    method: 'PUT',
    body: JSON.stringify({ records, merge: false }),
  });
}

// Secciones de negocio para clasificacion
const BUSINESS_SECTIONS = {
  PROVEEDORES: { id: 'proveedores', label: 'Proveedores', icon: 'Truck', color: 'blue' },
  CLIENTES: { id: 'clientes', label: 'Clientes', icon: 'Users', color: 'green' },
  EMPLEADOS: { id: 'empleados', label: 'Empleados', icon: 'UserCheck', color: 'emerald' },
  FISCAL: { id: 'fiscal', label: 'Fiscal', icon: 'Scale', color: 'cyan' },
  LEGAL: { id: 'legal', label: 'Legal', icon: 'FileSignature', color: 'purple' },
  OPERACIONES: { id: 'operaciones', label: 'Operaciones', icon: 'Settings', color: 'orange' },
  OTROS: { id: 'otros', label: 'Otros', icon: 'File', color: 'zinc' }
};

// Reglas de clasificacion
const CLASSIFICATION_RULES = {
  factura: {
    defaultSection: 'proveedores',
    pathTemplate: (data) => {
      const provider = data.provider?.name?.value || 'Sin_Nombre';
      const date = data.invoiceDate?.value || new Date().toISOString().split('T')[0];
      const year = date.substring(0, 4);
      const month = date.substring(5, 7);
      return `/Proveedores/${sanitizePath(provider)}/Facturas/${year}/${month}/`;
    }
  },
  nomina: {
    defaultSection: 'empleados',
    pathTemplate: (data) => {
      const name = data.provider?.name?.value || 'Empleado';
      const date = data.invoiceDate?.value || new Date().toISOString().split('T')[0];
      const year = date.substring(0, 4);
      const month = date.substring(5, 7);
      return `/Empleados/${sanitizePath(name)}/Nominas/${year}/${month}/`;
    }
  },
  albaran: {
    defaultSection: 'proveedores',
    pathTemplate: (data) => {
      const provider = data.provider?.name?.value || 'Sin_Nombre';
      const date = data.invoiceDate?.value || new Date().toISOString().split('T')[0];
      const year = date.substring(0, 4);
      return `/Proveedores/${sanitizePath(provider)}/Albaranes/${year}/`;
    }
  },
  contrato: {
    defaultSection: 'legal',
    pathTemplate: (data) => {
      const entity = data.provider?.name?.value || 'General';
      const year = new Date().getFullYear();
      return `/Legal/Contratos/${sanitizePath(entity)}/${year}/`;
    }
  },
  legal: {
    defaultSection: 'legal',
    pathTemplate: () => {
      const year = new Date().getFullYear();
      return `/Legal/Documentos/${year}/`;
    }
  },
  otros: {
    defaultSection: 'otros',
    pathTemplate: () => {
      const year = new Date().getFullYear();
      const month = String(new Date().getMonth() + 1).padStart(2, '0');
      return `/Otros/${year}/${month}/`;
    }
  }
};

function sanitizePath(str) {
  if (!str) return 'Sin_Nombre';
  return str
    .replace(/[^a-zA-Z0-9\s\-_áéíóúñÁÉÍÓÚÑ]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 50)
    .trim() || 'Sin_Nombre';
}

// ==========================================
// DOCBRAIN - CLASE PRINCIPAL
// ==========================================

class DocBrainService {
  constructor() {
    this.processedDocs = [];
    this.activityLog = [];
    this._initialized = false;
  }

  async _ensureLoaded() {
    if (this._initialized) return;
    this._initialized = true;
    this.processedDocs = await this._loadProcessed();
    this.activityLog = await this._loadLog();
  }

  // ========================================
  // PIPELINE PRINCIPAL
  // ========================================

  async processDocument(file, text = null, emailContext = null) {
    await this._ensureLoaded();
    const startTime = Date.now();
    const docId = 'doc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);

    try {
      let extractedText = text;
      if (!extractedText && file) {
        extractedText = await this._extractText(file);
      }

      if (!extractedText || extractedText.trim().length < 10) {
        return this._createResult(docId, file, 'error', {
          error: 'No se pudo extraer texto del documento',
          processingTime: Date.now() - startTime
        });
      }

      const extracted = invoiceExtractor.extractInvoiceData(extractedText);
      const classification = this._classifyDocument(extracted, emailContext);
      const entityResult = await this._resolveEntity(extracted, classification);
      const isDuplicate = this._checkDuplicate(extracted);

      const result = this._createResult(docId, file, isDuplicate ? 'duplicate' : 'processed', {
        extracted,
        classification,
        entity: entityResult,
        isDuplicate,
        emailContext: emailContext || null,
        processingTime: Date.now() - startTime,
        confidence: extracted.confidence || 0
      });

      if (!isDuplicate) {
        await this._saveDocument(result);
        if (classification.docType === 'factura' && extracted.total?.value) {
          await this._createInvoiceRecord(result);
        }
      }

      await this._logActivity({
        action: isDuplicate ? 'duplicate_detected' : 'document_processed',
        docId,
        docType: classification.docType,
        section: classification.section,
        entityName: entityResult.name,
        entityCreated: entityResult.wasCreated,
        confidence: extracted.confidence,
        path: classification.suggestedPath,
        fileName: file?.name || emailContext?.attachmentName || 'unknown'
      });

      return result;

    } catch (error) {
      console.error('DocBrain processing error:', error);
      await this._logActivity({
        action: 'processing_error',
        docId,
        error: error.message,
        fileName: file?.name || 'unknown'
      });
      return this._createResult(docId, file, 'error', {
        error: error.message,
        processingTime: Date.now() - startTime
      });
    }
  }

  // ========================================
  // EXTRACCION DE TEXTO
  // ========================================

  async _extractText(file) {
    const type = file.type || '';
    const name = (file.name || '').toLowerCase();

    if (type === 'application/pdf' || name.endsWith('.pdf')) {
      return await this._extractFromPDF(file);
    }
    if (type.startsWith('image/') || /\.(jpg|jpeg|png|gif|bmp|tiff|webp)$/.test(name)) {
      return await this._extractFromImage(file);
    }
    if (type.startsWith('text/') || name.endsWith('.txt') || name.endsWith('.csv')) {
      return await file.text();
    }
    if (type === 'text/xml' || type === 'application/xml' || name.endsWith('.xml')) {
      return await this._extractFromXML(file);
    }
    try {
      return await file.text();
    } catch {
      return null;
    }
  }

  async _extractFromPDF(file) {
    try {
      if (typeof window !== 'undefined' && window.pdfjsLib) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map(item => item.str).join(' ');
          fullText += pageText + '\n';
        }
        if (fullText.trim().length > 20) return fullText;
      }
      return await file.text();
    } catch (error) {
      console.warn('PDF extraction failed, trying raw text:', error);
      try { return await file.text(); } catch { return null; }
    }
  }

  async _extractFromImage(file) {
    try {
      const { default: ocrService } = await import('./ocrService');
      if (ocrService && ocrService.recognizeImage) {
        const result = await ocrService.recognizeImage(file);
        return result?.text || null;
      }
      return null;
    } catch (error) {
      console.warn('OCR extraction failed:', error);
      return null;
    }
  }

  async _extractFromXML(file) {
    try {
      const xmlText = await file.text();
      const cleanText = xmlText.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      return cleanText;
    } catch {
      return null;
    }
  }

  // ========================================
  // CLASIFICACION INTELIGENTE
  // ========================================

  _classifyDocument(extracted, emailContext = null) {
    const docType = extracted.documentType?.id || 'otros';
    const rule = CLASSIFICATION_RULES[docType] || CLASSIFICATION_RULES.otros;

    let section = rule.defaultSection;

    if (docType === 'factura') {
      if (emailContext?.direction === 'outbound') {
        section = 'clientes';
      }
    }
    if (docType === 'nomina') {
      section = 'empleados';
    }

    const suggestedPath = rule.pathTemplate(extracted);

    return {
      docType,
      section,
      sectionInfo: BUSINESS_SECTIONS[section.toUpperCase()] || BUSINESS_SECTIONS.OTROS,
      suggestedPath,
      rule: rule.defaultSection,
      confidence: extracted.confidence || 0
    };
  }

  // ========================================
  // RESOLUCION DE ENTIDADES
  // ========================================

  async _resolveEntity(extracted, classification) {
    const providerName = extracted.provider?.name?.value;
    const providerCIF = extracted.provider?.cif?.value;
    const providerEmail = extracted.provider?.email?.value;

    if (!providerName && !providerCIF) {
      return { id: null, name: 'Desconocido', wasCreated: false, isNew: false };
    }

    try {
      const existingProviders = await base44.entities.Provider.list();

      let found = null;
      if (providerCIF) {
        found = existingProviders.find(p =>
          p.cif === providerCIF || p.tax_id === providerCIF
        );
      }
      if (!found && providerName) {
        const normalizedName = providerName.toLowerCase().replace(/\s+/g, ' ').trim();
        found = existingProviders.find(p => {
          const pName = (p.name || p.company_name || '').toLowerCase().replace(/\s+/g, ' ').trim();
          return pName === normalizedName ||
                 pName.includes(normalizedName) ||
                 normalizedName.includes(pName);
        });
      }

      if (found) {
        return {
          id: found.id,
          name: found.name || found.company_name,
          wasCreated: false,
          isNew: false
        };
      }

      if (classification.section === 'proveedores' || classification.docType === 'factura') {
        const newProvider = await base44.entities.Provider.create({
          name: providerName || 'Proveedor ' + (providerCIF || 'Nuevo'),
          company_name: providerName,
          cif: providerCIF || '',
          tax_id: providerCIF || '',
          email: providerEmail || '',
          category: this._guessCategory(extracted),
          status: 'active',
          created_by: 'docbrain_ia',
          created_date: new Date().toISOString().split('T')[0],
          notes: 'Creado automaticamente por DocBrain IA'
        });

        await this._logActivity({
          action: 'provider_auto_created',
          entityName: providerName,
          entityCIF: providerCIF,
          entityId: newProvider?.id
        });

        return {
          id: newProvider?.id,
          name: providerName,
          wasCreated: true,
          isNew: true
        };
      }

      return { id: null, name: providerName || 'Desconocido', wasCreated: false, isNew: false };

    } catch (error) {
      console.warn('Entity resolution error:', error);
      return { id: null, name: providerName || 'Desconocido', wasCreated: false, isNew: false, error: error.message };
    }
  }

  _guessCategory(extracted) {
    const text = (extracted.rawText || '').toLowerCase();
    if (/aliment|comida|bebida|fruta|verdura|carne|pescado|pan|lacteo/i.test(text)) return 'alimentacion';
    if (/limpieza|higiene|detergente|desinfect/i.test(text)) return 'limpieza';
    if (/electricidad|luz|gas|agua|suministro|energia/i.test(text)) return 'suministros';
    if (/alquiler|renta|arrendamiento/i.test(text)) return 'alquiler';
    if (/seguro|poliza|cobertura/i.test(text)) return 'seguros';
    if (/telefon|internet|movil|fibra|datos/i.test(text)) return 'telecomunicaciones';
    if (/transporte|envio|mensajer|logistic/i.test(text)) return 'transporte';
    if (/mantenimiento|reparacion|averia/i.test(text)) return 'mantenimiento';
    return 'general';
  }

  // ========================================
  // DETECCION DE DUPLICADOS
  // ========================================

  _checkDuplicate(extracted) {
    const invoiceNum = extracted.invoiceNumber?.value;
    const providerCIF = extracted.provider?.cif?.value;
    const total = extracted.total?.value;
    const date = extracted.invoiceDate?.value;

    if (!invoiceNum && !total) return false;

    return this.processedDocs.some(doc => {
      if (invoiceNum && doc.invoiceNumber === invoiceNum && doc.providerCIF === providerCIF) {
        return true;
      }
      if (providerCIF && doc.providerCIF === providerCIF &&
          doc.total === total && doc.date === date) {
        return true;
      }
      return false;
    });
  }

  // ========================================
  // ALMACENAMIENTO (API)
  // ========================================

  _createResult(docId, file, status, data = {}) {
    return {
      id: docId,
      status,
      fileName: file?.name || data.emailContext?.attachmentName || 'unknown',
      fileType: file?.type || 'unknown',
      fileSize: file?.size || 0,
      ...data,
      timestamp: new Date().toISOString()
    };
  }

  async _saveDocument(result) {
    this.processedDocs.push({
      docId: result.id,
      invoiceNumber: result.extracted?.invoiceNumber?.value,
      providerCIF: result.extracted?.provider?.cif?.value,
      total: result.extracted?.total?.value,
      date: result.extracted?.invoiceDate?.value,
      path: result.classification?.suggestedPath,
      timestamp: result.timestamp
    });
    await this._saveProcessed();

    // Guardar documento completo en API
    try {
      const docRecord = {
        id: result.id,
        fileName: result.fileName,
        docType: result.classification?.docType,
        section: result.classification?.section,
        suggestedPath: result.classification?.suggestedPath,
        entityName: result.entity?.name,
        entityCreated: result.entity?.wasCreated,
        total: result.extracted?.total?.value,
        providerName: result.extracted?.provider?.name?.value,
        providerCIF: result.extracted?.provider?.cif?.value,
        invoiceNumber: result.extracted?.invoiceNumber?.value,
        invoiceDate: result.extracted?.invoiceDate?.value,
        confidence: result.confidence,
        status: result.status,
        timestamp: result.timestamp
      };
      await apiFetch(API_DOCS, {
        method: 'POST',
        body: JSON.stringify(docRecord),
      });
    } catch (e) {
      console.warn('[DocBrain] Error guardando documento en API:', e.message);
    }
  }

  async _createInvoiceRecord(result) {
    try {
      await base44.entities.Invoice.create({
        invoice_number: result.extracted?.invoiceNumber?.value || result.id,
        provider_name: result.extracted?.provider?.name?.value || 'Desconocido',
        provider_id: result.entity?.id,
        total: result.extracted?.total?.value || 0,
        subtotal: result.extracted?.subtotal?.value || null,
        iva: result.extracted?.iva?.value || null,
        invoice_date: result.extracted?.invoiceDate?.value || new Date().toISOString().split('T')[0],
        due_date: result.extracted?.dueDate?.value || null,
        status: 'pendiente',
        category: this._guessCategory(result.extracted),
        source: 'docbrain_ia',
        file_name: result.fileName,
        confidence: result.confidence,
        notes: `Procesado automaticamente por DocBrain. Confianza: ${result.confidence}%`
      });
    } catch (error) {
      console.warn('Error creating invoice record:', error);
    }
  }

  // ========================================
  // ESTADISTICAS Y LOG
  // ========================================

  async getStats() {
    await this._ensureLoaded();
    try {
      const result = await apiFetch(`${API_DOCS}?sort=-timestamp&limit=1000`);
      const docs = result?.data || [];
      const today = new Date().toISOString().split('T')[0];
      const todayDocs = docs.filter(d => d.timestamp?.startsWith(today));

      const byType = {};
      const bySection = {};
      let totalAutoCreated = 0;
      let totalConfidence = 0;

      docs.forEach(d => {
        byType[d.docType] = (byType[d.docType] || 0) + 1;
        bySection[d.section] = (bySection[d.section] || 0) + 1;
        if (d.entityCreated) totalAutoCreated++;
        totalConfidence += d.confidence || 0;
      });

      return {
        totalProcessed: docs.length,
        processedToday: todayDocs.length,
        byDocumentType: byType,
        bySection: bySection,
        providersAutoCreated: totalAutoCreated,
        averageConfidence: docs.length > 0 ? Math.round(totalConfidence / docs.length) : 0,
        lastDocument: docs[0] || null,
        recentDocuments: docs.slice(0, 20)
      };
    } catch (e) {
      console.warn('[DocBrain] Error obteniendo stats:', e.message);
      return {
        totalProcessed: 0, processedToday: 0,
        byDocumentType: {}, bySection: {},
        providersAutoCreated: 0, averageConfidence: 0,
        lastDocument: null, recentDocuments: []
      };
    }
  }

  async getActivityLog(limit = 50) {
    await this._ensureLoaded();
    return this.activityLog.slice(0, limit);
  }

  async getDocuments(filters = {}) {
    try {
      const result = await apiFetch(`${API_DOCS}?sort=-timestamp&limit=1000`);
      let docs = result?.data || [];

      if (filters.section) {
        docs = docs.filter(d => d.section === filters.section);
      }
      if (filters.docType) {
        docs = docs.filter(d => d.docType === filters.docType);
      }
      if (filters.status) {
        docs = docs.filter(d => d.status === filters.status);
      }
      if (filters.search) {
        const q = filters.search.toLowerCase();
        docs = docs.filter(d =>
          (d.providerName || '').toLowerCase().includes(q) ||
          (d.fileName || '').toLowerCase().includes(q) ||
          (d.invoiceNumber || '').toLowerCase().includes(q)
        );
      }

      return docs;
    } catch (e) {
      console.warn('[DocBrain] Error obteniendo documentos:', e.message);
      return [];
    }
  }

  async processBatch(files, emailContext = null) {
    const results = [];
    for (const file of files) {
      const result = await this.processDocument(file, null, emailContext);
      results.push(result);
    }

    const summary = {
      total: results.length,
      processed: results.filter(r => r.status === 'processed').length,
      duplicates: results.filter(r => r.status === 'duplicate').length,
      errors: results.filter(r => r.status === 'error').length,
      providersCreated: results.filter(r => r.entity?.wasCreated).length,
      results
    };

    await this._logActivity({
      action: 'batch_processed',
      total: summary.total,
      processed: summary.processed,
      duplicates: summary.duplicates,
      errors: summary.errors
    });

    return summary;
  }

  // ========================================
  // HELPERS DE STORAGE (API)
  // ========================================

  async _loadProcessed() {
    if (_processedCache) return _processedCache;
    try {
      const result = await apiFetch(`${API_QUEUE}?sort=-created_date`);
      _processedCache = result?.data || [];
      return _processedCache;
    } catch {
      return [];
    }
  }

  async _saveProcessed() {
    const trimmed = this.processedDocs.slice(-2000);
    _processedCache = trimmed;
    const records = trimmed.map((d, i) => ({ id: d.docId || `q_${i}`, ...d }));
    await apiBulkReplace(API_QUEUE, records);
  }

  async _loadLog() {
    if (_logCache) return _logCache;
    try {
      const result = await apiFetch(`${API_LOG}?sort=-created_date&limit=${MAX_LOG_ENTRIES}`);
      _logCache = result?.data || [];
      return _logCache;
    } catch {
      return [];
    }
  }

  async _logActivity(entry) {
    const record = {
      ...entry,
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      timestamp: new Date().toISOString()
    };
    this.activityLog.unshift(record);
    const trimmed = this.activityLog.slice(0, MAX_LOG_ENTRIES);
    this.activityLog = trimmed;
    _logCache = trimmed;

    // Guardar en API
    await apiFetch(API_LOG, {
      method: 'POST',
      body: JSON.stringify(record),
    });
  }

  async clearAll() {
    this.processedDocs = [];
    this.activityLog = [];
    _processedCache = null;
    _logCache = null;
    await apiBulkReplace(API_QUEUE, []);
    await apiBulkReplace(API_LOG, []);
    await apiBulkReplace(API_DOCS, []);
  }
}

// Singleton
export const docBrain = new DocBrainService();
export { DOCUMENT_TYPES, BUSINESS_SECTIONS, CLASSIFICATION_RULES };
export default docBrain;
