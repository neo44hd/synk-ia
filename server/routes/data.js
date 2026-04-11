/**
 * SYNK-IA - Generic Data CRUD API
 * Stores entities as JSON files on disk
 */
import { Router } from 'express';
import fs from 'fs';
import path from 'path';

// Ruta absoluta basada en la ubicación de este archivo (no depende de process.cwd())
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');

try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  console.log('[DATA] Directory ready:', DATA_DIR);
} catch (err) {
  console.error('[DATA] Cannot create data dir:', err.message);
}

const ALLOWED_ENTITIES = [
  'provider', 'invoice', 'pricecomparison', 'document', 'timesheet',
  'contract', 'payroll', 'vacationrequest', 'emailintegration',
  'notification', 'report', 'mutuaincident', 'rgpdcompliance',
  'companydocument', 'sale', 'menuitem', 'revoemployee', 'websync',
  'albaran', 'verifactu', 'emailaccount', 'order', 'emailmessage',
  'emailcontact', 'quote', 'client', 'salesinvoice', 'product',
  'productpurchase', 'employee', 'uploadedfile',
  // Entidades añadidas para migración localStorage → API
  'auditlog', 'docbrainqueue', 'docbrainlog', 'revoconfig',
  'revosyncstatus', 'revosyncevents', 'chathistory',
  'whatsappconfig', 'whatsappmessage'
];

function getEntityFile(entity) {
  const name = entity.toLowerCase();
  if (!ALLOWED_ENTITIES.includes(name)) {
    throw new Error(`Entity '${entity}' not allowed`);
  }
  return path.join(DATA_DIR, `${name}.json`);
}

function readEntity(entity) {
  const file = getEntityFile(entity);
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    console.error('[DATA] Read error:', e.message);
    return [];
  }
}

function writeEntity(entity, data) {
  const file = getEntityFile(entity);
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

function generateId() {
  return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

export const dataRouter = Router();

// BULK CREATE/REPLACE - must be before /:entity/:id
dataRouter.put('/:entity/bulk', (req, res) => {
  try {
    const { records: newRecords, merge } = req.body;
    if (!Array.isArray(newRecords)) {
      return res.status(400).json({ success: false, error: 'records must be array' });
    }
    if (merge) {
      const existing = readEntity(req.params.entity);
      const existingMap = new Map(existing.map(r => [r.id, r]));
      for (const record of newRecords) {
        if (!record.id) record.id = generateId();
        existingMap.set(record.id, { ...existingMap.get(record.id), ...record, updated_date: new Date().toISOString() });
      }
      const merged = Array.from(existingMap.values());
      writeEntity(req.params.entity, merged);
      res.json({ success: true, count: merged.length });
    } else {
      const stamped = newRecords.map(r => ({
        id: r.id || generateId(),
        ...r,
        created_date: r.created_date || new Date().toISOString(),
        updated_date: new Date().toISOString()
      }));
      writeEntity(req.params.entity, stamped);
      res.json({ success: true, count: stamped.length });
    }
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// FILTER records - must be before /:entity/:id
dataRouter.post('/:entity/filter', (req, res) => {
  try {
    let records = readEntity(req.params.entity);
    const filters = req.body;
    for (const [field, value] of Object.entries(filters)) {
      records = records.filter(r => r[field] === value);
    }
    res.json({ success: true, data: records });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// LIST all records
dataRouter.get('/:entity', (req, res) => {
  try {
    const records = readEntity(req.params.entity);
    const { sort, limit } = req.query;
    if (sort) {
      const desc = sort.startsWith('-');
      const field = desc ? sort.slice(1) : sort;
      records.sort((a, b) => {
        const aVal = a[field] || '';
        const bVal = b[field] || '';
        return desc ? (bVal > aVal ? 1 : -1) : (aVal > bVal ? 1 : -1);
      });
    }
    const result = limit ? records.slice(0, parseInt(limit)) : records;
    res.json({ success: true, data: result, total: records.length });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// GET single record
dataRouter.get('/:entity/:id', (req, res) => {
  try {
    const records = readEntity(req.params.entity);
    const record = records.find(r => r.id === req.params.id);
    if (!record) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: record });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// CREATE record
dataRouter.post('/:entity', (req, res) => {
  try {
    const records = readEntity(req.params.entity);
    const newRecord = {
      id: generateId(),
      ...req.body,
      created_date: new Date().toISOString(),
      updated_date: new Date().toISOString()
    };
    records.push(newRecord);
    writeEntity(req.params.entity, records);
    res.json({ success: true, data: newRecord });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// UPDATE record
dataRouter.put('/:entity/:id', (req, res) => {
  try {
    const records = readEntity(req.params.entity);
    const idx = records.findIndex(r => r.id === req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, error: 'Not found' });
    records[idx] = { ...records[idx], ...req.body, updated_date: new Date().toISOString() };
    writeEntity(req.params.entity, records);
    res.json({ success: true, data: records[idx] });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// DELETE record
dataRouter.delete('/:entity/:id', (req, res) => {
  try {
    const records = readEntity(req.params.entity);
    const filtered = records.filter(r => r.id !== req.params.id);
    writeEntity(req.params.entity, filtered);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});
