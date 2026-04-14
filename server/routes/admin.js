/**
 * admin.js — Panel de control CEO
 * GET  /api/admin/processes          → lista de procesos PM2
 * POST /api/admin/processes/:n/restart → reiniciar proceso
 * GET  /api/admin/system             → CPU, RAM, disco
 * GET  /api/admin/logs/:name         → últimas líneas de log
 * POST /api/admin/rebuild            → npm build + restart
 */

import { Router }                    from 'express';
import { execSync, exec }            from 'child_process';
import { readFileSync, existsSync }  from 'fs';
import os                            from 'os';
import path                          from 'path';
import { fileURLToPath }             from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router    = Router();

// ── Auth ─────────────────────────────────────────────────────────────────────
const TOKEN = process.env.ADMIN_TOKEN || 'sinkia2026';

router.use((req, res, next) => {
  const tok = req.headers['x-admin-token'] || req.query.token;
  if (tok !== TOKEN) return res.status(401).json({ error: 'Token inválido' });
  next();
});

// ── Processes ─────────────────────────────────────────────────────────────────
router.get('/processes', (_req, res) => {
  try {
    const raw  = execSync('pm2 jlist 2>/dev/null', { timeout: 5000 }).toString();
    const list = JSON.parse(raw);
    res.json(list.map(p => ({
      id:       p.pm_id,
      name:     p.name,
      status:   p.pm2_env?.status ?? 'unknown',
      cpu:      p.monit?.cpu  ?? 0,
      memory:   Math.round((p.monit?.memory ?? 0) / 1024 / 1024),
      uptime:   p.pm2_env?.pm_uptime ?? 0,
      restarts: p.pm2_env?.restart_time ?? 0,
      pid:      p.pid ?? null,
    })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/processes/:name/restart', (req, res) => {
  try {
    execSync(`pm2 restart ${req.params.name} --update-env`, { timeout: 15000 });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/processes/:name/stop', (req, res) => {
  try {
    execSync(`pm2 stop ${req.params.name}`, { timeout: 10000 });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── System ────────────────────────────────────────────────────────────────────
router.get('/system', (_req, res) => {
  try {
    const totalB = os.totalmem();

    // macOS: os.freemem() solo reporta RAM "free" (no incluye RAM
    // reutilizable usada como caché). vm_stat da el dato real.
    let availableGB, usedGB;
    try {
      const vmstat = execSync('vm_stat 2>/dev/null').toString();
      const pageSize = 16384; // Apple Silicon usa páginas de 16 KB
      const extract = (key) => {
        const m = vmstat.match(new RegExp(`${key}:\\s+(\\d+)`));
        return m ? parseInt(m[1]) * pageSize : 0;
      };
      const free       = extract('Pages free');
      const inactive   = extract('Pages inactive');
      const purgeable  = extract('Pages purgeable');
      // RAM disponible = free + inactive + purgeable (lo que macOS puede reclamar al instante)
      const availB = free + inactive + purgeable;
      availableGB  = Math.round(availB / 1024 / 1024 / 1024 * 10) / 10;
      usedGB       = Math.round((totalB - availB) / 1024 / 1024 / 1024 * 10) / 10;
      if (availableGB < 0) availableGB = Math.round(os.freemem() / 1024 / 1024 / 1024 * 10) / 10;
      if (usedGB < 0 || usedGB > totalB) usedGB = Math.round((totalB - os.freemem()) / 1024 / 1024 / 1024 * 10) / 10;
    } catch {
      // Fallback para Linux u otros
      availableGB = Math.round(os.freemem() / 1024 / 1024 / 1024 * 10) / 10;
      usedGB      = Math.round((totalB - os.freemem()) / 1024 / 1024 / 1024 * 10) / 10;
    }
    const totalGB = Math.round(totalB / 1024 / 1024 / 1024 * 10) / 10;
    const memPct  = Math.round((usedGB / totalGB) * 100);

    // Discos: SSD interno + disco externo (si existe)
    let disks = [];
    try {
      // SSD interno (home)
      const dfHome = execSync(`df -k ${os.homedir()} | tail -1`)
        .toString().trim().split(/\s+/);
      const hT = parseInt(dfHome[1]), hU = parseInt(dfHome[2]), hA = parseInt(dfHome[3]);
      disks.push({
        name:  'SSD interno',
        mount: '/',
        total: Math.round(hT / 1024 / 1024),
        used:  Math.round(hU / 1024 / 1024),
        avail: Math.round(hA / 1024 / 1024),
        pct:   Math.round((hU / hT) * 100),
      });

      // Disco externo "Disco local"
      const extPath = '/Volumes/Disco local';
      try {
        const dfExt = execSync(`df -k "${extPath}" 2>/dev/null | tail -1`)
          .toString().trim().split(/\s+/);
        // df output en macOS con espacios en nombre: reconstruct
        // Buscar los últimos 4 campos numéricos
        const nums = dfExt.filter(f => /^\d+$/.test(f));
        if (nums.length >= 3) {
          const eT = parseInt(nums[0]), eU = parseInt(nums[1]), eA = parseInt(nums[2]);
          disks.push({
            name:  'Disco local',
            mount: extPath,
            total: Math.round(eT / 1024 / 1024),
            used:  Math.round(eU / 1024 / 1024),
            avail: Math.round(eA / 1024 / 1024),
            pct:   Math.round((eU / eT) * 100),
          });
        }
      } catch {} // Disco externo no montado — ignorar
    } catch {}

    // Compatibilidad: mantener campo "disk" con el total combinado
    const diskTotalGB = disks.reduce((s, d) => s + d.total, 0);
    const diskUsedGB  = disks.reduce((s, d) => s + d.used, 0);
    const diskAvailGB = disks.reduce((s, d) => s + d.avail, 0);

    // Carga CPU (load average 1 min)
    const [load1] = os.loadavg();

    res.json({
      hostname: os.hostname(),
      platform: os.platform(),
      arch:     os.arch(),
      cpus:     os.cpus().length,
      model:    os.cpus()[0]?.model || '',
      uptime:   Math.round(os.uptime()),
      load1:    Math.round(load1 * 100) / 100,
      memory: {
        total: totalGB,
        used:  usedGB,
        free:  availableGB,
        pct:   memPct,
      },
      disk: {
        total: diskTotalGB,
        used:  diskUsedGB,
        avail: diskAvailGB,
        pct:   diskTotalGB > 0 ? Math.round((diskUsedGB / diskTotalGB) * 100) : 0,
      },
      disks,  // Array detallado por disco
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Logs ──────────────────────────────────────────────────────────────────────
router.get('/logs/:name', (req, res) => {
  const logDir = path.join(os.homedir(), '.pm2', 'logs');
  const tail   = (file, n = 80) => {
    if (!existsSync(file)) return '';
    return readFileSync(file, 'utf8').split('\n').slice(-n).join('\n');
  };
  res.json({
    stdout: tail(path.join(logDir, `${req.params.name}-out.log`)),
    stderr: tail(path.join(logDir, `${req.params.name}-error.log`), 40),
  });
});

// ── Rebuild frontend ──────────────────────────────────────────────────────────
router.post('/rebuild', (req, res) => {
  const root = path.resolve(__dirname, '../..');
  res.json({ ok: true, message: 'Build iniciado en background...' });
  exec(
    `cd ${root} && npm run build && pm2 restart sinkia-api --update-env`,
    { timeout: 180_000 },
    (err) => {
      if (err) console.error('[ADMIN] Rebuild error:', err.message);
      else console.log('[ADMIN] ✓ Rebuild completado');
    }
  );
});

export const adminRouter = router;
