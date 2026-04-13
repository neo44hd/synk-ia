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
import { setupTerminal }      from './routes/terminal.js';
import documentsRouter        from './routes/documents.js';
import trabajadoresRouter     from './routes/trabajadores.js';
import { authRouter }         from './routes/auth.js';
import { filebrainRouter }    from './routes/filebrain.js';

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
app.use('/claude',     claudeProxyRouter);  // Proxy local para Claude Code
app.use('/api/chat',   chatRouter);          // Chat IA local

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

// Servir admin.html en /admin (fuera del SPA de React)
const adminHtml = path.join(__dirnameRoot, '..', 'public', 'admin.html');
if (existsSync(adminHtml)) {
  app.get('/admin', (_req, res) => res.sendFile(adminHtml));
  console.log('[SERVER] ✓ Admin panel: /admin');
}

const chatHtml = path.join(__dirnameRoot, '..', 'public', 'chat.html');
if (existsSync(chatHtml)) {
  app.get('/chat', (_req, res) => res.sendFile(chatHtml));
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
  console.log(`\n[SERVER] ✓ Puerto ${PORT} | ${new Date().toISOString()}`);
  console.log(`[SERVER] CORS: ${ALLOWED_ORIGINS.join(', ')}\n`);

  // Terminal WebSocket (node-pty + ws)
  try { setupTerminal(server); } catch (e) { console.error('[TERMINAL] ✗', e.message); }

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

