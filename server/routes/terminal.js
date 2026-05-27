/**
 * terminal.js — Terminal WebSocket para Claude Code CLI via node-pty
 *
 * WebSocket: /terminal/ws?token=ADMIN_TOKEN
 * Spawns: Claude Code CLI dentro de zsh
 *
 * Si node-pty falla (posix_spawnp), cae a child_process como fallback.
 */
import { WebSocketServer }              from 'ws';
import { spawn, execFileSync, execSync } from 'child_process';
import { createRequire }                 from 'module';

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'sinkia2026';
const HOME_DIR    = process.env.HOME || process.env.USERPROFILE || '/app';

const EXTRA_PATH = [
  `${HOME_DIR}/.npm-global/bin`,
  `${HOME_DIR}/.local/bin`,
  '/opt/homebrew/bin',
  '/opt/homebrew/sbin',
  '/usr/local/bin',
  '/usr/local/sbin',
  '/usr/bin',
  '/bin',
  '/usr/sbin',
  '/sbin',
].join(':');

// ── Intentar cargar node-pty ─────────────────────────────────────────────────
let pty = null;
try {
  const require = createRequire(import.meta.url);
  pty = require('node-pty');
  const test = pty.spawn('/bin/echo', ['ok'], { cols: 10, rows: 5 });
  test.kill();
  console.log('[TERMINAL] ✓ node-pty disponible');
} catch (err) {
  pty = null;
  console.warn(`[TERMINAL] ⚠ node-pty no disponible (${err.message}), usando child_process`);
}

// ── Resolver ruta de Claude ──────────────────────────────────────────────────
function findClaude() {
  const searchEnv = { ...process.env, PATH: EXTRA_PATH + ':' + (process.env.PATH || '') };

  try {
    const p = execFileSync('which', ['claude'], { env: searchEnv, timeout: 4000 })
      .toString().trim();
    if (p) { console.log('[TERMINAL] claude encontrado en:', p); return p; }
  } catch {}

  try {
    const p = execSync(
      `find ${HOME_DIR}/.nvm/versions/node -maxdepth 3 -name "claude" -type f 2>/dev/null | head -1`,
      { timeout: 6000 }
    ).toString().trim();
    if (p) { console.log('[TERMINAL] claude (nvm) encontrado en:', p); return p; }
  } catch {}

  try {
    const prefix = execFileSync('npm', ['config', 'get', 'prefix'],
      { env: searchEnv, timeout: 4000 }).toString().trim();
    const p = `${prefix}/bin/claude`;
    console.log('[TERMINAL] claude (npm prefix) en:', p);
    return p;
  } catch {}

  console.warn('[TERMINAL] ⚠ No se pudo resolver ruta de claude, usando nombre directo');
  return 'claude';
}

const CLAUDE_BIN = findClaude();

// ── Construir env para Claude ────────────────────────────────────────────────
function buildClaudeEnv() {
  const env = { ...process.env };
  delete env.ANTHROPIC_API_KEY;
  env.ANTHROPIC_AUTH_TOKEN = 'ollama';
  env.ANTHROPIC_BASE_URL   = process.env.OLLAMA_URL || 'http://localhost:11434';
  env.HOME  = HOME_DIR;
  env.TERM  = 'xterm-256color';
  env.LANG  = 'en_US.UTF-8';
  env.PATH  = EXTRA_PATH + ':' + (process.env.PATH || '');
  return env;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODO PTY
// ═══════════════════════════════════════════════════════════════════════════════

function createPtySession(ws) {
  const env = buildClaudeEnv();

  const shell = pty.spawn('/bin/zsh', ['-c', `exec "${CLAUDE_BIN}"`], {
    name: 'xterm-256color',
    cols: 220,
    rows: 50,
    cwd:  HOME_DIR + '/sinkia',
    env,
  });

  shell.onData((data) => {
    try { if (ws.readyState === 1) ws.send(data); } catch {}
  });

  shell.onExit(({ exitCode }) => {
    try {
      ws.send(`\r\n\x1b[33m[Terminal cerrada — código ${exitCode}]\x1b[0m\r\n`);
      ws.close();
    } catch {}
  });

  ws.on('message', (msg) => {
    try {
      const str = msg.toString();
      if (str.startsWith('{')) {
        const obj = JSON.parse(str);
        if (obj.type === 'resize' && obj.cols > 0 && obj.rows > 0) {
          shell.resize(Math.max(10, obj.cols), Math.max(5, obj.rows));
          return;
        }
      }
      shell.write(str);
    } catch {
      try { shell.write(msg.toString()); } catch {}
    }
  });

  const cleanup = () => { try { shell.kill(); } catch {} };
  ws.on('close', cleanup);
  ws.on('error', cleanup);

  console.log('[TERMINAL] Nueva sesión PTY → Claude');
  return true;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODO FALLBACK — child_process.spawn
// ═══════════════════════════════════════════════════════════════════════════════

function createFallbackSession(ws) {
  const env = buildClaudeEnv();
  env.TERM = 'dumb';

  const proc = spawn('/bin/zsh', ['-c', `"${CLAUDE_BIN}"`], {
    cwd:   HOME_DIR + '/sinkia',
    env,
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: true,
  });

  ws.send('\x1b[32m[SynkIA Terminal]\x1b[0m Conectado a Claude (modo compatibilidad)\r\n');

  proc.stdout.on('data', (data) => {
    try { if (ws.readyState === 1) ws.send(data.toString().replace(/\n/g, '\r\n')); } catch {}
  });

  proc.stderr.on('data', (data) => {
    try { if (ws.readyState === 1) ws.send(data.toString().replace(/\n/g, '\r\n')); } catch {}
  });

  proc.on('exit', (code) => {
    try {
      ws.send(`\r\n\x1b[33m[Claude cerrado — código ${code}]\x1b[0m\r\n`);
      ws.close();
    } catch {}
  });

  proc.on('error', (err) => {
    try {
      ws.send(`\r\n\x1b[31m[ERROR] ${err.message}\x1b[0m\r\n`);
      ws.close();
    } catch {}
  });

  ws.on('message', (msg) => {
    try {
      const str = msg.toString();
      if (str.startsWith('{')) {
        try {
          const obj = JSON.parse(str);
          if (obj.type === 'resize') return;
        } catch {}
      }
      proc.stdin.write(str);
    } catch {}
  });

  const cleanup = () => {
    try { proc.stdin.end(); } catch {}
    try { proc.kill('SIGTERM'); } catch {}
    setTimeout(() => { try { proc.kill('SIGKILL'); } catch {} }, 2000);
  };
  ws.on('close', cleanup);
  ws.on('error', cleanup);

  console.log('[TERMINAL] Nueva sesión fallback → Claude');
  return true;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SETUP
// ═══════════════════════════════════════════════════════════════════════════════

export function setupTerminal(httpServer) {
  const wss = new WebSocketServer({ noServer: true });

  wss.handleUpgradeRequest = (req, socket, head) => {
    const token = new URL(req.url, 'http://localhost').searchParams.get('token');
    if (token !== ADMIN_TOKEN) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  };

  wss.on('connection', (ws) => {
    if (pty) {
      try {
        createPtySession(ws);
        return;
      } catch (err) {
        ws.send(`\x1b[33m[WARN] PTY falló (${err.message}), usando fallback...\x1b[0m\r\n`);
      }
    }

    try {
      createFallbackSession(ws);
    } catch (err) {
      ws.send(`\r\n\x1b[31m[ERROR] No se pudo iniciar: ${err.message}\x1b[0m\r\n`);
      ws.close();
    }
  });

  console.log(`[SERVER] ✓ Terminal WebSocket: /terminal/ws ${pty ? '(PTY)' : '(fallback)'}`);
  return wss;
}
