// ═══════════════════════════════════════════════════════════════════════════
//  SYNK-IA — Middleware de autenticación JWT
//  Uso: app.use('/api/ruta-protegida', requireAuth, router)
//       app.use('/api/ruta-admin', requireAdmin, router)
// ═══════════════════════════════════════════════════════════════════════════
import { verifyJWT } from '../routes/auth.js';

/**
 * Middleware que verifica JWT y pone req.user
 * Si no hay token o es inválido, devuelve 401
 */
export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  // Permitir también el token admin legacy (para compatibilidad con admin.html, documents.html)
  const legacyToken = req.headers['x-admin-token'] || req.query.token;
  const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'sinkia2026';
  if (legacyToken === ADMIN_TOKEN) {
    req.user = { id: 'admin-001', email: 'david@sinkialabs.com', role: 'admin' };
    return next();
  }

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de autenticación requerido' });
  }

  const payload = verifyJWT(authHeader.slice(7));
  if (!payload) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }

  req.user = payload;
  next();
}

/**
 * Middleware que requiere rol admin
 * Debe usarse DESPUÉS de requireAuth
 */
export function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Se requiere rol de administrador' });
  }
  next();
}

/**
 * Middleware opcional — pone req.user si hay token, pero no bloquea
 * Útil para rutas que funcionan con o sin auth
 */
export function optionalAuth(req, _res, next) {
  const authHeader = req.headers.authorization;

  const legacyToken = req.headers['x-admin-token'] || req.query.token;
  const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'sinkia2026';
  if (legacyToken === ADMIN_TOKEN) {
    req.user = { id: 'admin-001', email: 'david@sinkialabs.com', role: 'admin' };
    return next();
  }

  if (authHeader?.startsWith('Bearer ')) {
    const payload = verifyJWT(authHeader.slice(7));
    if (payload) req.user = payload;
  }
  next();
}
