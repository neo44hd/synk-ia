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
  ChevronRight,
  Camera,
  Shield,
  Activity,
  Clock,
  Brain,
  Mail,
  FolderCheck,
  UserCheck,
  AlertCircle,
  CheckCircle2,
  Upload
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { format, subMonths } from 'date-fns';
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

  // Calculos principales
  const totalGastos = invoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
  const totalIngresos = salesInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
  const margenBruto = totalIngresos - totalGastos;
  const pendientePago = invoices.filter(inv => inv.status === 'pendiente').reduce((sum, inv) => sum + (inv.total || 0), 0);

  // Operaciones HOY
  const today = new Date().toISOString().split('T')[0];
  const todayOrders = orders.filter(o => o.order_date?.startsWith(today));
  const todaySales = sales.filter(s => s.sale_date?.startsWith(today));
  const todayRevenue = todaySales.reduce((sum, s) => sum + (s.total || 0), 0) + todayOrders.reduce((sum, o) => sum + (o.total || 0), 0);

  // Facturas vencidas
  const facturasVencidas = invoices.filter(inv => inv.status === 'vencida');

  // Datos por mes (ultimos 6 meses)
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
  const hasMonthlyData = monthlyData.some(d => d.gastos > 0 || d.ingresos > 0);

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
                <div className="w-14 h-14 bg-black rounded-2xl flex items-center justify-center border border-cyan-500/50" style={{ boxShadow: '0 0 25px rgba(6, 182, 212, 0.4), inset 0 0 15px rgba(6, 182, 212, 0.1)' }}>
                  <Activity className="w-8 h-8 text-cyan-400" style={{ filter: 'drop-shadow(0 0 8px rgba(6, 182, 212, 0.8))' }} />
                </div>
                <span className="text-cyan-400" style={{ textShadow: '0 0 15px rgba(6, 182, 212, 0.6)' }}>CONTROL CENTRAL</span>
              </h1>
              <p className="text-lg text-zinc-400">Vista general del negocio en tiempo real</p>
            </div>
            <div className="flex gap-3 flex-wrap">
              <Link to={createPageUrl("FinanceDashboard")}>
                <Button className="bg-black border border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10 font-bold" style={{ boxShadow: '0 0 20px rgba(6, 182, 212, 0.4)' }}>💰 Finanzas</Button>
              </Link>
              <Link to={createPageUrl("ProductInventory")}>
                <Button variant="outline" className="border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-cyan-400">📦 Inventario</Button>
              </Link>
              <Link to={createPageUrl("AutomationHub")}>
                <Button variant="outline" className="border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-cyan-400">⚡ Auto-Sync</Button>
              </Link>
              <Link to={createPageUrl("EmployeePortal")}>
                <Button variant="outline" className="border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-emerald-400 border-emerald-500/30">👥 Equipo</Button>
              </Link>
              <Link to={createPageUrl("SmartDocumentArchive")}>
                <Button variant="outline" className="border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-purple-400 border-purple-500/30">🧠 IA Docs</Button>
              </Link>
            </div>
          </div>
        </div>

                {/* Asistencia en Tiempo Real */}
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

                {/* Alertas - Solo si hay datos */}
        {facturasVencidas.length > 0 && (
          <div className="mb-8">
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
          </div>
        )}

                {/* NUEVOS BLOQUES: IA Documental + Equipo */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* IA Documental */}
          <Link to={createPageUrl("SmartDocumentArchive")}>
            <Card className="border-none shadow-xl bg-black border border-purple-500/50 hover:border-purple-500 transition-all cursor-pointer h-full" style={{ boxShadow: '0 0 30px rgba(168, 85, 247, 0.3)' }}>
              <CardHeader className="pb-3">
                <CardTitle className="text-white flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-900/50 rounded-xl flex items-center justify-center border border-purple-500/30">
                    <Brain className="w-6 h-6 text-purple-400" style={{ filter: 'drop-shadow(0 0 8px rgba(168, 85, 247, 0.8))' }} />
                  </div>
                  <span>IA DOCUMENTAL</span>
                  <Badge className="bg-purple-600 text-white ml-auto animate-pulse">LIVE</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-purple-900/20 border border-purple-500/20 rounded-lg p-3 text-center">
                    <Mail className="w-5 h-5 text-purple-400 mx-auto mb-1" />
                    <p className="text-2xl font-black text-white">0</p>
                    <p className="text-xs text-zinc-400">Correos conectados</p>
                  </div>
                  <div className="bg-purple-900/20 border border-purple-500/20 rounded-lg p-3 text-center">
                    <FolderCheck className="w-5 h-5 text-purple-400 mx-auto mb-1" />
                    <p className="text-2xl font-black text-white">{invoices.length}</p>
                    <p className="text-xs text-zinc-400">Docs procesados</p>
                  </div>
                </div>
                <div className="bg-purple-900/20 border border-purple-500/20 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Upload className="w-4 h-4 text-purple-400" />
                    <span className="text-sm text-purple-300 font-medium">Sube cualquier archivo</span>
                  </div>
                  <p className="text-xs text-zinc-500">La IA lo lee, clasifica y archiva automaticamente</p>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500">{providers.length} proveedores auto-detectados</span>
                  <ChevronRight className="w-4 h-4 text-purple-400" />
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Equipo */}
          <Link to={createPageUrl("EmployeePortal")}>
            <Card className="border-none shadow-xl bg-black border border-emerald-500/50 hover:border-emerald-500 transition-all cursor-pointer h-full" style={{ boxShadow: '0 0 30px rgba(16, 185, 129, 0.3)' }}>
              <CardHeader className="pb-3">
                <CardTitle className="text-white flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-900/50 rounded-xl flex items-center justify-center border border-emerald-500/30">
                    <Users className="w-6 h-6 text-emerald-400" style={{ filter: 'drop-shadow(0 0 8px rgba(16, 185, 129, 0.8))' }} />
                  </div>
                  <span>EQUIPO</span>
                  <Badge className="bg-emerald-600 text-white ml-auto">PORTAL</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-emerald-900/20 border border-emerald-500/20 rounded-lg p-3 text-center">
                    <UserCheck className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
                    <p className="text-2xl font-black text-white">0</p>
                    <p className="text-xs text-zinc-400">Empleados</p>
                  </div>
                  <div className="bg-emerald-900/20 border border-emerald-500/20 rounded-lg p-3 text-center">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
                    <p className="text-2xl font-black text-white">0</p>
                    <p className="text-xs text-zinc-400">En turno</p>
                  </div>
                  <div className="bg-emerald-900/20 border border-emerald-500/20 rounded-lg p-3 text-center">
                    <AlertCircle className="w-5 h-5 text-yellow-400 mx-auto mb-1" />
                    <p className="text-2xl font-black text-white">0</p>
                    <p className="text-xs text-zinc-400">Alertas</p>
                  </div>
                </div>
                <div className="bg-emerald-900/20 border border-emerald-500/20 rounded-lg p-3">
                  <p className="text-sm text-emerald-300 font-medium mb-1">Compliance Inspecciones</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-zinc-800 rounded-full h-2">
                      <div className="bg-emerald-500 h-2 rounded-full" style={{ width: '0%' }} />
                    </div>
                    <span className="text-xs text-zinc-400">0%</span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">Documentacion empleados al dia</p>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500">Nominas, contratos, vacaciones, fichajes</span>
                  <ChevronRight className="w-4 h-4 text-emerald-400" />
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

                {/* Grafico Evolucion - Solo si hay datos */}
        {hasMonthlyData && (
          <div className="mb-8">
            <Card className="border-none shadow-xl bg-zinc-800/50 border border-zinc-800">
              <CardHeader><CardTitle className="text-white">Evolucion Mensual (6 meses)</CardTitle></CardHeader>
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
          </div>
        )}

        {/* Ultimas Facturas - Solo si hay */}
        {invoices.length > 0 && (
          <div className="mb-8">
            <Card className="border-none shadow-xl bg-zinc-800/50 border border-zinc-800">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-white text-lg">Ultimas Facturas</CardTitle>
                <Link to={createPageUrl("BiloopImport")}><Button variant="ghost" size="sm" className="text-blue-400"><ChevronRight className="w-4 h-4" /></Button></Link>
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
              </CardContent>
            </Card>
          </div>
        )}

                {/* Barra compacta: Camaras + Sistema */}
        <Link to={createPageUrl("ApiDiagnostics")}>
          <Card className="border-none shadow-xl bg-zinc-800/50 border border-zinc-800 hover:border-cyan-500/50 transition-all cursor-pointer">
            <CardContent className="p-4">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-green-400" />
                    <span className="text-sm text-green-400 font-medium">Sistema OK</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Camera className="w-4 h-4 text-zinc-400" />
                    <span className="text-sm text-zinc-400">4 camaras</span>
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-zinc-400" />
                    <span className="text-sm text-zinc-400">APIs: Biloop, Revo, Email</span>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-blue-400 font-medium">{providers.length} Proveedores</span>
                  <span className="text-purple-400 font-medium">{products.length} Productos</span>
                  <span className="text-zinc-500">Sync hace 5 min</span>
                  <ChevronRight className="w-4 h-4 text-zinc-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

      </div>
    </div>
  );
}
