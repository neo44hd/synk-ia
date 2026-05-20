/**
 * Sistema de Roles y Permisos para SYNK-IA
 * 
 * Configuración centralizada de roles, permisos y rutas permitidas.
 */

// Definición de roles
export const ROLES = {
  CEO: 'ceo',
  ADMIN: 'admin',
  EMPLOYEE: 'employee'
};

// Jerarquía de roles (índice mayor = más permisos)
export const ROLE_HIERARCHY = {
  [ROLES.EMPLOYEE]: 1,
  [ROLES.ADMIN]: 2,
  [ROLES.CEO]: 3
};

// Usuarios con roles predefinidos (CEO por defecto)
export const PREDEFINED_USERS = {
  'admin@synk.com': ROLES.CEO,
  'admin@synkia.com': ROLES.CEO
};

// Permisos disponibles en el sistema
export const PERMISSIONS = {
  // Gestión general
  VIEW_DASHBOARD: 'view_dashboard',
  VIEW_HOME: 'view_home',
  
  // Finanzas
  VIEW_INVOICES: 'view_invoices',
  MANAGE_INVOICES: 'manage_invoices',
  VIEW_BILLING: 'view_billing',
  VIEW_ALBARANES: 'view_albaranes',
  VIEW_FINANCE: 'view_finance',
  VIEW_VERIFACTU: 'view_verifactu',
  
  // RRHH
  VIEW_STAFF: 'view_staff',
  MANAGE_STAFF: 'manage_staff',
  VIEW_CONTRACTS: 'view_contracts',
  VIEW_PAYROLLS: 'view_payrolls',
  VIEW_ALL_PAYROLLS: 'view_all_payrolls',
  VIEW_VACATION_REQUESTS: 'view_vacation_requests',
  MANAGE_VACATION_REQUESTS: 'manage_vacation_requests',
  VIEW_TIMESHEETS: 'view_timesheets',
  VIEW_ATTENDANCE: 'view_attendance',
  VIEW_HR_DOCUMENTS: 'view_hr_documents',
  
  // Portal empleado
  VIEW_EMPLOYEE_PORTAL: 'view_employee_portal',
  VIEW_OWN_ATTENDANCE: 'view_own_attendance',
  VIEW_OWN_PAYROLLS: 'view_own_payrolls',
  VIEW_OWN_PROFILE: 'view_own_profile',
  
  // Operaciones
  VIEW_PROVIDERS: 'view_providers',
  VIEW_INVENTORY: 'view_inventory',
  VIEW_PRODUCTION: 'view_production',
  VIEW_KITCHEN: 'view_kitchen',
  VIEW_ORDERS: 'view_orders',
  
  // Integraciones
  VIEW_BILOOP: 'view_biloop',
  VIEW_REVO: 'view_revo',
  VIEW_EMAIL: 'view_email',
  
  // Sistema
  VIEW_SYSTEM_CONFIG: 'view_system_config',
  MANAGE_SYSTEM_CONFIG: 'manage_system_config',
  VIEW_DIAGNOSTICS: 'view_diagnostics',
  VIEW_AUTOMATION: 'view_automation',
  VIEW_SECURITY: 'view_security',
  
  // Legal y documentos
  VIEW_LEGAL: 'view_legal',
  VIEW_DOCUMENTS: 'view_documents',
  VIEW_RGPD: 'view_rgpd',
  
  // Gestoria
  VIEW_GESTORIA: 'view_gestoria',
  
  // IA y agentes
  VIEW_CEO_BRAIN: 'view_ceo_brain',
  VIEW_AGENTS: 'view_agents',
  VIEW_VOICE_COMMANDS: 'view_voice_commands',
  
  // Reportes
  VIEW_REPORTS: 'view_reports',
  VIEW_BUSINESS_ANALYSIS: 'view_business_analysis'
};

// Permisos por rol
export const ROLE_PERMISSIONS = {
  [ROLES.CEO]: Object.values(PERMISSIONS), // CEO tiene TODOS los permisos
  
  [ROLES.ADMIN]: [
    // Dashboard y general
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_HOME,
    
    // Finanzas
    PERMISSIONS.VIEW_INVOICES,
    PERMISSIONS.MANAGE_INVOICES,
    PERMISSIONS.VIEW_BILLING,
    PERMISSIONS.VIEW_ALBARANES,
    PERMISSIONS.VIEW_FINANCE,
    PERMISSIONS.VIEW_VERIFACTU,
    
    // RRHH
    PERMISSIONS.VIEW_STAFF,
    PERMISSIONS.MANAGE_STAFF,
    PERMISSIONS.VIEW_CONTRACTS,
    PERMISSIONS.VIEW_ALL_PAYROLLS,
    PERMISSIONS.VIEW_PAYROLLS,
    PERMISSIONS.VIEW_VACATION_REQUESTS,
    PERMISSIONS.MANAGE_VACATION_REQUESTS,
    PERMISSIONS.VIEW_TIMESHEETS,
    PERMISSIONS.VIEW_ATTENDANCE,
    PERMISSIONS.VIEW_HR_DOCUMENTS,
    PERMISSIONS.VIEW_EMPLOYEE_PORTAL,
    PERMISSIONS.VIEW_OWN_PROFILE,
    
    // Operaciones
    PERMISSIONS.VIEW_PROVIDERS,
    PERMISSIONS.VIEW_INVENTORY,
    PERMISSIONS.VIEW_PRODUCTION,
    PERMISSIONS.VIEW_KITCHEN,
    PERMISSIONS.VIEW_ORDERS,
    
    // Integraciones
    PERMISSIONS.VIEW_BILOOP,
    PERMISSIONS.VIEW_REVO,
    PERMISSIONS.VIEW_EMAIL,
    
    // Documentos
    PERMISSIONS.VIEW_DOCUMENTS,
    PERMISSIONS.VIEW_LEGAL,
    
    // Gestoria
    PERMISSIONS.VIEW_GESTORIA,
    
    // IA básica
    PERMISSIONS.VIEW_AGENTS,
    
    // Reportes
    PERMISSIONS.VIEW_REPORTS
  ],
  
  [ROLES.EMPLOYEE]: [
    // Portal empleado básico
    PERMISSIONS.VIEW_EMPLOYEE_PORTAL,
    PERMISSIONS.VIEW_OWN_ATTENDANCE,
    PERMISSIONS.VIEW_OWN_PAYROLLS,
    PERMISSIONS.VIEW_OWN_PROFILE,
    PERMISSIONS.VIEW_HOME
  ]
};

// Mapeo de rutas a permisos requeridos
// null = ruta pública, [] = solo autenticación requerida
export const ROUTE_PERMISSIONS = {
  // Rutas públicas (sin autenticación)
  '/ordersdashboard': null, // También pública para pedidos
  
  // Rutas que solo requieren autenticación (cualquier rol)
  '/': [],
  '/home': [],
  '/myprofile': [PERMISSIONS.VIEW_OWN_PROFILE],
  '/notifications': [],
  
  // Dashboard y general
  '/dashboard': [PERMISSIONS.VIEW_DASHBOARD],
  
  // Finanzas
  '/albaranes': [PERMISSIONS.VIEW_ALBARANES],
  '/billing': [PERMISSIONS.VIEW_BILLING],
  '/invoices': [PERMISSIONS.VIEW_INVOICES],
  '/gestorfacturas': [PERMISSIONS.VIEW_INVOICES],
  '/financedashboard': [PERMISSIONS.VIEW_FINANCE],
  '/verifactu': [PERMISSIONS.VIEW_VERIFACTU],
  
  // RRHH
  '/staff': [PERMISSIONS.VIEW_STAFF],
  '/contracts': [PERMISSIONS.VIEW_CONTRACTS],
  '/payrolls': [PERMISSIONS.VIEW_PAYROLLS],
  '/vacationrequests': [PERMISSIONS.VIEW_VACATION_REQUESTS],
  '/timesheets': [PERMISSIONS.VIEW_TIMESHEETS],
  '/attendancecontrol': [PERMISSIONS.VIEW_ATTENDANCE],
  '/hrdocuments': [PERMISSIONS.VIEW_HR_DOCUMENTS],
  '/hragent': [PERMISSIONS.VIEW_STAFF],
  '/mutuamanager': [PERMISSIONS.VIEW_STAFF],
  
  // Portal empleado
  '/employeehome': [PERMISSIONS.VIEW_EMPLOYEE_PORTAL],
  '/workerinterface': [PERMISSIONS.VIEW_EMPLOYEE_PORTAL],
  '/workermobile': [PERMISSIONS.VIEW_EMPLOYEE_PORTAL],
  
  // Operaciones
  '/providers': [PERMISSIONS.VIEW_PROVIDERS],
  '/productinventory': [PERMISSIONS.VIEW_INVENTORY],
  '/productioncontrol': [PERMISSIONS.VIEW_PRODUCTION],
  '/kitchendisplay': [PERMISSIONS.VIEW_KITCHEN],
  '/comparator': [PERMISSIONS.VIEW_PROVIDERS],
  
  // Gestión de Carta
  
  // Integraciones
  '/biloopagent': [PERMISSIONS.VIEW_BILOOP],
  '/biloopdocuments': [PERMISSIONS.VIEW_BILOOP],
  '/biloopimport': [PERMISSIONS.VIEW_BILOOP],
  '/revodashboard': [PERMISSIONS.VIEW_REVO],
  '/revosync': [PERMISSIONS.VIEW_REVO],
  '/revomanual': [PERMISSIONS.VIEW_REVO],
  '/websync': [PERMISSIONS.VIEW_REVO],
  '/emailsetup': [PERMISSIONS.VIEW_EMAIL],
  '/emailprocessor': [PERMISSIONS.VIEW_EMAIL],
  '/emailtriage': [PERMISSIONS.VIEW_EMAIL],
  '/smartmailbox': [PERMISSIONS.VIEW_EMAIL],
  
  // Sistema y configuración
  '/systemoverview': [PERMISSIONS.VIEW_SYSTEM_CONFIG],
  '/cronsetup': [PERMISSIONS.MANAGE_SYSTEM_CONFIG],
  '/apidiagnostics': [PERMISSIONS.VIEW_DIAGNOSTICS],
  '/connectiondiagnostics': [PERMISSIONS.VIEW_DIAGNOSTICS],
  '/automationhub': [PERMISSIONS.VIEW_AUTOMATION],
  '/securitycameras': [PERMISSIONS.VIEW_SECURITY],
  
  // Legal y documentos
  '/legalvault': [PERMISSIONS.VIEW_LEGAL],
  '/companydocs': [PERMISSIONS.VIEW_DOCUMENTS],
  '/documentarchive': [PERMISSIONS.VIEW_DOCUMENTS],
  '/rgpdmanager': [PERMISSIONS.VIEW_RGPD],
  
  // Gestoria
  '/portalgestoria': [PERMISSIONS.VIEW_GESTORIA],
  '/portallogin': null, // Página de login siempre pública
  
  // IA y agentes
  '/ceobrain': [PERMISSIONS.VIEW_CEO_BRAIN],
  '/centralagent': [PERMISSIONS.VIEW_AGENTS],
  '/voicecommands': [PERMISSIONS.VIEW_VOICE_COMMANDS],
  
  // Reportes
  '/executivereports': [PERMISSIONS.VIEW_REPORTS],
  '/businessanalysis': [PERMISSIONS.VIEW_BUSINESS_ANALYSIS],
  
  // Showcase (demo)
  '/showcase': []
};

// Función helper para verificar si un rol tiene un permiso
export const hasPermission = (role, permission) => {
  if (!role) return false;
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes(permission);
};

// Función helper para verificar si un rol puede acceder a una ruta
export const canAccessRoute = (role, route) => {
  const requiredPermissions = ROUTE_PERMISSIONS[route];
  
  // Ruta pública
  if (requiredPermissions === null) return true;
  
  // Ruta no configurada - por defecto requiere CEO
  if (requiredPermissions === undefined) {
    return role === ROLES.CEO;
  }
  
  // Ruta que solo requiere autenticación
  if (requiredPermissions.length === 0) return true;
  
  // Verificar permisos
  return requiredPermissions.every(perm => hasPermission(role, perm));
};

// Función para obtener el rol de un usuario
export const getUserRole = (user) => {
  if (!user) return null;
  
  // Primero verificar si el usuario tiene un rol predefinido
  const email = user.email?.toLowerCase();
  if (email && PREDEFINED_USERS[email]) {
    return PREDEFINED_USERS[email];
  }
  
  // Luego verificar si tiene un rol asignado en su perfil
  if (user.role) {
    // Normalizar el rol
    const normalizedRole = user.role.toLowerCase();
    if (Object.values(ROLES).includes(normalizedRole)) {
      return normalizedRole;
    }
  }
  
  // Por defecto, empleado
  return ROLES.EMPLOYEE;
};

// Función para verificar jerarquía de roles
export const hasRoleLevel = (userRole, requiredRole) => {
  const userLevel = ROLE_HIERARCHY[userRole] || 0;
  const requiredLevel = ROLE_HIERARCHY[requiredRole] || 0;
  return userLevel >= requiredLevel;
};

export default {
  ROLES,
  ROLE_HIERARCHY,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  ROUTE_PERMISSIONS,
  PREDEFINED_USERS,
  hasPermission,
  canAccessRoute,
  getUserRole,
  hasRoleLevel
};