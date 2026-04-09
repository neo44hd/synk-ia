// ═══════════════════════════════════════════════════════════════════════════
//  CONTROL HORARIO — Portal del trabajador (RDL 8/2019)
//  Obligatorio por ley española para todas las empresas
//  Registros conservados 4 años (Art. 34.9 ET)
// ═══════════════════════════════════════════════════════════════════════════
import { Router }    from 'express';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path          from 'path';

const router   = Router();
const DATA_DIR = process.env.DATA_DIR || '/Users/davidnows/sinkia/data';
const TRAB_FILE   = path.join(DATA_DIR, 'trabajadores.json');
const FICHAJES_FILE = path.join(DATA_DIR, 'fichajes.json');
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

export default router;
