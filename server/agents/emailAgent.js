// ═══════════════════════════════════════════════════════════════════════════
//  AGENTE EMAIL UNIFICADO — Monitor IMAP + procesamiento IA + fuente única
//  
//  ANTES: dos pipelines separados (emailAgent + routes/email) con dos
//         almacenes distintos (documents.json vs invoice.json).
//  AHORA: un solo motor que escribe en documents.json + entities.json,
//         la misma fuente de verdad que usa Brain.
//
//  Flujo: IMAP → guardar adjunto → documentProcessor (IA) → documents.json
//         + auto-crear proveedores/clientes en entities.json
//         + clasificación por tipo (factura, nómina, albarán…)
//         + extracción de trabajadores desde nóminas
// ═══════════════════════════════════════════════════════════════════════════
import Imap            from 'imap';
import { simpleParser } from 'mailparser';
import { writeFile, mkdir, readFile } from 'fs/promises';
import { existsSync }   from 'fs';
import path             from 'path';
import { processDocument, getDocuments, getEntities } from '../services/documentProcessor.js';
import { syncAfterEmails } from '../services/dataSync.js';

const DATA_DIR    = process.env.DATA_DIR    || '/app/data';
const UPLOADS_DIR = process.env.UPLOADS_DIR || '/app/uploads';
const EMAILS_FILE = path.join(DATA_DIR, 'emails.json');
const STATE_FILE  = path.join(DATA_DIR, 'email_state.json');

// Extensiones de adjunto que procesamos
const PROCESSABLE_EXTS = new Set(['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.docx', '.txt', '.xlsx', '.csv']);
// Tamaño mínimo para evitar firmas / iconos
const MIN_ATTACHMENT_SIZE = 500;

// ══════════════════════════════════════════════════════════════════════════
//  HELPERS — Persistencia JSON
// ══════════════════════════════════════════════════════════════════════════

async function loadJSON(file, def) {
  try { return existsSync(file) ? JSON.parse(await readFile(file, 'utf8')) : def; }
  catch { return def; }
}
async function saveJSON(file, data) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(data, null, 2));
}

// ══════════════════════════════════════════════════════════════════════════
//  HELPERS — IMAP
// ══════════════════════════════════════════════════════════════════════════

function getImapConfig() {
  return {
    user:        process.env.EMAIL_USER || 'info@chickenpalace.es',
    password:    process.env.EMAIL_APP_PASSWORD,
    host:        'imap.gmail.com',
    port:        993,
    tls:         true,
    tlsOptions:  { rejectUnauthorized: false },
    connTimeout: 30000,
    authTimeout: 30000,
  };
}

function isProcessable(filename) {
  const ext = path.extname(filename || '').toLowerCase();
  return PROCESSABLE_EXTS.has(ext);
}

function extractSenderInfo(from) {
  const name  = from?.value?.[0]?.name    || '';
  const email = from?.value?.[0]?.address  || '';
  return { name: name || email.split('@')[0] || 'Desconocido', email };
}

// ══════════════════════════════════════════════════════════════════════════
//  GUARDAR ADJUNTO EN DISCO
// ══════════════════════════════════════════════════════════════════════════

async function saveAttachment(attachment) {
  await mkdir(UPLOADS_DIR, { recursive: true });
  const safeName = (attachment.filename || 'adjunto')
    .replace(/[^a-zA-Z0-9.\-_]/g, '_').slice(0, 80);
  const fname = `email_${Date.now()}_${safeName}`;
  const fpath = path.join(UPLOADS_DIR, fname);
  await writeFile(fpath, attachment.content);
  return {
    path:     fpath,
    name:     safeName,
    origName: attachment.filename,
    mime:     attachment.contentType || 'application/octet-stream',
    size:     attachment.content?.length || 0,
  };
}

// ══════════════════════════════════════════════════════════════════════════
//  PROCESAR ADJUNTOS CON IA (documentProcessor unificado)
// ══════════════════════════════════════════════════════════════════════════

async function processAttachmentsWithAI(email, attachments) {
  const results = [];
  for (const att of attachments) {
    if (!isProcessable(att.filename)) continue;
    if (!att.content || att.content.length < MIN_ATTACHMENT_SIZE) continue;

    try {
      const saved = await saveAttachment(att);
      console.log(`[EMAIL] 📎 Procesando: ${saved.name} (${Math.round(saved.size / 1024)}KB)`);

      // ── documentProcessor hace TODO: extraer texto, clasificar, extraer datos,
      //    validar, resolver entidades, guardar en documents.json + entities.json
      const doc = await processDocument(saved.path, saved.mime, saved.name);

      results.push({
        filename:     saved.origName,
        saved_as:     saved.name,
        documento_id: doc.id,
        tipo:         doc.analisis?.tipo,
        total:        doc.analisis?.total,
        emisor:       doc.analisis?.emisor?.nombre,
        receptor:     doc.analisis?.receptor?.nombre,
        resumen:      doc.analisis?.resumen,
        metodo:       doc.metodo_extraccion,
        tiempo_ms:    doc.tiempo_ms,
        // Metadatos de email para vincular después
        email_message_id: email.message_id,
        email_subject:    email.subject,
        email_sender:     email.sender_email,
        email_date:       email.received_date,
      });

      console.log(`[EMAIL] ✓ ${saved.name} → ${doc.analisis?.tipo} (${doc.tiempo_ms}ms)`);
    } catch (err) {
      console.warn(`[EMAIL] ✗ ${att.filename}: ${err.message}`);
      results.push({ filename: att.filename, error: err.message });
    }
  }
  return results;
}

// ══════════════════════════════════════════════════════════════════════════
//  SYNC PRINCIPAL — Una sola función para todo
// ══════════════════════════════════════════════════════════════════════════

export async function syncEmails({ since, limit, processWithAI = true } = {}) {
  console.log('[EMAIL] Iniciando sincronización...');
  if (!process.env.EMAIL_APP_PASSWORD) {
    console.log('[EMAIL] Sin EMAIL_APP_PASSWORD — omitiendo');
    return { success: false, error: 'no password' };
  }

  const state          = await loadJSON(STATE_FILE, { processed_ids: [] });
  const existingEmails = await loadJSON(EMAILS_FILE, []);
  const existingIds    = new Set(existingEmails.map(e => e.message_id));
  const processedIds   = new Set(state.processed_ids || []);
  const newEmails      = [];

  // Calcular "desde" — por defecto 60 días, overridable
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - 60);
  const sinceStr = since || sinceDate.toISOString().split('T')[0];
  const maxEmails = limit || 100;

  try {
    await new Promise((resolve, reject) => {
      const imap = new Imap(getImapConfig());

      imap.once('ready', () => {
        imap.openBox('INBOX', true, (err) => {
          if (err) { imap.end(); reject(err); return; }

          imap.search([['SINCE', sinceStr]], async (err, results) => {
            if (err || !results?.length) { imap.end(); resolve(); return; }

            const ids = results.slice(-maxEmails);
            const f   = imap.fetch(ids, { bodies: '', struct: true });
            let pending = ids.length;

            f.on('message', (msg) => {
              msg.on('body', (stream) => {
                simpleParser(stream, async (err, parsed) => {
                  try {
                    if (err || !parsed.messageId || existingIds.has(parsed.messageId)) {
                      pending--;
                      if (pending <= 0) imap.end();
                      return;
                    }

                    const sender = extractSenderInfo(parsed.from);
                    const atts   = parsed.attachments || [];
                    const docAtts = atts.filter(a =>
                      isProcessable(a.filename) && a.content?.length >= MIN_ATTACHMENT_SIZE
                    );

                    const emailRecord = {
                      message_id:          parsed.messageId,
                      subject:             parsed.subject || '(sin asunto)',
                      sender_name:         sender.name,
                      sender_email:        sender.email,
                      received_date:       (parsed.date || new Date()).toISOString(),
                      body_preview:        (parsed.text || '').slice(0, 500),
                      has_attachments:     atts.length > 0,
                      attachment_names:    atts.map(a => a.filename || '').filter(Boolean),
                      has_doc_attachments: docAtts.length > 0,
                      attachment_count:    docAtts.length,
                      documentos_procesados: [],
                      synced_at:           new Date().toISOString(),
                      estado:              docAtts.length > 0 ? 'pendiente_procesar' : 'sin_adjuntos',
                    };

                    // ── Procesar adjuntos con IA si está habilitado ─────────
                    if (processWithAI && docAtts.length > 0 && !processedIds.has(parsed.messageId)) {
                      try {
                        const docs = await processAttachmentsWithAI(emailRecord, atts);
                        emailRecord.documentos_procesados = docs;
                        emailRecord.estado = docs.some(d => d.error) ? 'procesado_parcial' : 'procesado';
                        processedIds.add(parsed.messageId);
                      } catch (pe) {
                        emailRecord.estado = `error: ${pe.message}`;
                      }
                    }

                    newEmails.push(emailRecord);
                    existingIds.add(parsed.messageId);
                  } catch { /* silenciar errores de parseo individuales */ }

                  pending--;
                  if (pending <= 0) imap.end();
                });
              });
            });

            f.once('error', () => imap.end());
            f.once('end',   () => { if (pending <= 0) imap.end(); });
          });
        });
      });

      imap.once('end',   resolve);
      imap.once('error', reject);
      imap.connect();
    });

    // ── Persistir emails + estado ────────────────────────────────────────
    if (newEmails.length > 0) {
      const allEmails = [...newEmails, ...existingEmails].slice(0, 5000);
      await saveJSON(EMAILS_FILE, allEmails);

      await saveJSON(STATE_FILE, {
        processed_ids: [...processedIds].slice(-2000),
        last_sync:     new Date().toISOString(),
      });

      const conDocs = newEmails.filter(e => e.documentos_procesados?.length > 0);
      console.log(`[EMAIL] ✓ ${newEmails.length} nuevos — ${conDocs.length} con documentos procesados`);

      // Sincronizar emails con la API genérica
      try { syncAfterEmails(); } catch (e) { console.warn('[EMAIL] Sync warning:', e.message); }
    } else {
      console.log('[EMAIL] Sin emails nuevos');
    }

    return {
      success:        true,
      nuevos:         newEmails.length,
      con_documentos: newEmails.filter(e => e.has_doc_attachments).length,
      procesados:     newEmails.filter(e => e.estado === 'procesado').length,
      errores:        newEmails.filter(e => e.estado?.startsWith('error')).length,
    };
  } catch (err) {
    console.error('[EMAIL] ✗ Error:', err.message);
    return { success: false, error: err.message };
  }
}

// ══════════════════════════════════════════════════════════════════════════
//  SCAN — Escaneo ligero sin IA (solo metadatos + clasificación regex)
//  Para endpoints que necesitan respuesta rápida sin procesar PDFs
// ══════════════════════════════════════════════════════════════════════════

export async function scanEmails({ since = '2025-01-01', limit = 200, folder = 'INBOX', typeFilter = null, includeContent = false } = {}) {
  if (!process.env.EMAIL_APP_PASSWORD) {
    throw new Error('EMAIL_APP_PASSWORD no configurada');
  }

  const documents = [];
  const providers = new Map();
  let totalEmails = 0;

  await new Promise((resolve, reject) => {
    const imap = new Imap(getImapConfig());

    imap.once('ready', () => {
      imap.openBox(folder, true, (err, box) => {
        if (err) { reject(err); return; }
        totalEmails = box.messages.total;

        imap.search([['SINCE', since]], (err, results) => {
          if (err) { reject(err); return; }
          if (!results.length) { imap.end(); resolve(); return; }

          const ids = results.slice(-parseInt(limit));
          const f   = imap.fetch(ids, { bodies: '', struct: true });
          let pending = ids.length;

          f.on('message', (msg) => {
            msg.on('body', (stream) => {
              simpleParser(stream, (err, parsed) => {
                if (!err) {
                  const attachments = (parsed.attachments || []).filter(a =>
                    isProcessable(a.filename)
                  );

                  if (attachments.length > 0) {
                    const sender = extractSenderInfo(parsed.from);
                    if (!providers.has(sender.email)) {
                      providers.set(sender.email, { name: sender.name, email: sender.email, docCount: 0 });
                    }
                    providers.get(sender.email).docCount++;

                    attachments.forEach(a => {
                      const docType = classifyByHeuristic(parsed.subject, a.filename, parsed.from?.text);
                      if (typeFilter && docType !== typeFilter) return;

                      const doc = {
                        type: docType,
                        provider: sender.name,
                        providerEmail: sender.email,
                        subject: parsed.subject,
                        date: parsed.date,
                        filename: a.filename,
                        fileSize: a.size,
                        contentType: a.contentType,
                        messageId: parsed.messageId,
                      };
                      if (includeContent && a.content) {
                        doc.content = a.content.toString('base64');
                      }
                      documents.push(doc);
                    });
                  }
                }
                pending--;
                if (pending <= 0) imap.end();
              });
            });
          });

          f.once('error', () => imap.end());
        });
      });
    });

    imap.once('end', resolve);
    imap.once('error', reject);
    imap.connect();
  });

  // Pequeña pausa para que IMAP cierre limpiamente
  await new Promise(r => setTimeout(r, 1000));
  return { documents, providers, totalEmails };
}

// ══════════════════════════════════════════════════════════════════════════
//  CLASIFICACIÓN RÁPIDA POR HEURÍSTICA (sin IA — para scan ligero)
// ══════════════════════════════════════════════════════════════════════════

function classifyByHeuristic(subject, filename, from) {
  const s  = (subject  || '').toLowerCase();
  const f  = (filename || '').toLowerCase();
  const fr = (from     || '').toLowerCase();

  // Nóminas / Hojas de salario
  if (f.includes('nomina') || s.includes('nomina') || s.includes('nómina') || f.includes('payslip')) return 'nomina';
  if (s.includes('hoja de salario') || s.includes('hojas de salario') || s.includes('hoja salario')) return 'nomina';
  if (fr.includes('laboral') && (s.includes('salario') || f.includes('salario'))) return 'nomina';
  if (fr.includes('laboral') && !s.includes('factura')) return 'nomina';
  // Facturas
  if (f.includes('factura') || s.includes('factura') || s.includes('invoice') || f.includes('invoice')) return 'factura';
  if (s.includes('recibo') || f.includes('recibo') || s.includes('receipt')) return 'recibo';
  if (s.includes('contrato') || f.includes('contrato') || s.includes('contract')) return 'contrato';
  if (s.includes('presupuesto') || f.includes('presupuesto') || s.includes('quote')) return 'presupuesto';
  if (s.includes('albaran') || s.includes('albarán') || f.includes('albaran')) return 'albaran';
  if (s.includes('modelo') || s.includes('impuesto') || s.includes('tax')) return 'fiscal';
  if (f.endsWith('.pdf')) return 'documento';
  return 'otro';
}

// ══════════════════════════════════════════════════════════════════════════
//  CONSULTAS — Leer datos desde la fuente única
// ══════════════════════════════════════════════════════════════════════════

/** Historial de emails sincronizados */
export const getEmails = () => loadJSON(EMAILS_FILE, []);

/** Todos los documentos procesados (fuente única: documents.json) */
export { getDocuments, getEntities };

/** Estadísticas rápidas */
export async function getEmailStats() {
  const [emails, docs, entities] = await Promise.all([
    loadJSON(EMAILS_FILE, []),
    getDocuments(),
    getEntities(),
  ]);

  const byTipo = {};
  for (const d of docs) {
    const t = d.analisis?.tipo || 'otro';
    byTipo[t] = (byTipo[t] || 0) + 1;
  }

  return {
    total_emails:       emails.length,
    emails_con_docs:    emails.filter(e => e.has_doc_attachments).length,
    emails_procesados:  emails.filter(e => e.estado === 'procesado').length,
    total_documentos:   docs.length,
    documentos_por_tipo: byTipo,
    total_proveedores:  entities.proveedores?.length || 0,
    total_clientes:     entities.clientes?.length    || 0,
    last_sync:          emails[0]?.synced_at || null,
  };
}
