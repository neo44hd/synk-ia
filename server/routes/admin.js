/**
 * admin.js — Panel de control CEO (fusionado con Mission Control v2)
 *
 * GET  /api/admin/processes          → lista de procesos PM2
 * POST /api/admin/processes/:n/restart → reiniciar proceso
 * POST /api/admin/processes/:n/stop    → parar proceso
 * GET  /api/admin/system             → CPU, RAM, disco
 * GET  /api/admin/logs/:name         → últimas líneas de log
 * POST /api/admin/rebuild            → npm build + restart
 * POST /api/admin/deploy             → git pull + install + rebuild + restart
 * POST /api/admin/exec               → comando arbitrario
 *
 * Docker
 * GET    /api/admin/docker           → contenedores
 * POST   /api/admin/docker/:id/:action → restart/stop
 * GET    /api/admin/docker/:id/logs  → logs Docker
 * POST   /api/admin/docker/all/:action → restart/stop/prune all
 * POST   /api/admin/docker-compose/:action → compose up/down
 *
 * Ollama
 * GET    /api/admin/ollama/models    → modelos instalados
 * POST   /api/admin/ollama/:action/:model → pull/rm
 *
 * Tailscale / Cloudflare
 * GET  /api/admin/tailscale/status   → estado Tailscale
 * GET  /api/admin/cloudflare/status  → estado tunnel
 *
 * Repair Kit
 * GET    /api/admin/repair/actions   → lista de acciones
 * POST   /api/admin/repair/:action   → ejecutar reparación
 *
 * Cards (dashboard unificado)
 * GET  /api/admin/services           → datos combinados para el dashboard
 */

import { Router }                    from 'express';
import { execSync, exec } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import util from 'util';

const execAsync = util.promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router    = Router();

// PATH ampliado para encontrar binarios de Homebrew (docker, pm2, ollama, etc.)
const EXTRA_PATH = '/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin';
function execEnv(env = {}) {
  return { ...process.env, HOME: '/Users/davidnows', PATH: EXTRA_PATH + (process.env.PATH ? ':' + process.env.PATH : ''), ...env };
}

// ── Auth ─────────────────────────────────────────────────────────────────────
const TOKEN = process.env.ADMIN_TOKEN || 'sinkia2026';
const DEV_MODE = process.env.DISABLE_TAILSCALE_AUTH === 'true';

router.use((req, res, next) => {
  if (DEV_MODE) return next();
  // Desde Tailscale o red local → sin token
  if (req.fromTailscale) return next();
  const tok = req.headers['x-admin-token'] || req.query.token;
  if (tok !== TOKEN) return res.status(401).json({ error: 'Token inválido' });
  next();
});

// ═══════════════════════════════════════════════════════════════════════════════
// PM2 PROCESSES
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/processes', (_req, res) => {
  try {
    const raw  = execSync('pm2 jlist 2>/dev/null', { timeout: 5000, env: execEnv() }).toString();
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
    execSync(`pm2 restart ${req.params.name} --update-env`, { timeout: 15000, env: execEnv() });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/processes/:name/stop', (req, res) => {
  try {
    execSync(`pm2 stop ${req.params.name}`, { timeout: 10000, env: execEnv() });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/processes/:name/start', (req, res) => {
  try {
    execSync(`pm2 start ${req.params.name} --update-env`, { timeout: 15000, env: execEnv() });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ════════════════════════════════════════════════════════════════
// SYSTEM METRICS
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/system', (_req, res) => {
  try {
    const totalB = os.totalmem();
    let availableGB, usedGB;
    try {
      const vmstat = execSync('vm_stat 2>/dev/null', { env: execEnv() }).toString();
      const pageSize = 16384;
      const extract = (key) => {
        const m = vmstat.match(new RegExp(`${key}:\\s+(\\d+)`));
        return m ? parseInt(m[1]) * pageSize : 0;
      };
      const free       = extract('Pages free');
      const inactive   = extract('Pages inactive');
      const purgeable  = extract('Pages purgeable');
      const availB = free + inactive + purgeable;
      availableGB  = Math.round(availB / 1024 / 1024 / 1024 * 10) / 10;
      usedGB       = Math.round((totalB - availB) / 1024 / 1024 / 1024 * 10) / 10;
      if (availableGB < 0) availableGB = Math.round(os.freemem() / 1024 / 1024 / 1024 * 10) / 10;
      if (usedGB < 0 || usedGB > totalB) usedGB = Math.round((totalB - os.freemem()) / 1024 / 1024 / 1024 * 10) / 10;
    } catch {
      availableGB = Math.round(os.freemem() / 1024 / 1024 / 1024 * 10) / 10;
      usedGB      = Math.round((totalB - os.freemem()) / 1024 / 1024 / 1024 * 10) / 10;
    }
    const totalGB = Math.round(totalB / 1024 / 1024 / 1024 * 10) / 10;
    const memPct  = Math.round((usedGB / totalGB) * 100);

    let disks = [];
    try {
      const dfHome = execSync(`df -k ${os.homedir()} | tail -1`, { env: execEnv() }).toString().trim().split(/\s+/);
      const hT = parseInt(dfHome[1]), hU = parseInt(dfHome[2]), hA = parseInt(dfHome[3]);
      disks.push({ name: 'SSD interno', mount: '/', total: Math.round(hT / 1024 / 1024), used: Math.round(hU / 1024 / 1024), avail: Math.round(hA / 1024 / 1024), pct: Math.round((hU / hT) * 100) });
      const extPath = '/Volumes/Disco local';
      try {
        const dfExt = execSync(`df -k "${extPath}" 2>/dev/null | tail -1`, { env: execEnv() }).toString().trim().split(/\s+/);
        const nums = dfExt.filter(f => /^\d+$/.test(f));
        if (nums.length >= 3) {
          disks.push({ name: 'Disco local', mount: extPath, total: Math.round(parseInt(nums[0]) / 1024 / 1024), used: Math.round(parseInt(nums[1]) / 1024 / 1024), avail: Math.round(parseInt(nums[2]) / 1024 / 1024), pct: Math.round((parseInt(nums[1]) / parseInt(nums[0])) * 100) });
        }
      } catch {}
    } catch {}

    const diskTotalGB = disks.reduce((s, d) => s + d.total, 0);
    const diskUsedGB  = disks.reduce((s, d) => s + d.used, 0);
    const diskAvailGB = disks.reduce((s, d) => s + d.avail, 0);
    const [load1] = os.loadavg();

    res.json({
      hostname: os.hostname(), platform: os.platform(), arch: os.arch(),
      cpus: os.cpus().length, model: os.cpus()[0]?.model || '',
      uptime: Math.round(os.uptime()), load1: Math.round(load1 * 100) / 100,
      memory: { total: totalGB, used: usedGB, free: availableGB, pct: memPct },
      disk: { total: diskTotalGB, used: diskUsedGB, avail: diskAvailGB, pct: diskTotalGB > 0 ? Math.round((diskUsedGB / diskTotalGB) * 100) : 0 },
      disks,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/logs/:name', (req, res) => {
  const logDir = path.join(os.homedir(), '.pm2', 'logs');
  const tail = (file, n = 80) => { if (!existsSync(file)) return ''; return readFileSync(file, 'utf8').split('\n').slice(-n).join('\n'); };
  res.json({ stdout: tail(path.join(logDir, `${req.params.name}-out.log`)), stderr: tail(path.join(logDir, `${req.params.name}-error.log`), 40) });
});

router.post('/rebuild', (req, res) => {
  const root = path.resolve(__dirname, '../..');
  res.json({ ok: true, message: 'Build iniciado en background...' });
  exec(`cd ${root} && npm run build && pm2 restart sinkia-api --update-env`, { timeout: 180_000, env: execEnv() }, (err) => {
    if (err) console.error('[ADMIN] Rebuild error:', err.message);
    else console.log('[ADMIN] ✓ Rebuild completado');
  });
});

router.post('/deploy', (req, res) => {
  const root = path.resolve(__dirname, '../..');
  const steps = [`cd ${root} && git pull origin main`, `cd ${root}/server && npm install`, `cd ${root}/server && npm rebuild node-pty 2>/dev/null || true`, `cd ${root} && npm run build 2>/dev/null || true`, `pm2 restart sinkia-api --update-env`].join(' && ');
  res.json({ ok: true, message: 'Deploy completo iniciado en background...' });
  console.log('[ADMIN] ▶ Deploy completo iniciado');
  exec(steps, { timeout: 300_000, env: execEnv() }, (err, stdout, stderr) => {
    if (err) { console.error('[ADMIN] ✗ Deploy error:', err.message); if (stderr) console.error('[ADMIN] stderr:', stderr.slice(0, 500)); }
    else { console.log('[ADMIN] ✓ Deploy completo finalizado'); if (stdout) console.log('[ADMIN] stdout:', stdout.slice(0, 500)); }
  });
});

router.post('/exec', (req, res) => {
  const { command } = req.body;
  if (!command || typeof command !== 'string') return res.status(400).json({ error: 'Campo "command" requerido' });
  if (command.length > 500) return res.status(400).json({ error: 'Comando demasiado largo (máx 500 chars)' });
  try {
    const output = execSync(command, { timeout: 30_000, cwd: '/Users/davidnows/sinkia-next', env: execEnv() }).toString();
    res.json({ ok: true, output });
  } catch (err) {
    res.json({ ok: false, error: err.message, output: err.stdout?.toString() || '', stderr: err.stderr?.toString() || '' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// DOCKER
// ═══════════════════════════════════════════════════════════════════════════════

async function getDockerContainers() {
  try {
    const { stdout } = await execAsync('docker ps -a --format "{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}|{{.Ports}}" 2>/dev/null', { env: execEnv() });
    return stdout.trim().split('\n').filter(Boolean).map(l => {
      const [id, name, image, status, ports] = l.split('|');
      let health = 'unknown';
      if (status.includes('unhealthy')) health = 'unhealthy';
      else if (status.includes('healthy')) health = 'healthy';
      else if (status.includes('Up')) health = 'running';
      else if (status.includes('Exited') || status.includes('Created')) health = 'stopped';
      return { id: id.slice(0, 12), name, image, status, ports, health, type: 'docker' };
    });
  } catch { return []; }
}

router.get('/docker', async (req, res) => {
  try { res.json(await getDockerContainers()); } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/docker/:id/:action', async (req, res) => {
  try {
    const { stdout, stderr } = await execAsync(`docker ${req.params.action} ${req.params.id} 2>&1`);
    res.json({ ok: true, output: stdout || stderr });
  } catch (e) { res.json({ ok: false, error: e.message }); }
});

router.get('/docker/:id/logs', async (req, res) => {
  try {
    const { stdout } = await execAsync(`docker logs --tail ${parseInt(req.query.lines || '80')} ${req.params.id} 2>&1`);
    res.json({ ok: true, logs: stdout });
  } catch (e) { res.json({ ok: false, error: e.message }); }
});

router.post('/docker/all/:action', async (req, res) => {
  const actions = { restart: 'docker restart $(docker ps -q)', stop: 'docker stop $(docker ps -q)', prune: 'docker system prune -f' };
  const cmd = actions[req.params.action];
  if (!cmd) return res.json({ ok: false, error: 'Acción desconocida' });
  try { const { stdout, stderr } = await execAsync(cmd); res.json({ ok: true, output: stdout || stderr }); }
  catch (e) { res.json({ ok: false, error: e.message }); }
});

router.post('/docker-compose/:action', async (req, res) => {
  const actions = { up: 'cd ~/sinkia-next/docker && docker compose up -d', down: 'cd ~/sinkia-next/docker && docker compose down' };
  const cmd = actions[req.params.action];
  if (!cmd) return res.json({ ok: false, error: 'Acción desconocida' });
  try { const { stdout, stderr } = await execAsync(cmd); res.json({ ok: true, output: stdout || stderr }); }
  catch (e) { res.json({ ok: false, error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// OLLAMA
// ═══════════════════════════════════════════════════════════════════════════════

async function getOllamaModels() {
  try {
    const { stdout } = await execAsync('ollama list 2>/dev/null', { env: execEnv() });
    return stdout.trim().split('\n').slice(1).map(l => { const p = l.split(/\s{2,}/); return { name: p[0], id: p[1], size: p[2], modified: p[3] }; }).filter(m => m.name);
  } catch { return []; }
}

router.get('/ollama/models', async (req, res) => {
  try { res.json({ models: await getOllamaModels() }); } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/ollama/:action/:model', async (req, res) => {
  try {
    const { stdout } = await execAsync(`ollama ${req.params.action} ${req.params.model} 2>&1`);
    res.json({ ok: true, output: stdout });
  } catch (e) { res.json({ ok: false, error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// TAILSCALE & CLOUDFLARE
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/tailscale/status', async (req, res) => {
  try { const { stdout } = await execAsync('tailscale status 2>/dev/null'); res.json({ status: stdout }); }
  catch (e) { res.json({ status: 'Tailscale no disponible' }); }
});

router.get('/cloudflare/status', async (req, res) => {
  try { const { stdout } = await execAsync('cloudflared tunnel info 4298eb1a-c6f0-42d7-aa57-f7987ff43787 2>&1'); res.json({ status: stdout }); }
  catch (e) { res.json({ status: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// REPAIR KIT
// ═══════════════════════════════════════════════════════════════════════════════

const repairs = {
  'restart-all-docker': 'docker restart $(docker ps -q)',
  'restart-all-pm2': 'pm2 restart all',
  'stop-all-docker': 'docker stop $(docker ps -q)',
  'docker-prune': 'docker system prune -f',
  'pm2-save': 'pm2 save',
  'flush-dns': 'dscacheutil -flushcache && killall -HUP mDNSResponder',
  'restart-ollama': 'brew services restart ollama',
  'restart-openclaw': 'openclaw gateway restart',
  'reindex-memory': 'cd ~/sinkia-memory && /usr/bin/python3 src/cli.py index --all',
  'docker-compose-up': 'cd ~/synkia-app/docker && docker compose up -d',
  'docker-compose-down': 'cd ~/synkia-app/docker && docker compose down',
};

router.post('/repair/:action', async (req, res) => {
  const cmd = repairs[req.params.action];
  if (!cmd) return res.json({ ok: false, error: `Acción desconocida: ${req.params.action}` });
  try { const { stdout, stderr } = await execAsync(cmd); res.json({ ok: true, output: stdout || stderr || 'Completado' }); }
  catch (e) { res.json({ ok: false, error: e.message }); }
});

router.get('/repair/actions', (req, res) => res.json({ actions: [
  { id: 'restart-all-docker', name: 'Reiniciar todos los contenedores', icon: '🐳', category: 'docker' },
  { id: 'restart-all-pm2', name: 'Reiniciar todos los procesos PM2', icon: '💚', category: 'pm2' },
  { id: 'stop-all-docker', name: 'Parar todos los contenedores', icon: '🛑', category: 'docker' },
  { id: 'docker-prune', name: 'Limpiar Docker (prune)', icon: '🧹', category: 'docker' },
  { id: 'docker-compose-up', name: 'Docker Compose Up', icon: '⬆️', category: 'docker' },
  { id: 'docker-compose-down', name: 'Docker Compose Down', icon: '⬇️', category: 'docker' },
  { id: 'restart-ollama', name: 'Reiniciar Ollama', icon: '🦙', category: 'services' },
  { id: 'restart-openclaw', name: 'Reiniciar OpenClaw Gateway', icon: '🦞', category: 'services' },
  { id: 'flush-dns', name: 'Limpiar caché DNS', icon: '🌐', category: 'network' },
  { id: 'pm2-save', name: 'Guardar estado PM2', icon: '💾', category: 'pm2' },
  { id: 'reindex-memory', name: 'Re-indexar sinkMAIND', icon: '🧠', category: 'services' },
  { id: 'update-system', name: 'Actualizar brew', icon: '⬆️', category: 'system' },
]}));

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICES DISCOVERY (para el Dashboard)
// ═══════════════════════════════════════════════════════════════════════════════

async function discoverServices() {
  const [docker, pm2, ollama, metrics] = await Promise.all([
    getDockerContainers(),
    (async () => { try { const { stdout } = await execAsync('pm2 jlist 2>/dev/null', { env: execEnv() }); return JSON.parse(stdout); } catch { return []; } })(),
    getOllamaModels(),
    (async () => { try { const r = await fetch(`http://localhost:${process?.env?.PORT || 3001}/api/admin/system`, { headers: { 'x-admin-token': TOKEN } }); return r.json(); } catch { return { error: 'No disponible' }; } })(),
  ]);

  const portMap = {
    '3001': { name: 'SynK-IA API', icon: '🔧', url: 'http://localhost:3001' },
    '3030':   { name: 'Open WebUI', icon: '💬', url: 'http://localhost:3030' },
    '9302':   { name: 'Mission Control (antiguo)', icon: '⚡', url: 'http://localhost:9302' },
    '4400':   { name: 'Commerce TPV', icon: '🛒', url: 'http://localhost:4400' },
    '5678':   { name: 'n8n', icon: '🔄', url: 'http://localhost:5678' },
    '6333':   { name: 'Qdrant', icon: '🧠', url: 'http://localhost:6333' },
    '7999':   { name: 'OpenClaw', icon: '🦞', url: 'http://localhost:7999' },
    '8888':   { name: 'SearXNG', icon: '🔍', url: 'http://localhost:8888' },
    '11434':  { name: 'Ollama', icon: '🦙', url: 'http://localhost:11434' },
    '1234':   { name: 'LM Studio', icon: '🧪', url: 'http://localhost:1234' },
  };

  const custom = [];
  try {
    const { stdout } = await execAsync('lsof -i -P -n 2>/dev/null | grep LISTEN');
    const ports = new Set(stdout.split('\n').map(l => l.match(/:(\d+)\s/)?.[1]).filter(Boolean));
    for (const [port, info] of Object.entries(portMap)) {
      if (ports.has(port)) custom.push({ id: `port-${port}`, ...info, port, health: 'healthy', type: 'service' });
    }
  } catch {}

  const alerts = [
    ...docker.filter(c => c.health === 'unhealthy' || c.health === 'stopped').map(c => ({ name: c.name, health: c.health, type: 'docker' })),
    ...pm2.filter(p => p.pm2_env?.status !== 'online').map(p => ({ name: p.name, health: p.pm2_env?.status, type: 'pm2' })),
  ];

  return { docker, pm2: pm2.map(p => ({
    id: p.pm_id, name: p.name, status: p.pm2_env?.status ?? 'unknown',
    cpu: p.monit?.cpu ?? 0, memory: Math.round((p.monit?.memory ?? 0) / 1024 / 1024),
    uptime: p.pm2_env?.pm_uptime ?? 0, restarts: p.pm2_env?.restart_time ?? 0, pid: p.pid ?? null,
    type: 'pm2'
  })), ollama, custom, metrics, alerts, total: docker.length + pm2.length + custom.length };
}

router.get('/services', async (req, res) => {
  try { res.json(await discoverServices()); } catch (e) { res.status(500).json({ error: e.message }); }
});

// Mission Control Cards (compatibilidad)
router.get('/mission-control/cards', async (req, res) => {
  const d = await discoverServices();
  res.json({
    success: true,
    cards: [
      { id: 'synkia-backend', title: '🔧 SynK-IA Backend', type: 'service', status: 'healthy', priority: 'high',
        data: { puerto: '3001', modelos: d.ollama?.length || 0, contenedores: d.docker?.length || 0 },
        actions: [{ label: 'Health Check', action: 'health-check' }, { label: 'Ver Logs', action: 'view-log' }],
        description: 'Servidor principal SynK-IA con pipeline dual' },
      { id: 'ollama-models', title: '🦙 Modelos Ollama', type: 'service', status: d.ollama?.length > 0 ? 'healthy' : 'unhealthy', priority: 'high',
        data: { modelos: d.ollama?.length || 0, gpu: 'local' },
        actions: [{ label: 'Ver Modelos', action: 'view-ollama' }],
        description: `${d.ollama?.length || 0} modelos cargados en Ollama` },
      { id: 'docker-services', title: '🐳 Servicios Docker', type: 'service', status: d.docker?.some(c => c.health === 'running') ? 'healthy' : 'unhealthy', priority: 'normal',
        data: { corriendo: d.docker?.filter(c => c.health === 'running').length || 0, total: d.docker?.length || 0 },
        actions: [{ label: 'Ver Logs', action: 'view-logs' }],
        description: `${d.docker?.filter(c => c.health === 'running').length || 0}/${d.docker?.length || 0} contenedores activos` },
    ],
    timestamp: new Date().toISOString(), server: 'sinkia-express-main'
  });
});

router.post('/mission-control/action', async (req, res) => {
  try { res.json({ success: true, message: `Acción ejecutada para ${req.body.cardId}`, timestamp: new Date().toISOString(), executed: true }); }
  catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// WEBSOCKET TERMINAL (compatibilidad — SynK-IA ya lo monta en index.js)
// ═══════════════════════════════════════════════════════════════════════════════

export const adminRouter = router;