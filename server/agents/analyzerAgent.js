// ═══════════════════════════════════════════════════════════════════════════
//  AGENTE ANALIZADOR — Clasificación y extracción estructurada con LLM local
//
//  Recibe el texto extraído por el Agente Extractor y llama a Ollama para:
//    · Clasificar el tipo de documento (factura, nómina, multa, etc.)
//    · Extraer todos los campos relevantes de forma estructurada
//    · Asignar urgencia, acción recomendada y tags de búsqueda
//
//  Contexto de empresa: CHICKEN PALACE IBIZA, S.L. (CIF: B56908486)
//  Restaurante en Ibiza — documentos son SIEMPRE gastos/entradas de la empresa.
//
//  Uso:
//    import { analyze } from './analyzerAgent.js';
//    const result = await analyze({ text, method, metadata, originalName, mimeType });
// ═══════════════════════════════════════════════════════════════════════════

// ── Configuración ──────────────────────────────────────────────────────────
const OLLAMA_URL  = process.env.OLLAMA_URL   || 'http://localhost:11434';
const MODEL       = process.env.ANALYZER_MODEL || 'qwen3.5';
const TIMEOUT_MS  = 600_000;   // 10 minutos — PDFs largos (Coca Cola 13pg) necesitan más tiempo con qwen3.5
const MAX_TOKENS  = 4000;      // qwen3.5 soporta más tokens de salida
const TEMPERATURE = 0.05;      // Casi determinista para clasificación
const MAX_TEXT    = 5000;      // 5K chars — qwen3.5 pierde la estructura JSON con textos >5K

// Datos fijos de MI EMPRESA (receptor en casi todos los documentos)
const MI_EMPRESA = {
  nombre: process.env.EMPRESA_NOMBRE || 'CHICKEN PALACE IBIZA, S.L.',
  cif:    process.env.EMPRESA_CIF    || 'B56908486',
  email:  process.env.EMAIL_USER     || 'info@chickenpalace.es',
};

// Detectar automáticamente si el modelo tiene capacidad visual
const IS_VL_MODEL = /vl|vision|visual/i.test(MODEL);

// ── Tipos de documentos válidos ────────────────────────────────────────────
const TIPOS_VALIDOS = [
  'factura_recibida', 'factura_emitida', 'nomina', 'finiquito',
  'albaran', 'presupuesto', 'contrato', 'ticket',
  'extracto_bancario', 'certificado', 'multa',
  'notificacion_hacienda', 'correo_comercial', 'correo_personal',
  'spam', 'recibo_autonomo', 'seguro', 'poliza',
  'acta', 'sentencia', 'carta_oficial', 'otro',
];

// ── Urgencia alta por defecto para estos tipos ─────────────────────────────
const TIPOS_URGENTES = new Set(['multa', 'notificacion_hacienda', 'sentencia', 'acta']);

// ── Prompt del sistema — muy específico para Chicken Palace ───────────────
const SYSTEM_PROMPT = `Eres el motor de análisis documental de SynK-IA para ${MI_EMPRESA.nombre}.

═══════════════════════════════════════════════════════
CONTEXTO DE EMPRESA
═══════════════════════════════════════════════════════
Empresa: ${MI_EMPRESA.nombre}
CIF: ${MI_EMPRESA.cif}
Tipo: Restaurante de comida a domicilio y para llevar, Ibiza (Islas Baleares)
Email: ${MI_EMPRESA.email}

REGLA FUNDAMENTAL: ${MI_EMPRESA.nombre} es SIEMPRE el COMPRADOR / EMPLEADOR / RECEPTOR.
NUNCA es el proveedor/vendedor en los documentos que procesas.
Todos los documentos son gastos, obligaciones o comunicaciones ENTRANTES.

═══════════════════════════════════════════════════════
REGLAS DE CLASIFICACIÓN
═══════════════════════════════════════════════════════

FACTURAS RECIBIDAS (factura_recibida):
  - emisor = proveedor (la empresa que vende/presta servicio)
  - receptor = ${MI_EMPRESA.nombre}
  - emisor.rol = "proveedor"
  - Proveedores habituales: distribuidores de alimentación (carne, pollo, verduras),
    bebidas (Coca-Cola, cerveza), productos de limpieza, mantenimiento,
    gas/electricidad/agua (Endesa, Iberdrola, Gas Natural), gestoría,
    seguros, telefonía, plataformas de delivery (Glovo, Uber Eats, Just Eat),
    envases/embalajes, uniformes, publicidad, asesoría fiscal/laboral.
  - ATENCIÓN: Si el PDF tiene "CHICKEN PALACE" en cabecera, eso es el receptor (destinatario),
    NO el emisor. El emisor es la OTRA entidad del documento.

NÓMINAS (nomina):
  - emisor = ${MI_EMPRESA.nombre} (empleador)
  - receptor = el TRABAJADOR (empleado)
  - Extraer: nombre_completo, DNI, NSS (Nº Afiliación / N.A.F.), categoría profesional,
    grupo cotización, antigüedad, tipo contrato, salario bruto (base_imponible),
    IRPF, SS trabajador, líquido neto (total)

FINIQUITOS / LIQUIDACIONES (finiquito):
  - Igual que nómina pero con partes proporcionales y/o indemnización

ALBARANES (albaran):
  - Documento de entrega sin importe fiscal (o con importe no facturado)
  - emisor = proveedor que entrega mercancía

DOCUMENTOS FISCALES (notificacion_hacienda):
  - Modelos AEAT: 303 (IVA trimestral), 111/115 (retenciones),
    190/180 (resúmenes anuales), 347 (operaciones con terceros),
    200 (Impuesto Sociedades), 036/037 (censo)
  - También: notificaciones Agencia Tributaria, Seguridad Social (TC1, TC2),
    TGSS, SEPE, DGT/Tráfico
  - Islas Baleares: ATIB (Agència Tributària de les Illes Balears)

MULTAS (multa):
  - DGT, Ayuntamiento de Ibiza, Consell Insular, Sanidad, Laboral
  - urgencia = "alta" SIEMPRE

RECIBOS AUTÓNOMO (recibo_autonomo):
  - Cuota autónomo RETA, colegios profesionales

SEGUROS / PÓLIZAS (seguro | poliza):
  - Pólizas de responsabilidad civil, incendio, multiriesgo, vehiculos

EXTRACTOS BANCARIOS (extracto_bancario):
  - Movimientos de cuenta, cuadernos de pagos domiciliados

CONTRATOS (contrato):
  - Laborales, alquiler, suministros, prestación de servicios

CORREOS COMERCIALES / SPAM:
  - Emails de marketing, ofertas de proveedores, newsletters
  - accion_recomendada = "ignorar"

═══════════════════════════════════════════════════════
INSTRUCCIONES DE EXTRACCIÓN
═══════════════════════════════════════════════════════
1. Lee el documento completo y determina su tipo con certeza
2. Identifica al emisor real (quien envía/emite el documento)
3. Extrae TODOS los importes visibles (brutos, impuestos, netos, retenciones)
4. Captura TODAS las fechas relevantes (emisión, vencimiento, periodo)
5. Lista TODOS los conceptos/líneas de detalle del documento
6. Genera tags útiles para búsqueda posterior
7. Determina la acción recomendada:
   - "pagar"       → factura o recibo con importe pendiente
   - "contabilizar"→ factura ya pagada o nómina procesada
   - "urgente"     → multa o notificación con plazo inminente
   - "revisar"     → documento con datos incompletos o ambiguos
   - "responder"   → requiere respuesta o contestación formal
   - "archivar"    → informativo, sin acción pendiente
   - "ignorar"     → spam o correo comercial irrelevante

═══════════════════════════════════════════════════════
FORMATO DE RESPUESTA — JSON ESTRICTO
═══════════════════════════════════════════════════════
Responde ÚNICAMENTE con el siguiente JSON (sin markdown, sin texto antes ni después):
{
  "tipo": "uno de: factura_recibida|factura_emitida|nomina|finiquito|albaran|presupuesto|contrato|ticket|extracto_bancario|certificado|multa|notificacion_hacienda|correo_comercial|correo_personal|spam|recibo_autonomo|seguro|poliza|acta|sentencia|carta_oficial|otro",
  "subtipo": "descripción más específica (ej: cuota_autonomo, modelo_303, carta_despido, factura_gas, factura_delivery) o null",
  "urgencia": "alta|media|baja",
  "emisor": {
    "nombre": null,
    "cif_nif": null,
    "direccion": null,
    "email": null,
    "telefono": null,
    "rol": "proveedor|empleador|banco|administracion|aseguradora|otro",
    "tipo_entidad": "empresa|persona_fisica|administracion|banco|aseguradora"
  },
  "receptor": {
    "nombre": null,
    "cif_nif": null,
    "direccion": null,
    "email": null,
    "telefono": null,
    "rol": "empresa|empleado|cliente|particular|otro",
    "tipo_entidad": "empresa|persona_fisica|administracion|banco|aseguradora"
  },
  "trabajador": {
    "nombre_completo": null,
    "dni": null,
    "nss": null,
    "categoria_profesional": null,
    "grupo_cotizacion": null,
    "antiguedad": null,
    "tipo_contrato": null,
    "puesto": null
  },
  "importes": {
    "base_imponible": null,
    "iva_porcentaje": null,
    "iva_total": null,
    "irpf": null,
    "total": null,
    "moneda": "EUR"
  },
  "conceptos": [
    { "descripcion": null, "cantidad": 1, "precio_unitario": null, "iva_porcentaje": null, "total": null }
  ],
  "fechas": {
    "documento": null,
    "vencimiento": null,
    "periodo_inicio": null,
    "periodo_fin": null
  },
  "referencias": {
    "numero_documento": null,
    "numero_expediente": null,
    "referencia_catastral": null,
    "numero_poliza": null
  },
  "forma_pago": null,
  "cuenta_bancaria": null,
  "resumen": "Una frase en español describiendo el documento",
  "tags": ["tag1", "tag2"],
  "accion_recomendada": "archivar|pagar|revisar|urgente|contabilizar|responder|ignorar",
  "confianza": 0.9
}

REGLAS FINALES:
- trabajador → null si NO es nómina/finiquito/liquidación
- conceptos  → array vacío [] si no hay líneas de detalle
- Importes como número decimal (1234.56), nunca string
- Fechas en formato YYYY-MM-DD, null si no aparece
- null para cualquier campo no encontrado (NUNCA string vacío "")
- confianza: 1.0 = totalmente seguro, 0.0 = no sabe nada
- tags: mínimo 3, máximo 10, en minúsculas sin acentos (ej: "factura", "gas", "endesa", "2024")`;

// ══════════════════════════════════════════════════════════════════════════
//  HELPERS — Truncado inteligente de texto
// ══════════════════════════════════════════════════════════════════════════

/**
 * Trunca el texto conservando inicio (60%) y final (35%) para capturar
 * tanto la cabecera del documento como el total/firma al final.
 */
function smartTruncate(text, maxChars = MAX_TEXT) {
  if (!text || text.length <= maxChars) return text || '';
  const head = text.slice(0, Math.floor(maxChars * 0.60));
  const tail = text.slice(-Math.floor(maxChars * 0.35));
  return `${head}\n\n[...documento truncado por longitud...]\n\n${tail}`;
}

// ══════════════════════════════════════════════════════════════════════════
//  HELPERS — Parseo robusto de JSON
// ══════════════════════════════════════════════════════════════════════════

/**
 * Elimina bloques <think>...</think> que generan algunos modelos (phi4, qwen3).
 * También elimina bloques ```json ``` de markdown.
 */
function stripThinking(text) {
  if (!text) return '';
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();
}

/**
 * Intenta reparar JSON truncado o con errores comunes:
 *  1. Comas finales antes de } o ]
 *  2. Claves sin comillas
 *  3. JSON truncado (intenta cerrarlo)
 */
function repairJSON(raw) {
  let s = raw.trim();

  // Eliminar comas antes de cierre de objeto/array
  s = s.replace(/,\s*([}\]])/g, '$1');

  // Claves sin comillas: { clave: → { "clave":
  s = s.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');

  // Si está truncado, intentar cerrarlo contando llaves/corchetes abiertos
  const opens  = (s.match(/\{/g) || []).length;
  const closes = (s.match(/\}/g) || []).length;
  const arrOpens  = (s.match(/\[/g) || []).length;
  const arrCloses = (s.match(/\]/g) || []).length;

  // Cerrar arrays pendientes
  const missingArr = arrOpens - arrCloses;
  if (missingArr > 0) s += ']'.repeat(missingArr);

  // Cerrar objetos pendientes
  const missingObj = opens - closes;
  if (missingObj > 0) s += '}'.repeat(missingObj);

  return s;
}

/**
 * Extrae el bloque JSON más grande de un string (entre el primer { y el último }).
 */
function extractLargestJSON(text) {
  const first = text.indexOf('{');
  const last  = text.lastIndexOf('}');
  if (first === -1 || last === -1 || last < first) return null;
  return text.slice(first, last + 1);
}

/**
 * Parseo robusto con múltiples estrategias de recuperación.
 * NUNCA devuelve null — en el peor caso devuelve un análisis mínimo.
 */
function parseAnalysisJSON(raw, fallbackHint = '') {
  if (!raw || typeof raw !== 'string') return buildFallback('respuesta vacía del modelo');

  const cleaned = stripThinking(raw);

  // Estrategia 1: parseo directo
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed === 'object') return parsed;
  } catch (_) {}

  // Estrategia 2: extraer el bloque {} más grande
  const block = extractLargestJSON(cleaned);
  if (block) {
    try {
      const parsed = JSON.parse(block);
      if (parsed && typeof parsed === 'object') {
        console.log('[ANALIZADOR] JSON extraído con bloque más grande');
        return parsed;
      }
    } catch (_) {}

    // Estrategia 3: reparar el bloque extraído
    try {
      const repaired = repairJSON(block);
      const parsed   = JSON.parse(repaired);
      if (parsed && typeof parsed === 'object') {
        console.log('[ANALIZADOR] JSON reparado con éxito');
        return parsed;
      }
    } catch (_) {}

    // Estrategia 4: reparar el cleaned completo
    try {
      const repaired = repairJSON(cleaned);
      const block2   = extractLargestJSON(repaired);
      if (block2) {
        const parsed = JSON.parse(block2);
        if (parsed && typeof parsed === 'object') {
          console.log('[ANALIZADOR] JSON recuperado tras doble reparación');
          return parsed;
        }
      }
    } catch (_) {}
  }

  // Sin recuperación posible
  console.warn('[ANALIZADOR] ⚠ No se pudo parsear JSON del LLM:', cleaned.slice(0, 200));
  return buildFallback(fallbackHint || 'fallo de parseo');
}

/**
 * Construye un análisis mínimo de emergencia cuando el LLM falla por completo.
 */
function buildFallback(motivo = '') {
  return {
    tipo:               'otro',
    subtipo:            null,
    urgencia:           'baja',
    emisor:             { nombre: null, cif_nif: null, direccion: null, email: null, telefono: null, rol: 'otro', tipo_entidad: 'empresa' },
    receptor:           { nombre: MI_EMPRESA.nombre, cif_nif: MI_EMPRESA.cif, direccion: null, email: MI_EMPRESA.email, telefono: null, rol: 'empresa', tipo_entidad: 'empresa' },
    trabajador:         null,
    importes:           { base_imponible: null, iva_porcentaje: null, iva_total: null, irpf: null, total: null, moneda: 'EUR' },
    conceptos:          [],
    fechas:             { documento: null, vencimiento: null, periodo_inicio: null, periodo_fin: null },
    referencias:        { numero_documento: null, numero_expediente: null, referencia_catastral: null, numero_poliza: null },
    forma_pago:         null,
    cuenta_bancaria:    null,
    resumen:            `Documento no analizado — ${motivo}`,
    tags:               ['sin-analizar', 'revisar'],
    accion_recomendada: 'revisar',
    confianza:          0.1,
    _parse_fallback:    true,
    _motivo_fallback:   motivo,
  };
}

// ══════════════════════════════════════════════════════════════════════════
//  HELPERS — Post-procesado y normalización
// ══════════════════════════════════════════════════════════════════════════

/**
 * Convierte fechas en varios formatos a YYYY-MM-DD.
 * Retorna null si no puede parsear.
 */
function normalizeDate(str) {
  if (!str || typeof str !== 'string') return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str.trim())) return str.trim();

  const patterns = [
    // DD/MM/YYYY o DD-MM-YYYY
    /^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/,
    // YYYY/MM/DD
    /^(\d{4})[\/\-\.](\d{2})[\/\-\.](\d{2})$/,
    // DD de Mes de YYYY (español)
    /^(\d{1,2})\s+de\s+(\w+)\s+(?:de\s+)?(\d{4})$/i,
  ];

  const meses = {
    enero:1,febrero:2,marzo:3,abril:4,mayo:5,junio:6,
    julio:7,agosto:8,septiembre:9,octubre:10,noviembre:11,diciembre:12,
    january:1,february:2,march:3,april:4,may:5,june:6,
    july:7,august:8,september:9,october:10,november:11,december:12,
  };

  for (const p of patterns) {
    const m = str.trim().match(p);
    if (m) {
      let d, mo, y;
      if (p === patterns[2]) {
        // "DD de Mes de YYYY"
        d  = parseInt(m[1]);
        mo = meses[m[2].toLowerCase()];
        y  = parseInt(m[3]);
      } else if (parseInt(m[1]) > 31) {
        // YYYY-MM-DD
        y = parseInt(m[1]); mo = parseInt(m[2]); d = parseInt(m[3]);
      } else {
        d = parseInt(m[1]); mo = parseInt(m[2]); y = parseInt(m[3]);
      }
      if (y && mo && d && mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
        return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      }
    }
  }
  return null;
}

/**
 * Limpia strings vacíos, "null", "N/A", etc. en objetos anidados.
 */
function deepClean(obj) {
  if (obj === null || obj === undefined) return null;
  if (typeof obj !== 'object') {
    if (typeof obj === 'string') {
      const s = obj.trim();
      if (s === '' || s === 'null' || s === 'undefined' || s === 'N/A'
          || s === '-' || s === 'n/a' || s === 'no disponible') return null;
    }
    return obj;
  }
  if (Array.isArray(obj)) return obj.map(deepClean).filter(v => v !== null);
  const result = {};
  for (const [k, v] of Object.entries(obj)) {
    result[k] = deepClean(v);
  }
  return result;
}

/**
 * Normaliza y valida el objeto de análisis devuelto por el LLM.
 * Aplica correcciones ligeras sin sobrescribir las decisiones del modelo.
 */
function normalizeAnalysis(raw) {
  const d = deepClean(raw) || {};

  // Tipo — asegurar que es válido
  if (!TIPOS_VALIDOS.includes(d.tipo)) {
    console.log(`[ANALIZADOR] Tipo desconocido: "${d.tipo}" → 'otro'`);
    d.tipo = 'otro';
  }

  // Urgencia — reglas forzadas para tipos críticos
  if (TIPOS_URGENTES.has(d.tipo)) {
    d.urgencia = 'alta';
  } else if (!['alta', 'media', 'baja'].includes(d.urgencia)) {
    d.urgencia = 'media';
  }

  // Acción recomendada — valores permitidos
  const ACCIONES_VALIDAS = ['archivar', 'pagar', 'revisar', 'urgente', 'contabilizar', 'responder', 'ignorar'];
  if (!ACCIONES_VALIDAS.includes(d.accion_recomendada)) {
    // Inferir si no es válido
    if (d.tipo === 'multa' || d.urgencia === 'alta') {
      d.accion_recomendada = 'urgente';
    } else if (['factura_recibida', 'recibo_autonomo', 'ticket'].includes(d.tipo)) {
      d.accion_recomendada = 'pagar';
    } else if (['nomina', 'finiquito'].includes(d.tipo)) {
      d.accion_recomendada = 'contabilizar';
    } else if (['spam', 'correo_comercial'].includes(d.tipo)) {
      d.accion_recomendada = 'ignorar';
    } else {
      d.accion_recomendada = 'archivar';
    }
  }

  // Confianza — forzar rango [0, 1]
  d.confianza = Math.min(1.0, Math.max(0.0, parseFloat(d.confianza) || 0.5));

  // Normalizar fechas
  if (d.fechas) {
    d.fechas.documento      = normalizeDate(d.fechas.documento)      || d.fechas.documento      || null;
    d.fechas.vencimiento    = normalizeDate(d.fechas.vencimiento)    || d.fechas.vencimiento    || null;
    d.fechas.periodo_inicio = normalizeDate(d.fechas.periodo_inicio) || d.fechas.periodo_inicio || null;
    d.fechas.periodo_fin    = normalizeDate(d.fechas.periodo_fin)    || d.fechas.periodo_fin    || null;
  } else {
    d.fechas = { documento: null, vencimiento: null, periodo_inicio: null, periodo_fin: null };
  }

  // Importes — convertir strings con coma decimal a float
  if (d.importes) {
    for (const key of ['base_imponible', 'iva_total', 'irpf', 'total']) {
      const v = d.importes[key];
      if (typeof v === 'string') {
        d.importes[key] = parseFloat(v.replace(',', '.')) || null;
      }
    }
    d.importes.moneda = d.importes.moneda || 'EUR';
  } else {
    d.importes = { base_imponible: null, iva_porcentaje: null, iva_total: null, irpf: null, total: null, moneda: 'EUR' };
  }

  // Conceptos — asegurar array y limpiar
  if (!Array.isArray(d.conceptos)) d.conceptos = [];
  d.conceptos = d.conceptos.map(c => ({
    descripcion:    c.descripcion    ?? null,
    cantidad:       parseFloat(c.cantidad)       || 1,
    precio_unitario:parseFloat(c.precio_unitario)|| null,
    iva_porcentaje: parseFloat(c.iva_porcentaje) || null,
    total:          parseFloat(c.total)          || null,
  })).filter(c => c.descripcion || c.total);

  // Si hay conceptos pero total es null, calcularlo
  if (d.conceptos.length > 0 && !d.importes.total) {
    const suma = d.conceptos.reduce((s, c) => s + (c.total || 0), 0);
    if (suma > 0) d.importes.total = Math.round(suma * 100) / 100;
  }

  // Referencias — asegurar objeto
  if (!d.referencias || typeof d.referencias !== 'object') {
    d.referencias = { numero_documento: null, numero_expediente: null, referencia_catastral: null, numero_poliza: null };
  }

  // Emisor / Receptor — asegurar estructura mínima
  const estructuraEntidad = { nombre: null, cif_nif: null, direccion: null, email: null, telefono: null, rol: 'otro', tipo_entidad: 'empresa' };
  d.emisor   = { ...estructuraEntidad, ...(d.emisor   || {}) };
  d.receptor = { ...estructuraEntidad, ...(d.receptor || {}) };

  // Receptor siempre debe ser Chicken Palace si no se detectó ninguno
  if (!d.receptor.nombre && !['nomina', 'finiquito', 'factura_emitida'].includes(d.tipo)) {
    d.receptor.nombre   = MI_EMPRESA.nombre;
    d.receptor.cif_nif  = MI_EMPRESA.cif;
    d.receptor.email    = MI_EMPRESA.email;
    d.receptor.rol      = 'empresa';
    d.receptor.tipo_entidad = 'empresa';
  }

  // Trabajador — null si no es nómina/finiquito
  if (!['nomina', 'finiquito'].includes(d.tipo) && !d.trabajador?.nombre_completo) {
    d.trabajador = null;
  } else if (d.trabajador) {
    const esTrabajadorVacio = !Object.values(d.trabajador).some(v => v !== null && v !== undefined);
    if (esTrabajadorVacio) d.trabajador = null;
  }

  // Tags — asegurar array mínimo
  if (!Array.isArray(d.tags)) d.tags = [];
  // Añadir tags automáticos básicos si hay datos
  const autoTags = new Set(d.tags.map(t => String(t).toLowerCase().trim()));
  autoTags.add(d.tipo.replace('_', '-'));
  if (d.emisor?.nombre) autoTags.add(d.emisor.nombre.split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, ''));
  if (d.fechas?.documento) autoTags.add(d.fechas.documento.slice(0, 4));    // año
  if (d.urgencia === 'alta') autoTags.add('urgente');
  d.tags = [...autoTags].filter(t => t && t.length > 1).slice(0, 10);

  // Resumen — generar si está vacío
  if (!d.resumen) {
    const partes = [d.tipo];
    if (d.emisor?.nombre)        partes.push(`de ${d.emisor.nombre}`);
    if (d.importes?.total)       partes.push(`por ${d.importes.total}€`);
    if (d.fechas?.documento)     partes.push(`(${d.fechas.documento})`);
    d.resumen = partes.join(' ');
  }

  return d;
}

// ══════════════════════════════════════════════════════════════════════════
//  LLM CALLS — Texto y Visión
// ══════════════════════════════════════════════════════════════════════════

/**
 * Llamada estándar al endpoint OpenAI-compatible de Ollama.
 * Soporta AbortSignal con timeout de 180 segundos.
 */
async function llmCall(messages) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    // Usar API nativa de Ollama (/api/chat) que soporta format:"json" correctamente
    const response = await fetch(`${OLLAMA_URL}/api/chat`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      signal:  controller.signal,
      body: JSON.stringify({
        model:   MODEL,
        messages,
        stream:  false,
        think:   false,  // Desactivar thinking — qwen3.5 mete el JSON en thinking y deja content vacío
        options: {
          temperature:  TEMPERATURE,
          num_predict:  MAX_TOKENS,
        },
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Ollama ${response.status}: ${body.slice(0, 300)}`);
    }

    const data    = await response.json();
    // API nativa devuelve { message: { content: '...', thinking: '...' } }
    const rawContent = data?.message?.content || '';
    const thinking   = data?.message?.thinking || '';
    console.log(`[ANALIZADOR] Raw response — content: ${rawContent.length} chars, thinking: ${thinking.length} chars`);
    if (!rawContent && thinking) {
      console.log(`[ANALIZADOR] ⚠ Content vacío pero hay thinking (${thinking.length} chars). Intentando extraer JSON del thinking...`);
      // Si el content está vacío pero el thinking contiene JSON, intentar extraerlo
      const jsonMatch = thinking.match(/\{[\s\S]*\}/);  
      if (jsonMatch) return stripThinking(jsonMatch[0].trim());
    }
    if (!rawContent) {
      console.warn(`[ANALIZADOR] ⚠ Respuesta completamente vacía del modelo. Keys: ${Object.keys(data?.message || {}).join(', ')}`);
    }
    return stripThinking(rawContent.trim());

  } finally {
    clearTimeout(timer);
  }
}

/**
 * Llamada con imagen (modelos VL) — envía la imagen como image_url en el contenido.
 */
async function llmCallVision(imageBase64, mimeType) {
  // Usar API nativa de Ollama con campo "images" para visión
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role:    'user',
      content: 'Analiza este documento y devuelve el JSON solicitado:',
      images:  [imageBase64],
    },
  ];

  return llmCall(messages);
}

// ══════════════════════════════════════════════════════════════════════════
//  FUNCIÓN PRINCIPAL — analyze(extractedData)
// ══════════════════════════════════════════════════════════════════════════

/**
 * Analiza texto extraído por el Agente Extractor y devuelve análisis estructurado.
 *
 * @param {Object} extractedData
 * @param {string}  extractedData.text         - Texto extraído del documento
 * @param {string}  extractedData.method       - Método de extracción usado (pdf-text, tesseract, vision-vl...)
 * @param {Object}  [extractedData.metadata]   - Metadatos opcionales del documento
 * @param {string}  [extractedData.originalName] - Nombre original del archivo
 * @param {string}  [extractedData.mimeType]   - MIME type del archivo
 * @param {string}  [extractedData.imageBase64]- Base64 de imagen (solo para modelos VL)
 * @param {string}  [extractedData.imageMime]  - MIME type de la imagen para VL
 *
 * @returns {Promise<Object>} {
 *   analysis:           Object  - Datos estructurados del documento
 *   raw_response:       string  - Respuesta cruda del LLM
 *   model_used:         string  - Nombre del modelo
 *   processing_time_ms: number  - Tiempo de procesamiento
 *   ok:                 boolean - true si se analizó correctamente
 *   error?:             string  - Mensaje de error si ok=false
 * }
 */
export async function analyze(extractedData) {
  const start = Date.now();
  const { text = '', method = '', metadata = {}, originalName = '', mimeType = '', imageBase64, imageMime } = extractedData;

  console.log(`[ANALIZADOR] Iniciando análisis — archivo: "${originalName}" | método: ${method} | modelo: ${MODEL}`);

  // ── Validar que hay algo que analizar ───────────────────────────────────
  const esVision = method === 'vision-vl' && IS_VL_MODEL && imageBase64;
  if (!text && !esVision) {
    const msg = 'No hay texto ni imagen para analizar';
    console.warn(`[ANALIZADOR] ⚠ ${msg}`);
    return {
      analysis:           normalizeAnalysis(buildFallback(msg)),
      raw_response:       '',
      model_used:         MODEL,
      processing_time_ms: Date.now() - start,
      ok:                 false,
      error:              msg,
    };
  }

  let rawResponse = '';

  try {
    // ── Construir llamada según tipo de entrada ────────────────────────
    if (esVision) {
      // Modo visión — modelo VL con imagen adjunta
      console.log(`[ANALIZADOR] Modo VISIÓN — enviando imagen al modelo VL`);
      rawResponse = await llmCallVision(imageBase64, imageMime || 'image/jpeg');
    } else {
      // Modo texto — truncar y enviar como mensaje
      const textoTruncado = smartTruncate(text, MAX_TEXT);
      const contextoPrevio = buildDocumentContext(originalName, mimeType, metadata);

      const messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `${contextoPrevio}DOCUMENTO:\n${textoTruncado}\n\nIMPORTANTE: Responde ÚNICAMENTE con el JSON especificado. NO escribas explicaciones, NO uses markdown. Tu respuesta debe empezar con { y terminar con }.`,
        },
      ];

      rawResponse = await llmCall(messages);
    }

    console.log(`[ANALIZADOR] Respuesta LLM recibida (${rawResponse.length} chars) — parseando...`);

    // ── Parsear y normalizar ───────────────────────────────────────────
    const parsed     = parseAnalysisJSON(rawResponse, `archivo: ${originalName}`);
    const normalized = normalizeAnalysis(parsed);
    const elapsed    = Date.now() - start;

    console.log(`[ANALIZADOR] ✓ Análisis completado — tipo: "${normalized.tipo}" | urgencia: ${normalized.urgencia} | confianza: ${normalized.confianza} | tiempo: ${elapsed}ms`);

    return {
      analysis:           normalized,
      raw_response:       rawResponse,
      model_used:         MODEL,
      processing_time_ms: elapsed,
      ok:                 true,
    };

  } catch (err) {
    const elapsed = Date.now() - start;

    // Distinguir timeout de otros errores
    const esTimeout = err.name === 'AbortError' || err.message?.includes('aborted');
    const msgError  = esTimeout
      ? `Timeout tras ${TIMEOUT_MS / 1000}s — el modelo tardó demasiado`
      : `Error LLM: ${err.message}`;

    console.error(`[ANALIZADOR] ✗ ${msgError}`);

    return {
      analysis:           normalizeAnalysis(buildFallback(msgError)),
      raw_response:       rawResponse || '',
      model_used:         MODEL,
      processing_time_ms: elapsed,
      ok:                 false,
      error:              msgError,
    };
  }
}

// ══════════════════════════════════════════════════════════════════════════
//  HELPERS — Contexto adicional para el prompt
// ══════════════════════════════════════════════════════════════════════════

/**
 * Genera un bloque de contexto previo con metadatos del archivo
 * para ayudar al modelo (nombre del archivo suele ser muy indicativo).
 */
function buildDocumentContext(originalName, mimeType, metadata) {
  const parts = [];

  if (originalName) {
    parts.push(`Nombre del archivo: ${originalName}`);
  }
  if (mimeType) {
    parts.push(`Tipo MIME: ${mimeType}`);
  }
  if (metadata?.pages) {
    parts.push(`Páginas del PDF: ${metadata.pages}`);
  }
  if (metadata?.size) {
    parts.push(`Tamaño: ${Math.round(metadata.size / 1024)}KB`);
  }

  return parts.length > 0 ? `METADATOS DEL ARCHIVO:\n${parts.join('\n')}\n\n` : '';
}

// ══════════════════════════════════════════════════════════════════════════
//  EXPORTACIONES ADICIONALES — Utilidades internas accesibles externamente
// ══════════════════════════════════════════════════════════════════════════

/**
 * Devuelve la configuración actual del agente (útil para diagnósticos).
 */
export function getConfig() {
  return {
    ollamaUrl:   OLLAMA_URL,
    model:       MODEL,
    isVlModel:   IS_VL_MODEL,
    timeoutMs:   TIMEOUT_MS,
    maxTokens:   MAX_TOKENS,
    temperature: TEMPERATURE,
    maxTextChars:MAX_TEXT,
    empresa:     MI_EMPRESA,
  };
}

/**
 * Análisis por lotes — procesa un array de documentos con control de concurrencia.
 *
 * @param {Array}   items           - Array de extractedData
 * @param {number}  [concurrency=1] - Máximo de análisis en paralelo (defecto 1, LLM local)
 * @returns {Promise<Array>}        - Array de resultados en el mismo orden
 */
export async function analyzeBatch(items, concurrency = 1) {
  if (!Array.isArray(items) || items.length === 0) return [];

  console.log(`[ANALIZADOR] Lote de ${items.length} documentos (concurrencia: ${concurrency})`);

  const results = new Array(items.length);
  const queue   = items.map((item, idx) => ({ item, idx }));

  async function worker() {
    while (queue.length > 0) {
      const { item, idx } = queue.shift();
      results[idx] = await analyze(item);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);

  const ok  = results.filter(r => r.ok).length;
  const err = results.filter(r => !r.ok).length;
  console.log(`[ANALIZADOR] Lote completado — ${ok} OK, ${err} errores`);

  return results;
}

/**
 * Verificar que Ollama está disponible y el modelo cargado.
 * Útil para health-checks del servidor.
 *
 * @returns {Promise<{available: boolean, model: string, error?: string}>}
 */
export async function checkHealth() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);

    const res = await fetch(`${OLLAMA_URL}/api/tags`, {
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data   = await res.json();
    const models = (data?.models || []).map(m => m.name || m.model || '');
    const found  = models.some(m => m.includes(MODEL.split(':')[0]));

    console.log(`[ANALIZADOR] Health: Ollama OK | modelo "${MODEL}" ${found ? 'encontrado' : 'NO encontrado'}`);

    return {
      available:     true,
      model:         MODEL,
      model_loaded:  found,
      models_available: models,
    };
  } catch (err) {
    console.warn(`[ANALIZADOR] Health: Ollama NO disponible — ${err.message}`);
    return {
      available: false,
      model:     MODEL,
      error:     err.message,
    };
  }
}
