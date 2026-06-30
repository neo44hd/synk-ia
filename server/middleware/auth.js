import { existsSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import express from 'express';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TAILSCALE_ALLOWED_CIDRS = [
  '100.64.0.0/10',
  '10.0.0.0/8',
  '192.168.0.0/16',
  '172.16.0.0/12',
];

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'sinkia2026';
const TUNNEL_TOKEN = process.env.TUNNEL_TOKEN || '72cf96a04b991f146c0faba5edb1afed2a82bb547f33b498a993ddf01c6f502b';
const ALLOW_LOCAL = process.env.TAILSCALE_ALLOW_LOCAL !== 'false';

// ── Paths que NO requieren Tailscale (webhooks, health) ────────────────────
const BYPASS_PATHS = [
  '/api/telegram',
  '/api/health',
  '/healthz',
  '/api/files/tree',
  '/api/files/search',
  '/api/files/read',
  '/api/ollama',
  '/api/ai',
  '/api/services',
  '/api/data/public',
  '/api/data/provider',    // sync worker
  '/api/data/payroll',
  '/api/data/timesheet',
  '/api/data/invoice',
  '/api/data/employee',
  '/api/sync',             // sync endpoint
];

// ── CIDR helpers ────────────────────────────────────────────────────────────
function ipToNum(ip) {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0);
}

function cidrMatch(ip, cidr) {
  const [range, bits] = cidr.split('/');
  const mask = ~((1 << (32 - parseInt(bits, 10))) - 1) >>> 0;
  return (ipToNum(ip) & mask) === (ipToNum(range) & mask);
}

function isTailscaleIP(ip) {
  if (ip === '127.0.0.1' || ip === '::1') return true;
  if (ALLOW_LOCAL) {
    if (ip.startsWith('192.168.') || ip.startsWith('10.')) return true;
    if (ip.startsWith('172.')) {
      const second = parseInt(ip.split('.')[1], 10);
      if (second >= 16 && second <= 31) return true;
    }
  }
  return TAILSCALE_ALLOWED_CIDRS.some(cidr => cidrMatch(ip, cidr));
}

function pathBypassesAuth(pathname) {
  return BYPASS_PATHS.some(prefix => pathname.startsWith(prefix));
}

// ── Tailscale + Tunnel authentication middleware ─────────────────────────────
export function tailscaleAuth(req, res, next) {
  // Skip auth for webhook/health paths
  if (pathBypassesAuth(req.path)) {
    return next();
  }

  const remoteIP = (req.socket.remoteAddress || '').replace(/^::ffff:/, '');
  const forwardedIP = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();

  // DEVELOPMENT: Disable Tailscale check
  if (process.env.DISABLE_TAILSCALE_AUTH === 'true') {
    console.warn(`[AUTH] ⚠️  Tailscale check disabled (DEVELOPMENT MODE)`);
    req.fromTailscale = true;
    return next();
  }

  // METHOD 1: Cloudflare Tunnel (localhost + token)
  // Si la conexión TCP viene de localhost, verificar token del túnel
  if (remoteIP === '127.0.0.1' || remoteIP === '::1' || remoteIP === 'localhost') {
    const tunnelToken = req.headers['x-tunnel-token'];
    if (tunnelToken === TUNNEL_TOKEN) {
      console.log(`[AUTH] ✅ Túnel Cloudflare autorizado desde ${remoteIP} → ${req.method} ${req.path}`);
      req.fromTailscale = true;
      req.fromTunnel = true;
      return next();
    } else {
      console.warn(`[AUTH] 🚫 Túnel sin token válido desde ${remoteIP} → ${req.method} ${req.path}`);
      return res.status(403).json({ error: 'Acceso denegado. Token de túnel inválido.' });
    }
  }

  // METHOD 2: Tailscale direct access (red privada)
  // Para conexiones directas (no por túnel), solo IPs de Tailscale
  const ip = (forwardedIP || remoteIP).replace(/^::ffff:/, '');
  
  if (!isTailscaleIP(ip)) {
    console.warn(`[AUTH] 🚫 Denegado desde ${ip} → ${req.method} ${req.path}`);
    return res.status(403).json({ error: 'Acceso denegado. Solo desde Tailscale.' });
  }

  // IP de Tailscale/red local → confiable
  req.fromTailscale = true;

  // Admin token bypass
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const queryToken = req.query.token || req.query.t;
  if (token === ADMIN_TOKEN || queryToken === ADMIN_TOKEN) {
    req.user = { role: 'admin', token: true };
    return next();
  }

  // Rutas publicas dentro de Tailscale — sin token
  if (req.path === '/' || req.path === '/mc' || req.path === '/mc.html' ||
      req.path.startsWith('/documents') || req.path.startsWith('/commerce') ||
      req.path.startsWith('/chat') || req.path.startsWith('/admin') ||
      req.path.startsWith('/terminal') || req.path.startsWith('/filemanager') ||
      req.path.startsWith('/trabajadores')) {
    return next();
  }

  next();
}

// ── Express middleware wrapper ──────────────────────────────────────────────
export function setupAuth(app) {
  // Body parsers ANTES de auth para que los webhooks puedan parsear
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // CORS
  const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:5173')
    .split(',').map(o => o.trim());
  if (!ALLOWED_ORIGINS.includes('https://sinkialabs.com')) {
    ALLOWED_ORIGINS.push('https://sinkialabs.com', 'http://sinkialabs.com');
  }
  if (!ALLOWED_ORIGINS.includes('https://www.sinkialabs.com')) {
    ALLOWED_ORIGINS.push('https://www.sinkialabs.com', 'http://www.sinkialabs.com');
  }
  if (!ALLOWED_ORIGINS.includes('http://localhost:59401')) {
    ALLOWED_ORIGINS.push('http://localhost:59401');
  }

  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin || '*');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Token');
    }
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
  });

  // Apply Tailscale auth to everything
  app.use(tailscaleAuth);

  // Auth via query token
  app.use((req, res, next) => {
    const qt = req.query.token || req.query.t;
    if (qt === ADMIN_TOKEN) req.user = { role: 'admin', token: true };
    next();
  });

  console.log('[AUTH] ✅ Tailscale-only + webhook bypass activado');
}