// ═══════════════════════════════════════════════════════════════════════════════
//  SYNK-IA — FileBrain: Archivo inteligente
//  Clasificación automática de documentos por proveedor, fecha, categoría y tipo
//  Estructura de archivo virtual con navegación tipo árbol
// ═══════════════════════════════════════════════════════════════════════════════
import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { DATA_DIR } from './data.js';

export const filebrainRouter = Router();

function readJSON(entity) {
  const file = path.join(DATA_DIR, `${entity}.json`);
  try { return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : []; } catch { return []; }
}
function writeJSON(entity, data) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(path.join(DATA_DIR, `${entity}.json`), JSON.stringify(data, null, 2));
}

// ── Mapeo de categorías de proveedor ────────────────────────────────────────
const PROVIDER_CATEGORIES = {
  // Alimentación y bebidas
  'frutasjavier.com': { category: 'alimentacion', commercial_name: 'Frutas Javier', sector: 'Frutas y Verduras' },
  'distribucionesmontiel.com': { category: 'alimentacion', commercial_name: 'Distribuciones Montiel', sector: 'Distribución alimentaria' },
  'mercadona.com': { category: 'alimentacion', commercial_name: 'Mercadona', sector: 'Supermercado' },
  'mail.mercadona.com': { category: 'alimentacion', commercial_name: 'Mercadona', sector: 'Supermercado' },
  'eroski.es': { category: 'alimentacion', commercial_name: 'Eroski', sector: 'Supermercado' },
  // Suministros y energía
  'codicert.net': { category: 'suministros', commercial_name: 'AXPO Iberia', sector: 'Energía eléctrica' },
  'email.movistar.es': { category: 'suministros', commercial_name: 'Movistar', sector: 'Telecomunicaciones' },
  // Servicios profesionales
  'assempsaibiza.com': { category: 'servicios', commercial_name: 'Assempsa Ibiza', sector: 'Servicios empresariales' },
  'indexpert.es': { category: 'servicios', commercial_name: 'Indexpert', sector: 'Consultoría' },
  'aniofegroup.com': { category: 'servicios', commercial_name: 'Aniofe Group', sector: 'Administración' },
  // RRHH y laboral
  'vtrgestion.com': { category: 'laboral', commercial_name: 'VTR Gestión', sector: 'Asesoría laboral' },
  'asecrigestion@gmail.com': { category: 'laboral', commercial_name: 'T&V-ASECRI', sector: 'Asesoría laboral' },
  // Tecnología y software
  'stripe.com': { category: 'tecnologia', commercial_name: 'Warp (via Stripe)', sector: 'Software / SaaS' },
  'google.com': { category: 'tecnologia', commercial_name: 'Google', sector: 'Cloud / Tecnología' },
  'es.edenred.info': { category: 'beneficios', commercial_name: 'Edenred', sector: 'Beneficios empleados' },
};

// ── Subcategorías por tipo de documento ──────────────────────────────────────
const DOC_SUBCATEGORIES = {
  factura: 'facturas',
  recibo: 'recibos',
  nomina: 'nominas',
  contrato: 'contratos',
  albaran: 'albaranes',
  presupuesto: 'presupuestos',
  fiscal: 'fiscal',
  documento: 'otros_documentos',
  otro: 'sin_clasificar',
};

// ── Detectar categoría de proveedor por email ───────────────────────────────
function detectProviderCategory(email) {
  if (!email) return { category: 'sin_clasificar', commercial_name: null, sector: null };
  const domain = email.split('@').pop()?.toLowerCase();
  // Buscar coincidencia exacta o por dominio raíz
  for (const [key, val] of Object.entries(PROVIDER_CATEGORIES)) {
    if (domain?.includes(key) || email.toLowerCase().includes(key)) return val;
  }
  return { category: 'sin_clasificar', commercial_name: null, sector: null };
}

// ── Extraer año-mes de una fecha ────────────────────────────────────────────
function getYearMonth(dateStr) {
  if (!dateStr) return { year: 'sin_fecha', month: '00' };
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return { year: 'sin_fecha', month: '00' };
    return {
      year: String(d.getFullYear()),
      month: String(d.getMonth() + 1).padStart(2, '0')
    };
  } catch { return { year: 'sin_fecha', month: '00' }; }
}

const MONTH_NAMES = {
  '01': 'Enero', '02': 'Febrero', '03': 'Marzo', '04': 'Abril',
  '05': 'Mayo', '06': 'Junio', '07': 'Julio', '08': 'Agosto',
  '09': 'Septiembre', '10': 'Octubre', '11': 'Noviembre', '12': 'Diciembre', '00': 'Sin fecha'
};

// ═══════════════════════════════════════════════════════════════════════════════
//  POST /api/filebrain/classify-all
//  Clasifica TODAS las facturas existentes: enriquece con categoría de proveedor,
//  ruta virtual de archivo, y subcategoría. Idempotente.
// ═══════════════════════════════════════════════════════════════════════════════
filebrainRouter.post('/classify-all', (req, res) => {
  try {
    const invoices = readJSON('invoice');
    const providers = readJSON('provider');
    const providerMap = new Map(providers.map(p => [p.id, p]));
    const providerByEmail = new Map(providers.map(p => [p.email, p]));

    let classified = 0;
    let enrichedProviders = 0;

    // 1. Enriquecer proveedores con categoría y nombre comercial
    for (const prov of providers) {
      const detected = detectProviderCategory(prov.email);
      let changed = false;

      if (detected.category !== 'sin_clasificar') {
        if (prov.category === 'auto-detected' || !prov.category || prov.category === 'sin_clasificar') {
          prov.category = detected.category;
          changed = true;
        }
        if (detected.commercial_name && (!prov.commercial_name || prov.name === prov.email?.split('@')[0])) {
          prov.commercial_name = detected.commercial_name;
          changed = true;
        }
        if (detected.sector && !prov.sector) {
          prov.sector = detected.sector;
          changed = true;
        }
      }

      // Limpiar nombre genérico ("info", "administracion", etc.)
      const genericNames = ['info', 'administracion', 'administracion3', 'laboral', 'facturas-noreply@mercadona.com', 'Factura-correo'];
      if (genericNames.includes(prov.name) && detected.commercial_name) {
        prov.name = detected.commercial_name;
        changed = true;
      }

      if (changed) {
        prov.updated_date = new Date().toISOString();
        enrichedProviders++;
      }
    }
    writeJSON('provider', providers);

    // 2. Clasificar cada factura con ruta virtual
    for (const inv of invoices) {
      const provider = providerByEmail.get(inv.provider_email) || providerMap.get(inv.provider_id);
      const provCategory = provider?.category || 'sin_clasificar';
      const provName = provider?.commercial_name || provider?.name || inv.provider_name || 'Desconocido';
      const docSubcat = DOC_SUBCATEGORIES[inv.type] || 'sin_clasificar';
      const { year, month } = getYearMonth(inv.date);

      // Ruta virtual: /categoría/proveedor/año/mes/tipo/archivo
      const virtualPath = `/${provCategory}/${sanitizeName(provName)}/${year}/${month}-${MONTH_NAMES[month]}/${docSubcat}/${inv.filename || 'sin_nombre'}`;

      // Tags automáticos
      const tags = [inv.type, provCategory];
      if (provider?.sector) tags.push(provider.sector.toLowerCase());
      if (inv.file_size > 500000) tags.push('archivo_grande');

      inv.filebrain = {
        virtual_path: virtualPath,
        provider_category: provCategory,
        provider_commercial: provName,
        doc_subcategory: docSubcat,
        year,
        month,
        month_name: MONTH_NAMES[month],
        tags,
        classified_at: new Date().toISOString()
      };
      inv.updated_date = new Date().toISOString();
      classified++;
    }
    writeJSON('invoice', invoices);

    // 3. Estadísticas
    const stats = {
      total_classified: classified,
      providers_enriched: enrichedProviders,
      by_category: {},
      by_type: {},
      by_month: {},
      by_provider: {}
    };

    for (const inv of invoices) {
      const fb = inv.filebrain || {};
      stats.by_category[fb.provider_category || 'sin_clasificar'] = (stats.by_category[fb.provider_category] || 0) + 1;
      stats.by_type[inv.type] = (stats.by_type[inv.type] || 0) + 1;
      const monthKey = `${fb.year}-${fb.month}`;
      stats.by_month[monthKey] = (stats.by_month[monthKey] || 0) + 1;
      const provKey = fb.provider_commercial || inv.provider_name;
      stats.by_provider[provKey] = (stats.by_provider[provKey] || 0) + 1;
    }

    console.log(`[FILEBRAIN] Clasificados: ${classified} docs, ${enrichedProviders} proveedores enriquecidos`);
    res.json({ success: true, stats });

  } catch (err) {
    console.error('[FILEBRAIN] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  GET /api/filebrain/tree
//  Devuelve estructura de archivo virtual tipo árbol
//  Modos: ?by=category (default) | ?by=provider | ?by=date | ?by=type
// ═══════════════════════════════════════════════════════════════════════════════
filebrainRouter.get('/tree', (req, res) => {
  try {
    const invoices = readJSON('invoice');
    const mode = req.query.by || 'category';
    const tree = {};

    for (const inv of invoices) {
      const fb = inv.filebrain || {};
      const provName = fb.provider_commercial || inv.provider_name || 'Desconocido';
      const category = fb.provider_category || 'sin_clasificar';
      const docType = DOC_SUBCATEGORIES[inv.type] || 'sin_clasificar';
      const { year, month } = fb.year ? fb : getYearMonth(inv.date);
      const monthLabel = `${month}-${MONTH_NAMES[month] || month}`;

      const doc = {
        id: inv.id,
        filename: inv.filename,
        type: inv.type,
        date: inv.date,
        provider: provName,
        provider_email: inv.provider_email,
        size: inv.file_size,
        status: inv.status,
        subject: inv.subject,
        tags: fb.tags || [inv.type],
        virtual_path: fb.virtual_path
      };

      let path;
      switch (mode) {
        case 'provider':
          path = [provName, year, monthLabel, docType];
          break;
        case 'date':
          path = [year, monthLabel, category, provName];
          break;
        case 'type':
          path = [docType, year, monthLabel, provName];
          break;
        case 'category':
        default:
          path = [category, provName, year, monthLabel];
      }

      let node = tree;
      for (const segment of path) {
        if (!node[segment]) node[segment] = {};
        node = node[segment];
      }
      if (!node._files) node._files = [];
      node._files.push(doc);
    }

    // Calcular conteos recursivos
    function countFiles(node) {
      let count = 0;
      if (node._files) count += node._files.length;
      for (const [key, val] of Object.entries(node)) {
        if (key !== '_files' && typeof val === 'object') count += countFiles(val);
      }
      return count;
    }

    function enrichTree(node) {
      const result = {};
      for (const [key, val] of Object.entries(node)) {
        if (key === '_files') {
          result._files = val;
          result._count = val.length;
        } else if (typeof val === 'object') {
          result[key] = enrichTree(val);
          result[key]._total = countFiles(val);
        }
      }
      return result;
    }

    const enriched = enrichTree(tree);

    res.json({
      success: true,
      mode,
      total_documents: invoices.length,
      tree: enriched
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  GET /api/filebrain/stats
//  Dashboard de estadísticas del archivo
// ═══════════════════════════════════════════════════════════════════════════════
filebrainRouter.get('/stats', (req, res) => {
  try {
    const invoices = readJSON('invoice');
    const providers = readJSON('provider');
    const classified = invoices.filter(i => i.filebrain?.classified_at);

    const stats = {
      total_documents: invoices.length,
      total_classified: classified.length,
      pending_classification: invoices.length - classified.length,
      total_providers: providers.length,
      by_category: {},
      by_type: {},
      by_month: {},
      by_status: {},
      top_providers: [],
      provider_categories: {},
      date_range: { from: null, to: null },
      last_sync: null,
      last_classification: null
    };

    // Por categoría, tipo, mes, estado
    for (const inv of invoices) {
      const fb = inv.filebrain || {};
      const cat = fb.provider_category || 'sin_clasificar';
      stats.by_category[cat] = (stats.by_category[cat] || 0) + 1;
      stats.by_type[inv.type] = (stats.by_type[inv.type] || 0) + 1;
      stats.by_status[inv.status || 'unknown'] = (stats.by_status[inv.status] || 0) + 1;

      if (inv.date) {
        const ym = inv.date.substring(0, 7);
        stats.by_month[ym] = (stats.by_month[ym] || 0) + 1;
        if (!stats.date_range.from || inv.date < stats.date_range.from) stats.date_range.from = inv.date;
        if (!stats.date_range.to || inv.date > stats.date_range.to) stats.date_range.to = inv.date;
      }

      if (fb.classified_at) {
        if (!stats.last_classification || fb.classified_at > stats.last_classification) {
          stats.last_classification = fb.classified_at;
        }
      }
    }

    // Top proveedores
    const provCount = {};
    invoices.forEach(i => {
      const name = i.filebrain?.provider_commercial || i.provider_name;
      provCount[name] = (provCount[name] || 0) + 1;
    });
    stats.top_providers = Object.entries(provCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    // Categorías de proveedores
    providers.forEach(p => {
      const cat = p.category || 'sin_clasificar';
      stats.provider_categories[cat] = (stats.provider_categories[cat] || 0) + 1;
    });

    // Último sync
    const syncState = readJSON('emailintegration');
    if (syncState[0]) stats.last_sync = syncState[0].last_sync;

    res.json({ success: true, stats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  GET /api/filebrain/search
//  Búsqueda de documentos por texto, proveedor, tipo, fecha
// ═══════════════════════════════════════════════════════════════════════════════
filebrainRouter.get('/search', (req, res) => {
  try {
    const { q, provider, type, category, from, to, status, limit = '50' } = req.query;
    let invoices = readJSON('invoice');

    if (q) {
      const query = q.toLowerCase();
      invoices = invoices.filter(i =>
        (i.filename || '').toLowerCase().includes(query) ||
        (i.subject || '').toLowerCase().includes(query) ||
        (i.provider_name || '').toLowerCase().includes(query) ||
        (i.filebrain?.provider_commercial || '').toLowerCase().includes(query) ||
        (i.filebrain?.virtual_path || '').toLowerCase().includes(query)
      );
    }
    if (provider) {
      const prov = provider.toLowerCase();
      invoices = invoices.filter(i =>
        (i.provider_email || '').toLowerCase().includes(prov) ||
        (i.provider_name || '').toLowerCase().includes(prov) ||
        (i.filebrain?.provider_commercial || '').toLowerCase().includes(prov)
      );
    }
    if (type) invoices = invoices.filter(i => i.type === type);
    if (category) invoices = invoices.filter(i => i.filebrain?.provider_category === category);
    if (status) invoices = invoices.filter(i => i.status === status);
    if (from) invoices = invoices.filter(i => i.date && i.date >= from);
    if (to) invoices = invoices.filter(i => i.date && i.date <= to);

    invoices.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const total = invoices.length;
    invoices = invoices.slice(0, parseInt(limit));

    res.json({ success: true, total, count: invoices.length, documents: invoices });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  GET /api/filebrain/providers
//  Lista de proveedores enriquecidos con estadísticas
// ═══════════════════════════════════════════════════════════════════════════════
filebrainRouter.get('/providers', (req, res) => {
  try {
    const providers = readJSON('provider');
    const invoices = readJSON('invoice');

    // Enriquecer con estadísticas de documentos
    const docsByProvider = {};
    invoices.forEach(inv => {
      const key = inv.provider_id || inv.provider_email;
      if (!docsByProvider[key]) docsByProvider[key] = { total: 0, by_type: {}, last_doc: null, months: new Set() };
      docsByProvider[key].total++;
      docsByProvider[key].by_type[inv.type] = (docsByProvider[key].by_type[inv.type] || 0) + 1;
      if (inv.date) {
        docsByProvider[key].months.add(inv.date.substring(0, 7));
        if (!docsByProvider[key].last_doc || inv.date > docsByProvider[key].last_doc) {
          docsByProvider[key].last_doc = inv.date;
        }
      }
    });

    const enriched = providers.map(p => {
      const stats = docsByProvider[p.id] || docsByProvider[p.email] || { total: 0, by_type: {}, last_doc: null, months: new Set() };
      return {
        ...p,
        stats: {
          total_docs: stats.total,
          by_type: stats.by_type,
          last_document: stats.last_doc,
          active_months: stats.months.size || 0
        }
      };
    }).sort((a, b) => b.stats.total_docs - a.stats.total_docs);

    res.json({ success: true, total: enriched.length, providers: enriched });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  POST /api/filebrain/link-payslips
//  Vincula nóminas (type='nomina') a trabajadores automáticamente
//  Busca coincidencias por nombre en filename, email del proveedor laboral, subject
// ═══════════════════════════════════════════════════════════════════════════════
filebrainRouter.post('/link-payslips', (req, res) => {
  try {
    const invoices = readJSON('invoice');
    const trabajadores = readJSON('trabajadores');
    const nominas = invoices.filter(i => i.type === 'nomina');
    let vinculadas = 0;

    for (const nomina of nominas) {
      if (nomina.trabajador_id) continue; // ya vinculada

      const textoRef = [
        nomina.filename || '',
        nomina.subject || '',
        nomina.provider_name || '',
      ].join(' ').toLowerCase();

      // Intentar vincular por nombre del trabajador
      for (const trab of trabajadores) {
        const nombre = (trab.nombre_completo || '').toLowerCase();
        const apellido = (trab.apellidos || '').toLowerCase();
        if (
          (nombre && textoRef.includes(nombre)) ||
          (apellido && apellido.length > 2 && textoRef.includes(apellido))
        ) {
          nomina.trabajador_id = trab.id;
          nomina.trabajador_nombre = trab.nombre_completo;
          nomina.updated_date = new Date().toISOString();
          vinculadas++;
          break;
        }
      }
    }

    writeJSON('invoice', invoices);
    console.log(`[FILEBRAIN] Nóminas vinculadas: ${vinculadas} de ${nominas.length}`);
    res.json({
      success: true,
      total_nominas: nominas.length,
      vinculadas,
      sin_vincular: nominas.filter(n => !n.trabajador_id).length,
    });
  } catch (err) {
    console.error('[FILEBRAIN] Error link-payslips:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

function sanitizeName(str) {
  return (str || 'desconocido')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s\-_.]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 50);
}
