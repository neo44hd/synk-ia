/**
 * DOCBRAIN SERVICE - El Cerebro Magico de Archivo Inteligente
 * 
 * Pipeline completo: Archivo entra -> se lee -> se entiende -> se clasifica -> se archiva
 * Auto-crea proveedores, detecta duplicados, asigna rutas inteligentes.
 * 
 * Usa: invoiceExtractorService (regex), ocrService (Tesseract), dataService (localStorage)
 * Futuro: LLM local (Qwen2.5-7B) para clasificacion contextual avanzada
 */

import { invoiceExtractor, DOCUMENT_TYPES } from './invoiceExtractorService';
import { base44 } from '@/api/base44Client';

// ==========================================
// CONSTANTES Y CONFIGURACION
// ==========================================

const STORAGE_KEY = 'docbrain_processed';
const STORAGE_LOG = 'docbrain_activity_log';
const MAX_LOG_ENTRIES = 500;

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

// Reglas de clasificacion por tipo de documento + contexto
const CLASSIFICATION_RULES = {
  factura: {
    // Si tiene CIF de empresa conocida como proveedor -> proveedores
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

// Utilidad para limpiar nombres de ruta
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
    this.processedDocs = this._loadProcessed();
    this.activityLog = this._loadLog();
  }

  // ========================================
  // PIPELINE PRINCIPAL - LA MAGIA
  // ========================================

  /**
   * Procesa un archivo completo: extrae, clasifica, archiva, crea entidades
   * @param {File} file - Archivo subido
   * @param {string} text - Texto ya extraido (si viene de OCR o PDF previo)
   * @param {object} emailContext - Contexto del email si viene del harvester
   * @returns {object} Resultado completo del procesamiento
   */
  async processDocument(file, text = null, emailContext = null) {
    const startTime = Date.now();
    const docId = 'doc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);

    try {
      // PASO 1: Extraer texto si no lo tenemos
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

      // PASO 2: Extraer datos estructurados (invoiceExtractor)
      const extracted = invoiceExtractor.extractInvoiceData(extractedText);

      // PASO 3: Clasificar documento (tipo + seccion + ruta)
      const classification = this._classifyDocument(extracted, emailContext);

      // PASO 4: Buscar o crear entidad (proveedor/cliente/empleado)
      const entityResult = await this._resolveEntity(extracted, classification);

      // PASO 5: Detectar duplicados
      const isDuplicate = this._checkDuplicate(extracted);

      // PASO 6: Crear registro del documento procesado
      const result = this._createResult(docId, file, isDuplicate ? 'duplicate' : 'processed', {
        extracted,
        classification,
        entity: entityResult,
        isDuplicate,
        emailContext: emailContext || null,
        processingTime: Date.now() - startTime,
        confidence: extracted.confidence || 0
      });

      // PASO 7: Guardar en BD local
      if (!isDuplicate) {
        await this._saveDocument(result);
        // Si es factura, crear Invoice en el sistema
        if (classification.docType === 'factura' && extracted.total?.value) {
          await this._createInvoiceRecord(result);
        }
      }

      // PASO 8: Log de actividad
      this._logActivity({
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
      this._logActivity({
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

    // PDF -> usar pdf.js o texto plano si es texto-based PDF
    if (type === 'application/pdf' || name.endsWith('.pdf')) {
      return await this._extractFromPDF(file);
    }

    // Imagenes -> OCR con Tesseract
    if (type.startsWith('image/') || /\.(jpg|jpeg|png|gif|bmp|tiff|webp)$/.test(name)) {
      return await this._extractFromImage(file);
    }

    // Texto plano, CSV, etc
    if (type.startsWith('text/') || name.endsWith('.txt') || name.endsWith('.csv')) {
      return await file.text();
    }

    // XML (factura electronica)
    if (type === 'text/xml' || type === 'application/xml' || name.endsWith('.xml')) {
      return await this._extractFromXML(file);
    }

    // Fallback: intentar como texto
    try {
      return await file.text();
    } catch {
      return null;
    }
  }

  async _extractFromPDF(file) {
    try {
      // Intentar con pdf.js si esta disponible
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
      // Fallback: leer como texto bruto
      return await file.text();
    } catch (error) {
      console.warn('PDF extraction failed, trying raw text:', error);
      try { return await file.text(); } catch { return null; }
    }
  }

  async _extractFromImage(file) {
    try {
      // Usar OCR service si esta disponible
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
      // Extraer texto visible del XML (quitar tags)
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

    // Determinar seccion
    let section = rule.defaultSection;

    // Reglas contextuales avanzadas
    if (docType === 'factura') {
      // Si el email viene de un cliente conocido -> clientes
      if (emailContext?.direction === 'outbound') {
        section = 'clientes';
      }
    }
    if (docType === 'nomina') {
      section = 'empleados';
    }

    // Generar ruta sugerida
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
  // RESOLUCION DE ENTIDADES (AUTO-CREAR)
  // ========================================

  async _resolveEntity(extracted, classification) {
    const providerName = extracted.provider?.name?.value;
    const providerCIF = extracted.provider?.cif?.value;
    const providerEmail = extracted.provider?.email?.value;

    if (!providerName && !providerCIF) {
      return { id: null, name: 'Desconocido', wasCreated: false, isNew: false };
    }

    try {
      // Buscar proveedor existente por CIF o nombre
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

      // NO EXISTE -> CREAR AUTOMATICAMENTE
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

        this._logActivity({
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

  // Adivinar categoria del proveedor por contexto
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
      // Match exacto por numero de factura + CIF
      if (invoiceNum && doc.invoiceNumber === invoiceNum && doc.providerCIF === providerCIF) {
        return true;
      }
      // Match por CIF + total + fecha (misma factura sin numero)
      if (providerCIF && doc.providerCIF === providerCIF && 
          doc.total === total && doc.date === date) {
        return true;
      }
      return false;
    });
  }

  // ========================================
  // ALMACENAMIENTO
  // ========================================

  _createResult(docId, file, status, data = {}) {
    return {
      id: docId,
      status, // 'processed' | 'duplicate' | 'error' | 'pending_review'
      fileName: file?.name || data.emailContext?.attachmentName || 'unknown',
      fileType: file?.type || 'unknown',
      fileSize: file?.size || 0,
      ...data,
      timestamp: new Date().toISOString()
    };
  }

  async _saveDocument(result) {
    // Guardar en lista de procesados (para duplicados)
    this.processedDocs.push({
      docId: result.id,
      invoiceNumber: result.extracted?.invoiceNumber?.value,
      providerCIF: result.extracted?.provider?.cif?.value,
      total: result.extracted?.total?.value,
      date: result.extracted?.invoiceDate?.value,
      path: result.classification?.suggestedPath,
      timestamp: result.timestamp
    });
    this._saveProcessed();

    // Guardar documento completo en storage
    try {
      const docs = JSON.parse(localStorage.getItem('docbrain_documents') || '[]');
      docs.unshift({
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
      });
      // Limitar a 1000 documentos
      localStorage.setItem('docbrain_documents', JSON.stringify(docs.slice(0, 1000)));
    } catch (e) {
      console.warn('Error saving document to storage:', e);
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

  getStats() {
    const docs = JSON.parse(localStorage.getItem('docbrain_documents') || '[]');
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
  }

  getActivityLog(limit = 50) {
    return this.activityLog.slice(0, limit);
  }

  getDocuments(filters = {}) {
    let docs = JSON.parse(localStorage.getItem('docbrain_documents') || '[]');
    
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
  }

  // Procesar multiples archivos en batch
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

    this._logActivity({
      action: 'batch_processed',
      total: summary.total,
      processed: summary.processed,
      duplicates: summary.duplicates,
      errors: summary.errors
    });

    return summary;
  }

  // ========================================
  // HELPERS DE STORAGE
  // ========================================

  _loadProcessed() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch { return []; }
  }

  _saveProcessed() {
    try {
      const trimmed = this.processedDocs.slice(-2000);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch (e) {
      console.warn('Error saving processed docs:', e);
    }
  }

  _loadLog() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_LOG) || '[]');
    } catch { return []; }
  }

  _logActivity(entry) {
    this.activityLog.unshift({
      ...entry,
      timestamp: new Date().toISOString()
    });
    const trimmed = this.activityLog.slice(0, MAX_LOG_ENTRIES);
    this.activityLog = trimmed;
    try {
      localStorage.setItem(STORAGE_LOG, JSON.stringify(trimmed));
    } catch (e) {
      console.warn('Error saving activity log:', e);
    }
  }

  // Limpiar todo (reset)
  clearAll() {
    this.processedDocs = [];
    this.activityLog = [];
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_LOG);
    localStorage.removeItem('docbrain_documents');
  }
}

// Singleton
export const docBrain = new DocBrainService();
export { DOCUMENT_TYPES, BUSINESS_SECTIONS, CLASSIFICATION_RULES };
export default docBrain;
