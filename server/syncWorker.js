/**
 * SYNK-IA Sync Worker - Sincronizacion automatica 24/7
 * Ejecuta tareas periodicas: email scan, Revo sync, clasificacion IA
 */
import Imap from 'imap';
import { simpleParser } from 'mailparser';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:7b';
const DATA_DIR = process.env.DATA_DIR || '/opt/sinkia-backend/data';

import fs from 'fs';
import path from 'path';

// Simple JSON file store for synced data
function loadStore(name) {
  const file = path.join(DATA_DIR, `${name}.json`);
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return []; }
}
function saveStore(name, data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(path.join(DATA_DIR, `${name}.json`), JSON.stringify(data, null, 2));
}

// ========== EMAIL SYNC ==========
async function syncEmails() {
  console.log('[WORKER] Starting email sync...');
  if (!process.env.EMAIL_APP_PASSWORD) {
    console.log('[WORKER] EMAIL_APP_PASSWORD not set, skipping');
    return { success: false, error: 'no password' };
  }
  const config = {
    user: process.env.EMAIL_USER || 'info@chickenpalace.es',
    password: process.env.EMAIL_APP_PASSWORD,
    host: 'imap.gmail.com', port: 993, tls: true,
    tlsOptions: { rejectUnauthorized: false }
  };
  const existingEmails = loadStore('emails');
  const existingIds = new Set(existingEmails.map(e => e.message_id));
  const newEmails = [];
  try {
    const imap = new Imap(config);
    await new Promise((resolve, reject) => {
      imap.once('ready', () => {
        imap.openBox('INBOX', true, (err, box) => {
          if (err) { reject(err); return; }
          const since = new Date();
          since.setMonth(since.getMonth() - 2);
          const sinceStr = since.toISOString().split('T')[0];
          imap.search([['SINCE', sinceStr]], (err, results) => {
            if (err || !results.length) { imap.end(); resolve(); return; }
            const ids = results.slice(-200);
            const f = imap.fetch(ids, { bodies: '', struct: true });
            let pending = ids.length;
            f.on('message', (msg) => {
              msg.on('body', (stream) => {
                simpleParser(stream, (err, parsed) => {
                  if (!err && parsed.messageId && !existingIds.has(parsed.messageId)) {
                    const hasAttachments = (parsed.attachments || []).length > 0;
                    const attachmentNames = (parsed.attachments || []).map(a => a.filename || '').filter(Boolean);
                    newEmails.push({
                      message_id: parsed.messageId,
                      subject: parsed.subject || '(sin asunto)',
                      sender_name: parsed.from?.value?.[0]?.name || '',
                      sender_email: parsed.from?.value?.[0]?.address || parsed.from?.text || '',
                      received_date: (parsed.date || new Date()).toISOString(),
                      body_preview: (parsed.text || '').substring(0, 500),
                      html_body: (parsed.html || '').substring(0, 10000),
                      has_attachments: hasAttachments,
                      attachment_names: attachmentNames,
                      is_read: false,
                      is_starred: false,
                      folder: 'inbox',
                      category: 'otros',
                      ai_summary: '',
                      ai_action: '',
                      priority: 'media',
                      synced_at: new Date().toISOString()
                    });
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
    await new Promise(r => setTimeout(r, 2000));
    if (newEmails.length > 0) {
      // Classify with Ollama if available
      for (const email of newEmails) {
        try {
          const cls = await classifyEmailWithOllama(email);
          if (cls) {
            email.category = cls.category || 'otros';
            email.priority = cls.priority || 'media';
            email.ai_summary = cls.summary || '';
            email.ai_action = cls.action || '';
            email.folder = cls.category === 'factura' ? 'facturas' : cls.category === 'marketing' ? 'spam' : 'inbox';
          }
        } catch (e) {
          console.warn('[WORKER] Ollama classify failed:', e.message);
        }
      }
      const allEmails = [...newEmails, ...existingEmails].slice(0, 2000);
      saveStore('emails', allEmails);
      console.log(`[WORKER] Email sync: ${newEmails.length} new emails`);
    }
    return { success: true, new_emails: newEmails.length, total: existingEmails.length + newEmails.length };
  } catch (err) {
    console.error('[WORKER] Email sync error:', err.message);
    return { success: false, error: err.message };
  }
}

// ========== REVO XEF SYNC ==========
async function syncRevo() {
  console.log('[WORKER] Starting Revo XEF sync...');
  if (!process.env.REVO_TOKEN_LARGO) {
    console.log('[WORKER] REVO_TOKEN_LARGO not set, skipping');
    return { success: false, error: 'no token' };
  }
  const headers = {
    'Authorization': `Bearer ${process.env.REVO_TOKEN_LARGO}`,
    'Content-Type': 'application/json'
  };
  if (process.env.REVO_TOKEN_CORTO) headers['X-API-Key'] = process.env.REVO_TOKEN_CORTO;
  const revoFetch = async (endpoint) => {
    const res = await fetch(`https://integrations.revoxef.works/api/v1${endpoint}`, { headers });
    if (!res.ok) throw new Error(`Revo ${res.status}`);
    return res.json();
  };
  try {
    // Sync products
    const products = await revoFetch('/catalog/products');
    saveStore('revo_products', products.data || products);
    // Sync categories
    const categories = await revoFetch('/catalog/categories');
    saveStore('revo_categories', categories.data || categories);
    // Sync recent sales (last 30 days)
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const sinceStr = since.toISOString().split('T')[0];
    const sales = await revoFetch(`/orders?since=${sinceStr}`);
    const existingSales = loadStore('revo_sales');
    const existingIds = new Set(existingSales.map(s => s.id));
    const newSales = (sales.data || sales || []).filter(s => !existingIds.has(s.id));
    const allSales = [...newSales, ...existingSales].slice(0, 5000);
    saveStore('revo_sales', allSales);
    const result = {
      success: true,
      products: (products.data || products || []).length,
      categories: (categories.data || categories || []).length,
      new_sales: newSales.length,
      total_sales: allSales.length
    };
    console.log(`[WORKER] Revo sync: ${result.products} products, ${result.new_sales} new sales`);
    return result;
  } catch (err) {
    console.error('[WORKER] Revo sync error:', err.message);
    return { success: false, error: err.message };
  }
}

// ========== OLLAMA CLASSIFICATION ==========
async function classifyEmailWithOllama(email) {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt: `De: ${email.sender_email}\nAsunto: ${email.subject}\nContenido: ${(email.body_preview || '').substring(0, 1000)}`,
        system: 'Clasifica este email. Devuelve SOLO JSON: {"category":"factura|proveedor|cliente|rrhh|gestoria|marketing|interno|otro","priority":"alta|media|baja","summary":"resumen corto","action":"accion o null"}',
        stream: false,
        format: 'json',
        options: { temperature: 0.1 }
      })
    });
    if (!res.ok) return null;
    const data = await res.json();
    return JSON.parse(data.response);
  } catch { return null; }
}

// ========== WORKER SCHEDULER ==========
const INTERVALS = {
  email: 5 * 60 * 1000,   // Every 5 minutes
  revo: 15 * 60 * 1000,   // Every 15 minutes
};

let lastSync = { email: null, revo: null };
let syncResults = { email: null, revo: null };

async function runEmailSync() {
  try {
    syncResults.email = await syncEmails();
    lastSync.email = new Date().toISOString();
  } catch (e) { console.error('[WORKER] Email sync crashed:', e); }
}

async function runRevoSync() {
  try {
    syncResults.revo = await syncRevo();
    lastSync.revo = new Date().toISOString();
  } catch (e) { console.error('[WORKER] Revo sync crashed:', e); }
}

export function startSyncWorker() {
  console.log('[WORKER] Starting sync worker 24/7...');
  console.log(`[WORKER] Email interval: ${INTERVALS.email / 1000}s`);
  console.log(`[WORKER] Revo interval: ${INTERVALS.revo / 1000}s`);
  // Initial sync after 10s delay
  setTimeout(() => runEmailSync(), 10000);
  setTimeout(() => runRevoSync(), 15000);
  // Periodic sync
  setInterval(() => runEmailSync(), INTERVALS.email);
  setInterval(() => runRevoSync(), INTERVALS.revo);
}

export function getSyncStatus() {
  return { lastSync, results: syncResults, intervals: INTERVALS };
}

// Export data access for API routes
export function getEmails() { return loadStore('emails'); }
export function getProducts() { return loadStore('revo_products'); }
export function getCategories() { return loadStore('revo_categories'); }
export function getSales() { return loadStore('revo_sales'); }
export { syncEmails, syncRevo };
