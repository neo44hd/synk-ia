import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { 
  TrendingDown, 
  FileText, 
  Users, 
  DollarSign, 
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  Eye,
  ChevronRight,
  ShoppingCart,
  Camera,
  Shield,
  Package,
  Activity,
  Calendar,
  Clock
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { format, subMonths, isValid } from 'date-fns';
import CategoryPieChart from '@/components/dashboard/CategoryPieChart';
import LiveAttendance from '@/components/dashboard/LiveAttendance';

export default function Dashboard() {
  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => base44.entities.Invoice.list('-invoice_date', 200),
    staleTime: 30000,
  });

  const { data: providers = [] } = useQuery({
    queryKey: ['providers'],
    queryFn: () => base44.entities.Provider.list('-created_date', 100),
    staleTime: 60000,
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list('-total_spent', 100),
    staleTime: 60000,
  });

  const { data: salesInvoices = [] } = useQuery({
    queryKey: ['sales-invoices'],
    queryFn: () => base44.entities.SalesInvoice.list('-invoice_date', 200),
    staleTime: 30000,
  });

  const { data: orders = [] } = useQuery({
    queryKey: ['orders-dashboard'],
    queryFn: () => base44.entities.Order.list('-order_date', 50),
    staleTime: 10000,
  });

  const { data: sales = [] } = useQuery({
    queryKey: ['sales-dashboard'],
    queryFn: () => base44.entities.Sale.list('-sale_date', 100),
    staleTime: 30000,
  });

  // Cálculos principales
  const totalGastos = invoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
  const totalIngresos = salesInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
  const margenBruto = totalIngresos - totalGastos;
  const pendientePago = invoices.filter(inv => inv.status === 'pendiente').reduce((sum, inv) => sum + (inv.total || 0), 0);

  // Operaciones HOY
  const today = new Date().toISOString().split('T')[0];
  const todayOrders = orders.filter(o => o.order_date?.startsWith(today));
  const activeOrders = todayOrders.filter(o => ['nuevo', 'confirmado', 'en_cocina'].includes(o.status));
  const todaySales = sales.filter(s => s.sale_date?.startsWith(today));
  const todayRevenue = todaySales.reduce((sum, s) => sum + (s.total || 0), 0) + todayOrders.reduce((sum, o) => sum + (o.total || 0), 0);

  // Facturas vencidas
  const facturasVencidas = invoices.filter(inv => inv.status === 'vencida');
  
  // Productos con precio subiendo
  const preciosSubiendo = products.filter(p => p.price_trend === 'subiendo').slice(0, 5);

  // Datos por mes (últimos 6 meses)
  const monthlyData = [];
  for (let i = 5; i >= 0; i--) {
    const date = subMonths(new Date(), i);
    const monthStr = format(date, 'yyyy-MM');
    const monthInvoices = invoices.filter(inv => inv.invoice_date?.startsWith(monthStr));
    const monthSales = salesInvoices.filter(inv => inv.invoice_date?.startsWith(monthStr));
    monthlyData.push({
      month: format(date, 'MMM'),
      gastos: monthInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0),
      ingresos: monthSales.reduce((sum, inv) => sum + (inv.total || 0), 0)
    });
  }

  // Gastos por categoría
  const categoryData = invoices.reduce((acc, inv) => {
    const cat = inv.category || 'otros';
    if (!acc[cat]) acc[cat] = 0;
    acc[cat] += inv.total || 0;
    return acc;
  }, {});
  const pieData = Object.entries(categoryData).map(([name, value]) => ({ name, value: Math.round(value) }));
  const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444'];

  // Top proveedores
  const providerSpending = invoices.reduce((acc, inv) => {
    const provider = inv.provider_name || 'Sin nombre';
    if (!acc[provider]) acc[provider] = 0;
    acc[provider] += inv.total || 0;
    return acc;
  }, {});
  const topProviders = Object.entries(providerSpending)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, gasto]) => ({ name: name.length > 18 ? name.substring(0, 18) + '...' : name, gasto: Math.round(gasto) }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-neutral-900 to-zinc-950 p-4 md:p-8">
      <div className="max-w-[1800px] mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-3 h-3 bg-cyan-400 rounded-full animate-pulse" style={{ boxShadow: '0 0 10px rgba(6, 182, 212, 0.8)' }} />
            <span className="text-sm font-medium text-cyan-400" style={{ textShadow: '0 0 10px rgba(6, 182, 212, 0.6)' }}>
              Live • {format(new Date(), 'HH:mm')} • {format(new Date(), "EEEE dd MMM")}
            </span>
          </div>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <h1 className="text-4xl font-black text-white mb-2 flex items-center gap-4">
                <div 
                  className="w-14 h-14 bg-black rounded-2xl flex items-center justify-center border border-cyan-500/50"
                  style={{ boxShadow: '0 0 25px rgba(6, 182, 212, 0.4), inset 0 0 15px rgba(6, 182, 212, 0.1)' }}
                >
                  <Activity className="w-8 h-8 text-cyan-400" style={{ filter: 'drop-shadow(0 0 8px rgba(6, 182, 212, 0.8))' }} />
                </div>
                <span className="text-cyan-400" style={{ textShadow: '0 0 15px rgba(6, 182, 212, 0.6)' }}>CONTROL CENTRAL</span>
              </h1>
              <p className="text-lg text-zinc-400">Vista general del negocio en tiempo real</p>
            </div>
            <div className="flex gap-3">
              <Link to={createPageUrl("FinanceDashboard")}>
                <Button className="bg-black border border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10 font-bold" style={{ boxShadow: '0 0 20px rgba(6, 182, 212, 0.4)' }}>
                  💰 Finanzas
                </Button>
              </Link>
              <Link to={createPageUrl("ProductInventory")}>
                <Button variant="outline" className="border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-cyan-400">
                  📦 Inventario
                </Button>
              </Link>
              <Link to={createPageUrl("AutomationHub")}>
                <Button variant="outline" className="border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-cyan-400">
                  ⚡ Auto-Sync
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Asistencia en Tiempo Real (CEO Widget) */}
        <div className="mb-8">
          <LiveAttendance />
        </div>

        {/* KPIs Principales */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Link to={createPageUrl("RevoDashboard")}>
            <Card className="border-none shadow-xl bg-black border border-green-500/50 hover:border-green-500 transition-all cursor-pointer" style={{ boxShadow: '0 0 30px rgba(34, 197, 94, 0.3)' }}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <DollarSign className="w-10 h-10 text-green-400" style={{ filter: 'drop-shadow(0 0 8px rgba(34, 197, 94, 0.8))' }} />
                  <Badge className="bg-green-600 text-white">HOY</Badge>
                </div>
                <p className="text-4xl font-black text-white">{todayRevenue.toFixed(0)}€</p>
                <p className="text-sm text-green-300 mt-1">Facturación</p>
                <div className="mt-3 pt-3 border-t border-green-500/20 text-xs flex justify-between text-zinc-400">
                  <span>📊 {todaySales.length} ventas</span>
                  <span>📦 {todayOrders.length} pedidos</span>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Card className="border-none shadow-xl bg-black border border-red-500/50" style={{ boxShadow: '0 0 30px rgba(239, 68, 68, 0.3)' }}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <ArrowDownRight className="w-10 h-10 text-red-400" style={{ filter: 'drop-shadow(0 0 8px rgba(239, 68, 68, 0.8))' }} />
                <TrendingDown className="w-5 h-5 text-red-400" />
              </div>
              <p className="text-4xl font-black text-white">{totalGastos.toFixed(0)}€</p>
              <p className="text-sm text-red-300 mt-1">Gastos Total</p>
              <div className="mt-3 pt-3 border-t border-red-500/20 text-xs text-zinc-400">
                <span>📄 {invoices.length} facturas</span>
              </div>
            </CardContent>
          </Card>

          <Card className={`border-none shadow-xl bg-black ${margenBruto >= 0 ? 'border border-cyan-500/50' : 'border border-orange-500/50'}`} style={{ boxShadow: margenBruto >= 0 ? '0 0 30px rgba(6, 182, 212, 0.3)' : '0 0 30px rgba(249, 115, 22, 0.3)' }}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                {margenBruto >= 0 ? <ArrowUpRight className="w-10 h-10 text-cyan-400" style={{ filter: 'drop-shadow(0 0 8px rgba(6, 182, 212, 0.8))' }} /> : <ArrowDownRight className="w-10 h-10 text-orange-400" style={{ filter: 'drop-shadow(0 0 8px rgba(249, 115, 22, 0.8))' }} />}
                {margenBruto >= 0 ? <TrendingUp className="w-5 h-5 text-cyan-400" /> : <TrendingDown className="w-5 h-5 text-orange-400" />}
              </div>
              <p className="text-4xl font-black text-white">{margenBruto.toFixed(0)}€</p>
              <p className={`text-sm mt-1 ${margenBruto >= 0 ? 'text-cyan-300' : 'text-orange-300'}`}>Margen Bruto</p>
              <div className={`mt-3 pt-3 text-xs text-zinc-400 ${margenBruto >= 0 ? 'border-t border-cyan-500/20' : 'border-t border-orange-500/20'}`}>
                <span>💵 Ingresos: {totalIngresos.toFixed(0)}€</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-xl bg-black border border-yellow-500/50" style={{ boxShadow: '0 0 30px rgba(234, 179, 8, 0.3)' }}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <Clock className="w-10 h-10 text-yellow-400" style={{ filter: 'drop-shadow(0 0 8px rgba(234, 179, 8, 0.8))' }} />
                <AlertTriangle className="w-5 h-5 text-yellow-400" />
              </div>
              <p className="text-4xl font-black text-white">{pendientePago.toFixed(0)}€</p>
              <p className="text-sm text-yellow-300 mt-1">Pendiente Pago</p>
              <div className="mt-3 pt-3 border-t border-yellow-500/20 text-xs text-zinc-400">
                <span>⏳ {invoices.filter(i => i.status === 'pendiente').length} facturas</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Alertas */}
        {(facturasVencidas.length > 0 || preciosSubiendo.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {facturasVencidas.length > 0 && (
              <Card className="border-none shadow-xl bg-red-900/30 border border-red-500/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-5 h-5 text-red-400" />
                    <span className="font-bold text-red-400">⚠️ {facturasVencidas.length} Facturas Vencidas</span>
                  </div>
                  <div className="space-y-2">
                    {facturasVencidas.slice(0, 3).map(inv => (
                      <div key={inv.id} className="flex justify-between text-sm">
                        <span className="text-gray-300 truncate">{inv.provider_name}</span>
                        <span className="text-red-400 font-bold">{inv.total?.toFixed(2)}€</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
            
            {preciosSubiendo.length > 0 && (
              <Card className="border-none shadow-xl bg-orange-900/30 border border-orange-500/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="w-5 h-5 text-orange-400" />
                    <span className="font-bold text-orange-400">📈 Precios Subiendo</span>
                  </div>
                  <div className="space-y-2">
                    {preciosSubiendo.map(prod => (
                      <div key={prod.id} className="flex justify-between text-sm">
                        <span className="text-gray-300 truncate">{prod.name}</span>
                        <Badge className="bg-orange-600 text-white">+{prod.price_change_percent?.toFixed(1)}%</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Gráficos principales */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card className="border-none shadow-xl bg-zinc-800/50 border border-zinc-800">
            <CardHeader><CardTitle className="text-white">Evolución Mensual (6 meses)</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="month" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none' }} />
                  <Bar dataKey="ingresos" fill="#10b981" name="Ingresos" />
                  <Bar dataKey="gastos" fill="#ef4444" name="Gastos" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-none shadow-xl bg-zinc-800/50 border border-zinc-800">
            <CardHeader><CardTitle className="text-white">Gastos por Categoría</CardTitle></CardHeader>
            <CardContent>
              <CategoryPieChart data={pieData} colors={COLORS} />
            </CardContent>
          </Card>
        </div>

        {/* Resúmenes rápidos */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="border-none shadow-xl bg-zinc-800/50 border border-zinc-800">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-white text-lg">Top Proveedores</CardTitle>
              <Link to={createPageUrl("Providers")}><Button variant="ghost" size="sm" className="text-blue-400"><Eye className="w-4 h-4" /></Button></Link>
            </CardHeader>
            <CardContent className="space-y-3">
              {topProviders.map((prov, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold ${idx < 3 ? 'bg-blue-600' : 'bg-slate-600'}`}>{idx + 1}</div>
                    <span className="text-gray-300 truncate text-sm">{prov.name}</span>
                  </div>
                  <span className="text-white font-bold">{prov.gasto}€</span>
                </div>
              ))}
              {topProviders.length === 0 && <p className="text-gray-500 text-center py-4">Sin datos</p>}
            </CardContent>
          </Card>

          <Card className="border-none shadow-xl bg-zinc-800/50 border border-zinc-800">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-white text-lg">Top Productos</CardTitle>
              <Link to={createPageUrl("ProductInventory")}><Button variant="ghost" size="sm" className="text-blue-400"><Eye className="w-4 h-4" /></Button></Link>
            </CardHeader>
            <CardContent className="space-y-3">
              {products.slice(0, 5).map((prod, idx) => (
                <div key={prod.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold ${idx < 3 ? 'bg-emerald-600' : 'bg-slate-600'}`}>{idx + 1}</div>
                    <span className="text-gray-300 truncate text-sm">{prod.name}</span>
                  </div>
                  <span className="text-white font-bold">{prod.total_spent?.toFixed(0)}€</span>
                </div>
              ))}
              {products.length === 0 && <p className="text-gray-500 text-center py-4">Sin productos</p>}
            </CardContent>
          </Card>

          <Card className="border-none shadow-xl bg-zinc-800/50 border border-zinc-800">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-white text-lg">Últimas Facturas</CardTitle>
              <Link to={createPageUrl("BiloopImport")}><Button variant="ghost" size="sm" className="text-blue-400"><Eye className="w-4 h-4" /></Button></Link>
            </CardHeader>
            <CardContent className="space-y-3">
              {invoices.slice(0, 5).map(inv => (
                <div key={inv.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-300 text-sm truncate">{inv.provider_name}</p>
                    <p className="text-gray-500 text-xs">{inv.invoice_date}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-bold">{inv.total?.toFixed(0)}€</p>
                    <Badge className={inv.status === 'pagada' ? 'bg-green-600' : inv.status === 'vencida' ? 'bg-red-600' : 'bg-yellow-600'}>{inv.status}</Badge>
                  </div>
                </div>
              ))}
              {invoices.length === 0 && <p className="text-gray-500 text-center py-4">Sin facturas</p>}
            </CardContent>
          </Card>
        </div>

        {/* Cámaras y Sistema */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-none shadow-xl bg-zinc-800/50 border border-zinc-800">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-white flex items-center gap-2"><Camera className="w-5 h-5" />Cámaras</CardTitle>
              <Link to={createPageUrl("SecurityCameras")}><Button variant="ghost" size="sm" className="text-blue-400"><ChevronRight className="w-4 h-4" /></Button></Link>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {['Entrada', 'Cocina', 'Mostrador', 'Almacén'].map((cam, idx) => (
                  <div key={idx} className="bg-zinc-800 rounded-lg p-4 flex items-center justify-between">
                    <span className="text-gray-300">{cam}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      <span className="text-xs text-green-400">LIVE</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Link to={createPageUrl("ApiDiagnostics")}>
            <Card className="border-none shadow-xl bg-zinc-800/50 border border-zinc-800 hover:bg-zinc-800 hover:border-cyan-500/50 transition-all cursor-pointer">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Shield className="w-5 h-5" />Estado Sistema
                  <ChevronRight className="w-4 h-4 ml-auto text-zinc-500" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-green-900/30 border border-green-600/30 rounded-lg p-4">
                    <p className="text-green-400 font-bold">✓ APIs Activas</p>
                    <p className="text-xs text-gray-400 mt-1">Biloop, Revo, Email</p>
                  </div>
                  <div className="bg-green-900/30 border border-green-600/30 rounded-lg p-4">
                    <p className="text-green-400 font-bold">✓ Sync OK</p>
                    <p className="text-xs text-gray-400 mt-1">Última: hace 5 min</p>
                  </div>
                  <div className="bg-blue-900/30 border border-blue-600/30 rounded-lg p-4">
                    <p className="text-blue-400 font-bold">{providers.length} Proveedores</p>
                    <p className="text-xs text-gray-400 mt-1">Activos</p>
                  </div>
                  <div className="bg-purple-900/30 border border-purple-600/30 rounded-lg p-4">
                    <p className="text-purple-400 font-bold">{products.length} Productos</p>
                    <p className="text-xs text-gray-400 mt-1">Rastreados</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}