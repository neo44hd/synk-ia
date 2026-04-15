#!/usr/bin/env node
/**
 * SYNK-IA — Migración de datos
 * 
 * Problema: DocBrain/FileBrain guardan en documents.json + entities.json
 *           pero la API genérica (dataRouter) busca document.json, provider.json, invoice.json, etc.
 * 
 * Este script:
 * 1. Lee documents.json → crea document.json (formato API)
 * 2. Lee entities.json → crea provider.json + invoice.json (extraídos del análisis)
 * 3. Lee emails.json → crea emailmessage.json (formato API)
 * 4. NO toca los archivos originales (documents.json, entities.json, emails.json siguen igual)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');

function readJSON(file) {
  const p = path.join(DATA_DIR, file);
  if (!fs.existsSync(p)) return [];
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } 
  catch { return []; }
}

function writeJSON(file, data) {
  const p = path.join(DATA_DIR, file);
  fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
  console.log(`  ✅ ${file}: ${data.length} records`);
}

function generateId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

console.log('\n🔄 SYNK-IA Data Migration');
console.log('  DATA_DIR:', DATA_DIR);
console.log('');

// ─── 1. documents.json → document.json ─────────────────────────
console.log('📄 Migrating documents...');
const rawDocs = readJSON('documents.json');
const existingDocs = readJSON('document.json');
const existingDocIds = new Set(existingDocs.map(d => d.source_id || d.id));

const newDocs = [];
for (const doc of rawDocs) {
  // Skip if already migrated
  if (existingDocIds.has(doc.id)) continue;
  
  const a = doc.analisis || {};
  newDocs.push({
    id: generateId('id'),
    source_id: doc.id,  // link back to original
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
}
const allDocs = [...existingDocs, ...newDocs];
writeJSON('document.json', allDocs);

// ─── 2. entities.json → provider.json ──────────────────────────
console.log('🏢 Migrating providers...');
const entities = readJSON('entities.json');
const rawProviders = entities.proveedores || [];
const existingProviders = readJSON('provider.json');
const existingProvNames = new Set(existingProviders.map(p => (p.name || '').toLowerCase()));

const newProviders = [];
for (const prov of rawProviders) {
  if (existingProvNames.has((prov.nombre || '').toLowerCase())) continue;
  
  newProviders.push({
    id: generateId('id'),
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
}
const allProviders = [...existingProviders, ...newProviders];
writeJSON('provider.json', allProviders);

// ─── 3. documents.json (facturas) → invoice.json ───────────────
console.log('🧾 Migrating invoices...');
const existingInvoices = readJSON('invoice.json');
const existingInvSourceIds = new Set(existingInvoices.map(i => i.source_id || ''));

const newInvoices = [];
for (const doc of rawDocs) {
  const a = doc.analisis || {};
  if (!a.tipo || !a.tipo.includes('factura')) continue;
  if (existingInvSourceIds.has(doc.id)) continue;
  
  // Find matching provider
  const provName = a.emisor?.nombre || 'Sin proveedor';
  const matchingProv = allProviders.find(p => 
    p.name.toLowerCase() === provName.toLowerCase() ||
    (p.cif && a.emisor?.cif_nif && p.cif === a.emisor.cif_nif)
  );

  newInvoices.push({
    id: generateId('id'),
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
}
const allInvoices = [...existingInvoices, ...newInvoices];
writeJSON('invoice.json', allInvoices);

// ─── 4. emails.json → emailmessage.json ────────────────────────
console.log('📧 Migrating emails...');
const rawEmails = readJSON('emails.json');
const existingEmails = readJSON('emailmessage.json');
const existingMsgIds = new Set(existingEmails.map(e => e.message_id || e.source_id || ''));

const newEmails = [];
for (const email of rawEmails) {
  if (existingMsgIds.has(email.message_id)) continue;
  
  newEmails.push({
    id: generateId('id'),
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
}
const allEmails = [...existingEmails, ...newEmails];
writeJSON('emailmessage.json', allEmails);

// ─── 5. clients from entities.json → client.json ───────────────
console.log('👤 Migrating clients...');
const rawClients = entities.clientes || [];
const existingClients = readJSON('client.json');
const existingClientNames = new Set(existingClients.map(c => (c.name || '').toLowerCase()));

const newClients = [];
for (const cli of rawClients) {
  if (existingClientNames.has((cli.nombre || '').toLowerCase())) continue;
  
  newClients.push({
    id: generateId('id'),
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
}
const allClients = [...existingClients, ...newClients];
writeJSON('client.json', allClients);

// ─── Summary ────────────────────────────────────────────────────
console.log('\n📊 Migration Summary:');
console.log(`  Documents: ${newDocs.length} new (${allDocs.length} total)`);
console.log(`  Providers: ${newProviders.length} new (${allProviders.length} total)`);
console.log(`  Invoices:  ${newInvoices.length} new (${allInvoices.length} total)`);
console.log(`  Emails:    ${newEmails.length} new (${allEmails.length} total)`);
console.log(`  Clients:   ${newClients.length} new (${allClients.length} total)`);
console.log('\n✅ Migration complete!\n');
