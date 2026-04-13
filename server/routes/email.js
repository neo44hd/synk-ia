// ═══════════════════════════════════════════════════════════════════════════
//  ROUTES/EMAIL — Endpoints HTTP del pipeline de email unificado
//
//  ANTES: lógica IMAP propia + clasificación regex + almacén separado.
//  AHORA: capa HTTP fina sobre emailAgent unificado.
//         Solo endpoints — sin lógica IMAP, sin almacén propio.
//
//  Fuente de verdad: documents.json + entities.json (vía documentProcessor)
// ═══════════════════════════════════════════════════════════════════════════
import { Router } from 'express';
import {
  syncEmails,
  scanEmails,
  getEmails,
  getDocuments,
  getEntities,
  getEmailStats,
} from '../agents/emailAgent.js';

export const emailRouter = Router();

// ── GET /api/email/test — Verificar conexión IMAP ────────────────────────
emailRouter.get('/test', async (req, res) => {
  try {
    if (!process.env.EMAIL_APP_PASSWORD) {
      return res.json({ success: false, error: 'EMAIL_APP_PASSWORD not configured' });
    }
    const Imap = (await import('imap')).default;
    const imap = new Imap({
      user:     process.env.EMAIL_USER || 'info@chickenpalace.es',
      password: process.env.EMAIL_APP_PASSWORD,
      host:     'imap.gmail.com',
      port:     993,
      tls:      true,
      tlsOptions: { rejectUnauthorized: false },
    });
    await new Promise((resolve, reject) => {
      imap.once('ready', () => { imap.end(); resolve(); });
      imap.once('error', reject);
      imap.connect();
    });
    res.json({ success: true, message: 'Gmail connected', user: process.env.EMAIL_USER || 'info@chickenpalace.es' });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ── GET /api/email/stats — Dashboard de estadísticas ─────────────────────
emailRouter.get('/stats', async (req, res) => {
  try {
    const stats = await getEmailStats();
    res.json({ success: true, ...stats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/email/sync — Sincronización completa con IA ───────────────
//    Este es el endpoint principal. El syncWorker lo llama cada 5 min,
//    pero también se puede invocar manualmente.
emailRouter.post('/sync', async (req, res) => {
  try {
    const { since, limit, process_ai } = req.body || {};
    console.log(`[EMAIL-SYNC] Sincronización manual desde ${since || '60 días atrás'}`);
    const result = await syncEmails({
      since,
      limit:        limit || 300,
      processWithAI: process_ai !== false, // IA activada por defecto
    });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[EMAIL-SYNC] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/email/scan — Escaneo rápido sin IA (solo metadatos) ────────
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
      documents: documents.sort((a, b) => new Date(b.date) - new Date(a.date)),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/email/fetch — Lista de emails sincronizados ─────────────────
emailRouter.get('/fetch', async (req, res) => {
  try {
    const { limit = 50, since } = req.query;
    let emails = await getEmails();
    if (since) emails = emails.filter(e => e.received_date >= since);
    emails = emails.slice(0, parseInt(limit));
    res.json({ success: true, count: emails.length, emails });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/email/documents — Documentos procesados por tipo ────────────
//    Reemplaza /invoices, /payslips — ahora lee de documents.json
emailRouter.get('/documents', async (req, res) => {
  try {
    const { tipo, proveedor, desde, hasta, limit = '50' } = req.query;
    let docs = await getDocuments();

    if (tipo) {
      docs = docs.filter(d => d.analisis?.tipo === tipo);
    }
    if (proveedor) {
      const p = proveedor.toLowerCase();
      docs = docs.filter(d =>
        (d.analisis?.emisor?.nombre || '').toLowerCase().includes(p) ||
        (d.analisis?.emisor?.cif_nif || '').toLowerCase().includes(p)
      );
    }
    if (desde) {
      docs = docs.filter(d => (d.analisis?.fecha || d.procesado || '') >= desde);
    }
    if (hasta) {
      docs = docs.filter(d => (d.analisis?.fecha || d.procesado || '') <= hasta);
    }

    docs = docs.slice(0, parseInt(limit));

    res.json({
      success: true,
      count: docs.length,
      documents: docs.map(d => ({
        id:        d.id,
        archivo:   d.nombre_archivo,
        tipo:      d.analisis?.tipo,
        fecha:     d.analisis?.fecha,
        emisor:    d.analisis?.emisor?.nombre,
        receptor:  d.analisis?.receptor?.nombre,
        total:     d.analisis?.total,
        resumen:   d.analisis?.resumen,
        procesado: d.procesado,
      })),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/email/invoices — Facturas (compat con frontend) ─────────────
emailRouter.get('/invoices', async (req, res) => {
  try {
    const docs = await getDocuments();
    const facturas = docs.filter(d =>
      d.analisis?.tipo === 'factura_recibida' || d.analisis?.tipo === 'factura_emitida'
    );
    res.json({
      success: true,
      count: facturas.length,
      invoices: facturas.map(d => ({
        id:      d.id,
        archivo: d.nombre_archivo,
        tipo:    d.analisis?.tipo,
        numero:  d.analisis?.numero_documento,
        fecha:   d.analisis?.fecha,
        emisor:  d.analisis?.emisor?.nombre,
        total:   d.analisis?.total,
        resumen: d.analisis?.resumen,
      })),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/email/payslips — Nóminas (compat con frontend) ──────────────
emailRouter.get('/payslips', async (req, res) => {
  try {
    const { since = '2024-01-01' } = req.query;
    // Primero intentar desde documents.json (fuente principal)
    const docs = await getDocuments();
    const nominas = docs.filter(d =>
      d.analisis?.tipo === 'nomina' &&
      (d.analisis?.fecha || d.procesado || '') >= since
    );

    if (nominas.length > 0) {
      // Agrupar por mes
      const byMonth = {};
      nominas.forEach(d => {
        const fecha = d.analisis?.fecha || d.procesado || '';
        const key = fecha.slice(0, 7) || 'sin_fecha';
        if (!byMonth[key]) byMonth[key] = [];
        byMonth[key].push({
          id:       d.id,
          archivo:  d.nombre_archivo,
          fecha:    d.analisis?.fecha,
          emisor:   d.analisis?.emisor?.nombre,
          receptor: d.analisis?.receptor?.nombre,
          total:    d.analisis?.total,
          resumen:  d.analisis?.resumen,
        });
      });

      return res.json({ success: true, count: nominas.length, byMonth });
    }

    // Fallback: escanear emails directamente si no hay nóminas procesadas aún
    const { documents } = await scanEmails({ since, limit: 300, typeFilter: 'nomina', includeContent: true });
    const byMonth = {};
    documents.forEach(d => {
      const date = new Date(d.date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!byMonth[key]) byMonth[key] = [];
      byMonth[key].push(d);
    });

    res.json({ success: true, count: documents.length, byMonth, source: 'imap-scan' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/email/workers — Trabajadores detectados (entities.json) ───────
emailRouter.get('/workers', async (req, res) => {
  try {
    const entities = await getEntities();
    const trabajadores = entities.trabajadores || [];

    // Si hay trabajadores en entities.json, devolverlos directamente
    if (trabajadores.length > 0) {
      return res.json({
        success: true,
        count: trabajadores.length,
        workers: trabajadores.map(t => ({
          id:                    t.id,
          nombre:                t.nombre_completo || t.nombre,
          dni:                   t.dni,
          nss:                   t.nss,
          categoria_profesional: t.categoria_profesional,
          fecha_alta:            t.fecha_alta,
          ultimo_salario_bruto:  t.ultimo_salario_bruto,
          ultimo_salario_neto:   t.ultimo_salario_neto,
          nominas_count:         t.nominas || 0,
          ultima_nomina:         t.ultima_nomina,
          activo:                t.activo !== false,
        })),
        source: 'entities.json',
      });
    }

    // Fallback: escanear nóminas en documents.json
    const docs = await getDocuments();
    const nominas = docs.filter(d => d.analisis?.tipo === 'nomina');

    const workers = new Map();
    for (const d of nominas) {
      const receptor = d.analisis?.receptor;
      if (!receptor?.nombre) continue;
      const key = receptor.cif_nif || receptor.nombre;
      if (!workers.has(key)) {
        workers.set(key, {
          nombre: receptor.nombre,
          dni:    receptor.cif_nif,
          nominas: [],
        });
      }
      workers.get(key).nominas.push({
        id:     d.id,
        fecha:  d.analisis?.fecha,
        total:  d.analisis?.total,
        emisor: d.analisis?.emisor?.nombre,
      });
    }

    res.json({
      success: true,
      count: workers.size,
      workers: [...workers.values()].map(w => ({
        ...w,
        nominas_count: w.nominas.length,
      })),
      source: 'documents.json-fallback',
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/email/providers — Proveedores con facturas, balances y desglose IVA ──
//    Vista contable completa: cada proveedor con todas sus facturas agrupadas,
//    total facturado, desglose por tipo IVA, y balance acumulado.
//    Ordenado por total facturado (mayor primero).
emailRouter.get('/providers', async (req, res) => {
  try {
    const [entities, docs] = await Promise.all([getEntities(), getDocuments()]);

    // Indexar facturas por proveedor (cruzando entities + documents)
    const provMap = new Map();

    // Inicializar con proveedores conocidos de entities.json
    for (const p of (entities.proveedores || [])) {
      provMap.set(p.id, {
        id:             p.id,
        nombre:         p.nombre,
        cif_nif:        p.cif_nif,
        email:          p.email,
        telefono:       p.telefono || null,
        direccion:      p.direccion || null,
        creado:         p.creado,
        facturas:       [],
        total_facturado:    0,
        total_base:         0,
        total_iva:          0,
        desglose_iva:       {},   // { "21": { base: X, cuota: Y, count: N }, ... }
        primera_factura:    null,
        ultima_factura:     null,
      });
    }

    // Recorrer documentos y asignar facturas a proveedores
    for (const doc of docs) {
      const a = doc.analisis;
      if (!a) continue;

      // Solo facturas recibidas, albaranes facturados, tickets
      const tipo = (a.tipo || '').toLowerCase();
      if (!['factura_recibida', 'albaran', 'ticket'].includes(tipo) &&
          !tipo.includes('factura')) continue;

      // Buscar proveedor por ID o por nombre del emisor
      let provEntry = null;
      if (a.proveedor_id) {
        provEntry = provMap.get(a.proveedor_id);
      }
      if (!provEntry && a.emisor?.nombre) {
        // Buscar por nombre
        const emisorNorm = (a.emisor.nombre || '').toLowerCase().trim();
        for (const [, p] of provMap) {
          if ((p.nombre || '').toLowerCase().trim() === emisorNorm) {
            provEntry = p;
            break;
          }
        }
        // Si no existe, crear uno nuevo
        if (!provEntry) {
          const newId = `prov_doc_${Date.now()}_${Math.random().toString(36).slice(2,5)}`;
          provEntry = {
            id: newId,
            nombre:          a.emisor.nombre,
            cif_nif:         a.emisor.cif_nif || null,
            email:           a.emisor.email || null,
            telefono:        a.emisor.telefono || null,
            direccion:       a.emisor.direccion || null,
            creado:          doc.procesado,
            facturas:        [],
            total_facturado: 0,
            total_base:      0,
            total_iva:       0,
            desglose_iva:    {},
            primera_factura: null,
            ultima_factura:  null,
          };
          provMap.set(newId, provEntry);
        }
      }

      if (!provEntry) continue;

      // Calcular desglose IVA de esta factura
      const conceptos = a.conceptos || a.lineas || [];
      const facIva = {};
      for (const c of conceptos) {
        const pct = c.iva_porcentaje != null ? String(c.iva_porcentaje) : '21';
        if (!facIva[pct]) facIva[pct] = { base: 0, cuota: 0 };
        const lineTotal = parseFloat(c.total || c.total_linea) || 0;
        const lineBase  = parseFloat(c.precio_unitario) * (parseFloat(c.cantidad) || 1) || lineTotal / (1 + parseFloat(pct) / 100);
        facIva[pct].base  += lineBase;
        facIva[pct].cuota += lineTotal - lineBase;
      }

      const total = parseFloat(a.total) || 0;
      const base  = parseFloat(a.base_imponible) || 0;
      const iva   = parseFloat(a.iva_total) || (total - base);

      // Acumular en proveedor
      provEntry.total_facturado += total;
      provEntry.total_base      += base || (total / 1.21);
      provEntry.total_iva       += iva  || (total - total / 1.21);

      // Desglose IVA acumulado
      for (const [pct, vals] of Object.entries(facIva)) {
        if (!provEntry.desglose_iva[pct]) provEntry.desglose_iva[pct] = { base: 0, cuota: 0, count: 0 };
        provEntry.desglose_iva[pct].base  += vals.base;
        provEntry.desglose_iva[pct].cuota += vals.cuota;
        provEntry.desglose_iva[pct].count += 1;
      }

      const fecha = a.fecha || doc.procesado?.slice(0, 10);
      if (!provEntry.primera_factura || fecha < provEntry.primera_factura) provEntry.primera_factura = fecha;
      if (!provEntry.ultima_factura  || fecha > provEntry.ultima_factura)  provEntry.ultima_factura  = fecha;

      provEntry.facturas.push({
        id:        doc.id,
        archivo:   doc.nombre_archivo,
        tipo:      a.tipo,
        numero:    a.numero_documento,
        fecha,
        base:      round2(base || total / 1.21),
        iva:       round2(iva  || total - total / 1.21),
        total:     round2(total),
        conceptos: conceptos.map(c => ({
          descripcion: c.descripcion,
          cantidad:    c.cantidad,
          precio:      c.precio_unitario,
          iva_pct:     c.iva_porcentaje,
          total:       c.total || c.total_linea,
        })),
        resumen:   a.resumen,
      });
    }

    // Formatear y ordenar
    const providers = [...provMap.values()]
      .filter(p => p.facturas.length > 0)
      .map(p => ({
        ...p,
        total_facturado: round2(p.total_facturado),
        total_base:      round2(p.total_base),
        total_iva:       round2(p.total_iva),
        desglose_iva:    Object.fromEntries(
          Object.entries(p.desglose_iva).map(([k, v]) => [k, { base: round2(v.base), cuota: round2(v.cuota), facturas: v.count }])
        ),
        num_facturas:    p.facturas.length,
        facturas:        p.facturas.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '')),
      }))
      .sort((a, b) => b.total_facturado - a.total_facturado);

    const totales = {
      total_facturado: round2(providers.reduce((s, p) => s + p.total_facturado, 0)),
      total_base:      round2(providers.reduce((s, p) => s + p.total_base, 0)),
      total_iva:       round2(providers.reduce((s, p) => s + p.total_iva, 0)),
      num_proveedores: providers.length,
      num_facturas:    providers.reduce((s, p) => s + p.num_facturas, 0),
    };

    res.json({ success: true, totales, providers });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

function round2(n) { return Math.round((n || 0) * 100) / 100; }

// ═══════════════════════════════════════════════════════════════════════════
//  BACKWARD COMPAT — Endpoints que lee el frontend viejo
//  Redirigen a la fuente única (documents.json)
// ═══════════════════════════════════════════════════════════════════════════

// /api/email/invoices-detail — antes parseaba PDFs on-the-fly, ahora lee docs procesados
emailRouter.get('/invoices-detail', async (req, res) => {
  try {
    const docs = await getDocuments();
    const facturas = docs.filter(d =>
      d.analisis?.tipo === 'factura_recibida' || d.analisis?.tipo === 'factura_emitida'
    );

    // Agrupar por proveedor
    const byProvider = {};
    for (const d of facturas) {
      const key  = d.analisis?.emisor?.email || d.analisis?.emisor?.nombre || 'Desconocido';
      const name = d.analisis?.emisor?.nombre || 'Desconocido';
      if (!byProvider[key]) {
        byProvider[key] = { name, email: d.analisis?.emisor?.email, invoices: [], totalSpend: 0, allItems: [] };
      }
      byProvider[key].invoices.push({
        filename:      d.nombre_archivo,
        date:          d.analisis?.fecha,
        total:         d.analisis?.total,
        invoiceNumber: d.analisis?.numero_documento,
        items:         (d.analisis?.lineas || []).map(l => ({
          name:      l.descripcion,
          qty:       l.cantidad,
          unitPrice: l.precio_unitario,
          lineTotal: l.total_linea,
        })),
      });
      if (d.analisis?.total) byProvider[key].totalSpend += d.analisis.total;
      byProvider[key].allItems.push(...(d.analisis?.lineas || []));
    }

    const providers = Object.values(byProvider)
      .map(p => ({
        ...p,
        invoiceCount: p.invoices.length,
        totalSpend:   Math.round(p.totalSpend * 100) / 100,
        topItems:     getTopItems(p.allItems),
      }))
      .sort((a, b) => b.totalSpend - a.totalSpend);

    res.json({ success: true, totalInvoices: facturas.length, providers });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Helper: top items por proveedor ──────────────────────────────────────
function getTopItems(items) {
  const map = {};
  for (const l of items) {
    const k = (l.descripcion || '').toLowerCase().trim();
    if (!k || k.length < 2) continue;
    if (!map[k]) map[k] = { name: l.descripcion, totalQty: 0, totalSpend: 0, appearances: 0, prices: [] };
    map[k].totalQty += l.cantidad || 1;
    map[k].totalSpend += l.total_linea || 0;
    map[k].appearances++;
    if (l.precio_unitario) map[k].prices.push(l.precio_unitario);
  }
  return Object.values(map)
    .sort((a, b) => b.appearances - a.appearances)
    .slice(0, 20)
    .map(i => ({
      ...i,
      avgPrice:       i.totalQty > 0 ? i.totalSpend / i.totalQty : 0,
      minPrice:       i.prices.length ? Math.min(...i.prices) : 0,
      maxPrice:       i.prices.length ? Math.max(...i.prices) : 0,
      priceVariation: i.prices.length > 1
        ? ((Math.max(...i.prices) - Math.min(...i.prices)) / Math.min(...i.prices) * 100).toFixed(1)
        : '0',
    }));
}

// /api/email/fetch-page — paginación (ahora sobre emails guardados)
emailRouter.get('/fetch-page', async (req, res) => {
  try {
    const { limit = 100, since = '2026-01-01', page = 1 } = req.query;
    let emails = await getEmails();
    if (since) emails = emails.filter(e => e.received_date >= since);
    emails.sort((a, b) => (b.received_date || '').localeCompare(a.received_date || ''));

    const lim = parseInt(limit);
    const pg  = parseInt(page);
    const start = (pg - 1) * lim;
    const paged = emails.slice(start, start + lim);

    res.json({
      success: true,
      count: paged.length,
      page: pg,
      total: emails.length,
      totalPages: Math.ceil(emails.length / lim),
      emails: paged,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
