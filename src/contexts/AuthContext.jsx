import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User } from '@/api/entities';
import { 
  ROLES, 
  getUserRole, 
  hasPermission, 
  canAccessRoute, 
  hasRoleLevel,
  PERMISSIONS 
} from '@/config/roles';

// Crear el contexto
const AuthContext = createContext(null);

// Provider del contexto
export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Cargar usuario al montar
  useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await User.me();
        if (user) {
          setCurrentUser(user);
          setUserRole(getUserRole(user));
          setIsAuthenticated(true);
        } else {
          setCurrentUser(null);
          setUserRole(null);
          setIsAuthenticated(false);
        }
      } catch (error) {
        console.log('Usuario no autenticado o error al cargar:', error);
        setCurrentUser(null);
        setUserRole(null);
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };

    loadUser();
  }, []);

  // Verificar si tiene un permiso específico
  const checkPermission = useCallback((permission) => {
    return hasPermission(userRole, permission);
  }, [userRole]);

  // Verificar si puede acceder a una ruta
  const checkRouteAccess = useCallback((route) => {
    return canAccessRoute(userRole, route);
  }, [userRole]);

  // Verificar si tiene nivel de rol mínimo
  const checkRoleLevel = useCallback((requiredRole) => {
    return hasRoleLevel(userRole, requiredRole);
  }, [userRole]);

  // Verificar si es CEO
  const isCEO = useCallback(() => {
    return userRole === ROLES.CEO;
  }, [userRole]);

  // Verificar si es Admin o superior
  const isAdmin = useCallback(() => {
    return userRole === ROLES.ADMIN || userRole === ROLES.CEO;
  }, [userRole]);

  // Verificar si es Empleado
  const isEmployee = useCallback(() => {
    return userRole === ROLES.EMPLOYEE;
  }, [userRole]);

  // Función de logout
  const logout = useCallback(async () => {
    try {
      await User.logout();
      setCurrentUser(null);
      setUserRole(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  }, []);

  // Función de login (redirige al login de Base44)
  const login = useCallback(() => {
    User.login();
  }, []);

  // Refrescar datos del usuario
  const refreshUser = useCallback(async () => {
    try {
      const user = await User.me();
      if (user) {
        setCurrentUser(user);
        setUserRole(getUserRole(user));
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error('Error al refrescar usuario:', error);
    }
  }, []);

  const value = {
    // Estado
    currentUser,
    userRole,
    isLoading,
    isAuthenticated,
    
    // Constantes
    ROLES,
    PERMISSIONS,
    
    // Funciones de verificación
    checkPermission,
    checkRouteAccess,
    checkRoleLevel,
    isCEO,
    isAdmin,
    isEmployee,
    
    // Funciones de autenticación
    login,
    logout,
    refreshUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook para usar el contexto
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider');
  }
  return context;
}

// HOC para componentes que requieren autenticación
export function withAuth(Component) {
  return function AuthenticatedComponent(props) {
    const { isAuthenticated, isLoading, login } = useAuth();
    
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-screen bg-zinc-950">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-400"></div>
        </div>
      );
    }
    
    if (!isAuthenticated) {
      login();
      return null;
    }
    
    return <Component {...props} />;
  };
}

export default AuthContext;
