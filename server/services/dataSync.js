// ═══════════════════════════════════════════════════════════════════════════
//  SYNK-IA — Data Sync Service
//
//  Sincroniza datos entre las fuentes de procesamiento (documents.json,
//  filemanager_docs.json, entities.json, emails.json) y la API genérica
//  (document.json, provider.json, invoice.json, emailmessage.json, client.json).
//
//  Lee de DOS fuentes de documentos:
//  - documents.json        (pipeline antiguo: campos analisis, nombre_archivo, etc.)
//  - filemanager_docs.json (pipeline nuevo:  campos analysis, original_name, etc.)
//
//  Se ejecuta:
//  1. Automáticamente después de cada processDocument()
//  2. Automáticamente después de cada ciclo del emailAgent
//  3. Al arrancar el servidor (migración inicial)
// ═══════════════════════════════════════════════════════════════════════════
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
// Los modelos a veces devuelven arrays, strings, o nulls donde debería haber un número.
function toNum(val) {
  if (val == null) return 0;
  if (Array.isArray(val)) {
    // Si es array, sumar todos los elementos numéricos
    return val.reduce((sum, v) => sum + (parseFloat(v) || 0), 0);
  }
  if (typeof val === 'string') return parseFloat(val.replace(',', '.')) || 0;
  return typeof val === 'number' ? val : 0;
}

// ─── Normalizar un documento de filemanager_docs.json al formato unificado ──
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
    // Campos de análisis unificados
    analisis: {
      tipo: a.tipo || 'otro',
      subtipo: a.subtipo || '',
      fecha: a.fechas?.documento || null,
      fecha_vencimiento: a.fechas?.vencimiento || null,
      emisor: a.emisor || {},
      receptor: a.receptor || {},
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

// ─── Normalizar un documento de documents.json (pipeline antiguo) ────────
function normalizeOldDoc(doc) {
  const a = doc.analisis || {};
  return {
    id: doc.id,
    nombre_archivo: doc.nombre_archivo || 'Sin título',
    mime_type: doc.mime_type,
    paginas: doc.paginas,
    metodo_extraccion: doc.metodo_extraccion,
    procesado: doc.procesado,
    analisis: {
      tipo: a.tipo || 'otro',
      subtipo: a.subtipo || '',
      fecha: a.fecha || null,
      fecha_vencimiento: a.fecha_vencimiento || null,
      emisor: a.emisor || {},
      receptor: a.receptor || {},
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

// ─── Obtener todos los documentos de ambas fuentes (normalizados) ────────
function getAllDocs() {
  const oldRaw = readJSON('documents.json');
  const newRaw = readJSON('filemanager_docs.json');

  const docs = [];
  const seenIds = new Set();

  // Pipeline nuevo primero (tiene mejor calidad de análisis)
  for (const doc of newRaw) {
    if (!doc.id) continue;
    docs.push(normalizeFilemanagerDoc(doc));
    seenIds.add(doc.id);
  }

  // Pipeline antiguo (solo los que no estén ya)
  for (const doc of oldRaw) {
    if (!doc.id || seenIds.has(doc.id)) continue;
    docs.push(normalizeOldDoc(doc));
    seenIds.add(doc.id);
  }

  return docs;
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

// ─── Sync providers: entities.json + emisores de documentos → provider.json
function syncProviders() {
  // Fuente 1: entities.json (manual/legacy)
  const entities = readJSONObj('entities.json', { proveedores: [], clientes: [] });
  const rawProviders = entities.proveedores || [];
  const existing = readJSON('provider.json');
  const existingNames = new Set(existing.map(p => (p.name || '').toLowerCase().trim()));
  const existingCifs = new Set(existing.map(p => p.cif).filter(Boolean));
  const existingSourceIds = new Set(existing.map(p => p.source_id));

  let added = 0;

  // Agregar proveedores de entities.json
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

  // Fuente 2: Extraer emisores de todos los documentos procesados
  const allDocs = getAllDocs();
  for (const doc of allDocs) {
    const emisor = doc.analisis?.emisor;
    if (!emisor || !emisor.nombre) continue;
    if (emisor.rol === 'empresa' || emisor.rol === 'cliente') continue; // skip non-providers

    const name = emisor.nombre.trim();
    const cif = emisor.cif_nif || '';
    const nameLower = name.toLowerCase();

    // Dedup by CIF or name
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

  // Primero, corregir facturas existentes con totales rotos (arrays/NaN)
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

  // Agregar nuevas facturas
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
      status: 'pendiente',
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
      created_date: email.synced_at || new Date().toISOString(),
      updated_date: new Date().toISOString()
    });
    added++;
  }

  if (added > 0) {
    writeJSON('emailmessage.json', existing);
    console.log(`[SYNC] Emails: +${added} (${existing.length} total)`);
  }
  return added;
}

// ─── Sync entities.json → client.json ───────────────────────────────────
function syncClients() {
  const entities = readJSONObj('entities.json', { clientes: [] });
  const rawClients = entities.clientes || [];
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

// ─── Full sync (all entities) ───────────────────────────────────────────
export function syncAll() {
  console.log('[SYNC] Starting full data sync...');
  const results = {
    documents: syncDocuments(),
    providers: syncProviders(),
    invoices: syncInvoices(),
    emails: syncEmails(),
    clients: syncClients()
  };
  const total = Object.values(results).reduce((s, n) => s + n, 0);
  if (total > 0) {
    console.log(`[SYNC] ✅ Sync complete: ${total} new/fixed records`, results);
  } else {
    console.log('[SYNC] ✅ Already in sync');
  }
  return results;
}

// ─── Sync after document processing ─────────────────────────────────────
export function syncAfterDocument() {
  try {
    syncDocuments();
    syncProviders();
    syncInvoices();
  } catch (err) {
    console.error('[SYNC] Error syncing after document:', err.message);
  }
}

// ─── Sync after email fetch ─────────────────────────────────────────────
export function syncAfterEmails() {
  try {
    syncEmails();
  } catch (err) {
    console.error('[SYNC] Error syncing emails:', err.message);
  }
}

export default { syncAll, syncAfterDocument, syncAfterEmails };
