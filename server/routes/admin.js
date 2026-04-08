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
    const freeB  = os.freemem();
    const usedB  = totalB - freeB;

    // Disco home
    let disk = { total: 0, used: 0, avail: 0, pct: 0 };
    try {
      const df = execSync(`df -k ${os.homedir()} | tail -1`)
        .toString().trim().split(/\s+/);
      const t = parseInt(df[1]), u = parseInt(df[2]), a = parseInt(df[3]);
      disk = {
        total: Math.round(t / 1024 / 1024),
        used:  Math.round(u / 1024 / 1024),
        avail: Math.round(a / 1024 / 1024),
        pct:   Math.round((u / t) * 100),
      };
    } catch {}

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
        total: Math.round(totalB / 1024 / 1024 / 1024 * 10) / 10,
        used:  Math.round(usedB  / 1024 / 1024 / 1024 * 10) / 10,
        free:  Math.round(freeB  / 1024 / 1024 / 1024 * 10) / 10,
        pct:   Math.round((usedB / totalB) * 100),
      },
      disk,
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
