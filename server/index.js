import express            from 'express';
import cors               from 'cors';
import dotenv             from 'dotenv';
import path               from 'path';
import { fileURLToPath }  from 'url';
import { existsSync }     from 'fs';
import { emailRouter }       from './routes/email.js';
import { biloopRouter }      from './routes/biloop.js';
import { biloopPortalRouter } from './routes/biloop-portal.js';
import { revoRouter }        from './routes/revo.js';
import { healthRouter }      from './routes/health.js';
import { filesRouter }       from './routes/files.js';
import { adminRouter }       from './routes/admin.js';
import { claudeProxyRouter } from './routes/claude-proxy.js';
import { chatRouter }        from './routes/chat.js';
import { getFileTree, readFiles, searchFiles } from './services/fileContext.js';
import { setupTerminal }      from './routes/terminal.js';
import { setupOpenClawProxy } from './routes/openclaw-proxy.js';
import { setupShellTerminal }  from './routes/shell-terminal.js';
import documentsRouter        from './routes/documents.js';
import trabajadoresRouter     from './routes/trabajadores.js';
import { authRouter }         from './routes/auth.js';
import { filebrainRouter }    from './routes/filebrain.js';
import { syncAll }            from './services/dataSync.js';
import filemanagerRouter      from './routes/filemanager.js';

// Cargar .env desde server/ (donde realmente está el archivo)
const __dirnameRoot = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirnameRoot, '.env') });

const app  = express();
const PORT = process.env.PORT || 3001;

// ── CORS ─────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:5173')
  .split(',').map(o => o.trim());

// Mantiene compatibilidad con el origen hardcodeado anterior
if (!ALLOWED_ORIGINS.includes('https://sinkialabs.com')) {
  ALLOWED_ORIGINS.push('https://sinkialabs.com', 'http://sinkialabs.com');
}
// www variant (Cloudflare tunnel serves both)
if (!ALLOWED_ORIGINS.includes('https://www.sinkialabs.com')) {
  ALLOWED_ORIGINS.push('https://www.sinkialabs.com', 'http://www.sinkialabs.com');
}

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error(`CORS bloqueado: ${origin}`));
  },
  credentials: true,
}));

// ── Body parsers ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ── Logger (dev) ──────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'production') {
  app.use((req, _res, next) => {
    const ts = new Date().toISOString().slice(11, 19);
    console.log(`[${ts}] ${req.method} ${req.path}`);
    next();
  });
}

// ── Auth (JWT) ────────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/filebrain', filebrainRouter);


// ── Proxy: SINKIA Commerce (Mac Mini) ─────────────────────────────────────
const COMMERCE_URL = process.env.COMMERCE_URL || 'http://100.78.4.14:4400';

// Proxy imágenes de Commerce
app.use('/api/commerce/images', async (req, res) => {
  try {
    const targetUrl = COMMERCE_URL + '/images' + req.url;
    const upstream = await fetch(targetUrl, { signal: AbortSignal.timeout(8000) });
    if (!upstream.ok) return res.status(upstream.status).end();
    const contentType = upstream.headers.get('content-type');
    if (contentType) res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=604800');
    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.send(buffer);
  } catch {
    res.status(502).end();
  }
});

// Proxy API Commerce
app.use('/api/commerce', async (req, res) => {
  try {
    const targetUrl = COMMERCE_URL + '/api' + req.url;
    const opts = {
      method: req.method,
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(8000),
    };
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      opts.body = JSON.stringify(req.body);
    }
    const upstream = await fetch(targetUrl, opts);
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err) {
    res.status(502).json({ success: false, error: 'Commerce service unavailable' });
  }
});

// ── Proxies: Stack IA local (Docker) ─────────────────────────────────────────
// Permiten acceder a los servicios local desde fuera del Mac (via tunnel o red)

// Open WebUI (puerto 3030)
app.use('/webui', async (req, res) => {
  try {
    const targetUrl = `http://localhost:3030${req.url}`;
    const opts = {
      method: req.method,
      headers: req.headers,
      signal: AbortSignal.timeout(15000),
    };
    // No re-enviar headers HTTP/2 específicos
    delete opts.headers['host'];
    delete opts.headers['connection'];
    
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      // Para métodos POST, PUT, etc.
      const chunks = [];
      req.on('data', chunk => chunks.push(chunk));
      req.on('end', async () => {
        if (chunks.length) opts.body = Buffer.concat(chunks);
        const upstream = await fetch(targetUrl, opts);
        res.status(upstream.status);
        upstream.headers.forEach((val, key) => {
          if (key !== 'content-length') res.setHeader(key, val);
        });
        const buffer = Buffer.from(await upstream.arrayBuffer());
        res.send(buffer);
      });
    } else {
      const upstream = await fetch(targetUrl, opts);
      res.status(upstream.status);
      upstream.headers.forEach((val, key) => {
        if (key !== 'content-length') res.setHeader(key, val);
      });
      const buffer = Buffer.from(await upstream.arrayBuffer());
      res.send(buffer);
    }
  } catch (err) {
    res.status(502).json({ success: false, error: 'WebUI service unavailable', details: err.message });
  }
});

// n8n (puerto 5678)
app.use('/n8n', async (req, res) => {
  try {
    const targetUrl = `http://localhost:5678${req.url}`;
    const opts = {
      method: req.method,
      headers: req.headers,
      signal: AbortSignal.timeout(15000),
    };
    delete opts.headers['host'];
    delete opts.headers['connection'];
    
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const chunks = [];
      req.on('data', chunk => chunks.push(chunk));
      req.on('end', async () => {
        if (chunks.length) opts.body = Buffer.concat(chunks);
        const upstream = await fetch(targetUrl, opts);
        res.status(upstream.status);
        upstream.headers.forEach((val, key) => {
          if (key !== 'content-length') res.setHeader(key, val);
        });
        const buffer = Buffer.from(await upstream.arrayBuffer());
        res.send(buffer);
      });
    } else {
      const upstream = await fetch(targetUrl, opts);
      res.status(upstream.status);
      upstream.headers.forEach((val, key) => {
        if (key !== 'content-length') res.setHeader(key, val);
      });
      const buffer = Buffer.from(await upstream.arrayBuffer());
      res.send(buffer);
    }
  } catch (err) {
    res.status(502).json({ success: false, error: 'n8n service unavailable', details: err.message });
  }
});

// SearXNG (puerto 8888)
app.use('/searxng', async (req, res) => {
  try {
    const targetUrl = `http://localhost:8888${req.url}`;
    const opts = {
      method: req.method,
      headers: req.headers,
      signal: AbortSignal.timeout(15000),
    };
    delete opts.headers['host'];
    delete opts.headers['connection'];
    
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const chunks = [];
      req.on('data', chunk => chunks.push(chunk));
      req.on('end', async () => {
        if (chunks.length) opts.body = Buffer.concat(chunks);
        const upstream = await fetch(targetUrl, opts);
        res.status(upstream.status);
        upstream.headers.forEach((val, key) => {
          if (key !== 'content-length') res.setHeader(key, val);
        });
        const buffer = Buffer.from(await upstream.arrayBuffer());
        res.send(buffer);
      });
    } else {
      const upstream = await fetch(targetUrl, opts);
      res.status(upstream.status);
      upstream.headers.forEach((val, key) => {
        if (key !== 'content-length') res.setHeader(key, val);
      });
      const buffer = Buffer.from(await upstream.arrayBuffer());
      res.send(buffer);
    }
  } catch (err) {
    res.status(502).json({ success: false, error: 'SearXNG service unavailable', details: err.message });
  }
});

// Qdrant (puerto 6333)
app.use('/qdrant', async (req, res) => {
  try {
    const targetUrl = `http://localhost:6333${req.url}`;
    const opts = {
      method: req.method,
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(15000),
    };
    
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      opts.body = JSON.stringify(req.body);
    }
    const upstream = await fetch(targetUrl, opts);
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err) {
    res.status(502).json({ success: false, error: 'Qdrant service unavailable', details: err.message });
  }
});

console.log('[SERVER] ✓ AI Stack proxies: /webui, /n8n, /searxng, /qdrant');


// ── Rutas de negocio ──────────────────────────────────────────────────────────
app.use('/api/email',  emailRouter);
app.use('/api/biloop', biloopRouter);
app.use('/api/biloop', biloopPortalRouter);
app.use('/api/revo',   revoRouter);
app.use('/api/health', healthRouter);
app.use('/api/files',  filesRouter);
app.use('/api/admin',     adminRouter);
app.use('/api/documents',    documentsRouter);
app.use('/api/trabajadores', trabajadoresRouter);
app.use('/api/filemanager',  filemanagerRouter);
app.use('/claude',     claudeProxyRouter);  // Proxy local para Claude Code
app.use('/api/chat',   chatRouter);          // Chat IA local

// ── API de archivos compartida (todos los chats) ───────────────────────────
app.get('/api/files/tree', async (_req, res) => {
  try { res.json({ ok: true, tree: await getFileTree() }); }
  catch (e) { res.json({ ok: false, error: e.message, tree: [] }); }
});
app.get('/api/files/search', async (req, res) => {
  const q = req.query.q;
  if (!q) return res.json({ ok: true, results: [] });
  res.json({ ok: true, results: await searchFiles(q) });
});
app.post('/api/files/read', express.json(), async (req, res) => {
  const files = await readFiles(req.body.paths || []);
  res.json({ ok: true, files });
});
console.log('[SERVER] ✓ File Context API: /api/files/{tree,search,read}');

// ── Aiden (control de agentes OpenClaw) ──────────────────────────────────────
try {
  const { aidenRouter } = await import('./routes/aiden.js');
  app.use('/api/aiden', aidenRouter);
  console.log('[SERVER] ✓ Aiden: /api/aiden (control de agentes OpenClaw)');
} catch (e) {
  console.error('[SERVER] ✗ Aiden falló al cargar:', e.message);
}

// ── Aider (Claude Code coding assistant) ─────────────────────────────────────
try {
  const { aiderRouter } = await import('./routes/aider.js');
  app.use('/api/aider', aiderRouter);
  console.log(`[SERVER] ✓ Aider: /api/aider (modelo: ${process.env.AIDER_MODEL || 'ollama/qwen3.5'})`);
} catch (e) {
  console.error('[SERVER] ✗ Aider falló al cargar:', e.message);
}

// ── Data API (generic CRUD) ──────────────────────────────────────────────────
try {
  const { dataRouter } = await import('./routes/data.js');
  app.use('/api/data', dataRouter);
  console.log('[SERVER] Data API registrado');
} catch (e) {
  console.error('[SERVER] Data API fallo:', e.message);
}

// ── AI Engine (Ollama) ────────────────────────────────────────────────────────
// /api/ollama → backward compat (el frontend no necesita cambios)
try {
  const { aiRouter } = await import('./routes/ai.js');
  app.use('/api/ollama', aiRouter);
  app.use('/api/ai',     aiRouter);
  console.log(`[SERVER] ✓ AI Engine (Ollama) → ${process.env.OLLAMA_URL || 'http://localhost:11434'} / ${process.env.OLLAMA_CHAT_MODEL || process.env.OLLAMA_MODEL || 'qwen3.5'}`);
} catch (e) {
  console.error('[SERVER] ✗ AI Engine falló al cargar:', e.message);
}

// ── Frontend estático (producción) ─────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath  = path.join(__dirname, '..', 'dist');

// Servir assets estáticos de public/ (logos, SVGs, etc.)
const publicPath = path.join(__dirnameRoot, '..', 'public');
app.use(express.static(publicPath, {
  maxAge: '7d',
  setHeaders: (res, filePath) => {
    // No cachear HTML — cambian frecuentemente
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  },
}));

// Servir admin.html en /admin (fuera del SPA de React)
const adminHtml = path.join(__dirnameRoot, '..', 'public', 'admin.html');
if (existsSync(adminHtml)) {
  app.get('/admin', (_req, res) => res.sendFile(adminHtml));
  console.log('[SERVER] ✓ Admin panel: /admin');
}

const chatHtml = path.join(__dirnameRoot, '..', 'public', 'chat.html');
if (existsSync(chatHtml)) {
  app.get('/chat', (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(chatHtml);
  });
  console.log('[SERVER] ✓ Chat IA: /chat');
}

const terminalHtml = path.join(__dirnameRoot, '..', 'public', 'terminal.html');
if (existsSync(terminalHtml)) {
  app.get('/terminal', (_req, res) => res.sendFile(terminalHtml));
  console.log('[SERVER] ✓ Terminal: /terminal');
}

const documentsHtml = path.join(__dirnameRoot, '..', 'public', 'documents.html');
if (existsSync(documentsHtml)) {
  app.get('/documents', (_req, res) => res.sendFile(documentsHtml));
  console.log('[SERVER] ✓ Documentos: /documents');
}

const trabajadoresHtml = path.join(__dirnameRoot, '..', 'public', 'trabajadores.html');
if (existsSync(trabajadoresHtml)) {
  app.get('/trabajadores', (_req, res) => res.sendFile(trabajadoresHtml));
  console.log('[SERVER] ✓ Portal Trabajadores: /trabajadores');
}

const commerceHtml = path.join(__dirnameRoot, '..', 'public', 'commerce.html');
if (existsSync(commerceHtml)) {
  app.get('/commerce', (_req, res) => res.sendFile(commerceHtml));
  console.log('[SERVER] ✓ Commerce: /commerce');
}

const filemanagerHtml = path.join(__dirnameRoot, '..', 'public', 'filemanager.html');
if (existsSync(filemanagerHtml)) {
  app.get('/filemanager', (_req, res) => res.sendFile(filemanagerHtml));
  console.log('[SERVER] ✓ Explorador de Archivos: /filemanager');
}


if (existsSync(distPath)) {
  app.use(express.static(distPath));
  // SPA fallback — cualquier ruta no-API devuelve index.html
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.path}` });
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
  console.log(`[SERVER] ✓ Frontend estático: ${distPath}`);
} else {
  // ── 404 (sin frontend buildeado) ───────────────────────────────────────────
  app.use((req, res) => {
    res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.path}` });
  });
}

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[ERROR]', err.message);
  res.status(err.status || 500).json({ error: err.message });
});

// ── Arranque ──────────────────────────────────────────────────────────────────
const server = app.listen(PORT, '0.0.0.0', () => {
  // OCR de PDFs escaneados puede tardar 15+ min — desactivar timeouts HTTP
  server.requestTimeout = 0;
  server.headersTimeout = 0;
  server.timeout = 0;
  console.log(`\n[SERVER] ✓ Puerto ${PORT} | ${new Date().toISOString()}`);
  console.log(`[SERVER] CORS: ${ALLOWED_ORIGINS.join(', ')}\n`);

  // ── Sincronización inicial de datos ─────────────────────────────────────────
  try { syncAll(); } catch (e) { console.error('[SYNC] Startup sync error:', e.message); }

  // ── WebSocket handlers ──────────────────────────────────────────────────────
  let terminalWss = null;
  let openclawWss = null;
  let shellWss    = null;

  try { terminalWss = setupTerminal(server); } catch (e) { console.error('[TERMINAL] ✗', e.message); }
  try { openclawWss = setupOpenClawProxy(server); } catch (e) { console.error('[OPENCLAW-PROXY] ✗', e.message); }
  try { shellWss    = setupShellTerminal(server); } catch (e) { console.error('[SHELL-TERMINAL] ✗', e.message); }

  // ── Dispatcher centralizado de WebSocket upgrades ──────────────────────────
  server.on('upgrade', (req, socket, head) => {
    let pathname;
    try { pathname = new URL(req.url, 'http://localhost').pathname; }
    catch { socket.destroy(); return; }

    if (pathname === '/terminal/ws' && terminalWss) {
      terminalWss.handleUpgradeRequest(req, socket, head);
    } else if (pathname === '/ws/openclaw' && openclawWss) {
      openclawWss.handleUpgradeRequest(req, socket, head);
    } else if (pathname === '/ws/shell' && shellWss) {
      shellWss.handleUpgradeRequest(req, socket, head);
    } else {
      socket.destroy();
    }
  });

  import('./syncWorker.js').then(({ startSyncWorker }) => {
    try {
      startSyncWorker();
      console.log('[SYNC-WORKER] ✓ Iniciado');
    } catch (err) {
      console.error('[SYNC-WORKER] ✗', err.message);
    }
  }).catch(err => console.error('[SYNC-WORKER] ✗ No se pudo cargar:', err.message));
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────
async function shutdown(signal) {
  console.log(`\n[SERVER] ${signal} — cerrando...`);
  server.close(() => {
    console.log('[SERVER] ✓ Cerrado limpiamente');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

