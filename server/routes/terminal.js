// ── Terminal WebSocket — spawna Claude Code via node-pty ───────────────────
import { WebSocketServer } from 'ws';
import { createRequire }   from 'module';

const require = createRequire(import.meta.url);
const pty     = require('node-pty');

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'sinkia2026';

// PATH amplio para que node-pty encuentre "claude" independientemente
// de cómo PM2 arranque el proceso
const EXTRA_PATH = [
  '/usr/local/bin',
  '/usr/bin',
  '/bin',
  '/usr/sbin',
  '/sbin',
  '/opt/homebrew/bin',
  '/opt/homebrew/sbin',
].join(':');

export function setupTerminal(httpServer) {
  const wss = new WebSocketServer({ noServer: true });

  // ── Upgrade HTTP → WebSocket ──────────────────────────────────────────────
  httpServer.on('upgrade', (req, socket, head) => {
    let pathname;
    try { pathname = new URL(req.url, 'http://localhost').pathname; }
    catch { socket.destroy(); return; }

    if (pathname !== '/terminal/ws') { socket.destroy(); return; }

    const token = new URL(req.url, 'http://localhost').searchParams.get('token');
    if (token !== ADMIN_TOKEN) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });

  // ── Nueva conexión WebSocket ───────────────────────────────────────────────
  wss.on('connection', (ws) => {
    // Construir env limpio
    const env = { ...process.env };
    delete env.ANTHROPIC_API_KEY;          // eliminar clave real si existiera
    env.ANTHROPIC_AUTH_TOKEN = 'ollama';   // bypass auth → LiteLLM
    env.ANTHROPIC_BASE_URL   = 'http://localhost:8082';
    env.HOME  = '/Users/davidnows';
    env.TERM  = 'xterm-256color';
    env.LANG  = 'en_US.UTF-8';
    env.PATH  = EXTRA_PATH + ':' + (process.env.PATH || '');

    let shell;
    try {
      shell = pty.spawn('claude', [], {
        name: 'xterm-256color',
        cols: 220,
        rows: 50,
        cwd:  '/Users/davidnows/sinkia',
        env,
      });
    } catch (err) {
      ws.send(`\r\n\x1b[31m[ERROR]\x1b[0m No se pudo arrancar Claude Code: ${err.message}\r\n`);
      ws.send('\r\nVerifica que "claude" esté instalado y en el PATH.\r\n');
      ws.close();
      return;
    }

    // PTY → browser
    shell.onData((data) => {
      try { if (ws.readyState === 1) ws.send(data); } catch {}
    });

    shell.onExit(({ exitCode }) => {
      try {
        ws.send(`\r\n\x1b[33m[Terminal cerrada — código ${exitCode}]\x1b[0m\r\n`);
        ws.close();
      } catch {}
    });

    // browser → PTY
    ws.on('message', (msg) => {
      try {
        const str = msg.toString();
        // Mensaje de resize: {"type":"resize","cols":N,"rows":N}
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

    const killShell = () => { try { shell.kill(); } catch {} };
    ws.on('close', killShell);
    ws.on('error', killShell);
  });

  console.log('[SERVER] ✓ Terminal WebSocket: /terminal/ws');
}
