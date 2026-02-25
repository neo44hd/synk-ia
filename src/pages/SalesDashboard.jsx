import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { 
  TrendingUp, 
  DollarSign, 
  ShoppingCart,
  Users,
  Award,
  RefreshCw,
  Receipt,
  Clock,
  CreditCard,
  Wallet,
  Banknote,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  XCircle,
  Target,
  Zap,
  Coffee,
  UtensilsCrossed,
  ChefHat,
  Loader2
} from "lucide-react";
import { format, subDays, startOfDay, endOfDay, isToday, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

// Colores para gráficos
const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export default function SalesDashboard() {
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [cashRegisterOpen, setCashRegisterOpen] = useState(true);

  // Obtener ventas
  const { data: sales = [], isLoading: loadingSales } = useQuery({
    queryKey: ['sales-dashboard'],
    queryFn: () => base44.entities.Sale.list('-sale_date', 500),
    initialData: [],
    refetchInterval: 30000, // Refrescar cada 30s
  });

  // Obtener productos del menú
  const { data: menuItems = [] } = useQuery({
    queryKey: ['menu-items-sales'],
    queryFn: () => base44.entities.MenuItem.list(),
    initialData: [],
  });

  // Obtener pedidos del día
  const { data: orders = [] } = useQuery({
    queryKey: ['orders-sales'],
    queryFn: () => base44.entities.Order.list('-order_date', 100),
    initialData: [],
  });

  // Refrescar datos desde Revo XEF (simulado)
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Simular conexión con Revo XEF API
      await new Promise(resolve => setTimeout(resolve, 1500));
      await queryClient.invalidateQueries({ queryKey: ['sales-dashboard'] });
      await queryClient.invalidateQueries({ queryKey: ['orders-sales'] });
      toast.success('✅ Datos sincronizados con Revo XEF');
    } catch (error) {
      toast.error('Error al sincronizar con Revo XEF');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Filtrar ventas del día seleccionado
  const todaySales = sales.filter(s => {
    if (!s.sale_date) return false;
    const saleDate = new Date(s.sale_date);
    return isToday(saleDate);
  });

  // Cálculos principales
  const todayTotal = todaySales.reduce((sum, s) => sum + (s.total || 0), 0);
  const ticketCount = todaySales.length;
  const avgTicket = ticketCount > 0 ? todayTotal / ticketCount : 0;

  // Pedidos del día
  const todayOrders = orders.filter(o => {
    if (!o.order_date) return false;
    const orderDate = new Date(o.order_date);
    return isToday(orderDate);
  });

  // Ventas por hora (hoy)
  const hourlyData = [];
  for (let hour = 8; hour <= 23; hour++) {
    const hourSales = todaySales.filter(s => {
      const saleHour = new Date(s.sale_date).getHours();
      return saleHour === hour;
    });
    const hourTotal = hourSales.reduce((sum, s) => sum + (s.total || 0), 0);
    hourlyData.push({
      hour: `${hour}:00`,
      ventas: Math.round(hourTotal * 100) / 100,
      tickets: hourSales.length
    });
  }

  // Top 10 productos vendidos
  const productSales = {};
  todaySales.forEach(sale => {
    (sale.items || []).forEach(item => {
      const name = item.product_name || item.name || 'Producto';
      if (!productSales[name]) {
        productSales[name] = { name, quantity: 0, total: 0 };
      }
      productSales[name].quantity += item.quantity || 1;
      productSales[name].total += item.total || item.price || 0;
    });
  });
  const topProducts = Object.values(productSales)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10);

  // Métodos de pago
  const paymentMethods = {
    efectivo: { total: 0, count: 0, icon: Banknote, color: '#10b981' },
    tarjeta: { total: 0, count: 0, icon: CreditCard, color: '#3b82f6' },
    bizum: { total: 0, count: 0, icon: Wallet, color: '#8b5cf6' },
    otros: { total: 0, count: 0, icon: Receipt, color: '#f59e0b' }
  };
  todaySales.forEach(sale => {
    const method = sale.payment_method || 'efectivo';
    const key = paymentMethods[method] ? method : 'otros';
    paymentMethods[key].total += sale.total || 0;
    paymentMethods[key].count += 1;
  });

  // Datos para gráfico de métodos de pago
  const paymentData = Object.entries(paymentMethods)
    .filter(([_, data]) => data.count > 0)
    .map(([name, data]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value: data.total,
      count: data.count,
      color: data.color
    }));

  // Comparativa con ayer
  const yesterdaySales = sales.filter(s => {
    if (!s.sale_date) return false;
    const saleDate = new Date(s.sale_date);
    const yesterday = subDays(new Date(), 1);
    return saleDate >= startOfDay(yesterday) && saleDate <= endOfDay(yesterday);
  });
  const yesterdayTotal = yesterdaySales.reduce((sum, s) => sum + (s.total || 0), 0);
  const salesChange = yesterdayTotal > 0 ? ((todayTotal - yesterdayTotal) / yesterdayTotal) * 100 : 0;

  // Últimos 7 días
  const weeklyData = [];
  for (let i = 6; i >= 0; i--) {
    const date = subDays(new Date(), i);
    const dayStr = format(date, 'yyyy-MM-dd');
    const daySales = sales.filter(s => s.sale_date?.startsWith(dayStr));
    const dayTotal = daySales.reduce((sum, s) => sum + (s.total || 0), 0);
    weeklyData.push({
      day: format(date, 'EEE', { locale: es }),
      fecha: format(date, 'd MMM', { locale: es }),
      ventas: Math.round(dayTotal),
      tickets: daySales.length
    });
  }

  // Cierre de caja
  const cashClosing = {
    efectivoInicial: 200,
    efectivoFinal: 200 + paymentMethods.efectivo.total,
    tarjetas: paymentMethods.tarjeta.total,
    bizum: paymentMethods.bizum.total,
    totalVentas: todayTotal,
    descuentos: todaySales.reduce((sum, s) => sum + (s.discount || 0), 0),
    propinas: todaySales.reduce((sum, s) => sum + (s.tip || 0), 0)
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <div className="p-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500">
                <DollarSign className="w-8 h-8 text-white" />
              </div>
              Dashboard de Ventas
            </h1>
            <p className="text-gray-400 mt-1">Conectado con Revo XEF • Actualización en tiempo real</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge className={`px-3 py-1 ${cashRegisterOpen ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>
              {cashRegisterOpen ? '🟢 Caja Abierta' : '🔴 Caja Cerrada'}
            </Badge>
            <Button 
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600"
            >
              {isRefreshing ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Sincronizar Revo
            </Button>
          </div>
        </div>

        {/* KPIs principales */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Ventas Hoy */}
          <Card className="border-none shadow-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border-emerald-500/30">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-emerald-300/80 text-sm font-medium">Ventas Hoy</p>
                  <h3 className="text-3xl font-bold text-white mt-1">
                    {todayTotal.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                  </h3>
                  <div className={`flex items-center gap-1 mt-2 text-sm ${salesChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {salesChange >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                    {Math.abs(salesChange).toFixed(1)}% vs ayer
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-emerald-500/30">
                  <DollarSign className="w-6 h-6 text-emerald-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tickets */}
          <Card className="border-none shadow-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border-blue-500/30">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-blue-300/80 text-sm font-medium">Tickets del Día</p>
                  <h3 className="text-3xl font-bold text-white mt-1">{ticketCount}</h3>
                  <p className="text-gray-400 text-sm mt-2">
                    +{todayOrders.length} pedidos online
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-blue-500/30">
                  <Receipt className="w-6 h-6 text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Ticket Medio */}
          <Card className="border-none shadow-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border-purple-500/30">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-purple-300/80 text-sm font-medium">Ticket Medio</p>
                  <h3 className="text-3xl font-bold text-white mt-1">
                    {avgTicket.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                  </h3>
                  <p className="text-gray-400 text-sm mt-2">
                    Objetivo: 18,00 €
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-purple-500/30">
                  <Target className="w-6 h-6 text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Hora pico */}
          <Card className="border-none shadow-xl bg-gradient-to-br from-orange-500/20 to-amber-500/20 border-orange-500/30">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-orange-300/80 text-sm font-medium">Hora Pico</p>
                  <h3 className="text-3xl font-bold text-white mt-1">
                    {hourlyData.reduce((max, h) => h.ventas > max.ventas ? h : max, { ventas: 0 }).hour || '13:00'}
                  </h3>
                  <p className="text-gray-400 text-sm mt-2">
                    Mayor facturación
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-orange-500/30">
                  <Clock className="w-6 h-6 text-orange-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Gráficos principales */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Gráfico de ventas por hora */}
          <Card className="col-span-2 border-none shadow-xl bg-slate-800/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
                Ventas por Hora (Hoy)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={hourlyData}>
                  <defs>
                    <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="hour" stroke="#9ca3af" fontSize={11} />
                  <YAxis stroke="#9ca3af" fontSize={11} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                    labelStyle={{ color: '#fff' }}
                    formatter={(value) => [`${value.toFixed(2)} €`, 'Ventas']}
                  />
                  <Area type="monotone" dataKey="ventas" stroke="#10b981" fill="url(#colorVentas)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Métodos de pago */}
          <Card className="border-none shadow-xl bg-slate-800/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-blue-400" />
                Métodos de Pago
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={paymentData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {paymentData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                    formatter={(value) => [`${value.toFixed(2)} €`]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-4">
                {paymentData.map((method, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: method.color }} />
                      <span className="text-gray-300">{method.name}</span>
                    </div>
                    <span className="text-white font-medium">{method.value.toFixed(2)} € ({method.count})</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Segunda fila */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top 10 productos */}
          <Card className="border-none shadow-xl bg-slate-800/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-400" />
                Top 10 Productos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[350px]">
                <div className="space-y-3">
                  {topProducts.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <UtensilsCrossed className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>No hay ventas registradas hoy</p>
                    </div>
                  ) : (
                    topProducts.map((product, index) => (
                      <div key={index} className="flex items-center gap-4 p-3 rounded-lg bg-slate-700/50 hover:bg-slate-700 transition-colors">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          index === 0 ? 'bg-amber-500 text-white' :
                          index === 1 ? 'bg-gray-400 text-white' :
                          index === 2 ? 'bg-amber-700 text-white' :
                          'bg-slate-600 text-gray-300'
                        }`}>
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium truncate">{product.name}</p>
                          <p className="text-gray-400 text-sm">{product.quantity} unidades</p>
                        </div>
                        <div className="text-right">
                          <p className="text-emerald-400 font-bold">{product.total.toFixed(2)} €</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Cierre de Caja */}
          <Card className="border-none shadow-xl bg-slate-800/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Wallet className="w-5 h-5 text-green-400" />
                Cierre de Caja
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-slate-700/50">
                  <p className="text-gray-400 text-sm">Efectivo Inicial</p>
                  <p className="text-xl font-bold text-white">{cashClosing.efectivoInicial.toFixed(2)} €</p>
                </div>
                <div className="p-4 rounded-lg bg-slate-700/50">
                  <p className="text-gray-400 text-sm">Efectivo Final</p>
                  <p className="text-xl font-bold text-emerald-400">{cashClosing.efectivoFinal.toFixed(2)} €</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 rounded-lg bg-slate-700/30">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-blue-400" />
                    <span className="text-gray-300">Tarjetas</span>
                  </div>
                  <span className="text-white font-medium">{cashClosing.tarjetas.toFixed(2)} €</span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-lg bg-slate-700/30">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-purple-400" />
                    <span className="text-gray-300">Bizum</span>
                  </div>
                  <span className="text-white font-medium">{cashClosing.bizum.toFixed(2)} €</span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-lg bg-slate-700/30">
                  <div className="flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-amber-400" />
                    <span className="text-gray-300">Descuentos</span>
                  </div>
                  <span className="text-red-400 font-medium">-{cashClosing.descuentos.toFixed(2)} €</span>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-600">
                <div className="flex justify-between items-center">
                  <span className="text-lg text-white font-medium">Total Ventas</span>
                  <span className="text-2xl font-bold text-emerald-400">{cashClosing.totalVentas.toFixed(2)} €</span>
                </div>
              </div>

              <Button 
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 mt-4"
                onClick={() => {
                  setCashRegisterOpen(false);
                  toast.success('✅ Caja cerrada correctamente');
                }}
                disabled={!cashRegisterOpen}
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Cerrar Caja del Día
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Gráfico semanal */}
        <Card className="border-none shadow-xl bg-slate-800/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-400" />
              Evolución Semanal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="day" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                  labelStyle={{ color: '#fff' }}
                  formatter={(value) => [`${value} €`, 'Ventas']}
                />
                <Bar dataKey="ventas" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
