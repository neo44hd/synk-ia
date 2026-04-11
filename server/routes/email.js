import { Router } from 'express';
import Imap from 'imap';
import { simpleParser } from 'mailparser';
import fs from 'fs';
import path from 'path';

export const emailRouter = Router();

// ── Persistencia directa en /data/*.json ────────────────────────────────────
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
function readJSON(entity) {
  const file = path.join(DATA_DIR, `${entity}.json`);
  try { return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : []; } catch { return []; }
}
function writeJSON(entity, data) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(path.join(DATA_DIR, `${entity}.json`), JSON.stringify(data, null, 2));
}

const getImapConfig = () => ({
  user: process.env.EMAIL_USER || 'info@chickenpalace.es',
  password: process.env.EMAIL_APP_PASSWORD,
  host: 'imap.gmail.com',
  port: 993,
  tls: true,
  tlsOptions: { rejectUnauthorized: false }
});

// Auto-classify document type from subject/filename/sender
function classifyDocument(subject, filename, from) {
  const s = (subject || '').toLowerCase();
  const f = (filename || '').toLowerCase();
  const fr = (from || '').toLowerCase();
  // Nominas / Hojas de salario
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

// Extract provider/sender name from email
function extractProvider(from) {
  if (!from) return 'Desconocido';
  const nameMatch = from.match(/^"?([^"<]+)"?\s*</);
  if (nameMatch) return nameMatch[1].trim();
  const emailMatch = from.match(/<([^>]+)>/) || from.match(/([^@]+)@/);
  if (emailMatch) return emailMatch[1].split('@')[0];
  return from;
}

// Debug: verificar DATA_DIR y archivos existentes
emailRouter.get('/debug-data', (req, res) => {
  const files = fs.existsSync(DATA_DIR) ? fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json')) : [];
  const sizes = {};
  files.forEach(f => {
    try {
      const content = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8'));
      sizes[f] = Array.isArray(content) ? content.length : 'not-array';
    } catch { sizes[f] = 'parse-error'; }
  });
  res.json({ DATA_DIR, cwd: process.cwd(), files, sizes });
});

// Test connection
emailRouter.get('/test', async (req, res) => {
  try {
    if (!process.env.EMAIL_APP_PASSWORD) return res.json({ success: false, error: 'EMAIL_APP_PASSWORD not configured' });
    const imap = new Imap(getImapConfig());
    await new Promise((resolve, reject) => {
      imap.once('ready', () => { imap.end(); resolve(); });
      imap.once('error', reject);
      imap.connect();
    });
    res.json({ success: true, message: 'Gmail connected', user: process.env.EMAIL_USER || 'info@chickenpalace.es' });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

// Helper: scan emails and return parsed data
async function scanEmails({ since = '2025-01-01', limit = 200, folder = 'INBOX', includeContent = false, typeFilter = null }) {
  const imap = new Imap(getImapConfig());
  const documents = [];
  const providers = new Map();
  let totalEmails = 0;

  await new Promise((resolve, reject) => {
    imap.once('ready', () => {
      imap.openBox(folder, true, (err, box) => {
        if (err) { reject(err); return; }
        totalEmails = box.messages.total;
        imap.search([['SINCE', since]], (err, results) => {
          if (err) { reject(err); return; }
          if (!results.length) { imap.end(); resolve(); return; }
          const ids = results.slice(-parseInt(limit));
          const f = imap.fetch(ids, { bodies: '', struct: true });
          let pending = ids.length;
          f.on('message', (msg) => {
            msg.on('body', (stream) => {
              simpleParser(stream, (err, parsed) => {
                if (!err) {
                  const attachments = (parsed.attachments || []).filter(
                    a => a.contentType === 'application/pdf' ||
                    a.filename?.toLowerCase().endsWith('.pdf') ||
                    a.contentType?.includes('image') ||
                    a.filename?.toLowerCase().match(/\.(xlsx?|csv|doc|docx)$/)
                  );
                  if (attachments.length > 0) {
                    const providerName = extractProvider(parsed.from?.text);
                    const providerEmail = parsed.from?.text?.match(/<([^>]+)>/)?.[1] || parsed.from?.text;
                    if (!providers.has(providerEmail)) {
                      providers.set(providerEmail, { name: providerName, email: providerEmail, docCount: 0 });
                    }
                    providers.get(providerEmail).docCount++;
                    attachments.forEach(a => {
                      const docType = classifyDocument(parsed.subject, a.filename, parsed.from?.text);
                      if (typeFilter && docType !== typeFilter) return;
                      const doc = {
                        type: docType,
                        provider: providerName,
                        providerEmail,
                        subject: parsed.subject,
                        date: parsed.date,
                        filename: a.filename,
                        fileSize: a.size,
                        contentType: a.contentType,
                        messageId: parsed.messageId
                      };
                      if (includeContent) {
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
          f.once('error', () => { imap.end(); });
        });
      });
    });
    imap.once('end', resolve);
    imap.once('error', reject);
    imap.connect();
  });
  await new Promise(r => setTimeout(r, 2000));
  return { documents, providers, totalEmails };
}

// SCAN - full extraction with classification
emailRouter.get('/scan', async (req, res) => {
  try {
    const { since = '2025-01-01', limit = 200, folder = 'INBOX' } = req.query;
    const { documents, providers, totalEmails } = await scanEmails({ since, limit, folder });
    const byType = {};
    documents.forEach(d => { byType[d.type] = (byType[d.type] || 0) + 1; });
    const providerList = [...providers.values()].sort((a, b) => b.docCount - a.docCount);
    res.json({
      success: true,
      account: process.env.EMAIL_USER || 'info@chickenpalace.es',
      totalEmailsInBox: totalEmails,
      scannedSince: since,
      summary: { totalDocuments: documents.length, byType, providersFound: providerList.length },
      providers: providerList,
      documents: documents.sort((a, b) => new Date(b.date) - new Date(a.date))
    });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// PAYSLIPS - extract nominas/hojas de salario with PDF content
emailRouter.get('/payslips', async (req, res) => {
  try {
    const { since = '2025-01-01', limit = 100 } = req.query;
    const { documents } = await scanEmails({ since, limit, typeFilter: 'nomina', includeContent: true });
    // Group by month
    const byMonth = {};
    documents.forEach(d => {
      const date = new Date(d.date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!byMonth[key]) byMonth[key] = [];
      byMonth[key].push(d);
    });
    res.json({
      success: true,
      count: documents.length,
      byMonth,
      payslips: documents.sort((a, b) => new Date(b.date) - new Date(a.date))
    });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// WORKERS - extract worker names from payslip filenames and email data
emailRouter.get('/workers', async (req, res) => {
  try {
    const { since = '2024-01-01' } = req.query;
    const { documents } = await scanEmails({ since, limit: 500, typeFilter: 'nomina' });
    // Extract worker info from filenames and subjects
    const workers = new Map();
    documents.forEach(d => {
      // Try to extract worker name from filename patterns
      // e.g. "00430_CHICKEN PALACE IBIZA, S.L..PDF" = company file
      // e.g. "4 CH ABRIL.pdf" = could be worker count/schedule
      // Track all payslip documents
      const date = new Date(d.date);
      const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const key = d.providerEmail + '_' + month;
      if (!workers.has(d.providerEmail)) {
        workers.set(d.providerEmail, {
          source: d.provider,
          email: d.providerEmail,
          documents: [],
          months: new Set()
        });
      }
      const w = workers.get(d.providerEmail);
      w.documents.push({ filename: d.filename, date: d.date, size: d.fileSize, subject: d.subject });
      w.months.add(month);
    });
    const workerSources = [...workers.values()].map(w => ({
      ...w,
      months: [...w.months].sort(),
      documentCount: w.documents.length
    }));
    res.json({
      success: true,
      totalPayslipDocs: documents.length,
      sources: workerSources,
      tip: 'Las nominas vienen de laboral@vtrgestion.com - los PDFs contienen los datos de cada trabajador'
    });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// Fetch emails (basic)
emailRouter.get('/fetch', async (req, res) => {
  try {
    const { folder = 'INBOX', limit = 50, since } = req.query;
    const imap = new Imap(getImapConfig());
    const emails = [];
    await new Promise((resolve, reject) => {
      imap.once('ready', () => {
        imap.openBox(folder, true, (err) => {
          if (err) { reject(err); return; }
          const searchCriteria = since ? [['SINCE', since]] : ['ALL'];
          imap.search(searchCriteria, (err, results) => {
            if (err) { reject(err); return; }
            if (!results.length) { imap.end(); resolve(); return; }
            const ids = results.slice(-parseInt(limit));
            const f = imap.fetch(ids, { bodies: '', struct: true });
            f.on('message', (msg) => {
              msg.on('body', (stream) => {
                simpleParser(stream, (err, parsed) => {
                  if (!err) {
                    emails.push({
                      id: parsed.messageId,
                      from: parsed.from?.text,
                      to: parsed.to?.text,
                      subject: parsed.subject,
                      date: parsed.date,
                      text: parsed.text?.substring(0, 500),
                      attachments: (parsed.attachments || []).map(a => ({
                        filename: a.filename, contentType: a.contentType, size: a.size
                      }))
                    });
                  }
                });
              });
            });
            f.once('end', () => { imap.end(); });
          });
        });
      });
      imap.once('end', resolve);
      imap.once('error', reject);
      imap.connect();
    });
    await new Promise(r => setTimeout(r, 1000));
    res.json({ success: true, count: emails.length, emails });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// Invoices (with base64 content for download)
emailRouter.get('/invoices', async (req, res) => {
  try {
    const { since = '2025-01-01', limit = 100 } = req.query;
    const { documents } = await scanEmails({ since, limit, typeFilter: 'factura', includeContent: true });
    res.json({
      success: true,
      count: documents.length,
      invoices: documents.sort((a, b) => new Date(b.date) - new Date(a.date))
    });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// INVOICES-DETAIL - Parse PDFs, extract line items, prices per provider
// Uses pdf-parse to extract text and detect product lines
emailRouter.get('/invoices-detail', async (req, res) => {
  try {
    const { since = '2025-01-01', limit = 100 } = req.query;
    let pdfParse;
    try { pdfParse = (await import('pdf-parse')).default; } catch(e) { pdfParse = null; }

    const { documents } = await scanEmails({ since, limit, typeFilter: 'factura', includeContent: true });

    const parsed = await Promise.all(documents.map(async (doc) => {
      let items = [];
      let total = null;
      let invoiceNumber = null;
      let invoiceDate = doc.date;
      let rawText = '';

      if (pdfParse && doc.content) {
        try {
          const buf = Buffer.from(doc.content, 'base64');
          const data = await pdfParse(buf);
          rawText = data.text || '';

          // Extract invoice number
          const numMatch = rawText.match(/(?:factura|invoice|fra\.?|n[uú]mero)[\s:#]*([A-Z0-9\-\/]+)/i);
          if (numMatch) invoiceNumber = numMatch[1].trim();

          // Extract total
          const totalMatch = rawText.match(/(?:total|importe total|total factura)[\s:€$]*([\d.,]+)/i);
          if (totalMatch) total = parseFloat(totalMatch[1].replace(',', '.').replace(/\./g, (m, o, s) => o === s.lastIndexOf('.') ? '.' : ''));

          // Extract line items - look for patterns: description + qty + price
          const lines = rawText.split('\n').filter(l => l.trim().length > 2);
          lines.forEach(line => {
            // Pattern: text followed by numbers (qty x price = total)
            const itemMatch = line.match(/^(.+?)\s+(\d+[,.]?\d*)\s+([\d.,]+)\s*€?\s+([\d.,]+)\s*€?/);
            if (itemMatch) {
              const name = itemMatch[1].trim();
              const qty = parseFloat(itemMatch[2].replace(',', '.'));
              const unitPrice = parseFloat(itemMatch[3].replace(',', '.'));
              const lineTotal = parseFloat(itemMatch[4].replace(',', '.'));
              if (name.length > 2 && name.length < 80 && qty > 0 && unitPrice > 0) {
                items.push({ name, qty, unitPrice, lineTotal });
              }
            }
            // Simpler: description + price at end
            const simpleMatch = line.match(/^([A-Za-zà-ž\s]{4,50})\s+([\d.,]+)\s*€?\s*$/);
            if (simpleMatch && items.length === 0) {
              const name = simpleMatch[1].trim();
              const price = parseFloat(simpleMatch[2].replace(',', '.'));
              if (price > 0 && price < 10000) items.push({ name, qty: 1, unitPrice: price, lineTotal: price });
            }
          });
        } catch(parseErr) {
          rawText = '(parse error: ' + parseErr.message + ')';
        }
      }

      return {
        provider: doc.provider,
        providerEmail: doc.providerEmail,
        filename: doc.filename,
        subject: doc.subject,
        date: doc.date,
        fileSize: doc.fileSize,
        invoiceNumber,
        total,
        items,
        hasContent: !!doc.content,
        textLength: rawText.length
      };
    }));

    // Group by provider
    const byProvider = {};
    parsed.forEach(inv => {
      const key = inv.providerEmail || inv.provider;
      if (!byProvider[key]) {
        byProvider[key] = {
          name: inv.provider,
          email: inv.providerEmail,
          invoices: [],
          totalSpend: 0,
          allItems: []
        };
      }
      byProvider[key].invoices.push(inv);
      if (inv.total) byProvider[key].totalSpend += inv.total;
      byProvider[key].allItems.push(...inv.items);
    });

    // Build item stats per provider (most ordered, price history)
    const providers = Object.values(byProvider).map(p => {
      const itemMap = {};
      p.allItems.forEach(item => {
        const k = item.name.toLowerCase().trim();
        if (!itemMap[k]) itemMap[k] = { name: item.name, totalQty: 0, totalSpend: 0, priceHistory: [], appearances: 0 };
        itemMap[k].totalQty += item.qty;
        itemMap[k].totalSpend += item.lineTotal;
        itemMap[k].priceHistory.push(item.unitPrice);
        itemMap[k].appearances++;
      });
      const topItems = Object.values(itemMap)
        .sort((a, b) => b.appearances - a.appearances)
        .slice(0, 20)
        .map(i => ({
          ...i,
          avgPrice: i.totalSpend / i.totalQty,
          minPrice: Math.min(...i.priceHistory),
          maxPrice: Math.max(...i.priceHistory),
          priceVariation: i.priceHistory.length > 1 ? ((Math.max(...i.priceHistory) - Math.min(...i.priceHistory)) / Math.min(...i.priceHistory) * 100).toFixed(1) : '0'
        }));
      return {
        name: p.name,
        email: p.email,
        invoiceCount: p.invoices.length,
        totalSpend: Math.round(p.totalSpend * 100) / 100,
        invoices: p.invoices.sort((a, b) => new Date(b.date) - new Date(a.date)),
        topItems
      };
    }).sort((a, b) => b.totalSpend - a.totalSpend);

    res.json({
      success: true,
      totalInvoices: parsed.length,
      providers
    });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// Fetch emails with pagination support
emailRouter.get('/fetch-page', async (req, res) => {
  try {
    const { folder = 'INBOX', limit = 100, since = '2026-01-01', page = 1 } = req.query;
    const imap = new Imap(getImapConfig());
    const emails = [];
    await new Promise((resolve, reject) => {
      imap.once('ready', () => {
        imap.openBox(folder, true, (err) => {
          if (err) { reject(err); return; }
          const searchCriteria = [['SINCE', since]];
          imap.search(searchCriteria, (err, results) => {
            if (err) { reject(err); return; }
            if (!results.length) { imap.end(); resolve(); return; }
            const lim = parseInt(limit);
            const pg = parseInt(page);
            const totalResults = results.length;
            const totalPages = Math.ceil(totalResults / lim);
            const start = Math.max(0, totalResults - (lim * pg));
            const end = Math.max(0, totalResults - (lim * (pg - 1)));
            if (start >= end) { imap.end(); resolve(); return; }
            const ids = results.slice(start, end);
            const f = imap.fetch(ids, { bodies: '', struct: true });
            let pending = ids.length;
            f.on('message', (msg) => {
              msg.on('body', (stream) => {
                simpleParser(stream, (err, parsed) => {
                  if (!err) {
                    emails.push({
                      id: parsed.messageId,
                      from: parsed.from?.text,
                      to: parsed.to?.text,
                      subject: parsed.subject,
                      date: parsed.date,
                      text: parsed.text?.substring(0, 500),
                      attachments: (parsed.attachments || []).map(a => ({
                        filename: a.filename, contentType: a.contentType, size: a.size
                      }))
                    });
                  }
                  pending--;
                  if (pending <= 0) imap.end();
                });
              });
            });
            f.once('end', () => { imap.end(); });
          });
        });
      });
      imap.once('end', resolve);
      imap.once('error', reject);
      imap.connect();
    });
    await new Promise(r => setTimeout(r, 1000));
    res.json({ success: true, count: emails.length, page: parseInt(page), emails });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  POST /api/email/sync — Sincronización completa: IMAP → proveedores + facturas
//  Escanea emails, extrae documentos, persiste en /data/provider.json e invoice.json
//  Idempotente: usa messageId+filename como clave única para no duplicar
// ═══════════════════════════════════════════════════════════════════════════════
emailRouter.post('/sync', async (req, res) => {
  try {
    const { since = '2025-01-01', limit = 300 } = req.body || {};
    console.log(`[EMAIL-SYNC] Iniciando sincronización desde ${since}, límite ${limit}...`);

    // 1. Escanear emails vía IMAP
    const { documents, providers: providerMap, totalEmails } = await scanEmails({ since, limit, includeContent: false });
    console.log(`[EMAIL-SYNC] ${documents.length} documentos de ${providerMap.size} proveedores`);

    // 2. Cargar proveedores existentes
    let existingProviders = readJSON('provider');
    const providerByEmail = new Map(existingProviders.map(p => [p.email, p]));
    let newProviders = 0;
    let updatedProviders = 0;

    for (const [email, pData] of providerMap) {
      if (providerByEmail.has(email)) {
        // Actualizar conteo
        const existing = providerByEmail.get(email);
        existing.doc_count = pData.docCount;
        existing.updated_date = new Date().toISOString();
        updatedProviders++;
      } else {
        // Nuevo proveedor
        const newProv = {
          id: 'prov_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
          name: pData.name,
          email: pData.email,
          doc_count: pData.docCount,
          category: 'auto-detected',
          status: 'active',
          source: 'email-sync',
          created_date: new Date().toISOString(),
          updated_date: new Date().toISOString()
        };
        existingProviders.push(newProv);
        providerByEmail.set(email, newProv);
        newProviders++;
      }
    }
    writeJSON('provider', existingProviders);

    // 3. Cargar facturas/documentos existentes
    let existingInvoices = readJSON('invoice');
    const invoiceKeys = new Set(existingInvoices.map(i => `${i.message_id}::${i.filename}`));
    let newInvoices = 0;
    let skippedDuplicates = 0;

    for (const doc of documents) {
      const key = `${doc.messageId}::${doc.filename}`;
      if (invoiceKeys.has(key)) {
        skippedDuplicates++;
        continue;
      }

      const provider = providerByEmail.get(doc.providerEmail);
      const newInv = {
        id: 'inv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        type: doc.type,
        provider_name: doc.provider,
        provider_email: doc.providerEmail,
        provider_id: provider?.id || null,
        subject: doc.subject,
        date: doc.date,
        filename: doc.filename,
        file_size: doc.fileSize,
        content_type: doc.contentType,
        message_id: doc.messageId,
        status: 'pending_review',
        source: 'email-sync',
        created_date: new Date().toISOString(),
        updated_date: new Date().toISOString()
      };
      existingInvoices.push(newInv);
      invoiceKeys.add(key);
      newInvoices++;
    }
    writeJSON('invoice', existingInvoices);

    // 4. Guardar estado de sincronización
    const syncState = readJSON('emailintegration');
    const syncRecord = {
      id: syncState[0]?.id || 'emailsync_main',
      last_sync: new Date().toISOString(),
      account: process.env.EMAIL_USER || 'info@chickenpalace.es',
      total_emails_scanned: totalEmails,
      documents_found: documents.length,
      providers_total: existingProviders.length,
      invoices_total: existingInvoices.length,
      updated_date: new Date().toISOString()
    };
    writeJSON('emailintegration', [syncRecord]);

    const result = {
      success: true,
      sync: {
        scanned_since: since,
        total_emails_in_box: totalEmails,
        documents_found: documents.length,
        providers: {
          new: newProviders,
          updated: updatedProviders,
          total: existingProviders.length
        },
        invoices: {
          new: newInvoices,
          duplicates_skipped: skippedDuplicates,
          total: existingInvoices.length
        }
      }
    };
    console.log(`[EMAIL-SYNC] Completado:`, JSON.stringify(result.sync, null, 2));
    res.json(result);
  } catch (err) {
    console.error('[EMAIL-SYNC] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});
