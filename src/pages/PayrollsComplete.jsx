import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter 
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Wallet, 
  Plus, 
  Edit, 
  Trash2,
  Download,
  FileText,
  Search,
  Calendar,
  User,
  CheckCircle,
  Clock,
  TrendingUp,
  DollarSign,
  AlertCircle,
  Eye,
  Printer,
  MoreVertical,
  Filter,
  RefreshCw
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from "date-fns";
import { es } from "date-fns/locale";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts';
import { exportService } from "@/services/exportService";

export default function PayrollsComplete() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPayroll, setEditingPayroll] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  
  const [formData, setFormData] = useState({
    employee_id: '',
    employee_name: '',
    employee_dni: '',
    period: format(new Date(), 'yyyy-MM'),
    gross_salary: '',
    ss_employee: '',
    irpf_rate: '15',
    irpf_amount: '',
    ss_company: '',
    net_salary: '',
    extras: '0',
    deductions: '0',
    payment_date: '',
    status: 'pendiente',
    notes: ''
  });

  const queryClient = useQueryClient();

  const { data: payrolls = [], isLoading } = useQuery({
    queryKey: ['payrolls-complete'],
    queryFn: () => base44.entities.Payroll.list('-period', 500),
    staleTime: 60000
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['payroll-employees'],
    queryFn: () => base44.entities.Employee.list(),
    staleTime: 60000
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Payroll.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payrolls-complete'] });
      toast.success('Nómina creada correctamente');
      handleCloseDialog();
    },
    onError: () => toast.error('Error al crear nómina')
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Payroll.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payrolls-complete'] });
      toast.success('Nómina actualizada');
      handleCloseDialog();
    },
    onError: () => toast.error('Error al actualizar')
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Payroll.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payrolls-complete'] });
      toast.success('Nómina eliminada');
      setDeleteConfirm(null);
    },
    onError: () => toast.error('Error al eliminar')
  });

  // Filtrar nóminas por mes seleccionado
  const monthPayrolls = payrolls.filter(p => p.period?.startsWith(selectedMonth));
  
  // Filtrar por búsqueda y estado
  const filteredPayrolls = monthPayrolls.filter(p => {
    const matchesSearch = p.employee_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         p.employee_dni?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'all' || p.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  // Estadísticas del mes
  const totalBruto = monthPayrolls.reduce((sum, p) => sum + (p.gross_salary || 0), 0);
  const totalNeto = monthPayrolls.reduce((sum, p) => sum + (p.net_salary || 0), 0);
  const totalSSEmpresa = monthPayrolls.reduce((sum, p) => sum + (p.ss_company || 0), 0);
  const totalIRPF = monthPayrolls.reduce((sum, p) => sum + (p.irpf_amount || 0), 0);
  const pendientes = monthPayrolls.filter(p => p.status === 'pendiente').length;
  const pagadas = monthPayrolls.filter(p => p.status === 'pagada').length;

  // Evolución últimos 6 meses
  const monthlyEvolution = [];
  for (let i = 5; i >= 0; i--) {
    const monthDate = subMonths(new Date(), i);
    const monthStr = format(monthDate, 'yyyy-MM');
    const monthData = payrolls.filter(p => p.period?.startsWith(monthStr));
    
    monthlyEvolution.push({
      month: format(monthDate, 'MMM', { locale: es }),
      bruto: monthData.reduce((sum, p) => sum + (p.gross_salary || 0), 0),
      neto: monthData.reduce((sum, p) => sum + (p.net_salary || 0), 0),
      empleados: monthData.length
    });
  }

  // Calcular nómina automáticamente
  const calculatePayroll = () => {
    const gross = parseFloat(formData.gross_salary) || 0;
    const irpfRate = parseFloat(formData.irpf_rate) || 0;
    const extras = parseFloat(formData.extras) || 0;
    const deductions = parseFloat(formData.deductions) || 0;
    
    // Cálculos aproximados
    const ssEmployee = Math.round(gross * 0.0635); // ~6.35% SS empleado
    const irpfAmount = Math.round((gross + extras) * (irpfRate / 100));
    const ssCompany = Math.round(gross * 0.2975); // ~29.75% SS empresa
    const netSalary = gross + extras - ssEmployee - irpfAmount - deductions;
    
    setFormData(prev => ({
      ...prev,
      ss_employee: ssEmployee.toString(),
      irpf_amount: irpfAmount.toString(),
      ss_company: ssCompany.toString(),
      net_salary: netSalary.toFixed(2)
    }));
  };

  const handleOpenDialog = (payroll = null) => {
    if (payroll) {
      setEditingPayroll(payroll);
      setFormData({
        employee_id: payroll.employee_id || '',
        employee_name: payroll.employee_name || '',
        employee_dni: payroll.employee_dni || '',
        period: payroll.period || format(new Date(), 'yyyy-MM'),
        gross_salary: payroll.gross_salary?.toString() || '',
        ss_employee: payroll.ss_employee?.toString() || '',
        irpf_rate: payroll.irpf_rate?.toString() || '15',
        irpf_amount: payroll.irpf_amount?.toString() || '',
        ss_company: payroll.ss_company?.toString() || '',
        net_salary: payroll.net_salary?.toString() || '',
        extras: payroll.extras?.toString() || '0',
        deductions: payroll.deductions?.toString() || '0',
        payment_date: payroll.payment_date || '',
        status: payroll.status || 'pendiente',
        notes: payroll.notes || ''
      });
    } else {
      setEditingPayroll(null);
      setFormData({
        employee_id: '', employee_name: '', employee_dni: '',
        period: selectedMonth, gross_salary: '', ss_employee: '',
        irpf_rate: '15', irpf_amount: '', ss_company: '', net_salary: '',
        extras: '0', deductions: '0', payment_date: '', status: 'pendiente', notes: ''
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingPayroll(null);
  };

  const handleEmployeeSelect = (employeeId) => {
    const employee = employees.find(e => e.id === employeeId);
    if (employee) {
      const monthlySalary = employee.annual_salary ? Math.round(employee.annual_salary / 12) : '';
      setFormData(prev => ({
        ...prev,
        employee_id: employee.id,
        employee_name: employee.full_name,
        employee_dni: employee.dni || '',
        gross_salary: monthlySalary.toString()
      }));
    }
  };

  const handleSubmit = () => {
    if (!formData.employee_name || !formData.period || !formData.gross_salary) {
      toast.error('Empleado, período y salario bruto son obligatorios');
      return;
    }
    
    const data = {
      ...formData,
      gross_salary: parseFloat(formData.gross_salary) || 0,
      ss_employee: parseFloat(formData.ss_employee) || 0,
      irpf_rate: parseFloat(formData.irpf_rate) || 0,
      irpf_amount: parseFloat(formData.irpf_amount) || 0,
      ss_company: parseFloat(formData.ss_company) || 0,
      net_salary: parseFloat(formData.net_salary) || 0,
      extras: parseFloat(formData.extras) || 0,
      deductions: parseFloat(formData.deductions) || 0
    };
    
    if (editingPayroll) {
      updateMutation.mutate({ id: editingPayroll.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleMarkAsPaid = async (payroll) => {
    try {
      await base44.entities.Payroll.update(payroll.id, {
        status: 'pagada',
        payment_date: format(new Date(), 'yyyy-MM-dd')
      });
      queryClient.invalidateQueries({ queryKey: ['payrolls-complete'] });
      toast.success('Nómina marcada como pagada');
    } catch {
      toast.error('Error al actualizar');
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const [year, month] = selectedMonth.split('-');
      const result = exportService.exportPayrollsByMonth(payrolls, parseInt(month), parseInt(year));
      toast.success(`Exportadas ${result.exported} nóminas`);
    } catch (error) {
      toast.error('Error al exportar');
    }
    setIsExporting(false);
  };

  const generatePDF = (payroll) => {
    // Generar PDF básico de nómina
    const content = `
NÓMINA - ${payroll.period}
=====================================
Empleado: ${payroll.employee_name}
DNI: ${payroll.employee_dni || '-'}

DEVENGOS
-------------------------------------
Salario Base: ${payroll.gross_salary?.toLocaleString() || 0}€
Complementos: ${payroll.extras?.toLocaleString() || 0}€
TOTAL DEVENGADO: ${((payroll.gross_salary || 0) + (payroll.extras || 0)).toLocaleString()}€

DEDUCCIONES
-------------------------------------
S.S. Empleado: ${payroll.ss_employee?.toLocaleString() || 0}€
IRPF (${payroll.irpf_rate || 0}%): ${payroll.irpf_amount?.toLocaleString() || 0}€
Otras deducciones: ${payroll.deductions?.toLocaleString() || 0}€
TOTAL DEDUCCIONES: ${((payroll.ss_employee || 0) + (payroll.irpf_amount || 0) + (payroll.deductions || 0)).toLocaleString()}€

=====================================
LÍQUIDO A PERCIBIR: ${payroll.net_salary?.toLocaleString() || 0}€
=====================================

Coste empresa S.S.: ${payroll.ss_company?.toLocaleString() || 0}€

Estado: ${payroll.status?.toUpperCase() || 'PENDIENTE'}
${payroll.payment_date ? `Fecha pago: ${format(new Date(payroll.payment_date), 'dd/MM/yyyy')}` : ''}
    `;
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nomina_${payroll.employee_name?.replace(/\s+/g, '_')}_${payroll.period}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Nómina descargada');
  };

  // Navegar meses
  const goToPreviousMonth = () => {
    const date = new Date(selectedMonth + '-01');
    setSelectedMonth(format(subMonths(date, 1), 'yyyy-MM'));
  };

  const goToNextMonth = () => {
    const date = new Date(selectedMonth + '-01');
    setSelectedMonth(format(addMonths(date, 1), 'yyyy-MM'));
  };

  return (
    <div className="p-4 md:p-8 min-h-screen bg-gradient-to-br from-zinc-950 via-neutral-900 to-zinc-950">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Wallet className="w-8 h-8 text-amber-400" style={{ filter: 'drop-shadow(0 0 8px rgba(251, 191, 36, 0.8))' }} />
              <span className="text-amber-400" style={{ textShadow: '0 0 15px rgba(251, 191, 36, 0.6)' }}>
                Gestión de Nóminas
              </span>
            </h1>
            <p className="text-zinc-400 mt-1">Control completo de nóminas del personal</p>
          </div>
          
          <div className="flex gap-2">
            <Button 
              onClick={handleExport} 
              variant="outline" 
              className="border-zinc-700 text-zinc-300"
              disabled={isExporting}
            >
              {isExporting ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
              Exportar Mes
            </Button>
            <Button onClick={() => handleOpenDialog()} className="bg-amber-600 hover:bg-amber-700">
              <Plus className="w-4 h-4 mr-2" /> Nueva Nómina
            </Button>
          </div>
        </div>

        {/* Selector de mes */}
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <Button variant="ghost" onClick={goToPreviousMonth} className="text-zinc-400 hover:text-white">
                ← Mes anterior
              </Button>
              <div className="text-center">
                <h2 className="text-xl font-bold text-white capitalize">
                  {format(new Date(selectedMonth + '-01'), 'MMMM yyyy', { locale: es })}
                </h2>
                <p className="text-zinc-500 text-sm">{monthPayrolls.length} nóminas</p>
              </div>
              <Button variant="ghost" onClick={goToNextMonth} className="text-zinc-400 hover:text-white">
                Mes siguiente →
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* KPIs del mes */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="p-4">
              <p className="text-zinc-500 text-xs">Total Bruto</p>
              <p className="text-xl font-bold text-white">{totalBruto.toLocaleString()}€</p>
            </CardContent>
          </Card>
          <Card className="bg-emerald-900/20 border-emerald-800/50">
            <CardContent className="p-4">
              <p className="text-emerald-400/80 text-xs">Total Neto</p>
              <p className="text-xl font-bold text-white">{totalNeto.toLocaleString()}€</p>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="p-4">
              <p className="text-zinc-500 text-xs">SS Empresa</p>
              <p className="text-xl font-bold text-white">{totalSSEmpresa.toLocaleString()}€</p>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="p-4">
              <p className="text-zinc-500 text-xs">Retenciones IRPF</p>
              <p className="text-xl font-bold text-white">{totalIRPF.toLocaleString()}€</p>
            </CardContent>
          </Card>
          <Card className={`${pendientes > 0 ? 'bg-amber-900/20 border-amber-800/50' : 'bg-emerald-900/20 border-emerald-800/50'}`}>
            <CardContent className="p-4">
              <p className={`${pendientes > 0 ? 'text-amber-400/80' : 'text-emerald-400/80'} text-xs`}>Estado</p>
              <p className="text-xl font-bold text-white">
                {pagadas}/{monthPayrolls.length}
                <span className="text-sm font-normal text-zinc-500 ml-1">pagadas</span>
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Gráfico evolución */}
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-amber-400" />
              Evolución Últimos 6 Meses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyEvolution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="month" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '8px' }}
                    formatter={(value) => [`${value.toLocaleString()}€`]}
                  />
                  <Bar dataKey="bruto" fill="#fbbf24" name="Bruto" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="neto" fill="#10b981" name="Neto" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Filtros y tabla */}
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <Input
                  placeholder="Buscar por empleado o DNI..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-zinc-800 border-zinc-700 text-white"
                />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-40 bg-zinc-800 border-zinc-700 text-white">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pendiente">Pendientes</SelectItem>
                  <SelectItem value="pagada">Pagadas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800">
                  <TableHead className="text-zinc-400">Empleado</TableHead>
                  <TableHead className="text-zinc-400">DNI</TableHead>
                  <TableHead className="text-zinc-400 text-right">Bruto</TableHead>
                  <TableHead className="text-zinc-400 text-right">SS Emp.</TableHead>
                  <TableHead className="text-zinc-400 text-right">IRPF</TableHead>
                  <TableHead className="text-zinc-400 text-right">Neto</TableHead>
                  <TableHead className="text-zinc-400">Estado</TableHead>
                  <TableHead className="text-zinc-400 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayrolls.map((payroll) => (
                  <TableRow key={payroll.id} className="border-zinc-800 hover:bg-zinc-800/50">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-amber-500/20 rounded-lg flex items-center justify-center">
                          <User className="w-4 h-4 text-amber-400" />
                        </div>
                        <span className="text-white font-medium">{payroll.employee_name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-zinc-400 font-mono text-sm">{payroll.employee_dni || '-'}</TableCell>
                    <TableCell className="text-white text-right">{(payroll.gross_salary || 0).toLocaleString()}€</TableCell>
                    <TableCell className="text-zinc-400 text-right">{(payroll.ss_employee || 0).toLocaleString()}€</TableCell>
                    <TableCell className="text-zinc-400 text-right">{(payroll.irpf_amount || 0).toLocaleString()}€</TableCell>
                    <TableCell className="text-emerald-400 text-right font-semibold">{(payroll.net_salary || 0).toLocaleString()}€</TableCell>
                    <TableCell>
                      <Badge className={`${
                        payroll.status === 'pagada' ? 'bg-emerald-500/20 text-emerald-400' :
                        'bg-amber-500/20 text-amber-400'
                      } border-0`}>
                        {payroll.status === 'pagada' ? (
                          <><CheckCircle className="w-3 h-3 mr-1" /> Pagada</>
                        ) : (
                          <><Clock className="w-3 h-3 mr-1" /> Pendiente</>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-zinc-400">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-zinc-800 border-zinc-700">
                          <DropdownMenuItem 
                            onClick={() => handleOpenDialog(payroll)}
                            className="text-zinc-300 hover:text-white cursor-pointer"
                          >
                            <Edit className="w-4 h-4 mr-2" /> Editar
                          </DropdownMenuItem>
                          {payroll.status !== 'pagada' && (
                            <DropdownMenuItem 
                              onClick={() => handleMarkAsPaid(payroll)}
                              className="text-emerald-400 hover:text-emerald-300 cursor-pointer"
                            >
                              <CheckCircle className="w-4 h-4 mr-2" /> Marcar pagada
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem 
                            onClick={() => generatePDF(payroll)}
                            className="text-zinc-300 hover:text-white cursor-pointer"
                          >
                            <Download className="w-4 h-4 mr-2" /> Descargar
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => setDeleteConfirm(payroll.id)}
                            className="text-red-400 hover:text-red-300 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4 mr-2" /> Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {filteredPayrolls.length === 0 && (
              <div className="text-center py-12">
                <Wallet className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
                <p className="text-zinc-500">No hay nóminas para este período</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Resumen para gestoría */}
        <Card className="bg-amber-900/10 border-amber-800/50">
          <CardHeader>
            <CardTitle className="text-amber-400 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Resumen para Gestoría
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-zinc-800/50 rounded-lg">
                <p className="text-zinc-500 text-sm">Coste Total Empresa</p>
                <p className="text-2xl font-bold text-white">
                  {(totalBruto + totalSSEmpresa).toLocaleString()}€
                </p>
                <p className="text-zinc-500 text-xs mt-1">Bruto + SS Empresa</p>
              </div>
              <div className="p-4 bg-zinc-800/50 rounded-lg">
                <p className="text-zinc-500 text-sm">A Ingresar SS</p>
                <p className="text-2xl font-bold text-white">
                  {(totalSSEmpresa + monthPayrolls.reduce((sum, p) => sum + (p.ss_employee || 0), 0)).toLocaleString()}€
                </p>
                <p className="text-zinc-500 text-xs mt-1">SS Empresa + SS Empleado</p>
              </div>
              <div className="p-4 bg-zinc-800/50 rounded-lg">
                <p className="text-zinc-500 text-sm">A Ingresar IRPF</p>
                <p className="text-2xl font-bold text-white">{totalIRPF.toLocaleString()}€</p>
                <p className="text-zinc-500 text-xs mt-1">Retenciones del mes</p>
              </div>
              <div className="p-4 bg-zinc-800/50 rounded-lg">
                <p className="text-zinc-500 text-sm">Total a Pagar</p>
                <p className="text-2xl font-bold text-emerald-400">{totalNeto.toLocaleString()}€</p>
                <p className="text-zinc-500 text-xs mt-1">Nóminas netas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dialog crear/editar nómina */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingPayroll ? 'Editar Nómina' : 'Nueva Nómina'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Empleado y período */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-zinc-400">Empleado *</Label>
                <Select 
                  value={formData.employee_id} 
                  onValueChange={handleEmployeeSelect}
                >
                  <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                    <SelectValue placeholder="Seleccionar empleado" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700">
                    {employees.filter(e => e.status === 'activo' || !e.status).map(emp => (
                      <SelectItem key={emp.id} value={emp.id}>{emp.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-zinc-400">Período *</Label>
                <Input
                  type="month"
                  value={formData.period}
                  onChange={(e) => setFormData({...formData, period: e.target.value})}
                  className="bg-zinc-800 border-zinc-700 text-white"
                />
              </div>
            </div>

            {/* Devengos */}
            <div className="p-4 bg-zinc-800/30 rounded-lg space-y-4">
              <h4 className="text-white font-medium">Devengos</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-zinc-400">Salario Bruto *</Label>
                  <Input
                    type="number"
                    value={formData.gross_salary}
                    onChange={(e) => setFormData({...formData, gross_salary: e.target.value})}
                    className="bg-zinc-800 border-zinc-700 text-white"
                    placeholder="2000"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-400">Complementos/Extras</Label>
                  <Input
                    type="number"
                    value={formData.extras}
                    onChange={(e) => setFormData({...formData, extras: e.target.value})}
                    className="bg-zinc-800 border-zinc-700 text-white"
                    placeholder="0"
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={calculatePayroll} variant="outline" className="w-full border-amber-600 text-amber-400 hover:bg-amber-600/20">
                    <RefreshCw className="w-4 h-4 mr-2" /> Calcular
                  </Button>
                </div>
              </div>
            </div>

            {/* Deducciones */}
            <div className="p-4 bg-zinc-800/30 rounded-lg space-y-4">
              <h4 className="text-white font-medium">Deducciones</h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label className="text-zinc-400">SS Empleado</Label>
                  <Input
                    type="number"
                    value={formData.ss_employee}
                    onChange={(e) => setFormData({...formData, ss_employee: e.target.value})}
                    className="bg-zinc-800 border-zinc-700 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-400">% IRPF</Label>
                  <Input
                    type="number"
                    value={formData.irpf_rate}
                    onChange={(e) => setFormData({...formData, irpf_rate: e.target.value})}
                    className="bg-zinc-800 border-zinc-700 text-white"
                    placeholder="15"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-400">Retención IRPF</Label>
                  <Input
                    type="number"
                    value={formData.irpf_amount}
                    onChange={(e) => setFormData({...formData, irpf_amount: e.target.value})}
                    className="bg-zinc-800 border-zinc-700 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-400">Otras deducciones</Label>
                  <Input
                    type="number"
                    value={formData.deductions}
                    onChange={(e) => setFormData({...formData, deductions: e.target.value})}
                    className="bg-zinc-800 border-zinc-700 text-white"
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            {/* Resultado y empresa */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-emerald-900/20 border border-emerald-800/50 rounded-lg">
                <Label className="text-emerald-400">Líquido a Percibir</Label>
                <Input
                  type="number"
                  value={formData.net_salary}
                  onChange={(e) => setFormData({...formData, net_salary: e.target.value})}
                  className="bg-zinc-800 border-emerald-700 text-white text-xl font-bold mt-2"
                />
              </div>
              <div className="p-4 bg-zinc-800/30 rounded-lg">
                <Label className="text-zinc-400">SS Empresa</Label>
                <Input
                  type="number"
                  value={formData.ss_company}
                  onChange={(e) => setFormData({...formData, ss_company: e.target.value})}
                  className="bg-zinc-800 border-zinc-700 text-white mt-2"
                />
              </div>
            </div>

            {/* Estado y fecha pago */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-zinc-400">Estado</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData({...formData, status: v})}>
                  <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700">
                    <SelectItem value="pendiente">Pendiente</SelectItem>
                    <SelectItem value="pagada">Pagada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-zinc-400">Fecha de pago</Label>
                <Input
                  type="date"
                  value={formData.payment_date}
                  onChange={(e) => setFormData({...formData, payment_date: e.target.value})}
                  className="bg-zinc-800 border-zinc-700 text-white"
                />
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="ghost" onClick={handleCloseDialog} className="text-zinc-400">
              Cancelar
            </Button>
            <Button onClick={handleSubmit} className="bg-amber-600 hover:bg-amber-700">
              {editingPayroll ? 'Guardar Cambios' : 'Crear Nómina'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog confirmar eliminar */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-white">¿Eliminar nómina?</DialogTitle>
          </DialogHeader>
          <p className="text-zinc-400">
            Esta acción no se puede deshacer. Se eliminará el registro de la nómina.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteConfirm(null)} className="text-zinc-400">
              Cancelar
            </Button>
            <Button 
              onClick={() => deleteMutation.mutate(deleteConfirm)} 
              className="bg-red-600 hover:bg-red-700"
            >
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
