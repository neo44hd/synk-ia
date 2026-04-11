/**
 * SYNK-IA Email Service - FASE 2A.1
 * Servicio mejorado para sincronización Gmail con clasificación IA
 * Migrado: localStorage.lastEmailSync → /api/data/emailintegration (persistencia en servidor)
 */

import { base44 } from '../api/base44Client';

const API_BASE = '/api/data/emailintegration';

// Constantes de configuración
const CONFIG = {
  MAX_EMAILS: 500,
  MONTHS_BACK: 2,
  BATCH_SIZE: 50,
};

// Categorías de clasificación
export const EMAIL_CATEGORIES = {
  FACTURA: { id: 'factura', label: 'Factura', icon: '📄', color: 'emerald' },
  PROVEEDOR: { id: 'proveedor', label: 'Proveedor', icon: '🏢', color: 'purple' },
  CLIENTE: { id: 'cliente', label: 'Cliente', icon: '👤', color: 'blue' },
  INTERNO: { id: 'interno', label: 'Interno', icon: '📧', color: 'amber' },
  MARKETING: { id: 'marketing', label: 'Marketing/Spam', icon: '📢', color: 'red' },
  RRHH: { id: 'rrhh', label: 'RRHH', icon: '👥', color: 'orange' },
  GESTORIA: { id: 'gestoria', label: 'Gestoría', icon: '📊', color: 'cyan' },
  OTROS: { id: 'otros', label: 'Otros', icon: '📬', color: 'gray' },
};

// Patrones para detección de facturas
const INVOICE_PATTERNS = [
  /factura/i, /invoice/i, /fra\./i, /nº\s*factura/i,
  /importe\s*total/i, /total\s*factura/i, /iva/i,
  /base\s*imponible/i, /vencimiento/i, /payment/i
];

const PROVIDER_PATTERNS = [
  /presupuesto/i, /pedido/i, /albarán/i, /delivery/i,
  /envío/i, /shipping/i, /order\s*confirmation/i
];

const MARKETING_PATTERNS = [
  /newsletter/i, /promoción/i, /oferta/i, /descuento/i,
  /unsubscribe/i, /baja\s*lista/i, /no\s*reply/i,
  /noreply/i, /marketing/i, /campaign/i
];

const RRHH_PATTERNS = [
  /nómina/i, /payroll/i, /vacaciones/i, /contrato/i,
  /baja\s*médica/i, /permiso/i, /recursos\s*humanos/i
];

// Helper para guardar lastSync en API
async function saveLastSync(timestamp) {
  try {
    // Intentar actualizar el registro existente o crear uno nuevo
    const res = await fetch(`${API_BASE}/bulk`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        records: [{ id: 'email_sync_meta', lastSync: timestamp }],
        merge: false
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (err) {
    console.warn('[EmailService] Error guardando lastSync:', err.message);
  }
}

async function getLastSync() {
  try {
    const res = await fetch(`${API_BASE}/email_sync_meta`, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.data?.lastSync || null;
  } catch (err) {
    console.warn('[EmailService] Error leyendo lastSync:', err.message);
    return null;
  }
}

class EmailService {
  constructor() {
    this.syncProgress = { current: 0, total: 0, status: 'idle' };
    this.listeners = [];
  }

  onProgressUpdate(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  _notifyProgress(progress) {
    this.syncProgress = progress;
    this.listeners.forEach(callback => callback(progress));
  }

  classifyEmail(email) {
    const subject = email.subject || '';
    const body = email.body_preview || email.snippet || '';
    const sender = email.sender_email || '';
    const content = `${subject} ${body} ${sender}`.toLowerCase();
    const hasAttachments = email.has_attachments || false;
    const attachmentNames = (email.attachments || []).map(a => a.filename || '').join(' ').toLowerCase();

    const hasInvoiceAttachment = attachmentNames.match(/factura|invoice|fra[\._-]/i) ||
      (hasAttachments && attachmentNames.match(/\.pdf$/i) && INVOICE_PATTERNS.some(p => subject.match(p)));

    if (hasInvoiceAttachment || INVOICE_PATTERNS.some(p => content.match(p))) {
      const isFromProvider = this._isFromProvider(sender);
      return {
        category: 'factura',
        confidence: 0.9,
        subCategory: isFromProvider ? 'factura_proveedor' : 'factura_cliente',
        tags: ['factura', hasInvoiceAttachment ? 'adjunto_pdf' : 'referencia'],
        priority: 'alta'
      };
    }

    if (MARKETING_PATTERNS.some(p => content.match(p))) {
      return {
        category: 'marketing',
        confidence: 0.85,
        subCategory: 'publicidad',
        tags: ['marketing', 'baja_prioridad'],
        priority: 'baja'
      };
    }

    if (RRHH_PATTERNS.some(p => content.match(p))) {
      return {
        category: 'rrhh',
        confidence: 0.8,
        subCategory: this._detectRRHHType(content),
        tags: ['rrhh', 'personal'],
        priority: 'media'
      };
    }

    if (this._isFromProvider(sender) || PROVIDER_PATTERNS.some(p => content.match(p))) {
      return {
        category: 'proveedor',
        confidence: 0.75,
        subCategory: 'comunicacion_proveedor',
        tags: ['proveedor'],
        priority: 'media'
      };
    }

    if (this._isInternalEmail(sender)) {
      return {
        category: 'interno',
        confidence: 0.9,
        subCategory: 'interno',
        tags: ['interno', 'equipo'],
        priority: 'media'
      };
    }

    if (this._isFromGestoria(sender) || content.match(/gestor|asesor|contab|fiscal|impuesto/i)) {
      return {
        category: 'gestoria',
        confidence: 0.7,
        subCategory: 'comunicacion_gestoria',
        tags: ['gestoria', 'fiscal'],
        priority: 'alta'
      };
    }

    if (content.match(/pedido|reserva|consulta|información|precio/i)) {
      return {
        category: 'cliente',
        confidence: 0.6,
        subCategory: 'consulta_cliente',
        tags: ['cliente'],
        priority: 'media'
      };
    }

    return {
      category: 'otros',
      confidence: 0.5,
      subCategory: 'sin_clasificar',
      tags: ['pendiente_revision'],
      priority: 'baja'
    };
  }

  _isFromProvider(email) {
    const providerDomains = [
      'makro.es', 'sysco.com', 'metro.es', 'fripozo.com',
      'transgourmet.es', 'coca-cola.com', 'damm.com',
      'schweppes.es', 'heineken.es', 'mahou.es'
    ];
    return providerDomains.some(d => email.includes(d));
  }

  _isInternalEmail(email) {
    const companyDomain = 'chickenpalace.es';
    return email.includes(companyDomain);
  }

  _isFromGestoria(email) {
    return email.match(/gestoria|asesoria|contable|fiscal|deloitte|kpmg|pwc/i);
  }

  _detectRRHHType(content) {
    if (content.match(/nómina|payroll/i)) return 'nomina';
    if (content.match(/vacaciones/i)) return 'vacaciones';
    if (content.match(/contrato/i)) return 'contrato';
    if (content.match(/baja/i)) return 'baja';
    return 'general';
  }

  analyzeAttachments(email) {
    const attachments = email.attachments || [];
    const analysis = {
      total: attachments.length,
      pdfs: [],
      invoices: [],
      images: [],
      others: []
    };

    attachments.forEach(att => {
      const filename = (att.filename || '').toLowerCase();
      const mimeType = att.mimeType || '';

      if (mimeType.includes('pdf') || filename.endsWith('.pdf')) {
        analysis.pdfs.push(att);
        if (filename.match(/factura|invoice|fra[\._-]/i)) {
          analysis.invoices.push({
            ...att,
            isInvoice: true,
            confidence: 0.9
          });
        }
      } else if (mimeType.includes('image')) {
        analysis.images.push(att);
      } else {
        analysis.others.push(att);
      }
    });

    return analysis;
  }

  generateAISummary(email) {
    const subject = email.subject || '';
    const body = email.body_preview || '';

    let summary = '';

    if (body.length > 200) {
      const sentences = body.split(/[.!?]+/).filter(s => s.trim().length > 20);
      summary = sentences[0] ? sentences[0].trim().substring(0, 150) + '...' : '';
    } else {
      summary = body.trim();
    }

    let actionRequired = null;
    if (body.match(/urgente|inmediato|fecha\s*límite|deadline/i)) {
      actionRequired = 'Requiere atención urgente';
    } else if (body.match(/confirmar|responder|contestar/i)) {
      actionRequired = 'Requiere respuesta';
    } else if (body.match(/pago|abonar|transferencia/i)) {
      actionRequired = 'Revisar pago pendiente';
    } else if (body.match(/adjunto|documento|fichero/i)) {
      actionRequired = 'Revisar documentos adjuntos';
    }

    return {
      summary,
      actionRequired,
      keyEntities: this._extractKeyEntities(body)
    };
  }

  _extractKeyEntities(text) {
    const entities = [];

    const amounts = text.match(/(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)\s*€/g);
    if (amounts) {
      entities.push({ type: 'amount', values: amounts });
    }

    const dates = text.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/g);
    if (dates) {
      entities.push({ type: 'date', values: dates });
    }

    const refs = text.match(/(?:ref|nº|num|factura)[:\s]*([A-Z0-9\-\/]+)/gi);
    if (refs) {
      entities.push({ type: 'reference', values: refs });
    }

    return entities;
  }

  async syncEmails(options = {}) {
    const {
      maxEmails = CONFIG.MAX_EMAILS,
      monthsBack = CONFIG.MONTHS_BACK,
      folders = ['INBOX', 'SENT']
    } = options;

    this._notifyProgress({
      status: 'starting',
      current: 0,
      total: maxEmails,
      message: 'Iniciando sincronización...'
    });

    try {
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - monthsBack);

      this._notifyProgress({
        status: 'fetching',
        current: 0,
        total: maxEmails,
        message: 'Conectando con Gmail...'
      });

      const response = await base44.functions.invoke("smartEmailProcessor", {
        maxResults: maxEmails,
        startDate: startDate.toISOString(),
        folders: folders
      });

      if (response.data?.success) {
        const emails = response.data.results?.emails || [];

        this._notifyProgress({
          status: 'classifying',
          current: 0,
          total: emails.length,
          message: 'Clasificando emails con IA...'
        });

        const classifiedEmails = [];
        for (let i = 0; i < emails.length; i++) {
          const email = emails[i];
          const classification = this.classifyEmail(email);
          const aiAnalysis = this.generateAISummary(email);
          const attachmentAnalysis = this.analyzeAttachments(email);

          classifiedEmails.push({
            ...email,
            ai_category: classification.category,
            ai_confidence: classification.confidence,
            ai_tags: classification.tags,
            ai_priority: classification.priority,
            ai_summary: aiAnalysis.summary,
            ai_action: aiAnalysis.actionRequired,
            attachment_analysis: attachmentAnalysis
          });

          if (i % 10 === 0) {
            this._notifyProgress({
              status: 'classifying',
              current: i,
              total: emails.length,
              message: `Clasificando emails... ${i}/${emails.length}`
            });
          }
        }

        // Guardar timestamp de última sincronización en API
        await saveLastSync(new Date().toISOString());

        this._notifyProgress({
          status: 'complete',
          current: emails.length,
          total: emails.length,
          message: `Sincronización completada: ${emails.length} emails procesados`
        });

        return {
          success: true,
          emails: classifiedEmails,
          stats: {
            total: classifiedEmails.length,
            byCategory: this._countByCategory(classifiedEmails),
            withAttachments: classifiedEmails.filter(e => e.has_attachments).length,
            invoicesDetected: classifiedEmails.filter(e => e.ai_category === 'factura').length
          }
        };
      } else {
        throw new Error(response.data?.error || 'Error en sincronización');
      }
    } catch (error) {
      this._notifyProgress({
        status: 'error',
        current: 0,
        total: 0,
        message: `Error: ${error.message}`
      });
      throw error;
    }
  }

  _countByCategory(emails) {
    return emails.reduce((acc, email) => {
      const cat = email.ai_category || 'otros';
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    }, {});
  }

  async processInvoiceAttachments(emails) {
    const invoiceEmails = emails.filter(e =>
      e.ai_category === 'factura' && e.attachment_analysis?.invoices?.length > 0
    );

    const results = [];
    for (const email of invoiceEmails) {
      for (const invoice of email.attachment_analysis.invoices) {
        try {
          const invoiceData = {
            source_email_id: email.id,
            filename: invoice.filename,
            sender_email: email.sender_email,
            sender_name: email.sender_name,
            received_date: email.received_date,
            status: 'pending_review',
            auto_detected: true
          };

          const provider = await this._findOrCreateProvider(email);
          if (provider) {
            invoiceData.provider_id = provider.id;
            invoiceData.provider_name = provider.name;
          }

          results.push({
            success: true,
            invoice: invoiceData,
            provider
          });
        } catch (error) {
          results.push({
            success: false,
            error: error.message,
            email_id: email.id
          });
        }
      }
    }

    return results;
  }

  async _findOrCreateProvider(email) {
    try {
      const providers = await base44.entities.Provider.filter({
        email: email.sender_email
      });

      if (providers.length > 0) {
        return providers[0];
      }

      const providerName = email.sender_name ||
        email.sender_email.split('@')[0].replace(/[._-]/g, ' ');

      const newProvider = await base44.entities.Provider.create({
        name: providerName,
        email: email.sender_email,
        status: 'active',
        auto_created: true,
        source: 'email_detection'
      });

      return newProvider;
    } catch (error) {
      console.error('Error finding/creating provider:', error);
      return null;
    }
  }

  async getEmailStats() {
    try {
      const allEmails = await base44.entities.EmailMessage.list("-received_date", 500);

      const lastSync = await getLastSync();

      const stats = {
        total: allEmails.length,
        unread: allEmails.filter(e => !e.is_read).length,
        byCategory: {},
        byPriority: { alta: 0, media: 0, baja: 0 },
        withAttachments: allEmails.filter(e => e.has_attachments).length,
        invoices: allEmails.filter(e => e.category === 'factura').length,
        lastSync: lastSync,
        recentActivity: allEmails.filter(e => {
          const date = new Date(e.received_date);
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          return date > weekAgo;
        }).length
      };

      Object.values(EMAIL_CATEGORIES).forEach(cat => {
        stats.byCategory[cat.id] = allEmails.filter(e => e.category === cat.id).length;
      });

      allEmails.forEach(e => {
        if (e.priority && stats.byPriority[e.priority] !== undefined) {
          stats.byPriority[e.priority]++;
        }
      });

      return stats;
    } catch (error) {
      console.error('Error getting email stats:', error);
      return null;
    }
  }
}

export const emailService = new EmailService();
export default emailService;
