/**
 * SYNK-IA — Data Sync Service
 * =============================
 *
 * Sincroniza datos entre las fuentes de procesamiento (filemanager_docs.json,
 * entities.json, emails.json) y la API genérica (document.json, provider.json,
 * invoice.json, emailmessage.json, client.json).
 *
 * FUENTE ÚNICA de documentos: filemanager_docs.json (pipeline nuevo).
 *   - El pipeline antiguo (documents.json / proxy V3) fue ELIMINADO.
 *
 * Se ejecuta:
 *   1. Automáticamente después de cada processDocument()
 *   2. Automáticamente después de cada ciclo del emailAgent
 *   3. Al arrancar el servidor (migración inicial)
 */

import fs from 'fs';
import path from 'path';
import { DATA_DIR } from '../routes/data.js';

function readJSON(file) {
  const p = path.join(DATA_DIR, file);
  if (!fs.existsSync(p)) return [];
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return []; }
}

function readJSONObj(file, def = {}) {
  const p = path.join(DATA_DIR, file);
  if (!fs.existsSync(p)) return def;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return def; }
}

function writeJSON(file, data) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(path.join(DATA_DIR, `${file}`), JSON.stringify(data, null, 2), 'utf8');
}

function generateId() {
  return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// ─── Normalización de valores numéricos ──────────────────────────────────
function toNum(val) {
  if (val == null) return 0;
  if (Array.isArray(val)) {
    return val.reduce((sum, v) => sum + (parseFloat(v) || 0), 0);
  }
  if (typeof val === 'string') return parseFloat(val.replace(',', '.')) || 0;
  return typeof val === 'number' ? val : 0;
}

// ─── Normalizar un documento de filemanager_docs.json ────────────────────
function normalizeFilemanagerDoc(doc) {
  const a = doc.analysis || {};
  const importes = a.importes || {};
  return {
    id: doc.id,
    nombre_archivo: doc.original_name || 'Sin título',
    mime_type: doc.mime_type,
    paginas: doc.extraction?.metadata?.total_pages || null,
    metodo_extraccion: doc.extraction?.method || null,
    procesado: doc.created_at || doc.extraction?.metadata?.processed_at || null,
    estado: doc.status === 'processed' ? 'procesado' : (doc.status || null),
    filePath: doc.file_path || null,
    organizacion: doc.organization ? {
      folder_path: doc.organization.folder_path || null,
      normalized_name: doc.organization.normalized_name || null,
      destination: doc.organization.destination || null,
    } : null,
    analisis: {
      tipo: a.tipo || 'otro',
      subtipo: a.subtipo || '',
      fecha: a.fechas?.documento || null,
      fecha_vencimiento: a.fechas?.vencimiento || null,
      emisor: a.emisor || {},
      receptor: a.receptor || {},
      trabajador: a.trabajador || null,
      numero_documento: a.referencias?.numero_documento || '',
      base_imponible: toNum(importes.base_imponible),
      iva_total: toNum(importes.iva_total),
      total: toNum(importes.total),
      moneda: importes.moneda || 'EUR',
      forma_pago: a.forma_pago || '',
      conceptos: (a.conceptos || []).map(c => ({
        descripcion: c.descripcion,
        cantidad: c.cantidad,
        precio_unitario: c.precio_unitario,
        iva_porcentaje: c.iva_porcentaje,
        total: toNum(c.total)
      })),
      resumen: a.resumen || '',
      confianza: a.confianza || 0,
      tags: a.tags || []
    }
  };
}

// ─── Normalizar un documento del store nativo (documents.json) ────────────
// documents.json es la fuente real del pipeline de email/upload (processDocument).
// Su shape ya es casi el normalizado; solo aseguramos números con toNum().
function normalizeNativeDoc(doc) {
  const a = doc.analisis || {};
  return {
    id: doc.id || doc._id,
    nombre_archivo: doc.nombre_archivo || 'Sin título',
    mime_type: doc.mime_type,
    paginas: doc.paginas || null,
    metodo_extraccion: doc.metodo_extraccion || null,
    procesado: doc.procesado || null,
    estado: doc.estado || null,
    filePath: doc.filePath || null,
    organizacion: doc.organizacion || null,
    analisis: {
      tipo: a.tipo || 'otro',
      subtipo: a.subtipo || '',
      fecha: a.fecha || null,
      fecha_vencimiento: a.fecha_vencimiento || null,
      emisor: a.emisor || {},
      receptor: a.receptor || {},
      trabajador: a.trabajador || null,
      numero_documento: a.numero_documento || '',
      base_imponible: toNum(a.base_imponible),
      iva_total: toNum(a.iva_total),
      total: toNum(a.total),
      moneda: a.moneda || 'EUR',
      forma_pago: a.forma_pago || '',
      conceptos: (a.conceptos || []).map(c => ({
        descripcion: c.descripcion,
        cantidad: c.cantidad,
        precio_unitario: c.precio_unitario,
        iva_porcentaje: c.iva_porcentaje,
        total: toNum(c.total)
      })),
      resumen: a.resumen || '',
      confianza: a.confianza || 0,
      tags: a.tags || []
    }
  };
}

// ─── Obtener todos los documentos (store nativo documents.json + legacy) ──
// El pipeline de email/upload escribe en documents.json ({ documents: [...] }).
// Mantenemos compatibilidad con filemanager_docs.json (legacy) por si quedan
// documentos antiguos solo allí. Dedup por id.
function getAllDocs() {
  const byId = new Map();

  const native = readJSONObj('documents.json', { documents: [] });
  for (const doc of (native.documents || [])) {
    if (!doc.id && !doc._id) continue;
    const n = normalizeNativeDoc(doc);
    byId.set(n.id, n);
  }

  const fm = readJSON('filemanager_docs.json');
  for (const doc of fm) {
    if (!doc.id || byId.has(doc.id)) continue;
    byId.set(doc.id, normalizeFilemanagerDoc(doc));
  }

  return [...byId.values()];
}

// ─── Sync documents → document.json ─────────────────────────────────────
function syncDocuments() {
  const allDocs = getAllDocs();
  const existing = readJSON('document.json');
  const existingSourceIds = new Set(existing.map(d => d.source_id));

  let added = 0;
  for (const doc of allDocs) {
    if (existingSourceIds.has(doc.id)) continue;

    const a = doc.analisis;
    existing.push({
      id: generateId(),
      source_id: doc.id,
      title: doc.nombre_archivo,
      type: a.tipo,
      date: a.fecha || doc.procesado,
      provider_name: a.emisor?.nombre || '',
      provider_cif: a.emisor?.cif_nif || '',
      summary: a.resumen,
      total: a.total,
      status: 'procesado',
      file_name: doc.nombre_archivo,
      mime_type: doc.mime_type,
      pages: doc.paginas,
      extraction_method: doc.metodo_extraccion,
      created_date: doc.procesado || new Date().toISOString(),
      updated_date: new Date().toISOString()
    });
    added++;
  }

  if (added > 0) {
    writeJSON('document.json', existing);
    console.log(`[SYNC] Documents: +${added} (${existing.length} total)`);
  }
  return added;
}

// ─── Sync providers: entities.json + emisores → provider.json ───────────
function syncProviders() {
  const entities = readJSONObj('entities.json', { proveedores: [], clientes: [] });
  // entities.json del pipeline usa claves en inglés (providers/clients);
  // mantenemos compatibilidad con las antiguas en español.
  const rawProviders = entities.providers || entities.proveedores || [];
  const existing = readJSON('provider.json');
  const existingNames = new Set(existing.map(p => (p.name || '').toLowerCase().trim()));
  const existingCifs = new Set(existing.map(p => p.cif).filter(Boolean));
  const existingSourceIds = new Set(existing.map(p => p.source_id));

  let added = 0;

  for (const prov of rawProviders) {
    if (existingSourceIds.has(prov.id)) continue;
    if (existingNames.has((prov.nombre || '').toLowerCase().trim())) continue;

    const name = prov.nombre || 'Sin nombre';
    existing.push({
      id: generateId(),
      source_id: prov.id,
      name,
      cif: prov.cif_nif || '',
      address: prov.direccion || '',
      email: prov.email || '',
      phone: prov.telefono || '',
      category: 'otros',
      status: 'activo',
      rating: 3,
      total_invoices: prov.facturas || 0,
      last_invoice_date: prov.ultima_factura || null,
      created_date: prov.creado || new Date().toISOString(),
      updated_date: new Date().toISOString()
    });
    existingNames.add(name.toLowerCase().trim());
    if (prov.cif_nif) existingCifs.add(prov.cif_nif);
    added++;
  }

  const allDocs = getAllDocs();
  const EXCLUDED_PROVIDERS = ['jose riquer', 'josé riquer', 'chicken palace'];
  for (const doc of allDocs) {
    const emisor = doc.analisis?.emisor;
    if (!emisor || !emisor.nombre) continue;
    if (emisor.rol === 'empresa' || emisor.rol === 'cliente') continue;
    if (EXCLUDED_PROVIDERS.some(ex => emisor.nombre.toLowerCase().includes(ex))) continue;

    const name = emisor.nombre.trim();
    const cif = emisor.cif_nif || '';
    const nameLower = name.toLowerCase();

    if (cif && existingCifs.has(cif)) continue;
    if (existingNames.has(nameLower)) continue;

    existing.push({
      id: generateId(),
      source_id: 'emisor_' + doc.id,
      name,
      cif,
      address: emisor.direccion || '',
      email: emisor.email || '',
      phone: emisor.telefono || '',
      category: 'otros',
      status: 'activo',
      rating: 3,
      total_invoices: 1,
      last_invoice_date: doc.analisis?.fecha || null,
      created_date: new Date().toISOString(),
      updated_date: new Date().toISOString()
    });
    existingNames.add(nameLower);
    if (cif) existingCifs.add(cif);
    added++;
  }

  if (added > 0) {
    writeJSON('provider.json', existing);
    console.log(`[SYNC] Providers: +${added} (${existing.length} total)`);
  }
  return added;
}

// ─── Sync facturas → invoice.json ───────────────────────────────────────
function syncInvoices() {
  const allDocs = getAllDocs();
  const existing = readJSON('invoice.json');
  const existingSourceIds = new Set(existing.map(i => i.source_id));
  const allProviders = readJSON('provider.json');

  let added = 0;
  let fixed = 0;

  for (const inv of existing) {
    let changed = false;
    if (Array.isArray(inv.total) || typeof inv.total === 'string') {
      inv.total = toNum(inv.total);
      changed = true;
    }
    if (Array.isArray(inv.subtotal) || typeof inv.subtotal === 'string') {
      inv.subtotal = toNum(inv.subtotal);
      changed = true;
    }
    if (Array.isArray(inv.iva) || typeof inv.iva === 'string') {
      inv.iva = toNum(inv.iva);
      changed = true;
    }
    if (changed) {
      inv.updated_date = new Date().toISOString();
      fixed++;
    }
  }

  for (const doc of allDocs) {
    const a = doc.analisis;
    if (!a.tipo || !a.tipo.includes('factura')) continue;
    if (existingSourceIds.has(doc.id)) continue;

    const provName = a.emisor?.nombre || 'Sin proveedor';
    const provCif = a.emisor?.cif_nif || '';
    const matchingProv = allProviders.find(p =>
      (p.cif && provCif && p.cif === provCif) ||
      p.name?.toLowerCase() === provName.toLowerCase()
    );

    existing.push({
      id: generateId(),
      source_id: doc.id,
      provider_name: provName,
      provider_cif: provCif,
      provider_id: matchingProv?.id || null,
      invoice_number: a.numero_documento || '',
      invoice_date: a.fecha || null,
      due_date: a.fecha_vencimiento || null,
      subtotal: a.base_imponible,
      iva: a.iva_total,
      total: a.total,
      currency: a.moneda,
      payment_method: a.forma_pago,
      category: 'otros',
      status: 'pagada',
      file_name: doc.nombre_archivo,
      items: (a.conceptos || []).map(c => ({
        description: c.descripcion,
        quantity: c.cantidad,
        unit_price: c.precio_unitario,
        vat: c.iva_porcentaje,
        total: c.total
      })),
      summary: a.resumen,
      created_date: doc.procesado || new Date().toISOString(),
      updated_date: new Date().toISOString()
    });
    added++;
  }

  if (added > 0 || fixed > 0) {
    writeJSON('invoice.json', existing);
    console.log(`[SYNC] Invoices: +${added} new, ${fixed} fixed (${existing.length} total)`);
  }
  return added + fixed;
}

// ─── Sync emails.json → emailmessage.json ───────────────────────────────
function syncEmails() {
  const rawEmails = readJSON('emails.json');
  const existing = readJSON('emailmessage.json');
  const existingMsgIds = new Set(existing.map(e => e.message_id || e.source_id));

  // Backfill: sin 'folder' la bandeja (SmartMailbox filtra folder='inbox')
  // no muestra el correo. Garantizamos campos mínimos en registros antiguos.
  let migrated = 0;
  for (const e of existing) {
    if (!e.folder) { e.folder = 'inbox'; migrated++; }
    if (e.is_read === undefined) e.is_read = false;
    if (e.is_starred === undefined) e.is_starred = false;
  }

  let added = 0;
  for (const email of rawEmails) {
    if (existingMsgIds.has(email.message_id)) continue;

    existing.push({
      id: generateId(),
      source_id: email.message_id,
      message_id: email.message_id,
      subject: email.subject || '(Sin asunto)',
      sender_name: email.sender_name || '',
      sender_email: email.sender_email || '',
      received_date: email.received_date || null,
      body_preview: email.body_preview || '',
      has_attachments: email.has_attachments || false,
      attachment_names: email.attachment_names || [],
      attachment_count: email.attachment_count || 0,
      status: email.estado || 'nuevo',
      folder: 'inbox',
      is_read: false,
      is_starred: false,
      created_date: email.synced_at || new Date().toISOString(),
      updated_date: new Date().toISOString()
    });
    added++;
  }

  if (added > 0 || migrated > 0) {
    writeJSON('emailmessage.json', existing);
    console.log(`[SYNC] Emails: +${added} nuevos, ${migrated} migrados (${existing.length} total)`);
  }
  return added;
}

// ─── Sync entities.json → client.json ───────────────────────────────────
function syncClients() {
  const entities = readJSONObj('entities.json', { clientes: [] });
  const rawClients = entities.clients || entities.clientes || [];
  const existing = readJSON('client.json');
  const existingSourceIds = new Set(existing.map(c => c.source_id));

  let added = 0;
  for (const cli of rawClients) {
    if (existingSourceIds.has(cli.id)) continue;

    existing.push({
      id: generateId(),
      source_id: cli.id,
      name: cli.nombre || 'Sin nombre',
      cif: cli.cif_nif || '',
      address: cli.direccion || '',
      email: cli.email || '',
      status: 'activo',
      total_invoices: cli.facturas || 0,
      created_date: cli.creado || new Date().toISOString(),
      updated_date: new Date().toISOString()
    });
    added++;
  }

  if (added > 0) {
    writeJSON('client.json', existing);
    console.log(`[SYNC] Clients: +${added} (${existing.length} total)`);
  }
  return added;
}

// ─── Sync documentos procesados → uploadedfile.json ──────────────────────
// Produce registros en el shape que espera la página DocumentArchive:
//   { filename, size, processing_status, detected_type,
//     metadata: { provider, employee_name, destination:{section,type,name}, amount } }
const TIPO_LABEL = {
  factura_recibida: 'Factura', factura_emitida: 'Factura', albaran: 'Albarán',
  nomina: 'Nómina', finiquito: 'Finiquito', contrato: 'Contrato', recibo: 'Recibo',
  ticket: 'Ticket', escritura: 'Escritura', pdf_multi_factura: 'Múltiples', otro: 'Otros',
};

function buildUploadedRecord(doc, existingId) {
  const a = doc.analisis || {};
  const org = doc.organizacion || {};
  const tipoLabel = TIPO_LABEL[a.tipo] || 'Otros';

  const isChickenEmisor = /chicken\s*palace/i.test(a.emisor?.nombre || '');
  const emisorNombre = (a.emisor?.nombre || '').trim();
  const receptorNombre = (a.receptor?.nombre || '').trim();
  const employeeName = (a.trabajador?.nombre_completo || a.trabajador?.nombre || '').trim();
  const amount = a.total ?? a.base_imponible ?? null;

  let providerName = '';
  if (['nomina', 'finiquito'].includes(a.tipo)) providerName = '';
  else if (isChickenEmisor) providerName = receptorNombre || emisorNombre;
  else providerName = emisorNombre || receptorNombre;

  // Destino: preferir el del organizador; si no, derivar del tipo
  let destination = org.destination || null;
  if (!destination) {
    if (['nomina', 'finiquito'].includes(a.tipo) && employeeName) {
      destination = { type: 'Employee', id: doc.id, name: employeeName, section: 'Equipo' };
    } else if ((a.tipo || '').startsWith('factura') && providerName) {
      destination = { type: 'Invoice', id: doc.id, name: providerName + (amount ? ' - ' + amount + '€' : ''), section: 'Facturas' };
    } else if (a.tipo === 'recibo' && providerName) {
      destination = { type: 'Invoice', id: doc.id, name: providerName + (amount ? ' - ' + amount + '€' : ''), section: 'Recibos' };
    } else if (org.folder_path) {
      destination = { type: 'Document', id: doc.id, name: org.folder_path, section: org.folder_path.split('/')[0] };
    }
  }

  let size = 0;
  try { if (doc.filePath && fs.existsSync(doc.filePath)) size = fs.statSync(doc.filePath).size; } catch { /* sin tamaño */ }

  const processing_status = doc.estado === 'procesado' ? 'completed'
    : doc.estado === 'error' ? 'error' : 'pending';

  return {
    id: existingId || generateId(),
    source_id: doc.id,
    filename: doc.nombre_archivo || 'documento',
    detected_type: tipoLabel,
    document_type: tipoLabel,
    size,
    content_type: doc.mime_type || null,
    file_url: null,
    upload_date: doc.procesado || new Date().toISOString(),
    source: 'Email/Pipeline',
    processing_status,
    metadata: {
      provider: providerName || null,
      employee_name: employeeName || null,
      doc_number: a.numero_documento || null,
      destination,
      amount,
      tipo: a.tipo || null,
      folder_path: org.folder_path || null,
    },
    synced_at: new Date().toISOString(),
  };
}

function syncUploadedFiles() {
  const allDocs = getAllDocs();
  const existing = readJSON('uploadedfile.json');
  const bySource = new Map(existing.filter(f => f.source_id).map(f => [f.source_id, f]));

  let added = 0, updated = 0;
  for (const doc of allDocs) {
    const prev = bySource.get(doc.id);
    if (prev) {
      // Solo re-escribir si al registro previo le falta destino o no está completo
      const needsUpgrade = prev.processing_status !== 'completed' || !prev.metadata?.destination;
      if (!needsUpgrade) continue;
      Object.assign(prev, buildUploadedRecord(doc, prev.id));
      updated++;
    } else {
      existing.push(buildUploadedRecord(doc));
      added++;
    }
  }

  if (added > 0 || updated > 0) {
    writeJSON('uploadedfile.json', existing);
    console.log(`[SYNC] Uploaded files: +${added} nuevos, ${updated} actualizados (${existing.length} total)`);
  }
  return added + updated;
}

// ─── Sync completa ──────────────────────────────────────────────────────
export function syncData() {
  const counts = {
    documents: syncDocuments(),
    providers: syncProviders(),
    invoices:  syncInvoices(),
    emails:    syncEmails(),
    clients:   syncClients(),
    uploaded:  syncUploadedFiles(),
  };
  console.log('[SYNC] Completed:', JSON.stringify(counts));
  return counts;
}

// ─── Alias de compatibilidad para consumers existentes ─────────────────
export const syncAll = syncData;
export const syncAfterEmails = syncData;