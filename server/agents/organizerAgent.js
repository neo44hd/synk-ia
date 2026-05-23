// ═══════════════════════════════════════════════════════════════════════════
//  AGENTE ORGANIZADOR — Clasificación inteligente y archivo de documentos
//
//  Recibe el análisis del Agente Analizador y decide:
//    · En qué carpeta virtual archivar el documento
//    · Qué nombre normalizado asignar
//    · Qué tags aplicar
//    · Si hay que crear/actualizar entidades (proveedor, trabajador, etc.)
//    · Qué acción pendiente marcar
//
//  ═══════════════════════════════════════════════════════════════════════════
//  REGLA FUNDAMENTAL DE IDENTIDAD:
//
//  Propietario: CHICKEN PALACE IBIZA, S.L. (CIF B56908486)
//  Tú (David) eres el dueño. Tu empresa es el DESTINATARIO de todo.
//  TODO documento que entra es algo que RECIBES: facturas de proveedores,
//  nóminas que PAGAS, multas que te LLEGAN, correos que te ENVÍAN.
//
//  NUNCA eres el emisor. NUNCA eres el proveedor. NUNCA eres quien vende.
//  Si aparece "CHICKEN PALACE" en un documento, es porque eres el CLIENTE
//  que recibe ese producto/servicio/documento.
//
//  El EMISOR siempre es la OTRA entidad: el proveedor, Hacienda, el banco,
//  la compañía de seguros, el ayuntamiento, etc.
//  ═══════════════════════════════════════════════════════════════════════════
//
//  API:
//    import { organize } from './organizerAgent.js';
//    const result = await organize(analysis, extractedData, originalName);
// ═══════════════════════════════════════════════════════════════════════════

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ── Config ──────────────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process?.env?.DATA_DIR || path.join(__dirname, '..', '..', 'data');
const ENTITIES_FILE = path.join(DATA_DIR, 'entities.json');
const RULES_FILE = path.join(DATA_DIR, 'organizer_rules.json');

// ── Identidad del negocio ───────────────────────────────────────────────────
const MI_EMPRESA = {
  nombre: process?.env?.EMPRESA_NOMBRE || 'CHICKEN PALACE IBIZA, S.L.',
  cif:    process?.env?.EMPRESA_CIF    || 'B56908486',
  email:  process?.env?.EMAIL_USER     || 'info@chickenpalace.es',
  aliases: [
    'chicken palace', 'chicken palace ibiza', 'chickenpalace',
    'chicken palace ibiza s.l.', 'chicken palace ibiza sl',
    'b56908486',
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
//  ÁRBOL DE CARPETAS — Estructura predefinida para negocio de restauración
// ═══════════════════════════════════════════════════════════════════════════

const FOLDER_TREE = {
  // ── GASTOS / PROVEEDORES ──────────────────────────────────────────────
  factura_recibida: {
    base:     'gastos/facturas',
    subfolders: {
      alimentacion:   'gastos/facturas/alimentacion',
      bebidas:        'gastos/facturas/bebidas',
      limpieza:       'gastos/facturas/limpieza',
      suministros:    'gastos/facturas/suministros',    // luz, agua, gas
      telefonia:      'gastos/facturas/telefonia',
      delivery:       'gastos/facturas/delivery',       // Glovo, Uber Eats
      mantenimiento:  'gastos/facturas/mantenimiento',
      asesoria:       'gastos/facturas/asesoria',
      seguros:        'gastos/facturas/seguros',
      alquiler:       'gastos/facturas/alquiler',
      publicidad:     'gastos/facturas/publicidad',
      equipamiento:   'gastos/facturas/equipamiento',
      envases:        'gastos/facturas/envases',
      uniformes:      'gastos/facturas/uniformes',
      tecnologia:     'gastos/facturas/tecnologia',
      vehiculos:      'gastos/facturas/vehiculos',
      otros:          'gastos/facturas/otros',
    },
  },
  albaran:            { base: 'gastos/albaranes' },
  ticket:             { base: 'gastos/tickets' },
  recibo_autonomo:    { base: 'gastos/autonomo' },

  // ── LABORAL ───────────────────────────────────────────────────────────
  nomina:             { base: 'laboral/nominas' },
  finiquito:          { base: 'laboral/finiquitos' },
  contrato:           { base: 'laboral/contratos' },

  // ── FISCAL / HACIENDA ─────────────────────────────────────────────────
  notificacion_hacienda: { base: 'fiscal/hacienda' },
  certificado:        { base: 'fiscal/certificados' },

  // ── MULTAS / SANCIONES ────────────────────────────────────────────────
  multa:              { base: 'legal/multas' },
  acta:               { base: 'legal/actas' },
  sentencia:          { base: 'legal/sentencias' },
  carta_oficial:      { base: 'legal/correspondencia' },

  // ── BANCA / FINANZAS ──────────────────────────────────────────────────
  extracto_bancario:  { base: 'banca/extractos' },
  seguro:             { base: 'banca/seguros' },
  poliza:             { base: 'banca/polizas' },
  presupuesto:        { base: 'presupuestos' },

  // ── VENTAS (factura_emitida) ──────────────────────────────────────────
  factura_emitida:    { base: 'ventas/facturas' },

  // ── CORREO ────────────────────────────────────────────────────────────
  correo_comercial:   { base: 'correo/comercial' },
  correo_personal:    { base: 'correo/personal' },
  spam:               { base: 'correo/spam' },

  // ── OTROS ─────────────────────────────────────────────────────────────
  otro:               { base: 'otros' },
};

// ═══════════════════════════════════════════════════════════════════════════
//  REGLAS DE SUBCATEGORIZACIÓN DE FACTURAS
//  Basadas en palabras clave del nombre del proveedor o conceptos
// ═══════════════════════════════════════════════════════════════════════════

const SUBCATEGORY_RULES = [
  // Alimentación y materias primas
  {
    subfolder: 'alimentacion',
    keywords: [
      'carne', 'pollo', 'cerdo', 'ternera', 'vacuno', 'cordero',
      'pescado', 'marisco', 'congelado', 'frigorifico', 'frigorific',
      'verdura', 'fruta', 'hortaliza', 'lacteo', 'queso', 'huevo',
      'pan', 'panaderia', 'pasteleria', 'harina', 'aceite', 'arroz',
      'alimentacion', 'aliment', 'food', 'distribuciones', 'cash',
      'makro', 'metro', 'gros mercat', 'mercadona', 'fripozo',
      'campofrio', 'grupo siro', 'calvo', 'pescanova', 'findus',
      'carnica', 'charcuteria', 'embutido', 'jamon',
    ],
  },
  // Bebidas
  {
    subfolder: 'bebidas',
    keywords: [
      'coca-cola', 'coca cola', 'cocacola', 'pepsi', 'cerveza', 'beer',
      'agua', 'refresco', 'bebida', 'vino', 'licor', 'destilado',
      'damm', 'mahou', 'heineken', 'san miguel', 'estrella',
      'schweppes', 'fanta', 'sprite', 'red bull', 'monster',
      'bodega', 'distribuidora de bebidas', 'font vella', 'bezoya',
    ],
  },
  // Limpieza
  {
    subfolder: 'limpieza',
    keywords: [
      'limpieza', 'limpie', 'higiene', 'desinfec', 'detergent',
      'quimi', 'chemical', 'plagas', 'fumiga', 'ddd',
      'papel', 'servilleta', 'bayeta', 'fregona', 'escoba',
    ],
  },
  // Suministros (luz, agua, gas)
  {
    subfolder: 'suministros',
    keywords: [
      'endesa', 'iberdrola', 'naturgy', 'gas natural', 'repsol butano',
      'cepsa', 'galp', 'total energies', 'energia', 'electric',
      'emaya', 'aqualia', 'agua', 'canal', 'abaqua',
      'luz', 'electr', 'gas', 'gasoil', 'combustible', 'carburante',
    ],
  },
  // Telefonía e internet
  {
    subfolder: 'telefonia',
    keywords: [
      'movistar', 'telefonica', 'vodafone', 'orange', 'mas movil',
      'masmovil', 'yoigo', 'pepephone', 'digi', 'finetwork',
      'telefon', 'internet', 'fibra', 'movil', 'datos',
    ],
  },
  // Delivery
  {
    subfolder: 'delivery',
    keywords: [
      'glovo', 'uber eat', 'ubereats', 'just eat', 'justeat',
      'deliveroo', 'stuart', 'delivery', 'pedidos ya', 'pidoya',
    ],
  },
  // Mantenimiento
  {
    subfolder: 'mantenimiento',
    keywords: [
      'mantenim', 'reparacion', 'fontaner', 'electricist',
      'clima', 'aire acondicionado', 'frigori', 'horno',
      'cocina industrial', 'extractor', 'campana', 'caldera',
    ],
  },
  // Asesoría / Gestoría
  {
    subfolder: 'asesoria',
    keywords: [
      'asesor', 'gestor', 'consultor', 'abogad', 'notari',
      'procurad', 'auditor', 'contab', 'fiscal', 'laboral',
      'legal', 'juridic',
    ],
  },
  // Seguros
  {
    subfolder: 'seguros',
    keywords: [
      'seguro', 'poliza', 'asegura', 'mutua', 'zurich', 'mapfre',
      'axa', 'allianz', 'generali', 'liberty', 'pelayo',
      'sanitas', 'dkv', 'asisa', 'cigna',
    ],
  },
  // Alquiler
  {
    subfolder: 'alquiler',
    keywords: [
      'alquiler', 'renta', 'arrendamiento', 'mensualidad local',
      'inmobiliaria', 'finca',
    ],
  },
  // Publicidad
  {
    subfolder: 'publicidad',
    keywords: [
      'publicidad', 'marketing', 'google ads', 'facebook', 'meta',
      'instagram', 'tiktok', 'imprenta', 'rotulo', 'cartel',
      'flyer', 'web', 'seo', 'diseño', 'fotograf',
    ],
  },
  // Equipamiento
  {
    subfolder: 'equipamiento',
    keywords: [
      'equipamiento', 'maquinaria', 'mobiliario', 'silla', 'mesa',
      'vitrina', 'mostrador', 'nevera', 'congelador', 'freidora',
      'plancha', 'horno', 'batidora', 'robot cocina',
    ],
  },
  // Envases y packaging
  {
    subfolder: 'envases',
    keywords: [
      'envase', 'embalaje', 'packaging', 'caja', 'bolsa',
      'bandeja', 'film', 'aluminio', 'tupper', 'recipiente',
      'vaso', 'cubierto desechable', 'servilleta',
    ],
  },
  // Uniformes y ropa laboral
  {
    subfolder: 'uniformes',
    keywords: [
      'uniforme', 'ropa laboral', 'textil', 'bordado', 'vestuario',
      'calzado laboral', 'epi', 'proteccion',
    ],
  },
  // Tecnología
  {
    subfolder: 'tecnologia',
    keywords: [
      'software', 'licencia', 'tpv', 'terminal punto', 'pos',
      'ordenador', 'portatil', 'tablet', 'impresora', 'router',
      'apple', 'microsoft', 'amazon web', 'cloud', 'hosting',
      'dominio', 'revo', 'synk', 'app', 'informatica',
    ],
  },
  // Vehículos
  {
    subfolder: 'vehiculos',
    keywords: [
      'vehiculo', 'coche', 'moto', 'furgoneta', 'gasolina',
      'diesel', 'parking', 'itv', 'taller', 'neumatico',
      'automocion', 'renting', 'leasing vehic',
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
//  HELPERS — Persistencia JSON
// ═══════════════════════════════════════════════════════════════════════════

async function loadJSON(file, fallback) {
  try {
    if (!existsSync(file)) return fallback;
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

async function saveJSON(file, data) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(data, null, 2), 'utf8');
}

// ═══════════════════════════════════════════════════════════════════════════
//  HELPERS — Normalización de texto
// ═══════════════════════════════════════════════════════════════════════════

function norm(s) {
  return (s || '').toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,\-_()]/g, ' ')
    .replace(/\s+/g, ' ');
}

function sameEntity(a, b) {
  if (!a || !b) return false;
  // Por CIF/NIF
  if (a.cif_nif && b.cif_nif) {
    const ca = (a.cif_nif || '').replace(/[\s\-]/g, '').toUpperCase();
    const cb = (b.cif_nif || '').replace(/[\s\-]/g, '').toUpperCase();
    if (ca && cb && ca === cb) return true;
  }
  // Por DNI (trabajadores)
  if (a.dni && b.dni) {
    const da = (a.dni || '').replace(/[\s\-]/g, '').toUpperCase();
    const db = (b.dni || '').replace(/[\s\-]/g, '').toUpperCase();
    if (da && db && da === db) return true;
  }
  // Por NSS (trabajadores)
  if (a.nss && b.nss) {
    const na = (a.nss || '').replace(/[\s\-\/]/g, '');
    const nb = (b.nss || '').replace(/[\s\-\/]/g, '');
    if (na && nb && na === nb) return true;
  }
  // Por nombre
  const na = norm(a.nombre || a.nombre_completo || '');
  const nb = norm(b.nombre || b.nombre_completo || '');
  if (na.length > 4 && nb.length > 4) {
    if (na === nb) return true;
    if (na.length > 8 && nb.includes(na.slice(0, 8))) return true;
    if (nb.length > 8 && na.includes(nb.slice(0, 8))) return true;
  }
  return false;
}

/** Comprueba si una entidad es MI empresa (para no crear duplicados) */
function esMiEmpresa(entity) {
  if (!entity) return false;
  const nombre = norm(entity.nombre || entity.nombre_completo || '');
  const cif = (entity.cif_nif || '').replace(/[\s\-]/g, '').toUpperCase();

  // Por CIF
  if (cif === MI_EMPRESA.cif) return true;

  // Por alias
  return MI_EMPRESA.aliases.some(alias => nombre.includes(alias));
}

// ═══════════════════════════════════════════════════════════════════════════
//  CLASIFICADOR DE SUBCARPETAS PARA FACTURAS
// ═══════════════════════════════════════════════════════════════════════════

function classifyInvoiceSubfolder(analysis) {
  const emisorNombre = norm(analysis.emisor?.nombre || '');
  const conceptos = (analysis.conceptos || [])
    .map(c => norm(c.descripcion || '')).join(' ');
  const resumen = norm(analysis.resumen || '');
  const subtipo = norm(analysis.subtipo || '');
  const tags = (analysis.tags || []).map(t => norm(t)).join(' ');

  const searchText = `${emisorNombre} ${conceptos} ${resumen} ${subtipo} ${tags}`;

  for (const rule of SUBCATEGORY_RULES) {
    for (const kw of rule.keywords) {
      if (searchText.includes(kw)) {
        return rule.subfolder;
      }
    }
  }

  return 'otros';
}

// ═══════════════════════════════════════════════════════════════════════════
//  GENERADOR DE NOMBRE NORMALIZADO
// ═══════════════════════════════════════════════════════════════════════════

function generateNormalizedName(analysis, originalName) {
  const ext = path.extname(originalName || '').toLowerCase() || '.pdf';
  const fecha = analysis.fechas?.documento || analysis.fecha || new Date().toISOString().slice(0, 10);
  const tipo = (analysis.tipo || 'doc').replace(/_/g, '-');

  let emisor = '';
  if (analysis.emisor?.nombre && !esMiEmpresa(analysis.emisor)) {
    emisor = norm(analysis.emisor.nombre)
      .replace(/[^a-z0-9 ]/g, '')
      .trim()
      .split(' ')
      .slice(0, 3)
      .join('-');
  }

  // Para nóminas, usar nombre del trabajador
  if (['nomina', 'finiquito'].includes(analysis.tipo)) {
    const trabajador = analysis.trabajador?.nombre_completo || analysis.receptor?.nombre || '';
    if (trabajador) {
      emisor = norm(trabajador).replace(/[^a-z0-9 ]/g, '').trim().split(' ').slice(0, 2).join('-');
    }
  }

  const numero = analysis.referencias?.numero_documento
    || analysis.numero_documento
    || '';
  const numPart = numero ? `_${numero.replace(/[^a-zA-Z0-9]/g, '')}` : '';
  const total = analysis.importes?.total || analysis.total || '';
  const totalPart = total ? `_${total}eur` : '';

  const parts = [fecha, tipo];
  if (emisor) parts.push(emisor);
  const name = parts.join('_') + numPart + totalPart + ext;

  return name.replace(/_{2,}/g, '_').replace(/[^a-z0-9._\-]/g, '');
}

// ═══════════════════════════════════════════════════════════════════════════
//  RESOLUCIÓN DE ENTIDADES — Crear/actualizar proveedor, trabajador, etc.
// ═══════════════════════════════════════════════════════════════════════════

async function resolveEntities(analysis) {
  const ents = await loadJSON(ENTITIES_FILE, {
    clientes: [],
    proveedores: [],
    trabajadores: [],
  });
  if (!ents.trabajadores) ents.trabajadores = [];
  if (!ents.proveedores)  ents.proveedores = [];
  if (!ents.clientes)     ents.clientes = [];

  const created = [];
  const updated = [];
  const result = {};

  const tipo = (analysis.tipo || '').toLowerCase();
  const emisorRol = (analysis.emisor?.rol || '').toLowerCase();
  const receptorRol = (analysis.receptor?.rol || '').toLowerCase();

  // ── PROVEEDOR ───────────────────────────────────────────────────────────
  // El emisor de una factura recibida/albaran/ticket es SIEMPRE un proveedor
  // NUNCA crear un proveedor con datos de MI empresa
  const esDocProveedor = ['factura_recibida', 'albaran', 'ticket', 'recibo_autonomo'].includes(tipo)
    || emisorRol === 'proveedor';

  if (esDocProveedor && analysis.emisor?.nombre && !esMiEmpresa(analysis.emisor)) {
    let prov = ents.proveedores.find(p => sameEntity(p, analysis.emisor));

    if (prov) {
      // Actualizar datos que falten
      let changed = false;
      if (analysis.emisor.email && !prov.email) { prov.email = analysis.emisor.email; changed = true; }
      if (analysis.emisor.cif_nif && !prov.cif_nif) { prov.cif_nif = analysis.emisor.cif_nif; changed = true; }
      if (analysis.emisor.telefono && !prov.telefono) { prov.telefono = analysis.emisor.telefono; changed = true; }
      if (analysis.emisor.direccion && !prov.direccion) { prov.direccion = analysis.emisor.direccion; changed = true; }
      prov.facturas = (prov.facturas || 0) + 1;
      prov.ultima_factura = analysis.fechas?.documento || new Date().toISOString().slice(0, 10);
      if (analysis.importes?.total) {
        prov.total_acumulado = Math.round(((prov.total_acumulado || 0) + analysis.importes.total) * 100) / 100;
      }
      result.proveedor_id = prov.id;
      result.proveedor_nuevo = false;
      if (changed) updated.push({ tipo: 'proveedor', nombre: prov.nombre, id: prov.id });
    } else {
      prov = {
        id:              `prov_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        nombre:          analysis.emisor.nombre,
        cif_nif:         analysis.emisor.cif_nif || null,
        direccion:       analysis.emisor.direccion || null,
        email:           analysis.emisor.email || null,
        telefono:        analysis.emisor.telefono || null,
        tipo_entidad:    analysis.emisor.tipo_entidad || 'empresa',
        facturas:        1,
        total_acumulado: analysis.importes?.total || 0,
        ultima_factura:  analysis.fechas?.documento || new Date().toISOString().slice(0, 10),
        creado:          new Date().toISOString(),
      };
      ents.proveedores.push(prov);
      result.proveedor_id = prov.id;
      result.proveedor_nuevo = true;
      created.push({ tipo: 'proveedor', nombre: prov.nombre, id: prov.id });
      console.log(`[ORGANIZADOR] + Proveedor: ${prov.nombre} (${prov.cif_nif || 'sin CIF'})`);
    }
  }

  // ── TRABAJADOR ──────────────────────────────────────────────────────────
  const esNomina = ['nomina', 'finiquito'].includes(tipo);
  if (esNomina) {
    const tData = analysis.trabajador || {};
    const nombre = tData.nombre_completo || analysis.receptor?.nombre;
    const dni = tData.dni || analysis.receptor?.cif_nif;
    const nss = tData.nss || null;

    if (nombre && !esMiEmpresa({ nombre })) {
      const searchObj = { nombre, nombre_completo: nombre, cif_nif: dni, dni, nss };
      let trab = ents.trabajadores.find(t => sameEntity(t, searchObj));

      if (trab) {
        let changed = false;
        if (dni && !trab.dni) { trab.dni = dni; changed = true; }
        if (nss && !trab.nss) { trab.nss = nss; changed = true; }
        if (tData.categoria_profesional && !trab.categoria_profesional) { trab.categoria_profesional = tData.categoria_profesional; changed = true; }
        if (tData.antiguedad && !trab.fecha_alta) { trab.fecha_alta = tData.antiguedad; changed = true; }
        if (tData.tipo_contrato && !trab.tipo_contrato) { trab.tipo_contrato = tData.tipo_contrato; changed = true; }
        if (tData.grupo_cotizacion && !trab.grupo_cotizacion) { trab.grupo_cotizacion = tData.grupo_cotizacion; changed = true; }
        if (tData.puesto && !trab.puesto) { trab.puesto = tData.puesto; changed = true; }
        if (analysis.importes?.base_imponible) trab.ultimo_salario_bruto = analysis.importes.base_imponible;
        if (analysis.importes?.total) trab.ultimo_salario_neto = analysis.importes.total;
        trab.nominas = (trab.nominas || 0) + 1;
        trab.ultima_nomina = analysis.fechas?.documento || new Date().toISOString().slice(0, 10);

        // Finiquito → marcar como inactivo
        if (tipo === 'finiquito') {
          trab.activo = false;
          trab.fecha_baja = analysis.fechas?.documento || new Date().toISOString().slice(0, 10);
        }

        result.trabajador_id = trab.id;
        result.trabajador_nuevo = false;
        if (changed) updated.push({ tipo: 'trabajador', nombre: trab.nombre_completo, id: trab.id });
      } else {
        const partes = nombre.trim().split(/\s+/);
        trab = {
          id:                    `trab_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          nombre:                partes[0] || 'Sin nombre',
          apellidos:             partes.slice(1).join(' '),
          nombre_completo:       nombre,
          dni,
          nss,
          categoria_profesional: tData.categoria_profesional || null,
          grupo_cotizacion:      tData.grupo_cotizacion || null,
          fecha_alta:            tData.antiguedad || null,
          tipo_contrato:         tData.tipo_contrato || null,
          puesto:                tData.puesto || null,
          ultimo_salario_bruto:  analysis.importes?.base_imponible || null,
          ultimo_salario_neto:   analysis.importes?.total || null,
          activo:                tipo !== 'finiquito',
          nominas:               1,
          ultima_nomina:         analysis.fechas?.documento || new Date().toISOString().slice(0, 10),
          creado:                new Date().toISOString(),
        };
        ents.trabajadores.push(trab);
        result.trabajador_id = trab.id;
        result.trabajador_nuevo = true;
        created.push({ tipo: 'trabajador', nombre: trab.nombre_completo, id: trab.id });
        console.log(`[ORGANIZADOR] + Trabajador: ${trab.nombre_completo} (DNI: ${dni || 'n/a'})`);
      }
    }
  }

  // ── CLIENTE (para facturas emitidas) ────────────────────────────────────
  if (tipo === 'factura_emitida' && analysis.receptor?.nombre && !esMiEmpresa(analysis.receptor)) {
    let cli = ents.clientes.find(c => sameEntity(c, analysis.receptor));
    if (cli) {
      if (analysis.receptor.email && !cli.email) cli.email = analysis.receptor.email;
      cli.facturas = (cli.facturas || 0) + 1;
      result.cliente_id = cli.id;
      result.cliente_nuevo = false;
    } else {
      cli = {
        id:       `cli_${Date.now()}`,
        nombre:   analysis.receptor.nombre,
        cif_nif:  analysis.receptor.cif_nif || null,
        email:    analysis.receptor.email || null,
        facturas: 1,
        creado:   new Date().toISOString(),
      };
      ents.clientes.push(cli);
      result.cliente_id = cli.id;
      result.cliente_nuevo = true;
      created.push({ tipo: 'cliente', nombre: cli.nombre, id: cli.id });
    }
  }

  await saveJSON(ENTITIES_FILE, ents);

  return { ...result, entities_created: created, entities_updated: updated };
}

// ═══════════════════════════════════════════════════════════════════════════
//  ACCIONES PENDIENTES — Determinar qué hacer con el documento
// ═══════════════════════════════════════════════════════════════════════════

function determinePendingActions(analysis) {
  const actions = [];
  const tipo = (analysis.tipo || '').toLowerCase();
  const urgencia = analysis.urgencia || 'media';
  const accion = analysis.accion_recomendada || 'archivar';

  // Multas y notificaciones de Hacienda → urgente
  if (['multa', 'notificacion_hacienda', 'sentencia', 'acta'].includes(tipo)) {
    actions.push({
      tipo: 'urgente',
      descripcion: `⚠️ ${tipo.replace('_', ' ').toUpperCase()} — requiere atención inmediata`,
      plazo: analysis.fechas?.vencimiento || null,
      completada: false,
    });
  }

  // Facturas por pagar
  if (['factura_recibida', 'recibo_autonomo', 'ticket'].includes(tipo) && accion === 'pagar') {
    actions.push({
      tipo: 'pagar',
      descripcion: `Pagar ${analysis.importes?.total || '?'}€ a ${analysis.emisor?.nombre || 'proveedor'}`,
      plazo: analysis.fechas?.vencimiento || null,
      completada: false,
    });
  }

  // Nóminas → contabilizar
  if (['nomina', 'finiquito'].includes(tipo)) {
    actions.push({
      tipo: 'contabilizar',
      descripcion: `Registrar ${tipo} de ${analysis.trabajador?.nombre_completo || analysis.receptor?.nombre || '?'}`,
      completada: false,
    });
  }

  // Contratos → revisar
  if (tipo === 'contrato') {
    actions.push({
      tipo: 'revisar',
      descripcion: 'Revisar y firmar contrato',
      completada: false,
    });
  }

  return actions;
}

// ═══════════════════════════════════════════════════════════════════════════
//  REGLAS PERSONALIZADAS — Cargadas desde organizer_rules.json
// ═══════════════════════════════════════════════════════════════════════════

async function loadCustomRules() {
  return loadJSON(RULES_FILE, {
    folder_overrides: {},    // { 'nombre-proveedor': 'gastos/facturas/custom-folder' }
    tag_rules: [],           // [{ match: 'regex', tags: ['tag1'] }]
    auto_actions: [],        // [{ match: 'regex', action: { tipo, descripcion } }]
    ignored_senders: [],     // ['spam@sender.com'] → auto-ignorar
  });
}

async function applyCustomRules(result, analysis) {
  const rules = await loadCustomRules();
  const emisorNorm = norm(analysis.emisor?.nombre || '');
  const emisorEmail = (analysis.emisor?.email || '').toLowerCase();

  // Carpeta override por nombre de proveedor
  for (const [key, folder] of Object.entries(rules.folder_overrides || {})) {
    if (emisorNorm.includes(norm(key))) {
      result.folder_path = folder;
      result.folder_override = true;
      break;
    }
  }

  // Tags automáticos por regla
  for (const rule of (rules.tag_rules || [])) {
    try {
      const re = new RegExp(rule.match, 'i');
      if (re.test(emisorNorm) || re.test(analysis.resumen || '')) {
        result.tags = [...new Set([...(result.tags || []), ...(rule.tags || [])])];
      }
    } catch { /* regex inválido, ignorar */ }
  }

  // Acciones automáticas
  for (const rule of (rules.auto_actions || [])) {
    try {
      const re = new RegExp(rule.match, 'i');
      if (re.test(emisorNorm) || re.test(analysis.resumen || '')) {
        result.pending_actions.push(rule.action);
      }
    } catch { /* regex inválido */ }
  }

  // Auto-ignorar emisores
  if (rules.ignored_senders?.some(s => emisorEmail.includes(s) || emisorNorm.includes(norm(s)))) {
    result.auto_ignored = true;
    result.pending_actions = [];
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════════════
//  FUNCIÓN PRINCIPAL — organize(analysis, extractedData, originalName)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Organiza un documento analizado: asigna carpeta, nombre, tags, entidades, acciones.
 *
 * @param {Object} analysis      - Resultado del analyzerAgent (campo .analysis si viene envuelto)
 * @param {Object} extractedData - Resultado del extractorAgent
 * @param {string} originalName  - Nombre original del archivo
 * @returns {Promise<Object>}
 */
export async function organize(analysis, extractedData, originalName) {
  const start = Date.now();

  // Desenvolver si viene con wrapper del pipeline
  const a = analysis.analysis || analysis;

  console.log(`[ORGANIZADOR] Organizando: "${originalName}" → tipo: ${a.tipo}`);

  // ── 1. Determinar carpeta ───────────────────────────────────────────────
  const tipo = (a.tipo || 'otro').toLowerCase();
  const folderDef = FOLDER_TREE[tipo] || FOLDER_TREE.otro;
  let folderPath = folderDef.base;

  // Subcategorizar facturas recibidas
  if (tipo === 'factura_recibida' && folderDef.subfolders) {
    const sub = classifyInvoiceSubfolder(a);
    folderPath = folderDef.subfolders[sub] || folderDef.base;
  }

  // Añadir año como subcarpeta
  const year = (a.fechas?.documento || a.fecha || new Date().toISOString()).slice(0, 4);
  folderPath = `${folderPath}/${year}`;

  // Para nóminas/finiquitos → subcarpeta por trabajador
  if (['nomina', 'finiquito'].includes(tipo)) {
    const trabajadorNombre = norm(a.trabajador?.nombre_completo || a.receptor?.nombre || 'sin-nombre')
      .replace(/[^a-z0-9 ]/g, '').trim().replace(/\s+/g, '-');
    if (trabajadorNombre && trabajadorNombre !== 'sin-nombre') {
      folderPath = `${folderPath}/${trabajadorNombre}`;
    }
  }

  // ── 2. Nombre normalizado ──────────────────────────────────────────────
  const normalizedName = generateNormalizedName(a, originalName);

  // ── 3. Tags enriquecidos ──────────────────────────────────────────────
  const tags = [...new Set([
    ...(a.tags || []),
    tipo.replace('_', '-'),
    year,
    a.urgencia === 'alta' ? 'urgente' : null,
    a.emisor?.nombre ? norm(a.emisor.nombre).split(' ')[0] : null,
    a.subtipo ? norm(a.subtipo) : null,
  ].filter(Boolean))];

  // ── 4. Resolver entidades ──────────────────────────────────────────────
  const entityResult = await resolveEntities(a);

  // ── 5. Acciones pendientes ─────────────────────────────────────────────
  const pendingActions = determinePendingActions(a);

  // ── 6. Construir resultado ─────────────────────────────────────────────
  let result = {
    folder_path:     folderPath,
    normalized_name: normalizedName,
    full_path:       `${folderPath}/${normalizedName}`,
    tags,
    urgencia:        a.urgencia || 'media',
    accion_recomendada: a.accion_recomendada || 'archivar',
    pending_actions: pendingActions,
    auto_ignored:    false,

    // Entidades
    ...entityResult,

    // Metadata
    processing_time_ms: Date.now() - start,
    organized_at:       new Date().toISOString(),
  };

  // ── 7. Aplicar reglas personalizadas ───────────────────────────────────
  result = await applyCustomRules(result, a);

  console.log(`[ORGANIZADOR] ✓ ${originalName} → ${result.full_path} (${result.tags.join(', ')})`);
  if (result.entities_created?.length) {
    console.log(`[ORGANIZADOR]   Entidades nuevas: ${result.entities_created.map(e => `+${e.tipo}: ${e.nombre}`).join(', ')}`);
  }
  if (result.pending_actions?.length) {
    console.log(`[ORGANIZADOR]   Acciones: ${result.pending_actions.map(a => a.tipo).join(', ')}`);
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════════════
//  API — Gestión de reglas personalizadas
// ═══════════════════════════════════════════════════════════════════════════

/** Obtener reglas actuales */
export async function getRules() {
  return loadCustomRules();
}

/** Añadir override de carpeta para un proveedor */
export async function addFolderOverride(providerName, folderPath) {
  const rules = await loadCustomRules();
  rules.folder_overrides[providerName] = folderPath;
  await saveJSON(RULES_FILE, rules);
  console.log(`[ORGANIZADOR] Regla añadida: "${providerName}" → ${folderPath}`);
  return rules;
}

/** Añadir regla de tags automáticos */
export async function addTagRule(matchRegex, tags) {
  const rules = await loadCustomRules();
  rules.tag_rules.push({ match: matchRegex, tags });
  await saveJSON(RULES_FILE, rules);
  return rules;
}

/** Añadir emisor ignorado */
export async function addIgnoredSender(sender) {
  const rules = await loadCustomRules();
  if (!rules.ignored_senders.includes(sender)) {
    rules.ignored_senders.push(sender);
    await saveJSON(RULES_FILE, rules);
  }
  return rules;
}

/** Obtener el árbol de carpetas completo */
export function getFolderTree() {
  return FOLDER_TREE;
}

/** Obtener estadísticas de entidades */
export async function getEntityStats() {
  const ents = await loadJSON(ENTITIES_FILE, { clientes: [], proveedores: [], trabajadores: [] });
  return {
    proveedores:  ents.proveedores?.length || 0,
    trabajadores: ents.trabajadores?.length || 0,
    clientes:     ents.clientes?.length || 0,
    top_proveedores: (ents.proveedores || [])
      .sort((a, b) => (b.total_acumulado || 0) - (a.total_acumulado || 0))
      .slice(0, 10)
      .map(p => ({ nombre: p.nombre, facturas: p.facturas, total: p.total_acumulado })),
  };
}

export default { organize, getRules, addFolderOverride, addTagRule, addIgnoredSender, getFolderTree, getEntityStats };
