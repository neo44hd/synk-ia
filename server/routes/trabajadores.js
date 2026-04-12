// ═══════════════════════════════════════════════════════════════════════════
//  CONTROL HORARIO — Portal del trabajador (RDL 8/2019)
//  Obligatorio por ley española para todas las empresas
//  Registros conservados 4 años (Art. 34.9 ET)
// ═══════════════════════════════════════════════════════════════════════════
import { Router }    from 'express';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path          from 'path';
import { DATA_DIR } from './data.js';

const router   = Router();
const TRAB_FILE     = path.join(DATA_DIR, 'trabajadores.json');
const FICHAJES_FILE = path.join(DATA_DIR, 'fichajes.json');
const VAC_FILE      = path.join(DATA_DIR, 'vacaciones.json');
const DOCS_FILE     = path.join(DATA_DIR, 'trabajador_docs.json');
const INVOICE_FILE  = path.join(DATA_DIR, 'invoice.json');
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'sinkia2026';

// ── Helpers DB ──────────────────────────────────────────────────────────────
async function load(file, def) {
  try { return existsSync(file) ? JSON.parse(await readFile(file, 'utf8')) : def; }
  catch { return def; }
}
async function save(file, data) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(data, null, 2));
}

// ── Auth admin ──────────────────────────────────────────────────────────────
const isAdmin = (req) => (req.headers['x-admin-token'] || req.query.token) === ADMIN_TOKEN;
const adminOnly = (req, res, next) => isAdmin(req) ? next() : res.status(401).json({ error: 'No autorizado' });

// ── Auth trabajador (PIN de 4 dígitos) ──────────────────────────────────────
async function getTrabajadorByPin(pin) {
  const trabajadores = await load(TRAB_FILE, []);
  return trabajadores.find(t => t.pin === String(pin) && t.activo);
}
async function getTrabajadorById(id) {
  const trabajadores = await load(TRAB_FILE, []);
  return trabajadores.find(t => t.id === id);
}

// ══════════════════════════════════════════════════════════════════════════
//  GESTIÓN DE TRABAJADORES (solo admin)
// ══════════════════════════════════════════════════════════════════════════

// GET /api/trabajadores — listar todos
router.get('/', adminOnly, async (req, res) => {
  const trabajadores = await load(TRAB_FILE, []);
  res.json(trabajadores);
});

// POST /api/trabajadores — crear trabajador
router.post('/', adminOnly, async (req, res) => {
  const { nombre, apellidos, puesto, pin, email, telefono, turno, salario_hora } = req.body;
  if (!nombre || !pin) return res.status(400).json({ error: 'nombre y pin son obligatorios' });
  if (!/^\d{4}$/.test(pin)) return res.status(400).json({ error: 'El PIN debe ser de 4 dígitos' });

  const trabajadores = await load(TRAB_FILE, []);
  if (trabajadores.some(t => t.pin === pin)) return res.status(409).json({ error: 'PIN ya en uso' });

  const nuevo = {
    id:          `trab_${Date.now()}`,
    nombre, apellidos: apellidos || '',
    nombre_completo: `${nombre} ${apellidos || ''}`.trim(),
    puesto:       puesto || 'Empleado',
    pin,
    email:        email || null,
    telefono:     telefono || null,
    turno:        turno || 'mañana',
    salario_hora: parseFloat(salario_hora) || null,
    activo:       true,
    creado:       new Date().toISOString(),
  };
  trabajadores.push(nuevo);
  await save(TRAB_FILE, trabajadores);
  res.json({ ok: true, trabajador: { ...nuevo, pin: '****' } });
});

// PUT /api/trabajadores/:id — actualizar
router.put('/:id', adminOnly, async (req, res) => {
  const trabajadores = await load(TRAB_FILE, []);
  const idx = trabajadores.findIndex(t => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'No encontrado' });
  trabajadores[idx] = { ...trabajadores[idx], ...req.body, id: req.params.id };
  await save(TRAB_FILE, trabajadores);
  res.json({ ok: true });
});

// DELETE /api/trabajadores/:id — desactivar (nunca borrar por requisito legal)
router.delete('/:id', adminOnly, async (req, res) => {
  const trabajadores = await load(TRAB_FILE, []);
  const t = trabajadores.find(t => t.id === req.params.id);
  if (!t) return res.status(404).json({ error: 'No encontrado' });
  t.activo = false;
  await save(TRAB_FILE, trabajadores);
  res.json({ ok: true });
});

// ══════════════════════════════════════════════════════════════════════════
//  FICHAJES (entrada / salida)
// ══════════════════════════════════════════════════════════════════════════

// POST /api/trabajadores/fichar — fichar con PIN
router.post('/fichar', async (req, res) => {
  const { pin, tipo, latitud, longitud, notas } = req.body;
  // tipo: 'entrada' | 'salida' | 'descanso_inicio' | 'descanso_fin'
  if (!pin) return res.status(400).json({ error: 'PIN requerido' });

  const trab = await getTrabajadorByPin(pin);
  if (!trab) return res.status(401).json({ error: 'PIN incorrecto o trabajador inactivo' });

  const fichajes = await load(FICHAJES_FILE, []);
  const ahora    = new Date();
  const hoy      = ahora.toISOString().slice(0, 10);

  // Detectar tipo automáticamente si no se pasa
  let tipoFinal = tipo;
  if (!tipoFinal) {
    const ultimoHoy = fichajes
      .filter(f => f.trabajador_id === trab.id && f.fecha === hoy)
      .sort((a, b) => b.hora.localeCompare(a.hora))[0];

    tipoFinal = !ultimoHoy || ultimoHoy.tipo === 'salida'
      ? 'entrada'
      : 'salida';
  }

  const fichaje = {
    id:            `fich_${Date.now()}`,
    trabajador_id: trab.id,
    trabajador_nombre: trab.nombre_completo,
    puesto:        trab.puesto,
    fecha:         hoy,
    hora:          ahora.toTimeString().slice(0, 8),
    datetime:      ahora.toISOString(),
    tipo:          tipoFinal,
    latitud:       latitud || null,
    longitud:      longitud || null,
    notas:         notas || null,
    ip:            req.ip,
  };

  fichajes.unshift(fichaje);
  await save(FICHAJES_FILE, fichajes);

  console.log(`[HORARIO] ${trab.nombre_completo} — ${tipoFinal} a las ${fichaje.hora}`);

  res.json({
    ok: true,
    fichaje: { ...fichaje },
    trabajador: { nombre: trab.nombre_completo, puesto: trab.puesto },
    mensaje: tipoFinal === 'entrada'
      ? `¡Bienvenido, ${trab.nombre}! Entrada registrada a las ${fichaje.hora}`
      : `¡Hasta luego, ${trab.nombre}! Salida registrada a las ${fichaje.hora}`,
  });
});

// GET /api/trabajadores/fichajes — historial (admin)
router.get('/fichajes', adminOnly, async (req, res) => {
  let fichajes = await load(FICHAJES_FILE, []);
  const { desde, hasta, trabajador_id, fecha } = req.query;
  if (fecha)          fichajes = fichajes.filter(f => f.fecha === fecha);
  if (desde)          fichajes = fichajes.filter(f => f.fecha >= desde);
  if (hasta)          fichajes = fichajes.filter(f => f.fecha <= hasta);
  if (trabajador_id)  fichajes = fichajes.filter(f => f.trabajador_id === trabajador_id);
  res.json(fichajes);
});

// GET /api/trabajadores/fichajes/hoy — quién está trabajando ahora
router.get('/fichajes/hoy', adminOnly, async (req, res) => {
  const fichajes = await load(FICHAJES_FILE, []);
  const hoy      = new Date().toISOString().slice(0, 10);
  const hoyFichs = fichajes.filter(f => f.fecha === hoy);

  // Estado actual por trabajador
  const estado = {};
  for (const f of [...hoyFichs].reverse()) {
    if (!estado[f.trabajador_id]) {
      estado[f.trabajador_id] = {
        trabajador_id:     f.trabajador_id,
        nombre:            f.trabajador_nombre,
        puesto:            f.puesto,
        estado:            f.tipo === 'entrada' || f.tipo === 'descanso_fin' ? 'trabajando' : 'fuera',
        ultimo_fichaje:    f.tipo,
        ultima_hora:       f.hora,
        fichajes_hoy:      hoyFichs.filter(x => x.trabajador_id === f.trabajador_id),
        horas_trabajadas:  calcHorasTrabajadas(hoyFichs.filter(x => x.trabajador_id === f.trabajador_id)),
      };
    }
  }
  res.json({ fecha: hoy, trabajadores: Object.values(estado) });
});

// GET /api/trabajadores/:id/horario — horario personal del trabajador
router.get('/:id/horario', async (req, res) => {
  // Sin admin token: requiere que sea el propio trabajador (por PIN en query)
  const { pin, desde, hasta } = req.query;
  const trab = isAdmin(req)
    ? await getTrabajadorById(req.params.id)
    : await getTrabajadorByPin(pin);

  if (!trab || trab.id !== req.params.id) return res.status(401).json({ error: 'No autorizado' });

  let fichajes = await load(FICHAJES_FILE, []);
  fichajes = fichajes.filter(f => f.trabajador_id === req.params.id);
  if (desde) fichajes = fichajes.filter(f => f.fecha >= desde);
  if (hasta) fichajes = fichajes.filter(f => f.fecha <= hasta);

  // Agrupar por día
  const porDia = {};
  for (const f of fichajes) {
    if (!porDia[f.fecha]) porDia[f.fecha] = [];
    porDia[f.fecha].push(f);
  }

  const resumen = Object.entries(porDia).map(([fecha, fichs]) => ({
    fecha,
    fichajes: fichs,
    horas_trabajadas: calcHorasTrabajadas(fichs),
    entrada: fichs.find(f => f.tipo === 'entrada')?.hora,
    salida:  [...fichs].reverse().find(f => f.tipo === 'salida')?.hora,
  })).sort((a, b) => b.fecha.localeCompare(a.fecha));

  res.json({ trabajador: { nombre: trab.nombre_completo, puesto: trab.puesto }, dias: resumen });
});

// GET /api/trabajadores/informe/mensual — informe mensual para gestoría/nóminas
router.get('/informe/mensual', adminOnly, async (req, res) => {
  const { mes } = req.query; // formato YYYY-MM
  const periodo = mes || new Date().toISOString().slice(0, 7);

  const [trabajadores, fichajes] = await Promise.all([
    load(TRAB_FILE, []),
    load(FICHAJES_FILE, []),
  ]);

  const fichajesMes = fichajes.filter(f => f.fecha.startsWith(periodo));

  const informe = trabajadores.filter(t => t.activo).map(t => {
    const fichs   = fichajesMes.filter(f => f.trabajador_id === t.id);
    const porDia  = {};
    for (const f of fichs) {
      if (!porDia[f.fecha]) porDia[f.fecha] = [];
      porDia[f.fecha].push(f);
    }

    const diasTrabajados = Object.keys(porDia).length;
    const horasTotal     = Object.values(porDia).reduce((s, d) => s + calcHorasTrabajadas(d), 0);
    const horasExtra     = Math.max(0, horasTotal - diasTrabajados * 8);

    return {
      trabajador_id:  t.id,
      nombre:         t.nombre_completo,
      puesto:         t.puesto,
      periodo,
      dias_trabajados: diasTrabajados,
      horas_total:    Math.round(horasTotal * 100) / 100,
      horas_extra:    Math.round(horasExtra * 100) / 100,
      salario_hora:   t.salario_hora,
      coste_estimado: t.salario_hora ? Math.round(horasTotal * t.salario_hora * 100) / 100 : null,
      fichajes:       fichs.length,
    };
  });

  res.json({ periodo, informe, total_horas: informe.reduce((s, t) => s + t.horas_total, 0) });
});

// ── Calcular horas trabajadas en un día ──────────────────────────────────────
function calcHorasTrabajadas(fichajes) {
  const sorted   = [...fichajes].sort((a, b) => a.hora.localeCompare(b.hora));
  let total = 0, entradaTs = null;
  for (const f of sorted) {
    const ts = timeToMinutes(f.hora);
    if (f.tipo === 'entrada' || f.tipo === 'descanso_fin') {
      entradaTs = ts;
    } else if ((f.tipo === 'salida' || f.tipo === 'descanso_inicio') && entradaTs !== null) {
      total += ts - entradaTs;
      entradaTs = null;
    }
  }
  return Math.round(total / 60 * 100) / 100; // horas con 2 decimales
}

function timeToMinutes(hora) {
  const [h, m, s] = hora.split(':').map(Number);
  return h * 60 + m + (s || 0) / 60;
}

// ══════════════════════════════════════════════════════════════════════════
//  FROM-PAYSLIPS — Extraer trabajadores de nóminas PDF automáticamente
// ══════════════════════════════════════════════════════════════════════════

// POST /api/trabajadores/from-payslips — procesar nóminas y crear/actualizar trabajadores
router.post('/from-payslips', adminOnly, async (req, res) => {
  try {
    const pdfParse = (await import('pdf-parse')).default;

    // 1. Obtener nóminas del endpoint de email
    console.log('[FROM-PAYSLIPS] Descargando nóminas desde email/payslips...');
    const payslipsRes = await fetch('http://localhost:3001/api/email/payslips?since=2024-01-01&limit=300', {
      headers: { 'x-admin-token': ADMIN_TOKEN }
    });
    if (!payslipsRes.ok) {
      return res.status(502).json({ error: `Error al obtener nóminas: ${payslipsRes.status}` });
    }

    const payslipsData = await payslipsRes.json();
    const meses = payslipsData.data || payslipsData.months || payslipsData || [];
    // Aplanar: los payslips pueden venir agrupados por mes o como array directo
    const payslips = Array.isArray(meses)
      ? meses.flatMap(m => m.payslips || m.documents || [m])
      : [];

    console.log(`[FROM-PAYSLIPS] ${payslips.length} nóminas encontradas`);

    // 2. Procesar cada PDF
    const trabajadoresMap = new Map(); // clave: NSS
    let pdfsOk = 0, pdfsError = 0;

    for (const slip of payslips) {
      const content = slip.content || slip.content_base64 || slip.base64;
      if (!content) continue;

      try {
        const buffer = Buffer.from(content, 'base64');
        const pdf = await pdfParse(buffer);
        const texto = pdf.text || '';

        // Parsear cada página del PDF
        const paginas = texto.split(/\f/).filter(p => p.trim());
        for (const pagina of paginas) {
          const datos = parsearPaginaNomina(pagina);
          if (datos && datos.nss) {
            // Deduplicar por NSS — acumular datos más recientes
            const existente = trabajadoresMap.get(datos.nss);
            if (existente) {
              trabajadoresMap.set(datos.nss, { ...existente, ...datos });
            } else {
              trabajadoresMap.set(datos.nss, datos);
            }
          }
        }
        pdfsOk++;
      } catch (err) {
        console.warn(`[FROM-PAYSLIPS] Error procesando PDF: ${err.message}`);
        pdfsError++;
      }
    }

    // 3. Crear/actualizar trabajadores en trabajadores.json
    const trabajadores = await load(TRAB_FILE, []);
    let creados = 0, actualizados = 0;

    // Calcular siguiente PIN disponible
    const pinesUsados = trabajadores.map(t => parseInt(t.pin) || 0);
    let siguientePin = Math.max(0, ...pinesUsados) + 1;

    for (const [nss, datos] of trabajadoresMap) {
      // Buscar existente por NSS o DNI
      const idx = trabajadores.findIndex(t =>
        t.nss === nss || (datos.dni && t.dni === datos.dni)
      );

      if (idx >= 0) {
        // Actualizar datos existentes (no sobreescribir pin, id, es_admin)
        const preservar = ['id', 'pin', 'es_admin', 'creado'];
        for (const [key, val] of Object.entries(datos)) {
          if (val && !preservar.includes(key)) {
            trabajadores[idx][key] = val;
          }
        }
        trabajadores[idx].nombre_completo = `${trabajadores[idx].nombre || datos.nombre || ''} ${trabajadores[idx].apellidos || datos.apellidos || ''}`.trim();
        trabajadores[idx].actualizado = new Date().toISOString();
        actualizados++;
      } else {
        // Crear nuevo trabajador
        const pin = String(siguientePin).padStart(4, '0');
        siguientePin++;
        const nuevo = {
          id: `trab_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          nombre: datos.nombre || 'Sin nombre',
          apellidos: datos.apellidos || '',
          nombre_completo: `${datos.nombre || ''} ${datos.apellidos || ''}`.trim(),
          dni: datos.dni || null,
          nss: datos.nss,
          pin,
          puesto: datos.puesto || 'Empleado',
          departamento: datos.departamento || 'Cocina',
          tipo_contrato: 'indefinido',
          fecha_alta: datos.fecha_alta || null,
          salario_base_mensual: datos.salario_base_mensual || null,
          activo: datos.activo !== false,
          es_admin: false,
          creado: new Date().toISOString(),
        };
        if (datos.motivo_baja) nuevo.motivo_baja = datos.motivo_baja;
        if (datos.fecha_baja) nuevo.fecha_baja = datos.fecha_baja;
        trabajadores.push(nuevo);
        creados++;
      }
    }

    await save(TRAB_FILE, trabajadores);

    const resultado = {
      ok: true,
      pdfs_procesados: pdfsOk,
      pdfs_error: pdfsError,
      trabajadores_encontrados: trabajadoresMap.size,
      creados,
      actualizados,
      total_trabajadores: trabajadores.length,
    };
    console.log(`[FROM-PAYSLIPS] Resultado: ${JSON.stringify(resultado)}`);
    res.json(resultado);

  } catch (err) {
    console.error('[FROM-PAYSLIPS] Error general:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Parsear una página de nómina ────────────────────────────────────────────
function parsearPaginaNomina(texto) {
  const datos = {};

  // Extraer DNI (formatos: D.N.I. XX123456X, DNI: XX123456X, NIF: XX123456X)
  const dniMatch = texto.match(/(?:D\.?N\.?I\.?|NIF|N\.I\.F\.?)\s*:?\s*([A-Z0-9]\d{7}[A-Z]|[XYZ]\d{7}[A-Z])/i);
  if (dniMatch) datos.dni = dniMatch[1].toUpperCase();

  // Extraer NSS (formato XX/XXXXXXXX-XX)
  const nssMatch = texto.match(/(\d{2}\/\d{8}-\d{2})/);
  if (nssMatch) datos.nss = nssMatch[1];

  // Sin NSS no podemos identificar al trabajador de forma única
  if (!datos.nss) return null;

  // Extraer nombre y apellidos
  // Formato hoja de salario: "APELLIDOS, NOMBRE" en primeras líneas
  const nombreMatch = texto.match(/^([A-ZÁÉÍÓÚÑ\s]+),\s*([A-ZÁÉÍÓÚÑ\s]+)/m);
  if (nombreMatch) {
    datos.apellidos = nombreMatch[1].trim().split(' ').map(w =>
      w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    ).join(' ');
    datos.nombre = nombreMatch[2].trim().split(' ').map(w =>
      w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    ).join(' ');
  }

  // Formato certificado/finiquito: "Nombre y apellidos NOMBRE APELLIDOS"
  if (!datos.nombre) {
    const certMatch = texto.match(/Nombre\s+y\s+apellidos\s+([A-ZÁÉÍÓÚÑ\s]+)/i);
    if (certMatch) {
      const partes = certMatch[1].trim().split(/\s+/);
      if (partes.length >= 2) {
        datos.nombre = partes[0].charAt(0).toUpperCase() + partes[0].slice(1).toLowerCase();
        datos.apellidos = partes.slice(1).map(w =>
          w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
        ).join(' ');
      }
    }
  }

  // Formato registro horario: "Trabajador: APELLIDOS, NOMBRE"
  if (!datos.nombre) {
    const regMatch = texto.match(/Trabajador\s*:\s*([A-ZÁÉÍÓÚÑ\s]+),\s*([A-ZÁÉÍÓÚÑ\s]+)/i);
    if (regMatch) {
      datos.apellidos = regMatch[1].trim().split(' ').map(w =>
        w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
      ).join(' ');
      datos.nombre = regMatch[2].trim().split(' ').map(w =>
        w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
      ).join(' ');
    }
  }

  // Extraer salario base mensual
  const salarioMatch = texto.match(/(?:salario\s+base|s\.?\s*base)\s*[:\s]*(\d[\d.,]+)/i);
  if (salarioMatch) {
    datos.salario_base_mensual = parseFloat(salarioMatch[1].replace('.', '').replace(',', '.'));
  }

  // Extraer antigüedad / fecha alta
  const altaMatch = texto.match(/(?:antig[üu]edad|fecha\s+alta|alta\s+empresa)\s*:?\s*(\d{2}[\/-]\d{2}[\/-]\d{4})/i);
  if (altaMatch) {
    const partes = altaMatch[1].split(/[\/-]/);
    datos.fecha_alta = `${partes[2]}-${partes[1]}-${partes[0]}`;
  }

  // Extraer puesto
  const puestoMatch = texto.match(/(?:categor[ií]a|puesto|cargo)\s*:?\s*([^\n\r]+)/i);
  if (puestoMatch) {
    datos.puesto = puestoMatch[1].trim().substring(0, 50);
  }

  return datos;
}

// ══════════════════════════════════════════════════════════════════════════
//  SEED — Crear trabajadores reales de Chicken Palace Ibiza
// ══════════════════════════════════════════════════════════════════════════

const SEED_WORKERS = [
  {
    id: 'trab_001', nombre: 'David', apellidos: 'Roldan Hueso',
    nombre_completo: 'David Roldan Hueso',
    dni: '53357205B', nss: '46/10223734-71',
    pin: '0001', puesto: 'Director General', departamento: 'Dirección',
    tipo_contrato: 'indefinido', fecha_alta: '2024-01-01',
    salario_base_mensual: 1700, activo: true, es_admin: true
  },
  {
    id: 'trab_002', nombre: 'Fernando', apellidos: 'Roldan Hueso',
    nombre_completo: 'Fernando Roldan Hueso',
    dni: '53092395T', nss: '46/10047483-69',
    pin: '0002', puesto: 'Gerente', departamento: 'Dirección',
    tipo_contrato: 'indefinido', fecha_alta: '2024-02-01',
    salario_base_mensual: 1700, activo: true, es_admin: false
  },
  {
    id: 'trab_003', nombre: 'Tolia', apellidos: 'Gallegos Ordoñez',
    nombre_completo: 'Tolia Gallegos Ordoñez',
    dni: '55465294N', nss: '07/10552543-92',
    pin: '0003', puesto: 'Cocinera', departamento: 'Cocina',
    tipo_contrato: 'indefinido', fecha_alta: '2022-03-17',
    salario_base_mensual: 1168, activo: true, es_admin: false
  },
  {
    id: 'trab_004', nombre: 'Sandy Yadira', apellidos: 'Aguirre Gallegos',
    nombre_completo: 'Sandy Yadira Aguirre Gallegos',
    dni: '11456218X', nss: '07/10552545-94',
    pin: '0004', puesto: 'Cocinera', departamento: 'Cocina',
    tipo_contrato: 'indefinido', fecha_alta: '2022-03-03',
    salario_base_mensual: 1168, activo: true, es_admin: false
  },
  {
    id: 'trab_005', nombre: 'Carlos Fabian', apellidos: 'Aguirre Gallegos',
    nombre_completo: 'Carlos Fabian Aguirre Gallegos',
    dni: 'Y6582736N', nss: '07/11126247-41',
    pin: '0005', puesto: 'Cocinero', departamento: 'Cocina',
    tipo_contrato: 'indefinido', fecha_alta: '2023-11-10',
    salario_base_mensual: 1168, activo: true, es_admin: false
  },
  {
    id: 'trab_006', nombre: 'Evelyn Beatriz', apellidos: 'Ramos',
    nombre_completo: 'Evelyn Beatriz Ramos',
    dni: 'Y8472087M', nss: '07/11027632-75',
    pin: '0006', puesto: 'Cocinera', departamento: 'Cocina',
    tipo_contrato: 'indefinido', fecha_alta: '2024-04-02',
    salario_base_mensual: 1168, activo: true, es_admin: false
  },
  {
    id: 'trab_007', nombre: 'Davis Fabian', apellidos: 'Aguirre Farfan',
    nombre_completo: 'Davis Fabian Aguirre Farfan',
    dni: 'Z2558594X', nss: '07/11211343-68',
    pin: '0007', puesto: 'Ayudante de cocina', departamento: 'Cocina',
    tipo_contrato: 'indefinido', fecha_alta: '2025-11-01',
    salario_base_mensual: 1168, activo: true, es_admin: false
  },
  {
    id: 'trab_008', nombre: 'Humberto', apellidos: 'Pino Macias',
    nombre_completo: 'Humberto Pino Macias',
    dni: 'Y9492798E', nss: '07/11082155-84',
    pin: '0008', puesto: 'Cocinero', departamento: 'Cocina',
    tipo_contrato: 'indefinido', fecha_alta: '2025-08-01',
    salario_base_mensual: 1168, activo: false, es_admin: false,
    motivo_baja: 'Despido', fecha_baja: '2026-03-06'
  }
];

// POST /api/trabajadores/seed — insertar trabajadores de prueba
router.post('/seed', adminOnly, async (req, res) => {
  const trabajadores = await load(TRAB_FILE, []);
  let insertados = 0;

  for (const seed of SEED_WORKERS) {
    if (trabajadores.some(t => t.id === seed.id || t.pin === seed.pin)) continue;
    trabajadores.push({ ...seed, creado: new Date().toISOString() });
    insertados++;
  }

  await save(TRAB_FILE, trabajadores);
  console.log(`[SEED] ${insertados} trabajadores insertados`);
  res.json({ ok: true, insertados, total: trabajadores.length });
});

// ══════════════════════════════════════════════════════════════════════════
//  VACACIONES — Solicitudes y resolución
// ══════════════════════════════════════════════════════════════════════════

// POST /api/trabajadores/:id/vacaciones — solicitar vacaciones
router.post('/:id/vacaciones', async (req, res) => {
  const { pin, fecha_inicio, fecha_fin, tipo, notas } = req.body;
  if (!fecha_inicio || !fecha_fin) return res.status(400).json({ error: 'fecha_inicio y fecha_fin son obligatorios' });

  // Auth: PIN en body o admin token
  const trab = isAdmin(req)
    ? await getTrabajadorById(req.params.id)
    : await getTrabajadorByPin(pin);
  if (!trab || trab.id !== req.params.id) return res.status(401).json({ error: 'No autorizado' });

  const vacaciones = await load(VAC_FILE, []);
  const solicitud = {
    id: `vac_${Date.now()}`,
    trabajador_id: trab.id,
    trabajador_nombre: trab.nombre_completo,
    fecha_inicio,
    fecha_fin,
    tipo: tipo || 'vacaciones',
    estado: 'pendiente',
    notas: notas || null,
    notas_admin: null,
    created_at: new Date().toISOString(),
  };

  vacaciones.push(solicitud);
  await save(VAC_FILE, vacaciones);
  console.log(`[VACACIONES] ${trab.nombre_completo} solicitó ${solicitud.tipo} del ${fecha_inicio} al ${fecha_fin}`);
  res.json({ ok: true, solicitud });
});

// GET /api/trabajadores/:id/vacaciones — ver solicitudes
router.get('/:id/vacaciones', async (req, res) => {
  const { pin } = req.query;
  const trab = isAdmin(req)
    ? await getTrabajadorById(req.params.id)
    : await getTrabajadorByPin(pin);
  if (!trab || trab.id !== req.params.id) return res.status(401).json({ error: 'No autorizado' });

  const vacaciones = await load(VAC_FILE, []);
  const mis = vacaciones
    .filter(v => v.trabajador_id === req.params.id)
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  res.json(mis);
});

// PUT /api/trabajadores/vacaciones/:vacId/resolver — admin aprueba/rechaza
router.put('/vacaciones/:vacId/resolver', adminOnly, async (req, res) => {
  const { estado, notas_admin } = req.body;
  if (!['aprobada', 'rechazada'].includes(estado)) {
    return res.status(400).json({ error: 'estado debe ser aprobada o rechazada' });
  }

  const vacaciones = await load(VAC_FILE, []);
  const vac = vacaciones.find(v => v.id === req.params.vacId);
  if (!vac) return res.status(404).json({ error: 'Solicitud no encontrada' });

  vac.estado = estado;
  vac.notas_admin = notas_admin || null;
  vac.resuelto_at = new Date().toISOString();
  await save(VAC_FILE, vacaciones);

  console.log(`[VACACIONES] ${vac.trabajador_nombre} — ${estado}`);
  res.json({ ok: true, solicitud: vac });
});

// ══════════════════════════════════════════════════════════════════════════
//  DOCUMENTOS — Documentos vinculados al trabajador
// ══════════════════════════════════════════════════════════════════════════

// GET /api/trabajadores/:id/documentos — mis documentos
router.get('/:id/documentos', async (req, res) => {
  const { pin } = req.query;
  const trab = isAdmin(req)
    ? await getTrabajadorById(req.params.id)
    : await getTrabajadorByPin(pin);
  if (!trab || trab.id !== req.params.id) return res.status(401).json({ error: 'No autorizado' });

  // Documentos asignados manualmente
  const asignaciones = await load(DOCS_FILE, []);
  const misAsignaciones = asignaciones.filter(d => d.trabajador_id === req.params.id);

  // Documentos vinculados en invoice.json (nóminas, contratos, etc.)
  const invoices = await load(INVOICE_FILE, []);
  const misInvoices = invoices.filter(i => i.trabajador_id === req.params.id);

  res.json({
    asignaciones: misAsignaciones,
    documentos_vinculados: misInvoices.map(i => ({
      id: i.id, filename: i.filename, type: i.type,
      date: i.date, subject: i.subject, status: i.status,
    })),
  });
});

// POST /api/trabajadores/:id/documentos — admin asigna documento
router.post('/:id/documentos', adminOnly, async (req, res) => {
  const { invoice_id, tipo, descripcion } = req.body;
  if (!invoice_id) return res.status(400).json({ error: 'invoice_id es obligatorio' });

  const trab = await getTrabajadorById(req.params.id);
  if (!trab) return res.status(404).json({ error: 'Trabajador no encontrado' });

  const asignaciones = await load(DOCS_FILE, []);
  const nueva = {
    id: `doc_${Date.now()}`,
    trabajador_id: req.params.id,
    trabajador_nombre: trab.nombre_completo,
    invoice_id,
    tipo: tipo || 'documento',
    descripcion: descripcion || null,
    created_at: new Date().toISOString(),
  };

  asignaciones.push(nueva);
  await save(DOCS_FILE, asignaciones);
  res.json({ ok: true, asignacion: nueva });
});

// ══════════════════════════════════════════════════════════════════════════
//  NÓMINAS — Nóminas vinculadas al trabajador
// ══════════════════════════════════════════════════════════════════════════

// GET /api/trabajadores/:id/nominas — mis nóminas
router.get('/:id/nominas', async (req, res) => {
  const { pin } = req.query;
  const trab = isAdmin(req)
    ? await getTrabajadorById(req.params.id)
    : await getTrabajadorByPin(pin);
  if (!trab || trab.id !== req.params.id) return res.status(401).json({ error: 'No autorizado' });

  const invoices = await load(INVOICE_FILE, []);
  const nominas = invoices
    .filter(i => i.type === 'nomina' && i.trabajador_id === req.params.id)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .map(i => ({
      id: i.id, filename: i.filename, date: i.date,
      subject: i.subject, provider_name: i.provider_name,
      status: i.status,
    }));

  res.json({ trabajador: trab.nombre_completo, nominas });
});

export default router;
