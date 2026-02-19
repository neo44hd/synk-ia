import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  RefreshCw, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Users,
  ShoppingCart,
  Mail,
  Database,
  Globe,
  Utensils,
  TrendingUp,
  Clock,
  Wifi,
  WifiOff,
  Eye,
  Settings
} from "lucide-react";
import { toast } from "sonner";

export default function SystemOverview() {
  const navigate = useNavigate();
  const [scanning, setScanning] = useState(false);
  const [systemStatus, setSystemStatus] = useState(null);
  const [lastScan, setLastScan] = useState(null);

  // Datos locales
  const { data: employees = [] } = useQuery({
    queryKey: ['revoEmployees'],
    queryFn: () => base44.entities.RevoEmployee.list()
  });

  const { data: menuItems = [] } = useQuery({
    queryKey: ['menuItems'],
    queryFn: () => base44.entities.MenuItem.list()
  });

  const { data: sales = [] } = useQuery({
    queryKey: ['sales'],
    queryFn: () => base44.entities.Sale.list('-sale_date', 100)
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => base44.entities.Invoice.list('-invoice_date', 100)
  });

  const { data: providers = [] } = useQuery({
    queryKey: ['providers'],
    queryFn: () => base44.entities.Provider.list()
  });

  const { data: webSyncs = [] } = useQuery({
    queryKey: ['webSyncs'],
    queryFn: () => base44.entities.WebSync.list('-sync_date', 10)
  });

  // Escaneo completo del sistema
  const runFullScan = async () => {
    setScanning(true);
    toast.info('🔍 Escaneando todos los sistemas...');

    try {
      const response = await base44.functions.invoke('systemFullScan');
      setSystemStatus(response.data);
      setLastScan(new Date());
      
      if (response.data?.success) {
        toast.success('✅ Escaneo completado');
      } else {
        toast.warning('⚠️ Algunos sistemas tienen problemas');
      }
    } catch (error) {
      toast.error('❌ Error en escaneo: ' + error.message);
    } finally {
      setScanning(false);
    }
  };

  // Calcular estadísticas
  const stats = {
    employees: {
      total: employees.length,
      active: employees.filter(e => e.active).length,
      roles: [...new Set(employees.map(e => e.role))].length
    },
    menu: {
      total: menuItems.length,
      categories: [...new Set(menuItems.map(m => m.category))].length,
      available: menuItems.filter(m => m.available).length
    },
    sales: {
      total: sales.length,
      today: sales.filter(s => s.sale_date?.startsWith(new Date().toISOString().split('T')[0])).length,
      revenue: sales.reduce((sum, s) => sum + (s.total || 0), 0)
    },
    invoices: {
      total: invoices.length,
      pending: invoices.filter(i => i.status === 'pendiente').length,
      totalAmount: invoices.reduce((sum, i) => sum + (i.total || 0), 0)
    },
    providers: {
      total: providers.length,
      active: providers.filter(p => p.status === 'activo').length
    }
  };

  // Agrupar productos por categoría/familia
  const productsByCategory = menuItems.reduce((acc, item) => {
    const cat = item.category || 'otros';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  // Última sincronización web
  const lastWebSync = webSyncs[0];

  const ConnectionStatus = ({ connected, label }) => (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
      connected ? 'bg-green-900/30 border border-green-700' : 'bg-red-900/30 border border-red-700'
    }`}>
      {connected ? (
        <Wifi className="w-4 h-4 text-green-400" />
      ) : (
        <WifiOff className="w-4 h-4 text-red-400" />
      )}
      <span className={`text-sm font-medium ${connected ? 'text-green-400' : 'text-red-400'}`}>
        {label}
      </span>
    </div>
  );

  return (
    <div className="p-4 md:p-8 min-h-screen bg-gradient-to-br from-zinc-950 via-neutral-900 to-zinc-950">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-3 h-3 bg-cyan-400 rounded-full animate-pulse" style={{ boxShadow: '0 0 10px rgba(6, 182, 212, 0.8)' }} />
            <span className="text-sm font-medium text-cyan-400" style={{ textShadow: '0 0 10px rgba(6, 182, 212, 0.6)' }}>
              Vista Unificada • Sistemas Completos
            </span>
          </div>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-4xl font-black text-white mb-2 flex items-center gap-4">
                <div 
                  className="w-14 h-14 bg-black rounded-2xl flex items-center justify-center border border-cyan-500/50"
                  style={{ boxShadow: '0 0 25px rgba(6, 182, 212, 0.4), inset 0 0 15px rgba(6, 182, 212, 0.1)' }}
                >
                  <Eye className="w-8 h-8 text-cyan-400" style={{ filter: 'drop-shadow(0 0 8px rgba(6, 182, 212, 0.8))' }} />
                </div>
                <span className="text-cyan-400" style={{ textShadow: '0 0 15px rgba(6, 182, 212, 0.6)' }}>SISTEMA</span>
              </h1>
              <p className="text-lg text-zinc-400">
                Todo tu negocio en un vistazo • Revo + Biloop + Email + Web
              </p>
            </div>
            <div className="flex items-center gap-3">
              {lastScan && (
                <span className="text-sm text-zinc-500">
                  Último escaneo: {lastScan.toLocaleTimeString()}
                </span>
              )}
              <Button
                onClick={runFullScan}
                disabled={scanning}
                className="bg-black border border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10"
                style={{ boxShadow: '0 0 15px rgba(6, 182, 212, 0.3)' }}
              >
                {scanning ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Escaneando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-5 h-5 mr-2" />
                    Escanear Todo
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Estado de Conexiones */}
        <Card 
          className="border-none shadow-2xl bg-black/50 border border-cyan-500/30 mb-6 cursor-pointer hover:bg-black/70 hover:border-cyan-500/50 transition-all"
          style={{ boxShadow: '0 0 30px rgba(6, 182, 212, 0.2)' }}
          onClick={() => navigate(createPageUrl("ApiDiagnostics"))}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-cyan-400">
              <Wifi className="w-5 h-5" />
              Estado de Conexiones
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <ConnectionStatus 
                connected={systemStatus?.revo?.connected ?? true} 
                label="REVO XEF" 
              />
              <ConnectionStatus 
                connected={systemStatus?.biloop?.connected ?? true} 
                label="BILOOP" 
              />
              <ConnectionStatus 
                connected={systemStatus?.email?.connected ?? true} 
                label="EMAIL" 
              />
              <ConnectionStatus 
                connected={systemStatus?.web?.connected ?? (lastWebSync?.status === 'completado')} 
                label="WEB SYNC" 
              />
            </div>
          </CardContent>
        </Card>

        {/* KPIs Principales */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <Card 
            className="border-none shadow-xl bg-gradient-to-br from-blue-600 to-blue-700 text-white cursor-pointer hover:from-blue-500 hover:to-blue-600 transition-all"
            onClick={() => navigate(createPageUrl("Staff"))}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <Users className="w-8 h-8 opacity-80" />
                <div className="text-right">
                  <p className="text-3xl font-black">{stats.employees.total}</p>
                  <p className="text-xs opacity-80">Empleados ({stats.employees.active} activos)</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="border-none shadow-xl bg-gradient-to-br from-green-600 to-green-700 text-white cursor-pointer hover:from-green-500 hover:to-green-600 transition-all"
            onClick={() => navigate(createPageUrl("RevoPortal"))}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <Utensils className="w-8 h-8 opacity-80" />
                <div className="text-right">
                  <p className="text-3xl font-black">{stats.menu.total}</p>
                  <p className="text-xs opacity-80">Productos ({stats.menu.categories} familias)</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="border-none shadow-xl bg-gradient-to-br from-purple-600 to-purple-700 text-white cursor-pointer hover:from-purple-500 hover:to-purple-600 transition-all"
            onClick={() => navigate(createPageUrl("RevoDashboard"))}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <ShoppingCart className="w-8 h-8 opacity-80" />
                <div className="text-right">
                  <p className="text-3xl font-black">{stats.sales.total}</p>
                  <p className="text-xs opacity-80">Ventas ({stats.sales.today} hoy)</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="border-none shadow-xl bg-gradient-to-br from-orange-600 to-orange-700 text-white cursor-pointer hover:from-orange-500 hover:to-orange-600 transition-all"
            onClick={() => navigate(createPageUrl("BiloopImport"))}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <Database className="w-8 h-8 opacity-80" />
                <div className="text-right">
                  <p className="text-3xl font-black">{stats.invoices.total}</p>
                  <p className="text-xs opacity-80">Facturas ({stats.invoices.pending} pend.)</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="border-none shadow-xl bg-gradient-to-br from-cyan-600 to-cyan-700 text-white cursor-pointer hover:from-cyan-500 hover:to-cyan-600 transition-all"
            onClick={() => navigate(createPageUrl("Providers"))}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <Globe className="w-8 h-8 opacity-80" />
                <div className="text-right">
                  <p className="text-3xl font-black">{stats.providers.total}</p>
                  <p className="text-xs opacity-80">Proveedores</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Contenido Principal en Tabs */}
        <Tabs defaultValue="employees" className="space-y-6">
          <TabsList className="bg-zinc-800 border border-zinc-700">
            <TabsTrigger value="employees" className="data-[state=active]:bg-blue-600">
              👥 Empleados
            </TabsTrigger>
            <TabsTrigger value="products" className="data-[state=active]:bg-green-600">
              🍗 Productos/Familias
            </TabsTrigger>
            <TabsTrigger value="finances" className="data-[state=active]:bg-orange-600">
              💰 Finanzas
            </TabsTrigger>
            <TabsTrigger value="web" className="data-[state=active]:bg-purple-600">
              🌐 Web Sync
            </TabsTrigger>
          </TabsList>

          {/* Tab Empleados */}
          <TabsContent value="employees">
            <Card className="border-none bg-zinc-800/50 border border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-400" />
                  Empleados Registrados en Revo
                </CardTitle>
              </CardHeader>
              <CardContent>
                {employees.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">
                    No hay empleados sincronizados. Ejecuta un escaneo para importar desde Revo.
                  </p>
                ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {employees.map(emp => (
                    <div key={emp.id} className="bg-zinc-900 rounded-lg p-4 border border-zinc-700">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-lg">
                            {emp.name?.charAt(0) || '?'}
                          </div>
                          <div>
                            <p className="text-white font-semibold">{emp.name}</p>
                            <p className="text-sm text-gray-400 capitalize">{emp.role}</p>
                          </div>
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                          <Badge className={emp.active ? 'bg-green-600' : 'bg-gray-600'}>
                            {emp.active ? 'Activo' : 'Inactivo'}
                          </Badge>
                          {emp.total_sales > 0 && (
                            <span className="text-sm text-green-400">
                              {emp.total_sales?.toFixed(2)}€ ventas
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab Productos */}
          <TabsContent value="products">
            <Card className="border-none bg-zinc-800/50 border border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Utensils className="w-5 h-5 text-green-400" />
                  Productos por Familia/Categoría
                </CardTitle>
              </CardHeader>
              <CardContent>
                {Object.keys(productsByCategory).length === 0 ? (
                  <p className="text-gray-400 text-center py-8">
                    No hay productos sincronizados. Ejecuta un escaneo para importar desde Revo.
                  </p>
                ) : (
                  <div className="space-y-6">
                    {Object.entries(productsByCategory).map(([category, products]) => (
                      <div key={category}>
                        <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2 capitalize">
                          <span className="w-3 h-3 rounded-full bg-green-500"></span>
                          {category} 
                          <Badge className="bg-slate-700 ml-2">{products.length} productos</Badge>
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                          {products.slice(0, 12).map(product => (
                            <div key={product.id} className="bg-zinc-900 rounded-lg p-3 border border-zinc-700">
                              <p className="text-white text-sm font-medium truncate">{product.name}</p>
                              <p className="text-green-400 font-bold">{product.price?.toFixed(2)}€</p>
                              <Badge className={product.available ? 'bg-green-600 mt-1' : 'bg-red-600 mt-1'} style={{fontSize: '10px'}}>
                                {product.available ? 'Disponible' : 'Agotado'}
                              </Badge>
                            </div>
                          ))}
                        </div>
                        {products.length > 12 && (
                          <p className="text-gray-500 text-sm mt-2">
                            +{products.length - 12} productos más...
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab Finanzas */}
          <TabsContent value="finances">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="border-none bg-zinc-800/50 border border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-green-400" />
                    Resumen de Ventas (Revo)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 bg-slate-900 rounded-lg">
                      <span className="text-gray-400">Total Ventas</span>
                      <span className="text-2xl font-bold text-green-400">
                        {stats.sales.revenue.toFixed(2)}€
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-zinc-900 rounded-lg">
                      <span className="text-gray-400">Ventas Hoy</span>
                      <span className="text-xl font-bold text-white">{stats.sales.today}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-zinc-900 rounded-lg">
                      <span className="text-gray-400">Total Transacciones</span>
                      <span className="text-xl font-bold text-white">{stats.sales.total}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none bg-zinc-800/50 border border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Database className="w-5 h-5 text-orange-400" />
                    Resumen Facturas (Biloop)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 bg-zinc-900 rounded-lg">
                      <span className="text-gray-400">Total Facturas</span>
                      <span className="text-2xl font-bold text-orange-400">
                        {stats.invoices.totalAmount.toFixed(2)}€
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-zinc-900 rounded-lg">
                      <span className="text-gray-400">Pendientes de Pago</span>
                      <span className="text-xl font-bold text-red-400">{stats.invoices.pending}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-zinc-900 rounded-lg">
                      <span className="text-gray-400">Proveedores Activos</span>
                      <span className="text-xl font-bold text-white">{stats.providers.active}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Tab Web Sync */}
          <TabsContent value="web">
            <Card className="border-none bg-zinc-800/50 border border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Globe className="w-5 h-5 text-purple-400" />
                  Sincronización con Web
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!lastWebSync ? (
                  <p className="text-gray-400 text-center py-8">
                    No hay sincronizaciones web registradas.
                  </p>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-700">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-white font-semibold">Última Sincronización</span>
                        <Badge className={lastWebSync.status === 'completado' ? 'bg-green-600' : 'bg-yellow-600'}>
                          {lastWebSync.status}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-gray-400">Tipo</p>
                          <p className="text-white">{lastWebSync.sync_type}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Plataforma</p>
                          <p className="text-white">{lastWebSync.platform}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Items Sincronizados</p>
                          <p className="text-white">{lastWebSync.total_items || 0}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Fecha</p>
                          <p className="text-white">
                            {lastWebSync.sync_date ? new Date(lastWebSync.sync_date).toLocaleString() : '-'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Resultado del Escaneo */}
        {systemStatus && (
          <Card className="border-none bg-zinc-800/50 border border-zinc-800 mt-6">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-yellow-400" />
                Resultado del Último Escaneo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-zinc-900 p-4 rounded-lg text-xs text-gray-300 overflow-auto max-h-64">
                {JSON.stringify(systemStatus, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}