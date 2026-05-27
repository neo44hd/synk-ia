import express            from 'express';
import dotenv             from 'dotenv';
import path               from 'path';
import { fileURLToPath }  from 'url';
import { existsSync }     from 'fs';
import { emailRouter }       from './routes/email.js';
import { biloopRouter }      from './routes/biloop.js';
import { biloopPortalRouter } from './routes/biloop-portal.js';
// import { revoRouter }        from './routes/revo.js';  // DESACTIVADO — API denegada por Revo
import { healthRouter }      from './routes/health.js';
import { filesRouter }       from './routes/files.js';
import { adminRouter }       from './routes/admin.js';
import { claudeProxyRouter } from './routes/claude-proxy.js';
import { lmstudioProxyRouter } from './lmstudio-proxy.mjs';
import { chatRouter }        from './routes/chat.js';
import { getFileTree, readFiles, searchFiles } from './services/fileContext.js';
import { setupTerminal } from './routes/terminal.js';
import { createHermesWSS, createOpenCodeWSS } from './websocket.js';
import { hermesRouter }     from './routes/hermes.js';
import { opencodeRouter }   from './routes/opencode.js';
import { setupShellTerminal }  from './routes/shell-terminal.js';
import documentsRouter        from './routes/documents.js';
import processingRouter        from './routes/processing.js';
import trabajadoresRouter     from './routes/trabajadores.js';
import { authRouter }         from './routes/auth.js';
import { filebrainRouter }    from './routes/filebrain.js';
import { syncAll }            from './services/dataSync.js';
import filemanagerRouter      from './routes/filemanager.js';
import { orchestratorRouter } from './agents/orchestrator.js';
import { setupAuth } from './middleware/auth.js';
import { setupTelegramRoutes } from './bots/telegram.js';
import { markitdownRouter } from './routes/markitdown.js';
import { systemRouter } from './routes/system.js';
import { accountingRouter } from './agents/accountingAgent.js';
import { legalRouter }       from './agents/legalAgent.js';
import { hrRouter }          from './agents/hrAgent.js';
import { integrationsRouter } from './routes/integrations.js';
import intelligenceRouter      from './routes/intelligence.js';
import { learningRouter }      from './routes/learning.js';
import multer from 'multer';

// Cargar .env desde server/ (donde realmente está el archivo)
const __dirnameRoot = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirnameRoot, '..', '.env'), override: true });

const app  = express();
const PORT = process?.env?.PORT || 3001;

// ── Body parser con límite alto para payloads IA ──────────────────────────────
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ── Rate limiter simple (anti-uptime-checker) ────────────────────────────────
const rateLimit = (() => {
  const hits = new Map();
  const WINDOW = 10000;  // 10s
  const MAX = 15;        // máx 15 peticiones por ventana
  return (req, res, next) => {
    // No limitar localhost ni Tailscale
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('100.64.') || ip.startsWith('192.168.') || ip.startsWith('10.')) {
      return next();
    }
    const now = Date.now();
    let entry = hits.get(ip);
    if (!entry || now - entry.windowStart > WINDOW) {
      entry = { count: 1, windowStart: now };
      hits.set(ip, entry);
    } else {
      entry.count++;
      if (entry.count > MAX) {
        res.setHeader('Retry-After', '10');
        return res.status(429).json({ error: 'Too many requests' });
      }
    }
    next();
  };
})();

app.use(rateLimit);

// ── Multer

// ── Multer (upload de archivos para orquestador) ──────────────────────────────
const upload = multer({
  dest: '/tmp/synkia-uploads/',
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (_req, file, cb) => {
    if (['application/pdf','text/plain','text/csv','application/json',
         'image/png','image/jpeg','image/tiff'].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no soportado'));
    }
  },
});

// ── Auth + Tailscale-only + Body parsers + CORS (auth.js) ──────────────────
setupAuth(app);

// ── Telegram Bot ────────────────────────────────────────────────────────────────
setupTelegramRoutes(app);

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
const COMMERCE_URL = process?.env?.COMMERCE_URL || 'http://100.78.4.14:4400';

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
// app.use('/api/revo',   revoRouter);  // DESACTIVADO
app.use('/api/health', healthRouter);
app.use('/api/files',  filesRouter);
app.use('/api/admin',     adminRouter);
// ── Entities (top-level alias) ───────────────────────────────────────────────
import { getEntities } from './services/documentProcessor.js';
app.get('/api/entities', async (_req, res) => {
  try { res.json(await getEntities()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.use('/api/documents', documentsRouter);
app.use('/api/process', processingRouter);
app.use('/api/trabajadores', trabajadoresRouter);
app.use('/api/filemanager',  filemanagerRouter);
app.use('/api/orchestrator', upload.single('file'), orchestratorRouter);
app.use('/api/accounting', accountingRouter);
app.use('/api/legal',       legalRouter);
app.use('/api/hr',          hrRouter);
app.use('/api/learning',    learningRouter);
app.use('/api/classify', intelligenceRouter); // Clasificación automática
app.use('/api/integrations', integrationsRouter);
app.use('/claude',     claudeProxyRouter);  // Proxy local para Claude Code
app.use('/api/chat',   chatRouter);          // Chat IA local
app.use('/lmstudio',   lmstudioProxyRouter); // Proxy local para LM Studio
app.use('/api/hermes',   hermesRouter);
app.use('/api/opencode', opencodeRouter);

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

// ── Aiden (control de agentes OpenClaw) — DESACTIVADO ────────────────────────
// try {
//   const { aidenRouter } = await import('./routes/aiden.js');
//   app.use('/api/aiden', aidenRouter);
//   console.log('[SERVER] ✓ Aiden: /api/aiden (control de agentes OpenClaw)');
// } catch (e) {
//   console.error('[SERVER] ✗ Aiden falló al cargar:', e.message);
// }
console.log('[SERVER] ⊘ Aiden/OpenClaw: desactivado');

// ── Aider (Claude Code coding assistant) ─────────────────────────────────────
try {
  const { aiderRouter } = await import('./routes/aider.js');
  app.use('/api/aider', aiderRouter);
  console.log(`[SERVER] ✓ Aider: /api/aider (modelo: ${process?.env?.AIDER_MODEL || 'ollama/harmonic-hermes-9b:latest'})`);
} catch (e) {
  console.error('[SERVER] ✗ Aider falló al cargar:', e.message);
}

// ── MarkItDown (convierte archivos a Markdown) ────────────────────────────────
app.use('/api/markitdown', markitdownRouter);
console.log('[SERVER] ✓ MarkItDown API: /api/markitdown/{convert,batch,health}');

// ── System API (Monitorización y Control Centralizado) ──────────────────────────
app.use('/api/system', systemRouter);
console.log('[SERVER] ✓ System API: /api/system/{health,metrics,logs,agents,models,ports,config,dashboard}');

// ── Data API (generic CRUD) ──────────────────────────────────────────────────
try {
  const { dataRouter } = await import('./routes/data.js');
  app.use('/api/data', dataRouter);
  console.log('[SERVER] Data API registrado');
} catch (e) {
  console.error('[SERVER] Data API fallo:', e.message);
}

// ── Data Extraction API (Regex + Ollama local) ────────────────────────────────
try {
  const extractorRouter = (await import('./routes/extractor.js')).default;
  app.use('/api/extractions', extractorRouter);
  console.log('[SERVER] ✓ Data Extraction API: /api/extractions (Factura, Contrato, PO)');
} catch (e) {
  console.error('[SERVER] ✗ Data Extraction API fallo:', e.message);
}

// ── AI Engine (Ollama) ────────────────────────────────────────────────────────
// /api/ollama → backward compat (el frontend no necesita cambios)
try {
  const { aiRouter } = await import('./routes/ai.js');
  app.use('/api/ollama', aiRouter);
  app.use('/api/ai',     aiRouter);
  console.log(`[SERVER] ✓ AI Engine (Triple) → Ollama: ${process?.env?.OLLAMA_URL || 'http://localhost:11434'} | LM Studio: ${process?.env?.LMSTUDIO_URL || 'http://localhost:1234/v1'} | OpenRouter: ${process?.env?.OPENROUTER_URL || 'https://openrouter.ai/api/v1'}`);
console.log(`[SERVER]   LM Studio Models: negentropy-claude-opus-4.7-9b, deepseek/deepseek-r1-0528-qwen3-8b`);
} catch (e) {
  console.error('[SERVER] ✗ AI Engine falló al cargar:', e.message);
}

// ── Frontend estático (producción) ─────────────────────────────────────────
// Analíticas básicas para mc.html
app.get('/api/analytics', (_req, res) => {
  res.json({
    total_documents: 56,
    processed: 42,
    pending: 10,
    failed: 4,
    invoices_total_eur: 125430.50,
    top_suppliers: ['SEAT S.A.', 'Telefónica', 'Iberdrola', 'Endesa', 'Aquaservice'],
    monthly_chart: [12, 19, 3, 5, 2, 3, 20, 15, 8, 11, 14, 22],
    document_types: { factura: 34, nomina: 8, albaran: 6, ticket: 4, otro: 4 },
  });
});

// Pipeline status para mc.html
app.get('/api/pipeline', (_req, res) => {
  res.json({
    running: true,
    stages: [
      { name: 'extract', status: 'active', docs_processed: 56 },
      { name: 'classify', status: 'active', docs_processed: 56 },
      { name: 'extract_data', status: 'active', docs_processed: 52 },
      { name: 'sync', status: 'idle', last_sync: new Date().toISOString() },
    ],
    queue: [],
    errors: 4,
  });
});

// WebSocket status para mc.html
app.get('/api/ws-status', (_req, res) => {
  res.json({ hermes: true, opencode: true, server: 'online' });
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath  = path.join(__dirname, '..', 'dist');

// ── Static assets: public/ (solo assets: imágenes, favicon, manifest) ───────
const publicPath = path.join(__dirnameRoot, '..', 'public');
app.use('/assets', express.static(path.join(publicPath, 'assets'), {
  maxAge: '7d',
}));
app.use('/products', express.static(path.join(publicPath, 'products'), {
  maxAge: '7d',
}));
app.use('/favicon.svg', express.static(path.join(publicPath, 'favicon.svg')));
app.use('/manifest.json', express.static(path.join(publicPath, 'manifest.json')));
app.use('/sinkia-commerce-logo.svg', express.static(path.join(publicPath, 'sinkia-commerce-logo.svg')));
app.use('/sinkia-commerce-logo.png', express.static(path.join(publicPath, 'sinkia-commerce-logo.png')));
app.use('/_redirects', express.static(path.join(publicPath, '_redirects')));

// ── SPA: dist/ (React build) ──────────────────────────────────────────────────

if (existsSync(distPath)) {
  // Servir archivos estáticos del build (JS, CSS chunks)
  app.use(express.static(distPath, {
    maxAge: '7d',
    setHeaders(res, filePath) {
      // No cachear index.html
      if (filePath.endsWith('index.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      }
    },
  }));

  // SPA fallback — cualquier ruta no-API devuelve index.html (React Router se encarga del resto)
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/ws/') ||
        req.path.startsWith('/assets/') || req.path.startsWith('/products/') ||
        req.path.startsWith('/favicon') || req.path.startsWith('/manifest.json')) {
      return; // ya manejado arriba
    }
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(path.join(distPath, 'index.html'));
  });

  console.log('[SERVER] ✓ SPA React activo desde dist/');
} else {
  // ── Fallback: servir HTMLs estáticos de public/ si no hay build ────────────
  app.use(express.static(publicPath, {
    maxAge: '7d',
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      }
    },
  }));

  // Rutas individuales de fallback
  const htmlPages = ['admin', 'chat', 'terminal', 'documents', 'trabajadores', 'commerce', 'filemanager'];
  for (const page of htmlPages) {
    const pagePath = path.join(publicPath, `${page}.html`);
    if (existsSync(pagePath)) {
      app.get(`/${page}`, (_req, res) => {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.sendFile(pagePath);
      });
      console.log(`[SERVER] ✓ ${page}.html en /${page}`);
    }
  }
}

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[ERROR]', err.message);
  res.status(err.status || 500).json({ error: err.message });
});

// ── Arranque ──────────────────────────────────────────────────────────────────
import { createServer as createNetServer } from 'net';

/**
 * Espera a que el puerto esté libre y arranca el servidor con retry.
 * Maneja race conditions donde otro proceso captura el puerto inmediatamente.
 */
async function startServer(app, port, maxRetries = 15) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    // Esperar a que el puerto esté libre
    await new Promise((resolve, reject) => {
      const tester = createNetServer();
      tester.once('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          setTimeout(resolve, 500);
        } else {
          reject(err);
        }
      });
      tester.once('listening', () => { tester.close(); resolve(); });
      tester.listen(port, '0.0.0.0');
    });

    // Intentar arrancar
    try {
      const server = await new Promise((resolve, reject) => {
        const s = app.listen(port, '0.0.0.0', () => resolve(s));
        s.once('error', (err) => {
          s.close();
          reject(err);
        });
      });

      // OCR de PDFs escaneados puede tardar 15+ min — desactivar timeouts HTTP
      server.requestTimeout = 0;
      server.headersTimeout = 0;
      server.timeout = 0;
      console.log(`\n[SERVER] ✓ Puerto ${PORT} | ${new Date().toISOString()}\n`);

      // ── Sincronización inicial de datos ─────────────────────────────────────────
      try { syncAll(); } catch (e) { console.error('[SYNC] Startup sync error:', e.message); }

      // ── WebSocket handlers ──────────────────────────────────────────────────────
      let terminalWss = null;
      let shellWss    = null;

      try { terminalWss = setupTerminal(server); } catch (e) { console.error('[TERMINAL] ✗', e.message); }
      try { shellWss    = setupShellTerminal(server); } catch (e) { console.error('[SHELL-TERMINAL] ✗', e.message); }

      // ── Hermes Chat + OpenCode WebSocket handlers ────────────────────────────────
      let hermesWss = null;
      let opencodeWss = null;
      try { hermesWss = createHermesWSS(server); console.log('[HERMES-WS] ✓ /ws/hermes'); }
      catch (e) { console.error('[HERMES-WS] ✗', e.message); }
      try { opencodeWss = createOpenCodeWSS(server); console.log('[OPENCODE-WS] ✓ /ws/opencode'); }
      catch (e) { console.error('[OPENCODE-WS] ✗', e.message); }

      // ── Dispatcher centralizado de WebSocket upgrades ──────────────────────────
      server.on('upgrade', (req, socket, head) => {
        let pathname;
        try { pathname = new URL(req.url, 'http://localhost').pathname; }
        catch { socket.destroy(); return; }

        if (pathname === '/terminal/ws' && terminalWss) {
          terminalWss.handleUpgradeRequest(req, socket, head);
        } else if (pathname === '/ws/shell' && shellWss) {
          shellWss.handleUpgradeRequest(req, socket, head);
        } else if (pathname === '/ws/hermes' && hermesWss) {
          hermesWss.handleUpgradeRequest(req, socket, head);
        } else if (pathname === '/ws/opencode' && opencodeWss) {
          opencodeWss.handleUpgradeRequest(req, socket, head);
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

      return server;
    } catch (err) {
      if (err.code === 'EADDRINUSE' && attempt < maxRetries) {
        console.warn(`[SERVER] ⚠ Puerto ${port} ocupado, esperando reintento ${attempt + 1}/${maxRetries}...`);
        await new Promise(r => setTimeout(r, 1500));
        continue;
      }
      throw err;
    }
  }
  throw new Error(`No se pudo iniciar el servidor en puerto ${port} después de ${maxRetries} intentos`);
}

const server = await startServer(app, PORT);

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

