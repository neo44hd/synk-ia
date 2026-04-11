/**
 * SYNK-IA — Servicio de Autenticación (JWT real)
 * Conecta con backend /api/auth/* — zero localStorage para datos de sesión
 * Solo localStorage para el token JWT (necesario para persistir entre recargas)
 */

const AUTH_TOKEN_KEY = 'synkia_auth_token';
const AUTH_USER_KEY  = 'synkia_auth_user'; // Cache local del usuario (se revalida con /me)

const API_BASE = '/api/auth';

async function apiFetch(path, options = {}) {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

class AuthService {
  constructor() {
    // No inicializamos nada — el backend crea el admin automáticamente
  }

  /**
   * Obtiene el usuario actual autenticado
   * Primero intenta /api/auth/me, si falla limpia el token
   */
  async me() {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!token) return null;

    try {
      const { user } = await apiFetch('/me');
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
      return user;
    } catch {
      // Token inválido o expirado — limpiar
      this.logout();
      return null;
    }
  }

  /**
   * Inicia sesión con email + password
   */
  async login(email, password) {
    if (!email || !password) {
      throw new Error('Email y contraseña requeridos');
    }

    const { token, user } = await apiFetch('/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    localStorage.setItem(AUTH_TOKEN_KEY, token);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));

    return user;
  }

  /**
   * Cierra sesión
   */
  async logout() {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
    return true;
  }

  /**
   * Verifica si el usuario está autenticado (check local rápido)
   * Para verificación real, usar me()
   */
  isAuthenticated() {
    return !!localStorage.getItem(AUTH_TOKEN_KEY);
  }

  /**
   * Obtiene el token JWT
   */
  getToken() {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  }

  /**
   * Obtiene el usuario cacheado (sin llamar al backend)
   * Para datos frescos, usar me()
   */
  getCachedUser() {
    try {
      const cached = localStorage.getItem(AUTH_USER_KEY);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  }

  /**
   * Registra un nuevo usuario (solo admin)
   */
  async register(userData) {
    const { user } = await apiFetch('/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
    return user;
  }

  /**
   * Actualiza el perfil del usuario actual
   */
  async updateProfile(updates) {
    const { user } = await apiFetch('/profile', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    return user;
  }

  /**
   * Cambia la contraseña del usuario actual
   */
  async changePassword(currentPassword, newPassword) {
    const result = await apiFetch('/change-password', {
      method: 'POST',
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    });
    return result;
  }
}

export const authService = new AuthService();
export default authService;
