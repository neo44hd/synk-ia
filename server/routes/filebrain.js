// ═══════════════════════════════════════════════════════════════════════════════
//  SYNK-IA — FileBrain v2: Archivo inteligente (fuente única)
//
//  ANTES: leía de invoice.json + provider.json (almacén paralelo)
//  AHORA: lee de documents.json + entities.json (misma fuente que Brain)
//
//  Clasificación automática de documentos por proveedor, fecha, categoría y tipo
//  Estructura de archivo virtual con navegación tipo árbol
// ═══════════════════════════════════════════════════════════════════════════════
import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { DATA_DIR } from './data.js';

export const filebrainRouter = Router();

// ── Lectura de la fuente única ───────────────────────────────────────────────
function readJSON(entity) {
  const file = path.join(DATA_DIR, `${entity}.json`);
  try { return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : []; } catch { return []; }
}
function writeJSON(entity, data) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(path.join(DATA_DIR, `${entity}.json`), JSON.stringify(data, null, 2));
}

// ── Subcategorías por tipo de documento ──────────────────────────────────────
const DOC_SUBCATEGORIES = {
  factura_recibida:  'facturas_recibidas',
  factura_emitida:   'facturas_emitidas',
  albaran:           'albaranes',
  presupuesto:       'presupuestos',
  contrato:          'contratos',
  nomina:            'nominas',
  extracto_bancario: 'extractos',
  pedido:            'pedidos',
  ticket:            'tickets',
  email_comercial:   'emails',
  otro:              'sin_clasificar',
  // Compat con clasificación por heurística (scan sin IA)
  factura:           'facturas',
  recibo:            'recibos',
  fiscal:            'fiscal',
  documento:         'otros_documentos',
};

// ── Categorías dinámicas de proveedor ────────────────────────────────────────
// En vez de un diccionario hardcodeado, detectamos la categoría por:
//   1. Tipo de documentos que envía (si >50% nóminas → laboral)
//   2. Palabras clave en nombre/email
//   3. Sector ya asignado en entities.json
const CATEGORY_KEYWORDS = {
  laboral:       ['laboral', 'gestoria', 'gestión laboral', 'rrhh', 'nomina', 'asecri', 'vtr'],
  alimentacion:  ['frutas', 'carnes', 'pescado', 'verduras', 'alimenta', 'mercadona', 'eroski', 'distribu'],
  suministros:   ['energía', 'energia', 'eléctric', 'electric', 'gas', 'agua', 'telecom', 'movistar', 'vodafone'],
  servicios:     ['consult', 'asesor', 'legal', 'abogad', 'gestor', 'admin'],
  tecnologia:    ['software', 'saas', 'cloud', 'tech', 'google', 'stripe', 'digital'],
  beneficios:    ['edenred', 'ticket', 'sodexo', 'beneficio'],
  seguros:       ['seguro', 'mutua', 'póliza', 'insurance'],
  fiscalidad:    ['hacienda', 'agencia tributaria', 'modelo', 'impuesto'],
};

function detectCategoryDynamic(providerName, providerEmail, docTypes) {
  const text = `${providerName} ${providerEmail}`.toLowerCase();

  // 1. Por palabras clave en nombre/email
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => text.includes(kw))) return category;
  }

  // 2. Por tipos de documentos predominantes
  if (docTypes) {
    const total = Object.values(docTypes).reduce((s, v) => s + v, 0);
    if (total > 0) {
      if ((docTypes.nomina || 0) / total > 0.5) return 'laboral';
      if (((docTypes.factura_recibida || 0) + (docTypes.factura || 0)) / total > 0.5) return 'proveedor_general';
    }
  }

  return 'sin_clasificar';
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function getYearMonth(dateStr) {
  if (!dateStr) return { year: 'sin_fecha', month: '00' };
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return { year: 'sin_fecha', month: '00' };
    return {
      year: String(d.getFullYear()),
      month: String(d.getMonth() + 1).padStart(2, '0'),
    };
  } catch { return { year: 'sin_fecha', month: '00' }; }
}

const MONTH_NAMES = {
  '01': 'Enero', '02': 'Febrero', '03': 'Marzo', '04': 'Abril',
  '05': 'Mayo', '06': 'Junio', '07': 'Julio', '08': 'Agosto',
  '09': 'Septiembre', '10': 'Octubre', '11': 'Noviembre', '12': 'Diciembre', '00': 'Sin fecha',
};

function sanitizeName(str) {
  return (str || 'desconocido')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s\-_.]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 50);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  POST /api/filebrain/classify-all
//  Clasifica TODOS los documentos desde documents.json (fuente única)
//  Enriquece proveedores con categoría dinámica
// ═══════════════════════════════════════════════════════════════════════════════
filebrainRouter.post('/classify-all', (req, res) => {
  try {
    const docs     = readJSON('documents');
    const entities = (() => {
      const file = path.join(DATA_DIR, 'entities.json');
      try { return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { proveedores: [], clientes: [] }; }
      catch { return { proveedores: [], clientes: [] }; }
    })();

    let classified = 0;
    let enrichedProviders = 0;

    // 1. Indexar documentos por proveedor para detectar categoría dinámica
    const docsByProvider = {};
    for (const doc of docs) {
      const emisor = doc.analisis?.emisor;
      if (!emisor?.nombre) continue;
      const key = emisor.cif_nif || emisor.nombre;
      if (!docsByProvider[key]) docsByProvider[key] = { types: {}, docs: [] };
      const tipo = doc.analisis?.tipo || 'otro';
      docsByProvider[key].types[tipo] = (docsByProvider[key].types[tipo] || 0) + 1;
      docsByProvider[key].docs.push(doc);
    }

    // 2. Enriquecer proveedores en entities.json con categoría dinámica
    for (const prov of entities.proveedores) {
      const key = prov.cif_nif || prov.nombre;
      const provDocs = docsByProvider[key];
      const detected = detectCategoryDynamic(
        prov.nombre || '',
        prov.email  || '',
        provDocs?.types
      );

      if (detected !== 'sin_clasificar' && (!prov.category || prov.category === 'sin_clasificar' || prov.category === 'auto-detected')) {
        prov.category = detected;
        prov.updated = new Date().toISOString();
        enrichedProviders++;
      }
    }

    // Guardar entities actualizadas
    const entFile = path.join(DATA_DIR, 'entities.json');
    fs.writeFileSync(entFile, JSON.stringify(entities, null, 2));

    // 3. Clasificar cada documento con ruta virtual
    const provByKey = new Map();
    for (const p of entities.proveedores) {
      provByKey.set(p.cif_nif || p.nombre, p);
      if (p.nombre) provByKey.set(p.nombre, p);
    }

    for (const doc of docs) {
      const a = doc.analisis || {};
      const emisor = a.emisor || {};
      const provKey  = emisor.cif_nif || emisor.nombre;
      const provider = provByKey.get(provKey);
      const provCategory = provider?.category || 'sin_clasificar';
      const provName     = emisor.nombre || 'Desconocido';
      const docSubcat    = DOC_SUBCATEGORIES[a.tipo] || 'sin_clasificar';
      const { year, month } = getYearMonth(a.fecha || doc.procesado);

      const virtualPath = `/${provCategory}/${sanitizeName(provName)}/${year}/${month}-${MONTH_NAMES[month]}/${docSubcat}/${doc.nombre_archivo || 'sin_nombre'}`;

      const tags = [a.tipo, provCategory].filter(Boolean);
      if (provider?.sector) tags.push(provider.sector.toLowerCase());

      doc.filebrain = {
        virtual_path:        virtualPath,
        provider_category:   provCategory,
        provider_commercial: provName,
        doc_subcategory:     docSubcat,
        year,
        month,
        month_name:          MONTH_NAMES[month],
        tags,
        classified_at:       new Date().toISOString(),
      };

      classified++;
    }

    // Guardar documents con filebrain enriquecido
    writeJSON('documents', docs);

    // 4. Estadísticas
    const stats = {
      total_classified: classified,
      providers_enriched: enrichedProviders,
      by_category: {},
      by_type: {},
      by_month: {},
      by_provider: {},
    };

    for (const doc of docs) {
      const fb = doc.filebrain || {};
      const tipo = doc.analisis?.tipo || 'otro';
      stats.by_category[fb.provider_category || 'sin_clasificar'] = (stats.by_category[fb.provider_category] || 0) + 1;
      stats.by_type[tipo] = (stats.by_type[tipo] || 0) + 1;
      const monthKey = `${fb.year}-${fb.month}`;
      stats.by_month[monthKey] = (stats.by_month[monthKey] || 0) + 1;
      const provKey = fb.provider_commercial || 'Desconocido';
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
//  Estructura de archivo virtual tipo árbol — ahora desde documents.json
// ═══════════════════════════════════════════════════════════════════════════════
filebrainRouter.get('/tree', (req, res) => {
  try {
    const docs = readJSON('documents');
    const mode = req.query.by || 'category';
    const tree = {};

    for (const doc of docs) {
      const fb   = doc.filebrain || {};
      const a    = doc.analisis  || {};
      const provName = fb.provider_commercial || a.emisor?.nombre || 'Desconocido';
      const category = fb.provider_category   || 'sin_clasificar';
      const docType  = DOC_SUBCATEGORIES[a.tipo] || 'sin_clasificar';
      const { year, month } = fb.year ? fb : getYearMonth(a.fecha || doc.procesado);
      const monthLabel = `${month}-${MONTH_NAMES[month] || month}`;

      const entry = {
        id:           doc.id,
        filename:     doc.nombre_archivo,
        type:         a.tipo,
        date:         a.fecha || doc.procesado,
        provider:     provName,
        total:        a.total,
        resumen:      a.resumen,
        tags:         fb.tags || [a.tipo],
        virtual_path: fb.virtual_path,
      };

      let pathSegments;
      switch (mode) {
        case 'provider': pathSegments = [provName, year, monthLabel, docType]; break;
        case 'date':     pathSegments = [year, monthLabel, category, provName]; break;
        case 'type':     pathSegments = [docType, year, monthLabel, provName]; break;
        case 'category':
        default:         pathSegments = [category, provName, year, monthLabel]; break;
      }

      let node = tree;
      for (const segment of pathSegments) {
        if (!node[segment]) node[segment] = {};
        node = node[segment];
      }
      if (!node._files) node._files = [];
      node._files.push(entry);
    }

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

    res.json({
      success: true,
      mode,
      total_documents: docs.length,
      tree: enrichTree(tree),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  GET /api/filebrain/stats — Dashboard
// ═══════════════════════════════════════════════════════════════════════════════
filebrainRouter.get('/stats', (req, res) => {
  try {
    const docs = readJSON('documents');
    const entities = (() => {
      const file = path.join(DATA_DIR, 'entities.json');
      try { return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { proveedores: [], clientes: [] }; }
      catch { return { proveedores: [], clientes: [] }; }
    })();

    const classified = docs.filter(d => d.filebrain?.classified_at);

    const stats = {
      total_documents:         docs.length,
      total_classified:        classified.length,
      pending_classification:  docs.length - classified.length,
      total_providers:         entities.proveedores?.length || 0,
      total_clients:           entities.clientes?.length    || 0,
      by_category:  {},
      by_type:      {},
      by_month:     {},
      by_status:    {},
      top_providers: [],
      date_range:   { from: null, to: null },
      last_classification: null,
    };

    for (const doc of docs) {
      const fb   = doc.filebrain || {};
      const a    = doc.analisis  || {};
      const tipo = a.tipo || 'otro';
      const cat  = fb.provider_category || 'sin_clasificar';

      stats.by_category[cat]   = (stats.by_category[cat]   || 0) + 1;
      stats.by_type[tipo]      = (stats.by_type[tipo]      || 0) + 1;
      stats.by_status[doc.estado || 'unknown'] = (stats.by_status[doc.estado] || 0) + 1;

      const fecha = a.fecha || doc.procesado;
      if (fecha) {
        const ym = fecha.substring(0, 7);
        stats.by_month[ym] = (stats.by_month[ym] || 0) + 1;
        if (!stats.date_range.from || fecha < stats.date_range.from) stats.date_range.from = fecha;
        if (!stats.date_range.to   || fecha > stats.date_range.to)   stats.date_range.to   = fecha;
      }

      if (fb.classified_at && (!stats.last_classification || fb.classified_at > stats.last_classification)) {
        stats.last_classification = fb.classified_at;
      }
    }

    // Top proveedores
    const provCount = {};
    docs.forEach(d => {
      const name = d.filebrain?.provider_commercial || d.analisis?.emisor?.nombre || 'Desconocido';
      provCount[name] = (provCount[name] || 0) + 1;
    });
    stats.top_providers = Object.entries(provCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    res.json({ success: true, stats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  GET /api/filebrain/search — Búsqueda
// ═══════════════════════════════════════════════════════════════════════════════
filebrainRouter.get('/search', (req, res) => {
  try {
    const { q, provider, type, category, from, to, limit = '50' } = req.query;
    let docs = readJSON('documents');

    if (q) {
      const query = q.toLowerCase();
      docs = docs.filter(d =>
        (d.nombre_archivo || '').toLowerCase().includes(query) ||
        (d.analisis?.resumen || '').toLowerCase().includes(query) ||
        (d.analisis?.emisor?.nombre || '').toLowerCase().includes(query) ||
        (d.filebrain?.virtual_path || '').toLowerCase().includes(query)
      );
    }
    if (provider) {
      const prov = provider.toLowerCase();
      docs = docs.filter(d =>
        (d.analisis?.emisor?.nombre || '').toLowerCase().includes(prov) ||
        (d.analisis?.emisor?.email  || '').toLowerCase().includes(prov) ||
        (d.analisis?.emisor?.cif_nif || '').toLowerCase().includes(prov)
      );
    }
    if (type)     docs = docs.filter(d => d.analisis?.tipo === type);
    if (category) docs = docs.filter(d => d.filebrain?.provider_category === category);
    if (from)     docs = docs.filter(d => (d.analisis?.fecha || d.procesado || '') >= from);
    if (to)       docs = docs.filter(d => (d.analisis?.fecha || d.procesado || '') <= to);

    const total = docs.length;
    docs = docs.slice(0, parseInt(limit));

    res.json({
      success: true,
      total,
      count: docs.length,
      documents: docs.map(d => ({
        id:           d.id,
        archivo:      d.nombre_archivo,
        tipo:         d.analisis?.tipo,
        fecha:        d.analisis?.fecha,
        emisor:       d.analisis?.emisor?.nombre,
        total:        d.analisis?.total,
        resumen:      d.analisis?.resumen,
        virtual_path: d.filebrain?.virtual_path,
        tags:         d.filebrain?.tags,
      })),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  GET /api/filebrain/providers — Proveedores con estadísticas
// ═══════════════════════════════════════════════════════════════════════════════
filebrainRouter.get('/providers', (req, res) => {
  try {
    const docs = readJSON('documents');
    const entities = (() => {
      const file = path.join(DATA_DIR, 'entities.json');
      try { return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { proveedores: [], clientes: [] }; }
      catch { return { proveedores: [], clientes: [] }; }
    })();

    // Estadísticas por proveedor desde documents
    const docsByProv = {};
    for (const d of docs) {
      const emisor = d.analisis?.emisor;
      if (!emisor?.nombre) continue;
      const key = emisor.cif_nif || emisor.nombre;
      if (!docsByProv[key]) docsByProv[key] = { total: 0, by_type: {}, last_doc: null, months: new Set() };
      docsByProv[key].total++;
      const tipo = d.analisis?.tipo || 'otro';
      docsByProv[key].by_type[tipo] = (docsByProv[key].by_type[tipo] || 0) + 1;
      const fecha = d.analisis?.fecha || d.procesado;
      if (fecha) {
        docsByProv[key].months.add(fecha.substring(0, 7));
        if (!docsByProv[key].last_doc || fecha > docsByProv[key].last_doc) {
          docsByProv[key].last_doc = fecha;
        }
      }
    }

    const enriched = (entities.proveedores || []).map(p => {
      const key = p.cif_nif || p.nombre;
      const stats = docsByProv[key] || { total: 0, by_type: {}, last_doc: null, months: new Set() };
      return {
        ...p,
        stats: {
          total_docs:     stats.total,
          by_type:        stats.by_type,
          last_document:  stats.last_doc,
          active_months:  stats.months?.size || 0,
        },
      };
    }).sort((a, b) => b.stats.total_docs - a.stats.total_docs);

    res.json({ success: true, total: enriched.length, providers: enriched });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  POST /api/filebrain/link-payslips — Vincular nóminas a trabajadores
//  Ahora busca en documents.json donde analisis.tipo === 'nomina'
// ═══════════════════════════════════════════════════════════════════════════════
function normalizarTexto(str) {
  return (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

filebrainRouter.post('/link-payslips', (req, res) => {
  try {
    const docs         = readJSON('documents');
    const trabajadores = readJSON('trabajadores');
    const nominas      = docs.filter(d => d.analisis?.tipo === 'nomina');
    let vinculadas = 0;
    const nombresVinculados = [];

    for (const nomina of nominas) {
      if (nomina.trabajador_id) continue;

      // Usar datos extraídos por IA: receptor = empleado
      const receptor = nomina.analisis?.receptor;
      const textoRef = normalizarTexto([
        nomina.nombre_archivo || '',
        receptor?.nombre || '',
        receptor?.cif_nif || '',
        nomina.analisis?.resumen || '',
      ].join(' '));

      for (const trab of trabajadores) {
        // 1. Por DNI/NIF
        if (trab.dni && receptor?.cif_nif) {
          if (trab.dni.replace(/\s/g, '').toUpperCase() === receptor.cif_nif.replace(/\s/g, '').toUpperCase()) {
            nomina.trabajador_id = trab.id;
            nomina.trabajador_nombre = trab.nombre_completo;
            vinculadas++;
            nombresVinculados.push(trab.nombre_completo);
            break;
          }
        }

        // 2. Por NSS
        if (trab.nss && textoRef.includes(normalizarTexto(trab.nss))) {
          nomina.trabajador_id = trab.id;
          nomina.trabajador_nombre = trab.nombre_completo;
          vinculadas++;
          nombresVinculados.push(trab.nombre_completo);
          break;
        }

        // 3. Por nombre completo
        const nombreNorm = normalizarTexto(trab.nombre_completo);
        if (nombreNorm && nombreNorm.length > 3 && textoRef.includes(nombreNorm)) {
          nomina.trabajador_id = trab.id;
          nomina.trabajador_nombre = trab.nombre_completo;
          vinculadas++;
          nombresVinculados.push(trab.nombre_completo);
          break;
        }

        // 4. Por apellidos
        const apellidoNorm = normalizarTexto(trab.apellidos);
        if (apellidoNorm && apellidoNorm.length > 3 && textoRef.includes(apellidoNorm)) {
          nomina.trabajador_id = trab.id;
          nomina.trabajador_nombre = trab.nombre_completo;
          vinculadas++;
          nombresVinculados.push(trab.nombre_completo);
          break;
        }
      }
    }

    writeJSON('documents', docs);
    console.log(`[FILEBRAIN] Nóminas vinculadas: ${vinculadas} de ${nominas.length}`);

    res.json({
      success: true,
      total_nominas: nominas.length,
      vinculadas,
      sin_vincular: nominas.filter(n => !n.trabajador_id).length,
      trabajadores_vinculados: [...new Set(nombresVinculados)],
    });
  } catch (err) {
    console.error('[FILEBRAIN] Error link-payslips:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});
