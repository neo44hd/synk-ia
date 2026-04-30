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
      trabajador: a.trabajador || null,
      parent_v3_id: doc.parent_v3_id || undefined,
      v3_id: doc.v3_id || undefined,
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
      trabajador: a.trabajador || null,
      parent_v3_id: doc.parent_v3_id || undefined,
      v3_id: doc.v3_id || undefined,
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
  const EXCLUDED_PROVIDERS = ['jose riquer', 'josé riquer', 'chicken palace'];
  for (const doc of allDocs) {
    const emisor = doc.analisis?.emisor;
    if (!emisor || !emisor.nombre) continue;
    if (emisor.rol === 'empresa' || emisor.rol === 'cliente') continue; // skip non-providers
    // José Riquer es la calle del negocio, no un proveedor
    if (EXCLUDED_PROVIDERS.some(ex => emisor.nombre.toLowerCase().includes(ex))) continue;

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

// ─── Sync documentos procesados → uploadedfile.json (Archivo Inteligente) ──
// SYNC_UPLOADED_V3_V1 — parcheado para motor V3: mapea 'recibo', rellena plano
function syncUploadedFiles() {
  const allDocs = getAllDocs();
  const existing = readJSON('uploadedfile.json');
  const existingSourceIds = new Set(existing.map(f => f.source_id));

  const tipoMap = {
    'factura_recibida': 'Factura',
    'factura_emitida': 'Factura',
    'albaran': 'Albarán',
    'nomina': 'Nómina',
    'contrato': 'Contrato',
    'recibo': 'Recibo',
    'escritura': 'Escritura',
    'pdf_multi_factura': 'Múltiples',
    'otro': 'Otros'
  };

  let added = 0;
  for (const doc of allDocs) {
    if (existingSourceIds.has(doc.id)) continue;

    const a = doc.analisis || {};
    const tipoLabel = tipoMap[a.tipo] || 'Otros';

    // Detectar proveedor/trabajador/importe en formato plano
    // Regla dura: Chicken Palace es SIEMPRE receptor, NUNCA emisor.
    // Nóminas → trabajador va a employee_name (icono User en la UI)
    // Recibos/Facturas → emisor va a provider (icono Building). Nunca Chicken.
    const isChickenEmisor = /chicken\s*palace/i.test(a.emisor?.nombre || '');
    const emisorNombre = (a.emisor?.nombre || '').trim();
    const receptorNombre = (a.receptor?.nombre || '').trim();
    const trabajadorNombre = (a.trabajador?.nombre_completo || a.trabajador?.nombre || '').trim();

    let providerName = '';
    if (a.tipo === 'nomina') {
      // nómina: el trabajador va en employee_name, no en provider
      providerName = '';
    } else if (isChickenEmisor) {
      // Chicken es receptor real. El proveedor es... el receptor que V3 puso mal,
      // o (peor caso) dejamos emisor porque no hay alternativa.
      providerName = receptorNombre || emisorNombre;
    } else {
      providerName = emisorNombre || receptorNombre;
    }
    const employeeName =
      a.trabajador?.nombre_completo ||
      a.trabajador?.nombre ||
      '';
    const employeeDni =
      a.trabajador?.dni ||
      a.trabajador?.nif ||
      '';
    const amount = a.total ?? a.base_imponible ?? null;

    // Destino inferido para que la tabla muestre el link
    let destination = null;
    if (a.tipo === 'nomina' && employeeName) {
      destination = { type: 'Employee', id: doc.id, name: employeeName, section: 'Equipo' };
    } else if ((a.tipo || '').startsWith('factura') && providerName) {
      destination = { type: 'Invoice', id: doc.id, name: providerName + (amount ? ' - ' + amount + '€' : ''), section: 'Facturas' };
    } else if (a.tipo === 'recibo' && providerName) {
      destination = { type: 'Invoice', id: doc.id, name: providerName + (amount ? ' - ' + amount + '€' : ''), section: 'Recibos' };
    }

    existing.push({
      id: generateId(),
      source_id: doc.id,
      filename: doc.nombre_archivo,
      file_url: null,
      source: 'Pipeline IA',
      upload_date: doc.procesado || new Date().toISOString(),
      uploaded_by: 'Sistema',
      size: null,
      content_type: doc.mime_type || 'application/pdf',
      processing_status: 'completed',
      detected_type: tipoLabel,
      metadata: {
        // plano (lo que la UI de Archivo Global lee directamente)
        provider: providerName || undefined,
        employee_name: employeeName || undefined,
        employee_dni: employeeDni || undefined,
        amount: amount != null ? Number(amount) : undefined,
        document_date: a.fecha || undefined,
        summary: a.resumen || undefined,
        destination: destination || undefined,

        // compat con flujo antiguo
        extraction_method: doc.metodo_extraccion,
        pages: doc.paginas,
        confidence: a.confianza,
        processing_completed: new Date().toISOString(),
        parent_v3_id: doc.parent_v3_id || undefined,
        v3_id: doc.v3_id || undefined,
        extracted: {
          provider: providerName,
          providerCif: a.emisor?.cif_nif || '',
          invoiceNumber: a.numero_documento || '',
          invoiceDate: a.fecha || null,
          subtotal: a.base_imponible || null,
          iva: a.iva_total || null,
          total: amount,
          summary: a.resumen || '',
          documentType: { label: tipoLabel }
        }
      },
      created_date: doc.procesado || new Date().toISOString(),
      updated_date: new Date().toISOString()
    });
    added++;
  }

  if (added > 0) {
    writeJSON('uploadedfile.json', existing);
    console.log('[SYNC] UploadedFiles: +' + added + ' (' + existing.length + ' total)');
  }
  return added;
}


// ─── Sync empleados desde nóminas (auto-creación, tipoMap=nomina) ─────────
// SYNC_EMPLOYEES_V3 — crea Employee y acumula payrolls[] sin duplicar
function syncEmployees() {
  const allDocs = getAllDocs();
  const existing = readJSON('employee.json') || [];

  // índice por nombre normalizado
  const byName = new Map(
    existing.map(e => [String(e.full_name || '').trim().toUpperCase(), e])
  );

  let added = 0;
  let updated = 0;

  for (const doc of allDocs) {
    const a = doc.analisis || {};
    if (a.tipo !== 'nomina') continue;

    const nombre = (a.trabajador?.nombre_completo || a.trabajador?.nombre || a.receptor?.nombre || '').trim();
    if (!nombre) continue;

    const key = nombre.toUpperCase();
    const dni = a.trabajador?.dni || a.trabajador?.nif || a.receptor?.cif_nif || '';
    const net = Number(a.total || 0);
    const period = (a.fecha || '').slice(0, 7) || new Date().toISOString().slice(0, 7);
    const payroll = {
      period,
      net_salary: net,
      gross_salary: Number(a.base_imponible || net),
      date_processed: new Date().toISOString(),
      source_doc_id: doc.id,
      source_v3_id: doc.v3_id || null
    };

    let emp = byName.get(key);
    if (!emp) {
      emp = {
        id: generateId(),
        full_name: nombre,
        dni,
        position: a.trabajador?.puesto || a.trabajador?.categoria_profesional || '',
        nss: a.trabajador?.nss || '',
        salary_net: net,
        salary_gross: Number(a.base_imponible || net),
        status: 'activo',
        start_date: a.trabajador?.antiguedad || null,
        payrolls: [payroll],
        created_date: new Date().toISOString(),
        updated_date: new Date().toISOString()
      };
      existing.push(emp);
      byName.set(key, emp);
      added++;
    } else {
      // ¿Nómina ya registrada?
      const payrolls = emp.payrolls || [];
      const dup = payrolls.some(p => p.period === period && Math.abs((p.net_salary || 0) - net) < 0.01);
      if (!dup) {
        payrolls.push(payroll);
        emp.payrolls = payrolls;
        emp.salary_net = net; // último conocido
        emp.updated_date = new Date().toISOString();
        updated++;
      }
    }
  }

  if (added > 0 || updated > 0) {
    writeJSON('employee.json', existing);
    console.log('[SYNC] Employees: +' + added + ' nuevos, ' + updated + ' nóminas añadidas (' + existing.length + ' total)');
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
    clients: syncClients(),
    uploadedFiles: syncUploadedFiles(),
    employees: syncEmployees()
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
    syncUploadedFiles();
    syncEmployees();
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
