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

// Test connection
emailRouter.get('/test', async (req, res) => {
  try {
    if (!process.env.EMAIL_APP_PASSWORD) {
      return res.json({ success: false, error: 'EMAIL_APP_PASSWORD not configured' });
    }
    const imap = new Imap(getImapConfig());
    await new Promise((resolve, reject) => {
      imap.once('ready', () => { imap.end(); resolve(); });
      imap.once('error', reject);
      imap.connect();
    });
    res.json({ success: true, message: 'Gmail connected successfully', user: process.env.EMAIL_USER });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// Fetch emails
emailRouter.get('/fetch', async (req, res) => {
  try {
    const { folder = 'INBOX', limit = 50, since } = req.query;
    const imap = new Imap(getImapConfig());
    const emails = [];

    await new Promise((resolve, reject) => {
      imap.once('ready', () => {
        imap.openBox(folder, true, (err, box) => {
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
                      html: parsed.html?.substring(0, 2000),
                      attachments: (parsed.attachments || []).map(a => ({
                        filename: a.filename,
                        contentType: a.contentType,
                        size: a.size
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

    // Wait for parsing
    await new Promise(r => setTimeout(r, 1000));
    res.json({ success: true, count: emails.length, emails });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Fetch invoices (emails with PDF attachments)
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
                    const pdfAttachments = (parsed.attachments || []).filter(
                      a => a.contentType === 'application/pdf' ||
                           a.filename?.toLowerCase().endsWith('.pdf')
                    );
                    if (pdfAttachments.length > 0) {
                      invoices.push({
                        from: parsed.from?.text,
                        subject: parsed.subject,
                        date: parsed.date,
                        attachments: pdfAttachments.map(a => ({
                          filename: a.filename,
                          size: a.size,
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
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
