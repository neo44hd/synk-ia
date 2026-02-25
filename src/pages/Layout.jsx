
import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { 
  LayoutDashboard, 
  DollarSign, 
  Users, 
  FileText, 
  Shield, 
  Settings,
  LogOut,
  Menu,
  X,
  Brain,
  ChevronDown,
  Mail,
  Camera,
  Briefcase,
  Package,
  ShoppingCart,
  Clock,
  Bell
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import NotificationBell from "@/components/NotificationBell";
import { BackgroundTasksProvider, BackgroundTasksIndicator } from "@/components/BackgroundTasksManager";
import { base44 } from "@/api/base44Client";

// Navegación Minimalista "Zen"
const navItems = [
  { 
    id: "dashboard",
    label: "Control", 
    icon: LayoutDashboard, 
    items: [
      { label: "Resumen General", url: createPageUrl("Dashboard") },
      { label: "CEO Brain (IA)", url: createPageUrl("CEOBrain") },
      { label: "Cámaras & Seguridad", url: createPageUrl("SecurityCameras") },
    ]
  },
  { 
    id: "business",
    label: "Negocio", 
    icon: Briefcase,
    items: [
      { label: "Finanzas & KPIs", url: createPageUrl("FinanceDashboard") },
      { label: "Ventas (Revo)", url: createPageUrl("RevoDashboard") },
      { label: "Facturación", url: createPageUrl("Billing") },
      { label: "Proveedores", url: createPageUrl("Providers") },
      { label: "Inventario", url: createPageUrl("ProductInventory") },
    ]
  },
  { 
    id: "team",
    label: "Equipo", 
    icon: Users,
    items: [
      { label: "Portal Empleado", url: createPageUrl("Staff") },
      { label: "Control Horario", url: createPageUrl("AttendanceControl") },
      { label: "Portal Empleado", url: createPageUrl("WorkerInterface") },
    ]
  },
  { 
    id: "documents",
    label: "Archivo", 
    icon: FileText,
    items: [
      { label: "Archivo Inteligente", url: createPageUrl("DocumentArchive") },
      { label: "Legal & Empresa", url: createPageUrl("CompanyDocs") },
      { label: "Buzón Inteligente", url: "/correo" },
    ]
  }
];

export default function Layout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Detectar sección activa
  const getActiveSection = () => {
    for (const nav of navItems) {
      if (nav.items.some(item => location.pathname === item.url)) {
        return nav.id;
      }
    }
    return "inicio";
  };

  const activeSection = getActiveSection();

  // MODO PORTAL EMPLEADO: Sin layout de administración
  if (location.pathname.includes('PortalLogin') || location.pathname.includes('WorkerInterface')) {
    return <>{children}</>;
  }

  return (
    <BackgroundTasksProvider>
      <style>{`
        :root {
          --nav-bg: #0a0a0b;
          --nav-hover: #1a1a1f;
        }
      `}</style>
      
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-zinc-950 via-neutral-900 to-zinc-950">
        {/* Header / Navbar Superior */}
        <header className="bg-black/90 backdrop-blur-xl border-b border-zinc-800/50 sticky top-0 z-50">
          <div className="max-w-full mx-auto">
            {/* Barra principal */}
            <div className="flex items-center justify-between px-4 h-14">
              {/* Logo */}
              <Link to={createPageUrl("Dashboard")} className="flex items-center gap-3 group">
                    <div 
                      className="w-9 h-9 bg-black rounded-lg flex items-center justify-center border border-cyan-500/50 group-hover:border-cyan-400 transition-all"
                      style={{
                        boxShadow: '0 0 15px rgba(6, 182, 212, 0.4), 0 0 30px rgba(6, 182, 212, 0.2), inset 0 0 10px rgba(6, 182, 212, 0.1)'
                      }}
                    >
                      <Brain 
                        className="w-5 h-5 text-cyan-400 group-hover:text-cyan-300 transition-all" 
                        style={{
                          filter: 'drop-shadow(0 0 6px rgba(6, 182, 212, 0.8))'
                        }}
                      />
                    </div>
                    <span 
                      className="text-lg font-bold text-cyan-400 hidden sm:block tracking-tight"
                      style={{
                        textShadow: '0 0 10px rgba(6, 182, 212, 0.6)'
                      }}
                    >
                      SYNK-IA
                    </span>
                  </Link>

              {/* Navegación Desktop Zen */}
              <nav className="hidden lg:flex items-center gap-6 ml-8">
                {navItems.map((nav) => {
                  const isActive = activeSection === nav.id;
                  
                  return (
                    <DropdownMenu key={nav.id}>
                      <DropdownMenuTrigger asChild>
                        <button
                          className={`flex items-center gap-2 text-sm font-medium transition-all outline-none ${
                            isActive
                              ? "text-white"
                              : "text-zinc-500 hover:text-zinc-300"
                          }`}
                        >
                          {nav.label}
                          <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isActive ? "rotate-180 text-zinc-400" : "text-zinc-600"}`} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent 
                        align="start" 
                        sideOffset={8}
                        className="bg-black/95 backdrop-blur-2xl border border-zinc-800 p-1 rounded-xl shadow-2xl min-w-56 animate-in fade-in-0 zoom-in-95"
                      >
                        {nav.items.map((item) => {
                          const isItemActive = location.pathname === item.url;
                          return (
                            <DropdownMenuItem 
                              key={item.url}
                              onClick={() => navigate(item.url)}
                              className={`cursor-pointer rounded-lg px-3 py-2.5 text-sm transition-colors ${
                                isItemActive 
                                  ? "bg-zinc-800 text-white font-medium" 
                                  : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
                              }`}
                            >
                              {item.label}
                            </DropdownMenuItem>
                          );
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  );
                })}
              </nav>

              {/* Acciones derecha */}
              <div className="flex items-center gap-1">
                <NotificationBell />
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800">
                      <Settings className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-800">
                    <DropdownMenuItem onClick={() => navigate(createPageUrl("ApiDiagnostics"))} className="text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer">
                      <Shield className="w-4 h-4 mr-2" /> Diagnóstico APIs
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate(createPageUrl("AutomationHub"))} className="text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer">
                      <Settings className="w-4 h-4 mr-2" /> Automatización
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-zinc-800" />
                    <DropdownMenuItem onClick={() => base44.auth.logout()} className="text-red-400 hover:bg-zinc-800 cursor-pointer">
                      <LogOut className="w-4 h-4 mr-2" /> Cerrar sesión
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Menú móvil toggle */}
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="lg:hidden text-zinc-500 hover:text-zinc-300"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                >
                  {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </Button>
              </div>
            </div>

            {/* Menú móvil expandido Zen */}
            {mobileMenuOpen && (
              <div className="lg:hidden border-t border-zinc-800 bg-black pb-6 h-screen overflow-y-auto">
                {navItems.map((nav) => {
                  const isActive = activeSection === nav.id;
                  return (
                    <div key={nav.id} className="px-6 py-4 border-b border-zinc-900/50">
                      <p className={`text-xs font-bold uppercase mb-3 tracking-wider flex items-center gap-2 ${isActive ? "text-white" : "text-zinc-600"}`}>
                        <nav.icon className="w-4 h-4" />
                        {nav.label}
                      </p>
                      <div className="space-y-1 pl-2 border-l border-zinc-800">
                        {nav.items.map((item) => {
                          const isItemActive = location.pathname === item.url;
                          return (
                            <Link
                              key={item.url}
                              to={item.url}
                              onClick={() => setMobileMenuOpen(false)}
                              className={`block py-2.5 px-4 rounded-r-lg text-base ${
                                isItemActive
                                  ? "bg-zinc-900 text-white font-medium"
                                  : "text-zinc-500 hover:text-zinc-300"
                              }`}
                            >
                              {item.label}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                <div className="px-6 pt-6 mt-2">
                  <Button
                    onClick={() => base44.auth.logout()}
                    variant="outline"
                    className="w-full border-zinc-700 text-zinc-400 hover:text-red-400 hover:border-red-500/50 hover:bg-red-500/10"
                  >
                    <LogOut className="w-4 h-4 mr-2" /> Cerrar sesión
                  </Button>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Contenido principal */}
        <main className="flex-1">
          {children}
        </main>

        {/* Background Tasks Indicator */}
        <BackgroundTasksIndicator />
      </div>
    </BackgroundTasksProvider>
  );
}
