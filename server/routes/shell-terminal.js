/**
 * shell-terminal.js — Terminal web general (zsh/bash) via WebSocket
 *
 * WebSocket: /ws/shell?token=ADMIN_TOKEN
 *
 * Intenta node-pty primero (mejor experiencia: colores, resize, ctrl+c).
 * Si node-pty falla (posix_spawnp, rebuild necesario), cae a child_process
 * con un wrapper que sigue siendo funcional.
 */
import { WebSocketServer } from 'ws';
import { spawn }           from 'child_process';
import { createRequire }   from 'module';

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

// ── Intentar cargar node-pty (puede fallar si necesita rebuild) ──────────────
let pty = null;
try {
  const require = createRequire(import.meta.url);
  pty = require('node-pty');
  // Test rápido — verificar que spawn funciona
  const test = pty.spawn('/bin/echo', ['ok'], { cols: 10, rows: 5 });
  test.kill();
  console.log('[SHELL-TERMINAL] ✓ node-pty disponible');
} catch (err) {
  pty = null;
  console.warn(`[SHELL-TERMINAL] ⚠ node-pty no disponible (${err.message}), usando child_process fallback`);
}

// ── Detectar shell disponible ────────────────────────────────────────────────
function findShell() {
  const candidates = ['/bin/zsh', '/bin/bash', '/bin/sh'];
  for (const s of candidates) {
    try {
      const { execFileSync } = await_import_sync();
      return s; // En macOS siempre existen
    } catch {}
  }
  return '/bin/sh';
}
function await_import_sync() { return require('child_process'); }

// ═══════════════════════════════════════════════════════════════════════════════
// MODO PTY — experiencia completa con colores, resize, ctrl+c
// ═══════════════════════════════════════════════════════════════════════════════

function createPtySession(ws) {
  const env = {
    ...process.env,
    HOME:  HOME_DIR,
    TERM:  'xterm-256color',
    LANG:  'en_US.UTF-8',
    PATH:  EXTRA_PATH + ':' + (process.env.PATH || ''),
    SHELL: '/bin/zsh',
  };

  const shell = pty.spawn('/bin/zsh', ['--login'], {
    name: 'xterm-256color',
    cols: 120,
    rows: 30,
    cwd:  HOME_DIR + '/sinkia',
    env,
  });

  shell.onData((data) => {
    try { if (ws.readyState === 1) ws.send(data); } catch {}
  });

  shell.onExit(({ exitCode }) => {
    try {
      ws.send(`\r\n\x1b[33m[Shell cerrada — código ${exitCode}]\x1b[0m\r\n`);
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

  console.log('[SHELL-TERMINAL] Nueva sesión PTY');
  return true;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODO FALLBACK — child_process.spawn (sin PTY, pero funcional)
// ═══════════════════════════════════════════════════════════════════════════════

function createFallbackSession(ws) {
  const env = {
    ...process.env,
    HOME:  HOME_DIR,
    TERM:  'dumb',
    LANG:  'en_US.UTF-8',
    PATH:  EXTRA_PATH + ':' + (process.env.PATH || ''),
    SHELL: '/bin/zsh',
    PS1:   '\\u@sinkpro:\\w $ ',   // Prompt visible
  };

  const shell = spawn('/bin/zsh', ['-i'], {
    cwd:   HOME_DIR + '/sinkia',
    env,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  ws.send('\x1b[32m[SynkIA Shell]\x1b[0m Conectado (modo compatibilidad)\r\n');

  shell.stdout.on('data', (data) => {
    try { if (ws.readyState === 1) ws.send(data.toString().replace(/\n/g, '\r\n')); } catch {}
  });

  shell.stderr.on('data', (data) => {
    try { if (ws.readyState === 1) ws.send(`\x1b[31m${data.toString().replace(/\n/g, '\r\n')}\x1b[0m`); } catch {}
  });

  shell.on('exit', (code) => {
    try {
      ws.send(`\r\n\x1b[33m[Shell cerrada — código ${code}]\x1b[0m\r\n`);
      ws.close();
    } catch {}
  });

  shell.on('error', (err) => {
    try {
      ws.send(`\r\n\x1b[31m[ERROR] ${err.message}\x1b[0m\r\n`);
      ws.close();
    } catch {}
  });

  // Buffer para acumular caracteres (el usuario escribe char a char)
  let inputBuffer = '';

  ws.on('message', (msg) => {
    try {
      const str = msg.toString();

      // Ignorar mensajes de resize en modo fallback
      if (str.startsWith('{')) {
        try {
          const obj = JSON.parse(str);
          if (obj.type === 'resize') return;
        } catch {}
      }

      // Enter → enviar línea completa
      if (str === '\r' || str === '\n') {
        shell.stdin.write(inputBuffer + '\n');
        inputBuffer = '';
        ws.send('\r\n');
        return;
      }

      // Backspace
      if (str === '\x7f' || str === '\b') {
        if (inputBuffer.length > 0) {
          inputBuffer = inputBuffer.slice(0, -1);
          ws.send('\b \b');
        }
        return;
      }

      // Ctrl+C
      if (str === '\x03') {
        shell.kill('SIGINT');
        inputBuffer = '';
        ws.send('^C\r\n');
        return;
      }

      // Ctrl+D
      if (str === '\x04') {
        shell.stdin.end();
        return;
      }

      // Tab — no completion en fallback, ignorar
      if (str === '\t') return;

      // Carácter normal — acumular y hacer echo
      inputBuffer += str;
      ws.send(str);
    } catch {}
  });

  const cleanup = () => {
    try { shell.stdin.end(); } catch {}
    try { shell.kill('SIGTERM'); } catch {}
    setTimeout(() => { try { shell.kill('SIGKILL'); } catch {} }, 2000);
  };
  ws.on('close', cleanup);
  ws.on('error', cleanup);

  console.log('[SHELL-TERMINAL] Nueva sesión fallback (child_process)');
  return true;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SETUP — exportar el WebSocket server
// ═══════════════════════════════════════════════════════════════════════════════

export function setupShellTerminal(httpServer) {
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
    // Intentar PTY primero, fallback a child_process
    if (pty) {
      try {
        createPtySession(ws);
        return;
      } catch (err) {
        ws.send(`\x1b[33m[WARN] PTY falló (${err.message}), usando modo compatibilidad...\x1b[0m\r\n`);
      }
    }

    try {
      createFallbackSession(ws);
    } catch (err) {
      ws.send(`\r\n\x1b[31m[ERROR] No se pudo iniciar shell: ${err.message}\x1b[0m\r\n`);
      ws.close();
    }
  });

  console.log(`[SERVER] ✓ Shell Terminal WebSocket: /ws/shell ${pty ? '(PTY)' : '(fallback)'}`);
  return wss;
}
