import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { ROUTE_PERMISSIONS } from '@/config/roles';

/**
 * Componente para proteger rutas basado en autenticación y permisos
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children - Componente hijo a renderizar
 * @param {string[]} props.requiredPermissions - Permisos requeridos (opcional)
 * @param {string} props.requiredRole - Rol mínimo requerido (opcional)
 * @param {boolean} props.isPublic - Si la ruta es pública (opcional)
 */
export function ProtectedRoute({ 
  children, 
  requiredPermissions = [],
  requiredRole = null,
  isPublic = false 
}) {
  const location = useLocation();
  const { 
    isAuthenticated, 
    isLoading, 
    checkPermission, 
    checkRoleLevel,
    checkRouteAccess,
    login 
  } = useAuth();

  // Mostrar loading mientras se verifica autenticación
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-400 mx-auto mb-4"></div>
          <p className="text-zinc-400">Verificando acceso...</p>
        </div>
      </div>
    );
  }

  // Si es ruta pública, permitir acceso
  if (isPublic) {
    return children;
  }

  // Verificar autenticación para rutas protegidas
  if (!isAuthenticated) {
    // Redirigir al login de Base44
    login();
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-400 mx-auto mb-4"></div>
          <p className="text-zinc-400">Redirigiendo al login...</p>
        </div>
      </div>
    );
  }

  // Verificar acceso a la ruta actual
  const currentPath = location.pathname;
  const hasRouteAccess = checkRouteAccess(currentPath);
  
  // Verificar permisos específicos si se proporcionan
  const hasRequiredPermissions = requiredPermissions.length === 0 || 
    requiredPermissions.every(perm => checkPermission(perm));

  // Verificar rol mínimo si se proporciona
  const hasRequiredRole = !requiredRole || checkRoleLevel(requiredRole);

  // Si no tiene acceso, mostrar página de acceso denegado
  if (!hasRouteAccess || !hasRequiredPermissions || !hasRequiredRole) {
    return <AccessDenied />;
  }

  return children;
}

/**
 * Componente de acceso denegado
 */
export function AccessDenied() {
  const { userRole, currentUser } = useAuth();
  
  return (
    <div className="flex items-center justify-center h-screen bg-zinc-950">
      <div className="text-center max-w-md mx-auto p-8">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-500/20 flex items-center justify-center">
          <svg 
            className="w-10 h-10 text-red-500" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
            />
          </svg>
        </div>
        
        <h1 className="text-2xl font-bold text-white mb-2">
          Acceso Denegado
        </h1>
        
        <p className="text-zinc-400 mb-6">
          No tienes permisos suficientes para acceder a esta sección.
          {userRole && (
            <span className="block mt-2 text-sm">
              Tu rol actual: <span className="text-cyan-400 capitalize">{userRole}</span>
            </span>
          )}
        </p>
        
        <div className="space-y-3">
          <a 
            href="/Home" 
            className="block w-full px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors"
          >
            Volver al Inicio
          </a>
          
          <a 
            href="/EmployeeHome" 
            className="block w-full px-4 py-2 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600 transition-colors"
          >
            Portal del Empleado
          </a>
        </div>
        
        <p className="text-xs text-zinc-500 mt-6">
          Si crees que deberías tener acceso, contacta con el administrador.
        </p>
      </div>
    </div>
  );
}

/**
 * Hook para verificar permisos en componentes
 */
export function useRouteProtection(route) {
  const { checkRouteAccess, isAuthenticated } = useAuth();
  
  return {
    canAccess: isAuthenticated && checkRouteAccess(route),
    isAuthenticated
  };
}

export default ProtectedRoute;
