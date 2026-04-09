// ═══════════════════════════════════════════════════════════════════════════
//  AGENTE EMAIL — Monitor de correo + procesamiento automático de adjuntos
//  Detecta: facturas, albaranes, presupuestos, contratos en adjuntos PDF/imagen
// ═══════════════════════════════════════════════════════════════════════════
import Imap           from 'imap';
import { simpleParser } from 'mailparser';
import { writeFile, mkdir, readFile } from 'fs/promises';
import { existsSync }  from 'fs';
import path            from 'path';
import { processDocument } from '../services/documentProcessor.js';

const DATA_DIR    = process.env.DATA_DIR    || '/Users/davidnows/sinkia/data';
const UPLOADS_DIR = process.env.UPLOADS_DIR || '/Users/davidnows/sinkia/uploads';
const EMAILS_FILE = path.join(DATA_DIR, 'emails.json');
const STATE_FILE  = path.join(DATA_DIR, 'email_state.json');

// Extensiones de adjunto que procesamos
const PROCESSABLE = ['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.docx', '.txt'];

// ── DB helpers ──────────────────────────────────────────────────────────────
async function loadJSON(file, def) {
  try { return existsSync(file) ? JSON.parse(await readFile(file, 'utf8')) : def; }
  catch { return def; }
}
async function saveJSON(file, data) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(data, null, 2));
}

// ── Guardar adjunto en disco ────────────────────────────────────────────────
async function saveAttachment(attachment, emailSubject) {
  await mkdir(UPLOADS_DIR, { recursive: true });
  const safeName = (attachment.filename || 'adjunto')
    .replace(/[^a-zA-Z0-9.\-_]/g, '_').slice(0, 80);
  const fname    = `email_${Date.now()}_${safeName}`;
  const fpath    = path.join(UPLOADS_DIR, fname);
  await writeFile(fpath, attachment.content);
  return { path: fpath, name: safeName, mime: attachment.contentType || 'application/octet-stream' };
}

// ── Procesar adjuntos de un email ───────────────────────────────────────────
async function processAttachments(email, attachments) {
  const results = [];
  for (const att of attachments) {
    const ext = path.extname(att.filename || '').toLowerCase();
    if (!PROCESSABLE.includes(ext)) continue;
    if (!att.content || att.content.length < 500) continue; // ignorar archivos vacíos

    try {
      const saved = await saveAttachment(att, email.subject);
      console.log(`[EMAIL] 📎 Procesando adjunto: ${saved.name}`);
      const doc = await processDocument(saved.path, saved.mime, saved.name);
      results.push({
        filename:     saved.name,
        documento_id: doc.id,
        tipo:         doc.analisis?.tipo,
        total:        doc.analisis?.total,
        emisor:       doc.analisis?.emisor?.nombre,
        resumen:      doc.analisis?.resumen,
      });
      console.log(`[EMAIL] ✓ ${saved.name} → ${doc.analisis?.tipo}`);
    } catch (err) {
      console.warn(`[EMAIL] ✗ Adjunto ${att.filename}: ${err.message}`);
      results.push({ filename: att.filename, error: err.message });
    }
  }
  return results;
}

// ── Sync principal ──────────────────────────────────────────────────────────
export async function syncEmails() {
  console.log('[EMAIL] Iniciando sincronización...');
  if (!process.env.EMAIL_APP_PASSWORD) {
    console.log('[EMAIL] Sin EMAIL_APP_PASSWORD — omitiendo');
    return { success: false, error: 'no password' };
  }

  const state         = await loadJSON(STATE_FILE, { processed_ids: [] });
  const existingEmails = await loadJSON(EMAILS_FILE, []);
  const existingIds   = new Set(existingEmails.map(e => e.message_id));
  const processedIds  = new Set(state.processed_ids || []);
  const newEmails     = [];

  const imapConfig = {
    user:       process.env.EMAIL_USER || 'info@chickenpalace.es',
    password:   process.env.EMAIL_APP_PASSWORD,
    host:       'imap.gmail.com',
    port:       993,
    tls:        true,
    tlsOptions: { rejectUnauthorized: false },
    connTimeout: 30000,
    authTimeout: 30000,
  };

  try {
    await new Promise((resolve, reject) => {
      const imap = new Imap(imapConfig);

      imap.once('ready', () => {
        imap.openBox('INBOX', true, (err) => {
          if (err) { imap.end(); reject(err); return; }

          const since = new Date();
          since.setDate(since.getDate() - 60); // Últimos 60 días
          const sinceStr = since.toISOString().split('T')[0];

          imap.search([['SINCE', sinceStr]], async (err, results) => {
            if (err || !results?.length) { imap.end(); resolve(); return; }

            const ids = results.slice(-100); // Máx 100 emails por ciclo
            const f   = imap.fetch(ids, { bodies: '', struct: true });
            let pending = ids.length;

            f.on('message', (msg) => {
              msg.on('body', (stream) => {
                simpleParser(stream, async (err, parsed) => {
                  try {
                    if (!err && parsed.messageId && !existingIds.has(parsed.messageId)) {
                      const atts        = parsed.attachments || [];
                      const hasDocAtts  = atts.some(a => {
                        const ext = path.extname(a.filename || '').toLowerCase();
                        return PROCESSABLE.includes(ext);
                      });

                      const emailRecord = {
                        message_id:     parsed.messageId,
                        subject:        parsed.subject || '(sin asunto)',
                        sender_name:    parsed.from?.value?.[0]?.name || '',
                        sender_email:   parsed.from?.value?.[0]?.address || '',
                        received_date:  (parsed.date || new Date()).toISOString(),
                        body_preview:   (parsed.text || '').slice(0, 500),
                        has_attachments: atts.length > 0,
                        attachment_names: atts.map(a => a.filename || '').filter(Boolean),
                        has_doc_attachments: hasDocAtts,
                        documentos_procesados: [],
                        synced_at:      new Date().toISOString(),
                        estado:         hasDocAtts ? 'pendiente_procesar' : 'sin_adjuntos',
                      };

                      // Procesar adjuntos relevantes automáticamente
                      if (hasDocAtts && !processedIds.has(parsed.messageId)) {
                        try {
                          const docs = await processAttachments(emailRecord, atts);
                          emailRecord.documentos_procesados = docs;
                          emailRecord.estado = 'procesado';
                          processedIds.add(parsed.messageId);
                        } catch (pe) {
                          emailRecord.estado = `error: ${pe.message}`;
                        }
                      }

                      newEmails.push(emailRecord);
                    }
                  } catch {}

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

    if (newEmails.length > 0) {
      const allEmails = [...newEmails, ...existingEmails].slice(0, 5000);
      await saveJSON(EMAILS_FILE, allEmails);

      // Guardar estado
      await saveJSON(STATE_FILE, {
        processed_ids: [...processedIds].slice(-2000),
        last_sync:     new Date().toISOString(),
      });

      const conDocs = newEmails.filter(e => e.documentos_procesados?.length > 0);
      console.log(`[EMAIL] ✓ ${newEmails.length} nuevos — ${conDocs.length} con documentos procesados`);
    } else {
      console.log('[EMAIL] Sin emails nuevos');
    }

    return { success: true, nuevos: newEmails.length, con_documentos: newEmails.filter(e => e.has_doc_attachments).length };
  } catch (err) {
    console.error('[EMAIL] ✗ Error:', err.message);
    return { success: false, error: err.message };
  }
}

// Lectura asíncrona del historial de emails (compatible con ES modules)
export const getEmails = () => loadJSON(EMAILS_FILE, []);
