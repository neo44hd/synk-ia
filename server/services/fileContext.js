/**
 * fileContext.js — Servicio compartido de acceso a archivos del proyecto
 *
 * Usado por todos los chats para:
 * 1. Listar archivos del proyecto (árbol)
 * 2. Leer archivos seleccionados manualmente
 * 3. Buscar archivos relevantes automáticamente por query (RAG ligero)
 *
 * El RAG es por nombre/ruta + grep del contenido — sin embeddings,
 * rápido y con 0 dependencias externas.
 */
import { readdir, readFile, stat } from 'fs/promises';
import { join, relative, extname, basename } from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileP = promisify(execFile);

const PROJECT_DIR  = process?.env?.SINKIA_PROJECT_DIR || '/app';
const MAX_FILE_SIZE = 100_000; // 100KB
const MAX_CONTEXT_CHARS = 50_000; // límite total de contexto inyectado

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', '.next', '.nuxt', 'coverage',
  '.cache', '__pycache__', '.DS_Store', '.ollama', 'ollama',
  'uploads', 'tmp', 'logs',
]);

const CODE_EXTS = new Set([
  '.js','.ts','.jsx','.tsx','.vue','.svelte','.py','.go','.rs','.rb',
  '.java','.c','.cpp','.h','.css','.scss','.html','.json','.yaml',
  '.yml','.toml','.md','.sh','.sql','.env','.mjs','.cjs','.txt',
]);

// ── Mapa de keywords → archivos/dirs relevantes para búsqueda inteligente ──
const KEYWORD_MAP = {
  // Email
  'email':    ['server/routes/email.js', 'server/services/emailAgent.js', 'server/services/email'],
  'correo':   ['server/routes/email.js', 'server/services/emailAgent.js'],
  'imap':     ['server/services/emailAgent.js'],
  // Facturas / proveedores
  'factura':  ['server/routes/documents.js', 'server/services/filebrain.js', 'server/routes/filebrain.js'],
  'proveedor':['server/services/filebrain.js', 'server/routes/filebrain.js'],
  'invoice':  ['server/routes/documents.js', 'server/services/filebrain.js'],
  // Trabajadores / nóminas
  'nomina':   ['server/routes/trabajadores.js', 'server/services/'],
  'nómina':   ['server/routes/trabajadores.js'],
  'trabajador':['server/routes/trabajadores.js'],
  'worker':   ['server/routes/trabajadores.js'],
  // Chat / IA
  'chat':     ['server/routes/chat.js', 'public/chat.html'],
  'brain':    ['server/services/brain.js', 'server/routes/chat.js'],
  'ollama':   ['server/routes/claude-proxy.js', 'server/routes/chat.js', 'server/routes/ai.js'],
  'proxy':    ['server/routes/claude-proxy.js'],
  'aider':    ['server/routes/aider.js'],
  'openclaw': ['server/routes/openclaw-proxy.js'],
  // Infra
  'config':   ['server/.env', 'package.json', 'server/index.js'],
  'server':   ['server/index.js'],
  'index':    ['server/index.js'],
  'route':    ['server/routes/'],
  'ruta':     ['server/routes/'],
  'api':      ['server/routes/', 'server/index.js'],
  // Frontend
  'admin':    ['public/admin.html', 'server/routes/admin.js'],
  'terminal': ['server/routes/terminal.js', 'server/routes/shell-terminal.js', 'public/terminal.html'],
  'biloop':   ['server/routes/biloop.js', 'server/routes/biloop-portal.js'],
  'revo':     ['server/routes/revo.js'],
};

// ── Árbol de archivos ───────────────────────────────────────────────────────
export async function getFileTree(dir = PROJECT_DIR, base = PROJECT_DIR, depth = 0) {
  if (depth > 5) return [];
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const results = [];
  for (const e of entries) {
    if (SKIP_DIRS.has(e.name) || e.name.startsWith('._')) continue;
    const full = join(dir, e.name);
    const rel = relative(base, full);
    if (e.isDirectory()) {
      results.push({ name: e.name, path: rel, type: 'dir', children: await getFileTree(full, base, depth + 1) });
    } else if (CODE_EXTS.has(extname(e.name).toLowerCase())) {
      const s = await stat(full).catch(() => null);
      if (s && s.size <= MAX_FILE_SIZE) {
        results.push({ name: e.name, path: rel, type: 'file', size: s.size });
      }
    }
  }
  return results.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1));
}

// ── Leer archivos por rutas ─────────────────────────────────────────────────
export async function readFiles(paths, maxFiles = 20) {
  const files = [];
  for (const p of paths.slice(0, maxFiles)) {
    const full = join(PROJECT_DIR, p);
    if (!full.startsWith(PROJECT_DIR)) continue; // seguridad
    try {
      let content = await readFile(full, 'utf-8');
      if (content.length > MAX_FILE_SIZE) content = content.slice(0, MAX_FILE_SIZE) + '\n... [truncado]';
      files.push({ path: p, content });
    } catch (e) {
      files.push({ path: p, content: `[Error: ${e.message}]` });
    }
  }
  return files;
}

// ── Buscar archivos relevantes por query (RAG ligero) ───────────────────────
export async function searchFiles(query) {
  const q = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const words = q.split(/\s+/).filter(w => w.length > 2);
  const candidates = new Map(); // path → score

  // 1. Buscar por keyword map
  for (const word of words) {
    for (const [key, paths] of Object.entries(KEYWORD_MAP)) {
      const keyNorm = key.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (word.includes(keyNorm) || keyNorm.includes(word)) {
        for (const p of paths) {
          candidates.set(p, (candidates.get(p) || 0) + 3);
        }
      }
    }
  }

  // 2. Buscar archivos por nombre que coincidan con palabras del query
  try {
    const allFiles = await flattenTree(await getFileTree());
    for (const f of allFiles) {
      const nameL = f.path.toLowerCase();
      for (const word of words) {
        if (nameL.includes(word)) {
          candidates.set(f.path, (candidates.get(f.path) || 0) + 2);
        }
      }
    }
  } catch {}

  // 3. grep en el proyecto para encontrar archivos con contenido relevante
  const grepWords = words.slice(0, 3); // max 3 palabras para grep
  for (const word of grepWords) {
    if (word.length < 3) continue;
    try {
      const { stdout } = await execFileP('grep', [
        '-rl', '--include=*.js', '--include=*.ts', '--include=*.json',
        '--include=*.md', '--include=*.html', '--include=*.sh',
        '-i', word, PROJECT_DIR,
      ], { timeout: 3000, maxBuffer: 100_000 }).catch(() => ({ stdout: '' }));

      for (const line of stdout.split('\n').filter(Boolean)) {
        const rel = relative(PROJECT_DIR, line);
        if (rel.includes('node_modules') || rel.includes('.git')) continue;
        candidates.set(rel, (candidates.get(rel) || 0) + 1);
      }
    } catch {}
  }

  // Ordenar por score y devolver top resultados
  const sorted = [...candidates.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([path, score]) => ({ path, score }));

  return sorted;
}

// ── Construir bloque de contexto para inyectar en system prompt ─────────────
export async function buildContextBlock(manualFiles = [], autoQuery = null) {
  const filePaths = new Set(manualFiles);

  // Si hay autoQuery, buscar archivos relevantes
  if (autoQuery) {
    const found = await searchFiles(autoQuery);
    for (const f of found) {
      // Solo incluir archivos exactos (no directorios terminados en /)
      if (!f.path.endsWith('/')) filePaths.add(f.path);
    }
  }

  if (filePaths.size === 0) return '';

  // Leer contenidos
  const files = await readFiles([...filePaths], 15);
  const blocks = [];
  let totalChars = 0;

  for (const f of files) {
    if (totalChars + f.content.length > MAX_CONTEXT_CHARS) {
      blocks.push(`── ${f.path} ──\n[Archivo omitido: excede límite de contexto]`);
      continue;
    }
    blocks.push(`── ${f.path} ──\n${f.content}`);
    totalChars += f.content.length;
  }

  return `\n\nProject files loaded as context (${files.length} files, ${totalChars} chars):\n\n${blocks.join('\n\n')}`;
}

// ── Helpers ─────────────────────────────────────────────────────────────────
async function flattenTree(tree, result = []) {
  for (const item of tree) {
    if (item.type === 'file') result.push(item);
    if (item.type === 'dir' && item.children) await flattenTree(item.children, result);
  }
  return result;
}

export { PROJECT_DIR };
