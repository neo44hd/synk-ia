import { Router } from 'express';
import Imap from 'imap';
import { simpleParser } from 'mailparser';

export const emailRouter = Router();

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
  if (f.includes('nomina') || s.includes('nomina') || s.includes('nómina') || f.includes('payslip')) return 'nomina';
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

// SCAN - full extraction with classification (no base64, metadata only)
emailRouter.get('/scan', async (req, res) => {
  try {
    const { since = '2025-01-01', limit = 200, folder = 'INBOX' } = req.query;
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
                        documents.push({
                          type: docType,
                          provider: providerName,
                          providerEmail,
                          subject: parsed.subject,
                          date: parsed.date,
                          filename: a.filename,
                          fileSize: a.size,
                          contentType: a.contentType,
                          messageId: parsed.messageId
                        });
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

    // Build summary
    const byType = {};
    documents.forEach(d => { byType[d.type] = (byType[d.type] || 0) + 1; });

    const providerList = [...providers.values()].sort((a, b) => b.docCount - a.docCount);

    res.json({
      success: true,
      account: process.env.EMAIL_USER || 'info@chickenpalace.es',
      totalEmailsInBox: totalEmails,
      scannedSince: since,
      summary: {
        totalDocuments: documents.length,
        byType,
        providersFound: providerList.length
      },
      providers: providerList,
      documents: documents.sort((a, b) => new Date(b.date) - new Date(a.date))
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
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
    const imap = new Imap(getImapConfig());
    const invoices = [];
    await new Promise((resolve, reject) => {
      imap.once('ready', () => {
        imap.openBox('INBOX', true, (err) => {
          if (err) { reject(err); return; }
          imap.search([['SINCE', since]], (err, results) => {
            if (err) { reject(err); return; }
            if (!results.length) { imap.end(); resolve(); return; }
            const ids = results.slice(-parseInt(limit));
            const f = imap.fetch(ids, { bodies: '', struct: true });
            f.on('message', (msg) => {
              msg.on('body', (stream) => {
                simpleParser(stream, (err, parsed) => {
                  if (!err) {
                    const pdfs = (parsed.attachments || []).filter(
                      a => a.contentType === 'application/pdf' || a.filename?.toLowerCase().endsWith('.pdf')
                    );
                    if (pdfs.length > 0) {
                      invoices.push({
                        from: parsed.from?.text,
                        subject: parsed.subject,
                        date: parsed.date,
                        attachments: pdfs.map(a => ({
                          filename: a.filename, size: a.size,
                          content: a.content.toString('base64')
                        }))
                      });
                    }
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
    await new Promise(r => setTimeout(r, 2000));
    res.json({ success: true, count: invoices.length, invoices });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});
