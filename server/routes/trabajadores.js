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
//  SEED — Crear trabajadores de prueba (Chicken Palace Ibiza)
// ══════════════════════════════════════════════════════════════════════════

const SEED_WORKERS = [
  {
    id: 'trab_001', nombre: 'David', apellidos: 'Roldan',
    nombre_completo: 'David Roldan', email: 'david@sinkialabs.com',
    pin: '0001', puesto: 'Director General', departamento: 'Dirección',
    tipo_contrato: 'indefinido', fecha_alta: '2024-01-01',
    salario_hora: 25, activo: true, es_admin: true
  },
  {
    id: 'trab_002', nombre: 'Empleado', apellidos: 'Demo',
    nombre_completo: 'Empleado Demo', email: 'demo@chickenpalace.es',
    pin: '1234', puesto: 'Cocinero', departamento: 'Cocina',
    tipo_contrato: 'indefinido', fecha_alta: '2024-06-01',
    salario_hora: 12, activo: true, es_admin: false
  },
  {
    id: 'trab_003', nombre: 'Camarero', apellidos: 'Demo',
    nombre_completo: 'Camarero Demo', email: 'camarero@chickenpalace.es',
    pin: '5678', puesto: 'Camarero', departamento: 'Sala',
    tipo_contrato: 'temporal', fecha_alta: '2025-04-01',
    salario_hora: 10, activo: true, es_admin: false
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
