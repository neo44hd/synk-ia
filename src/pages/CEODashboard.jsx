import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Crown,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  FileText,
  Package,
  AlertTriangle,
  Clock,
  ArrowRight,
  Download,
  RefreshCw,
  Building2,
  Calendar,
  CheckCircle,
  XCircle,
  Bell,
  BarChart3,
  PieChart,
  Activity,
  Wallet,
  Receipt
} from "lucide-react";
import { toast } from "sonner";
import { format, subDays, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  LineChart, 
  Line,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart as RechartsPie,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { exportService } from "@/services/exportService";
import { backupService } from "@/services/backupService";
import { auditService } from "@/services/auditService";
import { Shield, HardDrive } from "lucide-react";

const COLORS = ['#06b6d4', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#ec4899'];

export default function CEODashboard() {
  const navigate = useNavigate();
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const [isExporting, setIsExporting] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);

  // Handle full backup
  const handleBackup = async () => {
    setIsBackingUp(true);
    try {
      const result = await backupService.downloadBackup();
      toast.success(`Backup completo generado: ${result.filename}`, {
        description: `Tamaño: ${(result.size / 1024).toFixed(1)} KB`
      });
    } catch (error) {
      console.error('Backup error:', error);
      toast.error('Error al generar backup');
    } finally {
      setIsBackingUp(false);
    }
  };

  // Verificar permisos de CEO
  const [user, setUser] = useState(null);
  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
        if (currentUser.permission_level !== 'super_admin' && currentUser.permission_level !== 'admin' && currentUser.role !== 'ceo') {
          toast.error('Acceso restringido a CEO');
          navigate(createPageUrl("Dashboard"));
        }
      } catch (error) {
        console.error('Error loading user:', error);
      }
    };
    loadUser();
  }, [navigate]);

  // Datos principales
  const { data: invoices = [] } = useQuery({
    queryKey: ['ceo-invoices'],
    queryFn: () => base44.entities.Invoice.list('-created_date', 500),
    staleTime: 60000
  });

  const { data: providers = [] } = useQuery({
    queryKey: ['ceo-providers'],
    queryFn: () => base44.entities.Provider.list('-created_date', 200),
    staleTime: 60000
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['ceo-employees'],
    queryFn: () => base44.entities.Employee.list(),
    staleTime: 60000
  });

  const { data: payrolls = [] } = useQuery({
    queryKey: ['ceo-payrolls'],
    queryFn: () => base44.entities.Payroll.list('-period', 200),
    staleTime: 60000
  });

  const { data: timesheets = [] } = useQuery({
    queryKey: ['ceo-timesheets'],
    queryFn: () => base44.entities.Timesheet.list('-date', 500),
    staleTime: 60000
  });

  const { data: sales = [] } = useQuery({
    queryKey: ['ceo-sales'],
    queryFn: async () => {
      try {
        return await base44.entities.Sale.list('-date', 500);
      } catch {
        return [];
      }
    },
    staleTime: 60000
  });

  // Calcular KPIs
  const now = new Date();
  const currentMonth = startOfMonth(now);
  const lastMonth = startOfMonth(subMonths(now, 1));

  // Ventas del mes
  const currentMonthSales = sales.filter(s => new Date(s.date) >= currentMonth);
  const totalVentas = currentMonthSales.reduce((sum, s) => sum + (s.total || 0), 0);
  
  // Gastos del mes (facturas)
  const currentMonthInvoices = invoices.filter(i => new Date(i.date || i.created_date) >= currentMonth);
  const totalGastos = currentMonthInvoices.reduce((sum, i) => sum + (i.total_amount || i.total || 0), 0);

  // Nóminas del mes
  const currentPeriod = format(now, 'yyyy-MM');
  const currentMonthPayrolls = payrolls.filter(p => p.period?.startsWith(currentPeriod));
  const totalNominas = currentMonthPayrolls.reduce((sum, p) => sum + (p.net_salary || 0), 0);

  // Empleados activos
  const activeEmployees = employees.filter(e => e.status === 'activo' || !e.status);

  // Empleados fichados hoy
  const today = format(now, 'yyyy-MM-dd');
  const todayTimesheets = timesheets.filter(t => 
    t.date === today || (t.check_in && t.check_in.startsWith(today))
  );

  // Margen bruto estimado
  const margenBruto = totalVentas - totalGastos - totalNominas;

  // Alertas pendientes
  const pendingInvoices = invoices.filter(i => i.status === 'pendiente');
  const pendingPayrolls = payrolls.filter(p => p.status === 'pendiente');

  // Datos para gráfico de evolución mensual
  const monthlyData = [];
  for (let i = 5; i >= 0; i--) {
    const monthDate = subMonths(now, i);
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);
    
    const monthSales = sales.filter(s => {
      const d = new Date(s.date);
      return d >= monthStart && d <= monthEnd;
    }).reduce((sum, s) => sum + (s.total || 0), 0);
    
    const monthExpenses = invoices.filter(inv => {
      const d = new Date(inv.date || inv.created_date);
      return d >= monthStart && d <= monthEnd;
    }).reduce((sum, i) => sum + (i.total_amount || i.total || 0), 0);
    
    monthlyData.push({
      name: format(monthDate, 'MMM', { locale: es }),
      ventas: monthSales,
      gastos: monthExpenses,
      margen: monthSales - monthExpenses
    });
  }

  // Datos para gráfico de gastos por categoría
  const expensesByCategory = {};
  currentMonthInvoices.forEach(inv => {
    const cat = inv.category || 'Otros';
    expensesByCategory[cat] = (expensesByCategory[cat] || 0) + (inv.total_amount || inv.total || 0);
  });
  const categoryData = Object.entries(expensesByCategory).map(([name, value]) => ({ name, value }));

  // Top proveedores por gasto
  const providerExpenses = {};
  invoices.forEach(inv => {
    const prov = inv.provider_name || 'Desconocido';
    providerExpenses[prov] = (providerExpenses[prov] || 0) + (inv.total_amount || inv.total || 0);
  });
  const topProviders = Object.entries(providerExpenses)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, total]) => ({ name, total }));

  // Exportar informe
  const handleExportReport = async () => {
    setIsExporting(true);
    try {
      const month = now.getMonth() + 1;
      const year = now.getFullYear();
      const result = exportService.exportMonthlyReport(invoices, payrolls, timesheets, month, year);
      toast.success(`Informe exportado: ${result.filename}`);
    } catch (error) {
      toast.error('Error al exportar informe');
    }
    setIsExporting(false);
  };

  const quickActions = [
    { label: 'Proveedores', icon: Building2, url: 'ProvidersComplete', color: 'cyan' },
    { label: 'Empleados', icon: Users, url: 'EmployeeControl', color: 'purple' },
    { label: 'Nóminas', icon: Wallet, url: 'PayrollsComplete', color: 'amber' },
    { label: 'Facturas', icon: Receipt, url: 'Invoices', color: 'emerald' },
  ];

  return (
    <div className="p-4 md:p-8 min-h-screen bg-gradient-to-br from-zinc-950 via-neutral-900 to-zinc-950">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header CEO */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/30">
                <Crown className="w-7 h-7 text-white" />
              </div>
              <span>Panel CEO</span>
            </h1>
            <p className="text-zinc-400 mt-2">
              Control total del negocio • {format(now, "EEEE, d 'de' MMMM yyyy", { locale: es })}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-40 bg-zinc-800 border-zinc-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-800 border-zinc-700">
                <SelectItem value="week">Esta semana</SelectItem>
                <SelectItem value="month">Este mes</SelectItem>
                <SelectItem value="quarter">Trimestre</SelectItem>
                <SelectItem value="year">Este año</SelectItem>
              </SelectContent>
            </Select>
            
            <Button 
              onClick={handleExportReport}
              disabled={isExporting}
              className="bg-cyan-600 hover:bg-cyan-700 text-white"
            >
              {isExporting ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
              Exportar Gestoría
            </Button>
            
            <Button 
              onClick={handleBackup}
              disabled={isBackingUp}
              variant="outline"
              className="border-purple-600 text-purple-400 hover:bg-purple-600/20"
            >
              {isBackingUp ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <HardDrive className="w-4 h-4 mr-2" />}
              Backup Completo
            </Button>
            
            <Button 
              onClick={() => navigate(createPageUrl("AuditLogs"))}
              variant="outline"
              className="border-gray-600 text-gray-400 hover:bg-gray-600/20"
            >
              <Shield className="w-4 h-4 mr-2" />
              Auditoría
            </Button>
          </div>
        </div>

        {/* KPIs Principales */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-emerald-900/50 to-emerald-950 border-emerald-800/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-emerald-400/80 text-sm">Ventas Mes</p>
                  <p className="text-3xl font-bold text-white mt-1">{totalVentas.toLocaleString()}€</p>
                </div>
                <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-emerald-400" />
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3 text-xs">
                <Badge className="bg-emerald-500/20 text-emerald-400 border-0">
                  <TrendingUp className="w-3 h-3 mr-1" /> +12%
                </Badge>
                <span className="text-zinc-500">vs mes anterior</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-red-900/50 to-red-950 border-red-800/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-red-400/80 text-sm">Gastos Mes</p>
                  <p className="text-3xl font-bold text-white mt-1">{totalGastos.toLocaleString()}€</p>
                </div>
                <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center">
                  <TrendingDown className="w-6 h-6 text-red-400" />
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3 text-xs">
                <span className="text-zinc-500">{currentMonthInvoices.length} facturas</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-900/50 to-purple-950 border-purple-800/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-400/80 text-sm">Nóminas Mes</p>
                  <p className="text-3xl font-bold text-white mt-1">{totalNominas.toLocaleString()}€</p>
                </div>
                <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
                  <Users className="w-6 h-6 text-purple-400" />
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3 text-xs">
                <span className="text-zinc-500">{currentMonthPayrolls.length} nóminas</span>
              </div>
            </CardContent>
          </Card>

          <Card className={`bg-gradient-to-br ${margenBruto >= 0 ? 'from-cyan-900/50 to-cyan-950 border-cyan-800/50' : 'from-orange-900/50 to-orange-950 border-orange-800/50'}`}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className={`${margenBruto >= 0 ? 'text-cyan-400/80' : 'text-orange-400/80'} text-sm`}>Margen Bruto</p>
                  <p className="text-3xl font-bold text-white mt-1">{margenBruto.toLocaleString()}€</p>
                </div>
                <div className={`w-12 h-12 ${margenBruto >= 0 ? 'bg-cyan-500/20' : 'bg-orange-500/20'} rounded-xl flex items-center justify-center`}>
                  <Activity className={`w-6 h-6 ${margenBruto >= 0 ? 'text-cyan-400' : 'text-orange-400'}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Fila de empleados y alertas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <p className="text-zinc-400 text-sm">Empleados Activos</p>
                <Users className="w-5 h-5 text-cyan-400" />
              </div>
              <p className="text-4xl font-bold text-white">{activeEmployees.length}</p>
              <div className="mt-3 flex items-center gap-2">
                <Badge className="bg-emerald-500/20 text-emerald-400 border-0">
                  <CheckCircle className="w-3 h-3 mr-1" /> {todayTimesheets.length} fichados hoy
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <p className="text-zinc-400 text-sm">Facturas Pendientes</p>
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              </div>
              <p className="text-4xl font-bold text-white">{pendingInvoices.length}</p>
              <div className="mt-3">
                <p className="text-zinc-500 text-sm">
                  {pendingInvoices.reduce((sum, i) => sum + (i.total_amount || i.total || 0), 0).toLocaleString()}€ por pagar
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <p className="text-zinc-400 text-sm">Nóminas Pendientes</p>
                <Wallet className="w-5 h-5 text-purple-400" />
              </div>
              <p className="text-4xl font-bold text-white">{pendingPayrolls.length}</p>
              <div className="mt-3">
                <p className="text-zinc-500 text-sm">
                  {pendingPayrolls.reduce((sum, p) => sum + (p.net_salary || 0), 0).toLocaleString()}€ pendiente
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Evolución mensual */}
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-cyan-400" />
                Evolución Últimos 6 Meses
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyData}>
                    <defs>
                      <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorGastos" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="name" stroke="#9ca3af" />
                    <YAxis stroke="#9ca3af" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '8px' }}
                      labelStyle={{ color: '#fff' }}
                    />
                    <Area type="monotone" dataKey="ventas" stroke="#10b981" fillOpacity={1} fill="url(#colorVentas)" name="Ventas" />
                    <Area type="monotone" dataKey="gastos" stroke="#ef4444" fillOpacity={1} fill="url(#colorGastos)" name="Gastos" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Gastos por categoría */}
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <PieChart className="w-5 h-5 text-cyan-400" />
                Gastos por Categoría
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPie>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '8px' }}
                      formatter={(value) => [`${value.toLocaleString()}€`, 'Importe']}
                    />
                    <Legend 
                      wrapperStyle={{ color: '#9ca3af' }}
                    />
                  </RechartsPie>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Top Proveedores y Accesos rápidos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Proveedores */}
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-cyan-400" />
                Top 5 Proveedores
              </CardTitle>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => navigate(createPageUrl("ProvidersComplete"))}
                className="text-cyan-400 hover:text-cyan-300"
              >
                Ver todos <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {topProviders.map((prov, idx) => (
                  <div key={prov.name} className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-zinc-700 rounded-lg flex items-center justify-center text-sm font-bold text-zinc-400">
                        {idx + 1}
                      </div>
                      <span className="text-white font-medium">{prov.name}</span>
                    </div>
                    <span className="text-cyan-400 font-semibold">{prov.total.toLocaleString()}€</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Accesos rápidos */}
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-cyan-400" />
                Accesos Rápidos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {quickActions.map((action) => (
                  <Button
                    key={action.label}
                    variant="outline"
                    onClick={() => navigate(createPageUrl(action.url))}
                    className={`h-24 flex flex-col items-center justify-center gap-2 bg-zinc-800/50 border-zinc-700 hover:border-${action.color}-500/50 hover:bg-zinc-800 text-white transition-all`}
                  >
                    <action.icon className={`w-8 h-8 text-${action.color}-400`} />
                    <span>{action.label}</span>
                  </Button>
                ))}
              </div>
              
              {/* Resumen de pendientes */}
              <div className="mt-6 p-4 bg-amber-900/20 border border-amber-800/50 rounded-lg">
                <h4 className="text-amber-400 font-medium flex items-center gap-2 mb-3">
                  <Bell className="w-4 h-4" /> Pendientes de atención
                </h4>
                <ul className="space-y-2 text-sm">
                  {pendingInvoices.length > 0 && (
                    <li className="text-zinc-400 flex items-center gap-2">
                      <XCircle className="w-4 h-4 text-red-400" />
                      {pendingInvoices.length} facturas por revisar/pagar
                    </li>
                  )}
                  {pendingPayrolls.length > 0 && (
                    <li className="text-zinc-400 flex items-center gap-2">
                      <XCircle className="w-4 h-4 text-red-400" />
                      {pendingPayrolls.length} nóminas pendientes de pago
                    </li>
                  )}
                  {activeEmployees.length - todayTimesheets.length > 0 && (
                    <li className="text-zinc-400 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-400" />
                      {activeEmployees.length - todayTimesheets.length} empleados sin fichar hoy
                    </li>
                  )}
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}
