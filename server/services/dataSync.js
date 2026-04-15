// ═══════════════════════════════════════════════════════════════════════════
//  SYNK-IA — Data Sync Service
//
//  Sincroniza datos entre las fuentes de procesamiento (documents.json,
//  entities.json, emails.json) y la API genérica (document.json, provider.json,
//  invoice.json, emailmessage.json, client.json).
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

// ─── Sync documents.json → document.json ────────────────────────────────
function syncDocuments() {
  const raw = readJSON('documents.json');
  const existing = readJSON('document.json');
  const existingSourceIds = new Set(existing.map(d => d.source_id));

  let added = 0;
  for (const doc of raw) {
    if (existingSourceIds.has(doc.id)) continue;

    const a = doc.analisis || {};
    existing.push({
      id: generateId(),
      source_id: doc.id,
      title: doc.nombre_archivo || 'Sin título',
      type: a.tipo || 'otro',
      date: a.fecha || doc.procesado,
      provider_name: a.emisor?.nombre || '',
      provider_cif: a.emisor?.cif_nif || '',
      summary: a.resumen || '',
      total: a.total || null,
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

// ─── Sync entities.json → provider.json ─────────────────────────────────
function syncProviders() {
  const entities = readJSONObj('entities.json', { proveedores: [], clientes: [] });
  const rawProviders = entities.proveedores || [];
  const existing = readJSON('provider.json');
  const existingNames = new Set(existing.map(p => (p.name || '').toLowerCase()));
  const existingSourceIds = new Set(existing.map(p => p.source_id));

  let added = 0;
  for (const prov of rawProviders) {
    if (existingSourceIds.has(prov.id)) continue;
    if (existingNames.has((prov.nombre || '').toLowerCase())) continue;

    existing.push({
      id: generateId(),
      source_id: prov.id,
      name: prov.nombre || 'Sin nombre',
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
    added++;
  }

  if (added > 0) {
    writeJSON('provider.json', existing);
    console.log(`[SYNC] Providers: +${added} (${existing.length} total)`);
  }
  return added;
}

// ─── Sync documents.json (facturas) → invoice.json ──────────────────────
function syncInvoices() {
  const rawDocs = readJSON('documents.json');
  const existing = readJSON('invoice.json');
  const existingSourceIds = new Set(existing.map(i => i.source_id));
  const allProviders = readJSON('provider.json');

  let added = 0;
  for (const doc of rawDocs) {
    const a = doc.analisis || {};
    if (!a.tipo || !a.tipo.includes('factura')) continue;
    if (existingSourceIds.has(doc.id)) continue;

    const provName = a.emisor?.nombre || 'Sin proveedor';
    const matchingProv = allProviders.find(p =>
      p.name?.toLowerCase() === provName.toLowerCase() ||
      (p.cif && a.emisor?.cif_nif && p.cif === a.emisor.cif_nif)
    );

    existing.push({
      id: generateId(),
      source_id: doc.id,
      provider_name: provName,
      provider_cif: a.emisor?.cif_nif || '',
      provider_id: matchingProv?.id || null,
      invoice_number: a.numero_documento || '',
      invoice_date: a.fecha || null,
      due_date: a.fecha_vencimiento || null,
      subtotal: a.base_imponible || 0,
      iva: a.iva_total || 0,
      total: a.total || 0,
      currency: a.moneda || 'EUR',
      payment_method: a.forma_pago || '',
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
      summary: a.resumen || '',
      created_date: doc.procesado || new Date().toISOString(),
      updated_date: new Date().toISOString()
    });
    added++;
  }

  if (added > 0) {
    writeJSON('invoice.json', existing);
    console.log(`[SYNC] Invoices: +${added} (${existing.length} total)`);
  }
  return added;
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
    console.log(`[SYNC] ✅ Sync complete: ${total} new records`);
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
