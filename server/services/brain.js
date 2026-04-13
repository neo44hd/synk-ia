// ═══════════════════════════════════════════════════════════════════════════
//  SINKIA BRAIN — Agente de negocio con contexto real
//  Flujo: Pregunta → Clasificar intención → Buscar datos → Responder
//  LLM: Ollama (localhost:11434) — qwen3.5
// ═══════════════════════════════════════════════════════════════════════════
import { getDocuments, getEntities, getStats } from './documentProcessor.js';
import { getRevoResumen, getRevoProductos, getRevoVentas } from '../agents/revoAgent.js';

const OLLAMA_URL = process.env.OLLAMA_URL            || 'http://localhost:11434';
const MODEL      = process.env.OLLAMA_CHAT_MODEL || process.env.OLLAMA_MODEL || 'qwen3.5';
const SEARXNG    = process.env.SEARXNG_URL    || 'http://localhost:8888';

// ── Strip <think>...</think> del modelo Qwen3 thinking ─────────────────────
function stripThinking(text) {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

// ── Búsqueda web via SearXNG (cuando está disponible) ─────────────────────
export async function searchWeb(query, n = 5) {
  try {
    const url = `${SEARXNG}/search?q=${encodeURIComponent(query)}&format=json&language=es&categories=general`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json();
    return (data.results || []).slice(0, n).map(r => ({
      titulo:  r.title,
      url:     r.url,
      resumen: (r.content || '').slice(0, 400),
    }));
  } catch {
    return null; // SearXNG no disponible
  }
}

// ── LLM helper (Ollama OpenAI-compatible API, strip thinking) ───────────────
async function llm(messages, { maxTokens = 1200, temp = 0.2 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);
  try {
    const res = await fetch(`${OLLAMA_URL}/v1/chat/completions`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      signal:  controller.signal,
      body: JSON.stringify({
        model:       MODEL,
        messages,
        temperature: temp,
        max_tokens:  maxTokens,
        stream:      false,
      }),
    });
    if (!res.ok) throw new Error(`Ollama ${res.status}`);
    const d = await res.json();
    return stripThinking(d.choices?.[0]?.message?.content?.trim() || '');
  } finally {
    clearTimeout(timer);
  }
}

// ── PASO 1: Clasificar intención ───────────────────────────────────────────
const INTENT_SYSTEM = `Clasifica la pregunta del usuario en exactamente UNO de estos tipos.
Responde SOLO con JSON, sin explicaciones.

TIPOS:
- precio_articulo   → buscar precio de un producto/artículo en facturas
- buscar_factura    → encontrar una o varias facturas (por proveedor, fecha, número, cliente)
- comparar_facturas → comparar dos facturas o dos períodos
- crear_presupuesto → generar un presupuesto para un cliente
- resumen_proveedor → información y historial de un proveedor
- resumen_cliente   → información y historial de un cliente
- gastos_analisis   → análisis de gastos/ingresos, totales, tendencias
- producto_ventas   → artículo más vendido, estadísticas de ventas (datos Revo)
- facturas_pendientes → facturas sin pagar o por cobrar
- general           → cualquier otra consulta o conversación

JSON a devolver:
{
  "intent": "tipo",
  "params": {
    "articulo":    "nombre del producto si aplica, o null",
    "proveedor":   "nombre del proveedor si aplica, o null",
    "cliente":     "nombre del cliente si aplica, o null",
    "fecha_desde": "YYYY-MM si aplica, o null",
    "fecha_hasta": "YYYY-MM si aplica, o null",
    "mes":         "nombre del mes si se menciona, o null",
    "tipo_doc":    "factura_recibida|factura_emitida|albaran|presupuesto|null",
    "query":       "la pregunta original resumida en 5 palabras"
  }
}`;

export async function classifyIntent(message) {
  try {
    const raw = await llm([
      { role: 'system', content: INTENT_SYSTEM },
      { role: 'user',   content: message },
    ], { maxTokens: 300, temp: 0.0 });

    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return { intent: 'general', params: { query: message } };
    return JSON.parse(match[0]);
  } catch {
    return { intent: 'general', params: { query: message } };
  }
}

// ── PASO 2: Funciones de datos ─────────────────────────────────────────────

// Normaliza texto para búsqueda
function norm(s) { return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
function matches(a, b) { return a && b && norm(a).includes(norm(b)); }

// Compara precios de un artículo entre proveedores
async function getPrecioArticulo(articulo) {
  const docs = await getDocuments();
  const resultados = [];

  for (const doc of docs) {
    const a = doc.analisis || {};
    if (!['factura_recibida', 'albaran', 'pedido'].includes(a.tipo)) continue;
    for (const linea of (a.lineas || [])) {
      if (matches(linea.descripcion, articulo)) {
        resultados.push({
          articulo:    linea.descripcion,
          precio_unit: linea.precio_unitario,
          cantidad:    linea.cantidad,
          iva:         linea.iva_porcentaje,
          proveedor:   a.emisor?.nombre || 'Desconocido',
          fecha:       a.fecha || doc.procesado?.slice(0, 10),
          documento:   doc.nombre_archivo,
        });
      }
    }
  }

  // Agrupar por proveedor → mejor precio
  const byProv = {};
  for (const r of resultados) {
    const k = r.proveedor;
    if (!byProv[k] || r.precio_unit < byProv[k].precio_unit) byProv[k] = r;
  }

  return {
    articulo_buscado: articulo,
    total_registros:  resultados.length,
    por_proveedor:    Object.values(byProv).sort((a, b) => a.precio_unit - b.precio_unit),
    todos:            resultados.slice(0, 20),
  };
}

// Busca facturas por criterios
async function buscarFacturas(params) {
  const docs = await getDocuments();
  const found = docs.filter(doc => {
    const a = doc.analisis || {};
    if (params.tipo_doc && a.tipo !== params.tipo_doc) return false;
    if (params.proveedor && !matches(a.emisor?.nombre, params.proveedor) && !matches(a.emisor?.cif_nif, params.proveedor)) return false;
    if (params.cliente   && !matches(a.receptor?.nombre, params.cliente)) return false;
    if (params.mes) {
      const fecha = a.fecha || doc.procesado || '';
      const mesNorm = norm(params.mes);
      const MESES = { enero:'01',febrero:'02',marzo:'03',abril:'04',mayo:'05',junio:'06',
                      julio:'07',agosto:'08',septiembre:'09',octubre:'10',noviembre:'11',diciembre:'12' };
      const mesNum = MESES[mesNorm];
      if (mesNum && !fecha.includes(`-${mesNum}-`)) return false;
    }
    if (params.fecha_desde) {
      const fecha = (a.fecha || doc.procesado || '').slice(0, 7);
      if (fecha < params.fecha_desde) return false;
    }
    if (params.fecha_hasta) {
      const fecha = (a.fecha || doc.procesado || '').slice(0, 7);
      if (fecha > params.fecha_hasta) return false;
    }
    return true;
  });

  return found.slice(0, 15).map(doc => {
    const a = doc.analisis || {};
    return {
      id:         doc.id,
      archivo:    doc.nombre_archivo,
      tipo:       a.tipo,
      numero:     a.numero_documento,
      fecha:      a.fecha,
      emisor:     a.emisor?.nombre,
      receptor:   a.receptor?.nombre,
      total:      a.total,
      moneda:     a.moneda || 'EUR',
      lineas:     (a.lineas || []).slice(0, 5),
      forma_pago: a.forma_pago,
      notas:      a.notas,
      resumen:    a.resumen,
    };
  });
}

// Resumen completo de un proveedor
async function resumenProveedor(nombre) {
  const [docs, entities] = await Promise.all([getDocuments(), getEntities()]);

  const proveedor = entities.proveedores.find(p => matches(p.nombre, nombre) || matches(p.cif_nif, nombre));
  const facturas  = docs.filter(d => {
    const e = d.analisis?.emisor;
    return matches(e?.nombre, nombre) || matches(e?.cif_nif, nombre);
  });

  const totalGastado = facturas.reduce((s, d) => s + (d.analisis?.total || 0), 0);
  const articulos    = {};
  for (const f of facturas) {
    for (const l of (f.analisis?.lineas || [])) {
      const key = norm(l.descripcion || 'Sin descripción').slice(0, 40);
      if (!articulos[key]) articulos[key] = { descripcion: l.descripcion, veces: 0, precio_min: Infinity, precio_max: 0 };
      articulos[key].veces++;
      if (l.precio_unitario < articulos[key].precio_min) articulos[key].precio_min = l.precio_unitario;
      if (l.precio_unitario > articulos[key].precio_max) articulos[key].precio_max = l.precio_unitario;
    }
  }

  return {
    proveedor:      proveedor || { nombre },
    total_facturas: facturas.length,
    total_gastado:  totalGastado,
    ultima_factura: facturas[0]?.analisis?.fecha || facturas[0]?.procesado?.slice(0, 10),
    articulos_frecuentes: Object.values(articulos).sort((a, b) => b.veces - a.veces).slice(0, 10),
    ultimas_facturas: facturas.slice(0, 5).map(f => ({
      fecha:  f.analisis?.fecha,
      numero: f.analisis?.numero_documento,
      total:  f.analisis?.total,
    })),
  };
}

// Análisis de gastos e ingresos
async function analisisGastos(params) {
  const docs  = await getDocuments();
  const stats = { gastos: {}, ingresos: {}, por_proveedor: {}, por_tipo: {} };

  for (const doc of docs) {
    const a    = doc.analisis || {};
    const mes  = (a.fecha || doc.procesado || '').slice(0, 7);
    const total = a.total || 0;

    if (a.tipo === 'factura_recibida') {
      stats.gastos[mes] = (stats.gastos[mes] || 0) + total;
      const prov = a.emisor?.nombre || 'Desconocido';
      stats.por_proveedor[prov] = (stats.por_proveedor[prov] || 0) + total;
    }
    if (a.tipo === 'factura_emitida') {
      stats.ingresos[mes] = (stats.ingresos[mes] || 0) + total;
    }
    stats.por_tipo[a.tipo] = (stats.por_tipo[a.tipo] || 0) + 1;
  }

  const topProveedores = Object.entries(stats.por_proveedor)
    .sort(([,a],[,b]) => b - a).slice(0, 10)
    .map(([nombre, total]) => ({ nombre, total }));

  return {
    gastos_por_mes:    stats.gastos,
    ingresos_por_mes:  stats.ingresos,
    top_proveedores:   topProveedores,
    documentos_por_tipo: stats.por_tipo,
    total_gastos:      Object.values(stats.gastos).reduce((s, v) => s + v, 0),
    total_ingresos:    Object.values(stats.ingresos).reduce((s, v) => s + v, 0),
  };
}

// Crear borrador de presupuesto
async function crearPresupuesto(params, preguntaOriginal) {
  const entities = await getEntities();
  const cliente  = entities.clientes.find(c => matches(c.nombre, params.cliente)) || { nombre: params.cliente };
  const docs     = await getDocuments();

  // Buscar presupuestos anteriores del cliente
  const anteriores = docs.filter(d =>
    d.analisis?.tipo === 'presupuesto' &&
    matches(d.analisis?.receptor?.nombre, params.cliente)
  ).slice(0, 3);

  return {
    accion: 'crear_presupuesto',
    cliente,
    presupuestos_anteriores: anteriores.map(p => ({
      fecha: p.analisis?.fecha,
      total: p.analisis?.total,
      lineas: p.analisis?.lineas,
    })),
    instruccion: preguntaOriginal,
  };
}

// Facturas pendientes (sin forma de pago o vencidas)
async function facturasPendientes() {
  const docs = await getDocuments();
  const hoy  = new Date().toISOString().slice(0, 10);

  const pendientes = docs.filter(d => {
    const a = d.analisis || {};
    if (!['factura_recibida', 'factura_emitida'].includes(a.tipo)) return false;
    if (a.fecha_vencimiento && a.fecha_vencimiento < hoy) return true; // vencida
    if (!a.forma_pago || a.forma_pago?.toLowerCase().includes('pendiente')) return true;
    return false;
  });

  return pendientes.slice(0, 20).map(d => ({
    archivo:    d.nombre_archivo,
    tipo:       d.analisis?.tipo,
    total:      d.analisis?.total,
    emisor:     d.analisis?.emisor?.nombre,
    receptor:   d.analisis?.receptor?.nombre,
    vencimiento: d.analisis?.fecha_vencimiento,
    forma_pago: d.analisis?.forma_pago,
  }));
}

// ── PASO 3: Generar respuesta ──────────────────────────────────────────────
const ANSWER_SYSTEM = `Eres el asistente inteligente de Sinkia Labs, experto en gestión empresarial y hostelería.
Respondes en español, de forma clara, directa y útil — como un CFO personal.
REGLAS:
- Usa los datos reales del negocio que se te proporcionan. Cita números exactos.
- Si hay resultados_web en el contexto, úsalos para enriquecer la respuesta con info actual.
- Si te piden crear un presupuesto, hazlo en formato estructurado con líneas, importes e IVA.
- Sé conciso pero completo. Nunca inventes datos que no estén en el contexto.
- Si el contexto está vacío o hay pocos documentos, dilo claramente y sugiere qué hacer.
- Puedes razonar internamente, pero tu respuesta final debe ser limpia y directa.`;

async function generateAnswer(question, contextData, intent, stream = false) {
  const contextStr = JSON.stringify(contextData, null, 2);
  const truncated  = contextStr.length > 3000
    ? contextStr.slice(0, 3000) + '\n... [datos truncados]'
    : contextStr;

  const messages = [
    { role: 'system', content: ANSWER_SYSTEM },
    { role: 'user',   content: `PREGUNTA: ${question}\n\nDATOS DISPONIBLES:\n${truncated}\n\nResponde a la pregunta usando los datos anteriores.` },
  ];

  if (!stream) {
    return llm(messages, { maxTokens: 1500, temp: 0.3 });
  }

  // Streaming
  const res = await fetch(`${OLLAMA_URL}/v1/chat/completions`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, messages, temperature: 0.3, max_tokens: 1500, stream: true }),
  });
  return res; // devuelve el response para streaming
}

// ── API PÚBLICA ────────────────────────────────────────────────────────────
export async function askBrain(question, { stream = false } = {}) {
  // 1. Clasificar intención
  const { intent, params } = await classifyIntent(question);
  console.log(`[BRAIN] intent=${intent} params=${JSON.stringify(params)}`);

  // 2. Buscar datos relevantes
  let contextData = {};
  let stepLabel   = 'Analizando tu pregunta...';

  try {
    switch (intent) {
      case 'precio_articulo':
        stepLabel   = `Buscando precios de "${params.articulo}"...`;
        contextData = await getPrecioArticulo(params.articulo || params.query);
        break;

      case 'buscar_factura':
        stepLabel   = `Buscando facturas${params.proveedor ? ` de ${params.proveedor}` : ''}...`;
        contextData = { facturas: await buscarFacturas(params) };
        break;

      case 'comparar_facturas':
        stepLabel   = 'Comparando documentos...';
        const [f1, f2] = await Promise.all([
          buscarFacturas({ ...params, fecha_hasta: params.fecha_desde }),
          buscarFacturas({ ...params, fecha_desde: params.fecha_hasta }),
        ]);
        contextData = { periodo_1: f1, periodo_2: f2 };
        break;

      case 'resumen_proveedor':
        stepLabel   = `Analizando proveedor "${params.proveedor}"...`;
        contextData = await resumenProveedor(params.proveedor || params.query);
        break;

      case 'resumen_cliente': {
        stepLabel   = `Analizando cliente "${params.cliente}"...`;
        const [docs, entities] = await Promise.all([getDocuments(), getEntities()]);
        const cliente = entities.clientes.find(c => matches(c.nombre, params.cliente));
        const factsCliente = docs.filter(d => matches(d.analisis?.receptor?.nombre, params.cliente));
        contextData = { cliente, facturas: factsCliente.slice(0, 10).map(f => f.analisis) };
        break;
      }

      case 'gastos_analisis':
        stepLabel   = 'Calculando análisis financiero...';
        contextData = await analisisGastos(params);
        break;

      case 'crear_presupuesto':
        stepLabel   = `Preparando presupuesto para "${params.cliente}"...`;
        contextData = await crearPresupuesto(params, question);
        break;

      case 'facturas_pendientes':
        stepLabel   = 'Buscando facturas pendientes...';
        contextData = { pendientes: await facturasPendientes() };
        break;

      case 'producto_ventas': {
        stepLabel   = 'Consultando datos de ventas del TPV...';
        const [resumen, productos] = await Promise.all([
          getRevoResumen(),
          getRevoProductos(),
        ]);
        contextData = {
          top_productos:  resumen.top_productos   || [],
          ventas_por_dia: (resumen.por_dia || []).slice(0, 14),
          total_ventas:   resumen.total_ventas    || 0,
          total_tickets:  resumen.total_tickets   || 0,
          articulo_buscado: params.articulo || null,
          catalogo_total: (productos.items || []).length,
        };
        break;
      }

      default: {
        // Búsqueda general en documentos
        stepLabel   = 'Buscando en documentos...';
        const allDocs = await getDocuments();
        const relevant = allDocs.filter(d => {
          const text = JSON.stringify(d.analisis).toLowerCase();
          return (params.query || question).toLowerCase().split(' ')
            .filter(w => w.length > 3)
            .some(w => text.includes(w));
        }).slice(0, 5);
        const statsData = await getStats();
        contextData = { documentos_relevantes: relevant.map(d => d.analisis), estadisticas: statsData };
        break;
      }
    }
  } catch (err) {
    contextData = { error: err.message, nota: 'No hay documentos procesados aún o el sistema está vacío.' };
  }

  // 3. Generar respuesta
  const answer = await generateAnswer(question, contextData, intent, stream);

  return { intent, stepLabel, contextData, answer };
}

// Streaming version para SSE
export async function askBrainStream(question, onStep, onChunk) {
  // 1. Clasificar
  const { intent, params } = await classifyIntent(question);
  const stepLabel = getStepLabel(intent, params);
  onStep({ intent, stepLabel });

  // 2. Datos
  let contextData = {};
  try {
    contextData = await fetchContextByIntent(intent, params, question);
  } catch (err) {
    contextData = { error: err.message };
  }

  onStep({ intent, stepLabel: 'Generando respuesta...' });

  // 3. Stream
  const res = await generateAnswer(question, contextData, intent, true);
  if (!res?.body) throw new Error('No stream');

  const reader  = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer    = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6);
      if (data === '[DONE]') continue;
      try {
        const json  = JSON.parse(data);
        const chunk = json.choices?.[0]?.delta?.content || '';
        if (chunk) onChunk(chunk);
      } catch {}
    }
  }
}

function getStepLabel(intent, params) {
  const map = {
    precio_articulo:    `Buscando precios de "${params.articulo || params.query}"...`,
    buscar_factura:     `Buscando facturas${params.proveedor ? ` de ${params.proveedor}` : ''}...`,
    comparar_facturas:  'Comparando documentos...',
    resumen_proveedor:  `Analizando proveedor "${params.proveedor}"...`,
    resumen_cliente:    `Analizando cliente "${params.cliente}"...`,
    gastos_analisis:    'Calculando análisis financiero...',
    crear_presupuesto:  `Preparando presupuesto para "${params.cliente}"...`,
    facturas_pendientes:'Buscando facturas pendientes...',
    producto_ventas:    'Consultando datos de ventas...',
  };
  return map[intent] || 'Buscando en documentos...';
}

async function fetchContextByIntent(intent, params, question) {
  switch (intent) {
    case 'precio_articulo':    return getPrecioArticulo(params.articulo || params.query);
    case 'buscar_factura':     return { facturas: await buscarFacturas(params) };
    case 'resumen_proveedor':  return resumenProveedor(params.proveedor || params.query);
    case 'gastos_analisis':    return analisisGastos(params);
    case 'crear_presupuesto':  return crearPresupuesto(params, question);
    case 'facturas_pendientes': return { pendientes: await facturasPendientes() };
    case 'producto_ventas': {
      const [resumen, productos] = await Promise.all([ getRevoResumen(), getRevoProductos() ]);
      return {
        top_productos:   resumen.top_productos  || [],
        ventas_por_dia:  (resumen.por_dia || []).slice(0, 14),
        total_ventas:    resumen.total_ventas   || 0,
        total_tickets:   resumen.total_tickets  || 0,
        articulo_buscado: params.articulo       || null,
        catalogo_total:  (productos.items || []).length,
      };
    }
    default: {
      const allDocs = await getDocuments();
      const relevant = allDocs.filter(d => {
        const text = JSON.stringify(d.analisis).toLowerCase();
        return (params.query || question).toLowerCase().split(' ')
          .filter(w => w.length > 3).some(w => text.includes(w));
      }).slice(0, 5);
      const stats = await getStats();
      // Búsqueda web si SearXNG está disponible
      const webResults = await searchWeb(params.query || question);
      return {
        documentos: relevant.map(d => d.analisis),
        stats,
        ...(webResults ? { resultados_web: webResults } : {}),
      };
    }
  }
}
