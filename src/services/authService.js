/**
 * SYNK-IA - Servicio de Autenticación Local
 * © 2024 David Roldan - Chicken Palace Ibiza
 * Futuro: SYNK-IA LABS
 */

const AUTH_STORAGE_KEY = 'synkia_auth_user';
const AUTH_TOKEN_KEY = 'synkia_auth_token';

// Usuario administrador por defecto
const DEFAULT_ADMIN = {
  id: 'admin-001',
  email: 'admin@chickenpalace.es',
  full_name: 'David Roldan',
  role: 'admin',
  department: 'Dirección',
  avatar_url: null,
  created_at: new Date().toISOString()
};

// Usuarios de demo
const DEMO_USERS = [
  DEFAULT_ADMIN,
  {
    id: 'user-002',
    email: 'gerente@chickenpalace.es',
    full_name: 'Gerente Chicken Palace',
    role: 'gerente',
    department: 'Gestión',
    avatar_url: null,
    created_at: new Date().toISOString()
  },
  {
    id: 'user-003',
    email: 'empleado@chickenpalace.es',
    full_name: 'Empleado Demo',
    role: 'empleado',
    department: 'Cocina',
    avatar_url: null,
    created_at: new Date().toISOString()
  }
];

class AuthService {
  constructor() {
    this._initializeUsers();
  }

  _initializeUsers() {
    const storedUsers = localStorage.getItem('synkia_users');
    if (!storedUsers) {
      localStorage.setItem('synkia_users', JSON.stringify(DEMO_USERS));
    }
  }

  /**
   * Obtiene el usuario actual autenticado
   */
  async me() {
    const storedUser = localStorage.getItem(AUTH_STORAGE_KEY);
    if (storedUser) {
      return JSON.parse(storedUser);
    }
    // Auto-login con admin para desarrollo
    const user = DEFAULT_ADMIN;
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    localStorage.setItem(AUTH_TOKEN_KEY, 'synkia-local-token-' + Date.now());
    return user;
  }

  /**
   * Inicia sesión (simulado para desarrollo local)
   */
  async login(email = 'admin@chickenpalace.es', password = '') {
    const users = JSON.parse(localStorage.getItem('synkia_users') || '[]');
    let user = users.find(u => u.email === email);
    
    if (!user) {
      // Auto-crear usuario si no existe
      user = DEFAULT_ADMIN;
    }
    
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    localStorage.setItem(AUTH_TOKEN_KEY, 'synkia-local-token-' + Date.now());
    
    return user;
  }

  /**
   * Cierra sesión
   */
  async logout() {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem(AUTH_TOKEN_KEY);
    return true;
  }

  /**
   * Verifica si el usuario está autenticado
   */
  isAuthenticated() {
    return !!localStorage.getItem(AUTH_STORAGE_KEY);
  }

  /**
   * Obtiene el token de autenticación
   */
  getToken() {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  }

  /**
   * Registra un nuevo usuario
   */
  async register(userData) {
    const users = JSON.parse(localStorage.getItem('synkia_users') || '[]');
    const newUser = {
      id: 'user-' + Date.now(),
      ...userData,
      created_at: new Date().toISOString()
    };
    users.push(newUser);
    localStorage.setItem('synkia_users', JSON.stringify(users));
    return newUser;
  }

  /**
   * Actualiza el perfil del usuario
   */
  async updateProfile(updates) {
    const user = await this.me();
    const updatedUser = { ...user, ...updates };
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updatedUser));
    
    // Actualizar también en la lista de usuarios
    const users = JSON.parse(localStorage.getItem('synkia_users') || '[]');
    const idx = users.findIndex(u => u.id === user.id);
    if (idx >= 0) {
      users[idx] = updatedUser;
      localStorage.setItem('synkia_users', JSON.stringify(users));
    }
    
    return updatedUser;
  }
}

export const authService = new AuthService();
export default authService;
