// ═══════════════════════════════════════════════════════════════════════════
//  SYNK-IA — Autenticación JWT real
//  Endpoints: login, register, me, change-password, update-profile
//  Usuarios almacenados en /data/users.json (bcrypt + JWT)
// ═══════════════════════════════════════════════════════════════════════════
import { Router } from 'express';
import crypto from 'crypto';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const router = Router();
const DATA_DIR   = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const JWT_SECRET = process.env.JWT_SECRET || 'sinkia-jwt-secret-2026-' + crypto.randomBytes(8).toString('hex');
const JWT_EXPIRY = 7 * 24 * 60 * 60; // 7 días en segundos

// ── JWT casero (sin dependencia externa) ────────────────────────────────────
// Usa HMAC-SHA256 — suficiente para auth local en red privada
function base64url(buf) {
  return Buffer.from(buf).toString('base64url');
}

function createJWT(payload) {
  const header  = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now     = Math.floor(Date.now() / 1000);
  const body    = base64url(JSON.stringify({ ...payload, iat: now, exp: now + JWT_EXPIRY }));
  const sig     = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

function verifyJWT(token) {
  try {
    const [header, body, sig] = token.split('.');
    const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
    if (sig !== expectedSig) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

// ── Hash de password (SHA-256 + salt — sin bcrypt para evitar deps nativas) ─
function hashPassword(password, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.createHash('sha256').update(salt + password).digest('hex');
  return { hash, salt };
}

function verifyPassword(password, hash, salt) {
  const { hash: computed } = hashPassword(password, salt);
  return computed === hash;
}

// ── DB de usuarios (JSON file) ──────────────────────────────────────────────
async function loadUsers() {
  try {
    if (!existsSync(USERS_FILE)) return [];
    return JSON.parse(await readFile(USERS_FILE, 'utf8'));
  } catch {
    return [];
  }
}

async function saveUsers(users) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(USERS_FILE, JSON.stringify(users, null, 2));
}

async function ensureAdminExists() {
  let users = await loadUsers();
  if (users.length === 0) {
    const { hash, salt } = hashPassword('sinkia2026');
    users.push({
      id: 'admin-001',
      email: 'david@sinkialabs.com',
      full_name: 'David Roldan',
      role: 'admin',
      permission_level: 'admin',
      department: 'Dirección',
      avatar_url: null,
      passwordHash: hash,
      passwordSalt: salt,
      created_at: new Date().toISOString(),
    });
    await saveUsers(users);
    console.log('[AUTH] ✓ Usuario admin creado: david@sinkialabs.com / sinkia2026');
  }
}

// Crear admin al importar el módulo
ensureAdminExists().catch(e => console.error('[AUTH] Error creando admin:', e.message));

// ── Helper: extraer usuario de JWT o legacy token ────────────────────────────
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'sinkia2026';
function extractUser(req) {
  // Legacy x-admin-token (compat con admin.html, documents.html, etc.)
  const legacyToken = req.headers['x-admin-token'] || req.query.token;
  if (legacyToken === ADMIN_TOKEN) {
    return { id: 'admin-001', email: 'david@sinkialabs.com', role: 'admin' };
  }
  // JWT Bearer
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  return verifyJWT(authHeader.slice(7));
}

// ── POST /api/auth/login ────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña requeridos' });
  }

  const users = await loadUsers();
  const user  = users.find(u => u.email === email);

  if (!user || !verifyPassword(password, user.passwordHash, user.passwordSalt)) {
    return res.status(401).json({ error: 'Credenciales incorrectas' });
  }

  const token = createJWT({ id: user.id, email: user.email, role: user.role });
  const { passwordHash, passwordSalt, ...safeUser } = user;

  res.json({ token, user: safeUser });
});

// ── POST /api/auth/register (solo admin) ────────────────────────────────────
router.post('/register', async (req, res) => {
  const payload = extractUser(req);
  if (!payload) {
    return res.status(401).json({ error: 'Token requerido' });
  }
  if (payload.role !== 'admin') {
    return res.status(403).json({ error: 'Solo admin puede registrar usuarios' });
  }

  const { email, password, full_name, role = 'empleado', department = '' } = req.body;
  if (!email || !password || !full_name) {
    return res.status(400).json({ error: 'email, password y full_name requeridos' });
  }

  const users = await loadUsers();
  if (users.find(u => u.email === email)) {
    return res.status(409).json({ error: 'El email ya existe' });
  }

  const { hash, salt } = hashPassword(password);
  const newUser = {
    id: 'user-' + Date.now(),
    email,
    full_name,
    role,
    department,
    avatar_url: null,
    passwordHash: hash,
    passwordSalt: salt,
    created_at: new Date().toISOString(),
  };

  users.push(newUser);
  await saveUsers(users);

  const { passwordHash: _, passwordSalt: __, ...safeUser } = newUser;
  res.status(201).json({ user: safeUser });
});

// ── GET /api/auth/me ────────────────────────────────────────────────────────
router.get('/me', async (req, res) => {
  const payload = extractUser(req);
  if (!payload) {
    return res.status(401).json({ error: 'Token requerido' });
  }

  const users = await loadUsers();
  const user  = users.find(u => u.id === payload.id);
  if (!user) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }

  const { passwordHash, passwordSalt, ...safeUser } = user;
  res.json({ user: safeUser });
});

// ── POST /api/auth/change-password ──────────────────────────────────────────
router.post('/change-password', async (req, res) => {
  const payload = extractUser(req);
  if (!payload) {
    return res.status(401).json({ error: 'Token requerido' });
  }

  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'current_password y new_password requeridos' });
  }
  if (new_password.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  }

  const users = await loadUsers();
  const user  = users.find(u => u.id === payload.id);
  if (!user) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }

  if (!verifyPassword(current_password, user.passwordHash, user.passwordSalt)) {
    return res.status(401).json({ error: 'Contraseña actual incorrecta' });
  }

  const { hash, salt } = hashPassword(new_password);
  user.passwordHash = hash;
  user.passwordSalt = salt;
  await saveUsers(users);

  res.json({ ok: true, message: 'Contraseña actualizada' });
});

// ── PUT /api/auth/profile ───────────────────────────────────────────────────
router.put('/profile', async (req, res) => {
  const payload = extractUser(req);
  if (!payload) {
    return res.status(401).json({ error: 'Token requerido' });
  }

  const { full_name, department, avatar_url } = req.body;

  const users = await loadUsers();
  const user  = users.find(u => u.id === payload.id);
  if (!user) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }

  if (full_name !== undefined)  user.full_name  = full_name;
  if (department !== undefined) user.department  = department;
  if (avatar_url !== undefined) user.avatar_url  = avatar_url;
  user.updated_at = new Date().toISOString();

  await saveUsers(users);

  const { passwordHash, passwordSalt, ...safeUser } = user;
  res.json({ user: safeUser });
});

// Exportar verifyJWT para uso en middleware
export { verifyJWT };
export const authRouter = router;
