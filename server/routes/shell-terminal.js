/**
 * shell-terminal.js — Terminal web general (zsh) via WebSocket + node-pty
 *
 * WebSocket: /ws/shell?token=ADMIN_TOKEN
 * Spawns: /bin/zsh en ~/sinkia
 *
 * A diferencia de terminal.js (que lanza Claude Code CLI),
 * este lanza un shell general para administrar el Mac Mini.
 */
import { WebSocketServer } from 'ws';
import { createRequire }   from 'module';

const require = createRequire(import.meta.url);
const pty     = require('node-pty');

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'sinkia2026';
const HOME_DIR    = '/Users/davidnows';

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
    const env = {
      ...process.env,
      HOME:  HOME_DIR,
      TERM:  'xterm-256color',
      LANG:  'en_US.UTF-8',
      PATH:  EXTRA_PATH + ':' + (process.env.PATH || ''),
      SHELL: '/bin/zsh',
    };

    let shell;
    try {
      shell = pty.spawn('/bin/zsh', ['--login'], {
        name: 'xterm-256color',
        cols: 120,
        rows: 30,
        cwd:  HOME_DIR + '/sinkia',
        env,
      });
    } catch (err) {
      ws.send(`\r\n\x1b[31m[ERROR]\x1b[0m No se pudo arrancar shell: ${err.message}\r\n`);
      ws.close();
      return;
    }

    // PTY → browser
    shell.onData((data) => {
      try { if (ws.readyState === 1) ws.send(data); } catch {}
    });

    shell.onExit(({ exitCode }) => {
      try {
        ws.send(`\r\n\x1b[33m[Shell cerrada — código ${exitCode}]\x1b[0m\r\n`);
        ws.close();
      } catch {}
    });

    // browser → PTY
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

    const killShell = () => { try { shell.kill(); } catch {} };
    ws.on('close', killShell);
    ws.on('error', killShell);

    console.log('[SHELL-TERMINAL] Nueva sesión de shell');
  });

  console.log('[SERVER] ✓ Shell Terminal WebSocket: /ws/shell');
  return wss;
}
