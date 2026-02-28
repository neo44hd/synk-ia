import React, { useState, useEffect } from "react";
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
  Users, 
  Plus, 
  Edit, 
  Trash2,
  Clock,
  Calendar,
  FileText,
  Phone,
  Mail,
  Search,
  Download,
  ArrowLeft,
  Eye,
  CheckCircle,
  XCircle,
  AlertTriangle,
  User,
  Briefcase,
  CreditCard,
  Building,
  Timer,
  Activity,
  MoreVertical,
  LogIn,
  LogOut,
  TrendingUp
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { format, differenceInMinutes, startOfMonth, endOfMonth, isToday, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { exportService } from "@/services/exportService";

const CONTRACT_TYPES = [
  { value: 'indefinido', label: 'Indefinido' },
  { value: 'temporal', label: 'Temporal' },
  { value: 'practicas', label: 'Prácticas' },
  { value: 'formacion', label: 'Formación' },
  { value: 'autonomo', label: 'Autónomo' }
];

const WORK_SCHEDULES = [
  { value: 'completa', label: 'Jornada Completa' },
  { value: 'parcial', label: 'Jornada Parcial' },
  { value: 'intensiva', label: 'Jornada Intensiva' },
  { value: 'turnos', label: 'Por Turnos' }
];

export default function EmployeeControl() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  
  const [formData, setFormData] = useState({
    full_name: '',
    dni: '',
    email: '',
    phone: '',
    position: '',
    department: '',
    hire_date: '',
    contract_type: 'indefinido',
    work_schedule: 'completa',
    annual_salary: '',
    ss_number: '',
    iban: '',
    address: '',
    emergency_contact: '',
    status: 'activo'
  });

  const queryClient = useQueryClient();

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['employees-control'],
    queryFn: () => base44.entities.Employee.list('-created_date', 200),
    staleTime: 60000
  });

  const { data: timesheets = [] } = useQuery({
    queryKey: ['employee-timesheets'],
    queryFn: () => base44.entities.Timesheet.list('-date', 1000),
    staleTime: 30000
  });

  const { data: payrolls = [] } = useQuery({
    queryKey: ['employee-payrolls'],
    queryFn: () => base44.entities.Payroll.list('-period', 500),
    staleTime: 60000
  });

  const { data: documents = [] } = useQuery({
    queryKey: ['employee-documents'],
    queryFn: async () => {
      try {
        return await base44.entities.Document.list('-created_date', 500);
      } catch {
        return [];
      }
    },
    staleTime: 60000
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Employee.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees-control'] });
      toast.success('Empleado creado correctamente');
      handleCloseDialog();
    },
    onError: () => toast.error('Error al crear empleado')
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Employee.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees-control'] });
      toast.success('Empleado actualizado');
      handleCloseDialog();
    },
    onError: () => toast.error('Error al actualizar')
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Employee.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees-control'] });
      toast.success('Empleado eliminado');
      setDeleteConfirm(null);
      if (selectedEmployee?.id === deleteConfirm) {
        setSelectedEmployee(null);
      }
    },
    onError: () => toast.error('Error al eliminar')
  });

  // Obtener fichajes de hoy
  const today = format(new Date(), 'yyyy-MM-dd');
  const todayTimesheets = timesheets.filter(t => 
    t.date === today || (t.check_in && t.check_in.startsWith(today))
  );

  // Calcular estadísticas por empleado
  const getEmployeeStats = (employee) => {
    const empTimesheets = timesheets.filter(t => 
      t.employee_id === employee.id || t.employee_name === employee.full_name
    );
    
    const empPayrolls = payrolls.filter(p => 
      p.employee_id === employee.id || p.employee_name === employee.full_name
    );
    
    // Fichaje de hoy
    const todayTs = empTimesheets.find(t => 
      t.date === today || (t.check_in && t.check_in.startsWith(today))
    );
    
    // Horas este mes
    const monthStart = startOfMonth(new Date());
    const monthEnd = endOfMonth(new Date());
    const monthTimesheets = empTimesheets.filter(t => {
      const d = new Date(t.date || t.check_in);
      return d >= monthStart && d <= monthEnd;
    });
    
    const totalHoursMonth = monthTimesheets.reduce((sum, t) => {
      if (t.hours_worked) return sum + t.hours_worked;
      if (t.check_in && t.check_out) {
        const diff = differenceInMinutes(new Date(t.check_out), new Date(t.check_in));
        return sum + (diff / 60);
      }
      return sum;
    }, 0);
    
    // Horas por día de la semana (últimos 30 días)
    const weekdayHours = {};
    empTimesheets.slice(0, 30).forEach(t => {
      const day = format(new Date(t.date || t.check_in), 'EEE', { locale: es });
      const hours = t.hours_worked || 0;
      weekdayHours[day] = (weekdayHours[day] || 0) + hours;
    });
    
    return {
      timesheets: empTimesheets,
      payrolls: empPayrolls,
      todayTimesheet: todayTs,
      totalHoursMonth,
      isWorking: todayTs && todayTs.check_in && !todayTs.check_out,
      daysWorkedMonth: monthTimesheets.length,
      weekdayData: Object.entries(weekdayHours).map(([name, hours]) => ({ name, hours: Math.round(hours) }))
    };
  };

  // Filtrar empleados
  const filteredEmployees = employees.filter(e => {
    const matchesSearch = e.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         e.dni?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         e.position?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'all' || e.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  // Estadísticas generales
  const activeEmployees = employees.filter(e => e.status === 'activo' || !e.status);
  const workingNow = activeEmployees.filter(e => {
    const stats = getEmployeeStats(e);
    return stats.isWorking;
  });
  const checkedInToday = todayTimesheets.length;
  const notCheckedIn = activeEmployees.length - checkedInToday;

  const handleOpenDialog = (employee = null) => {
    if (employee) {
      setEditingEmployee(employee);
      setFormData({
        full_name: employee.full_name || '',
        dni: employee.dni || '',
        email: employee.email || '',
        phone: employee.phone || '',
        position: employee.position || '',
        department: employee.department || '',
        hire_date: employee.hire_date || '',
        contract_type: employee.contract_type || 'indefinido',
        work_schedule: employee.work_schedule || 'completa',
        annual_salary: employee.annual_salary || '',
        ss_number: employee.ss_number || '',
        iban: employee.iban || '',
        address: employee.address || '',
        emergency_contact: employee.emergency_contact || '',
        status: employee.status || 'activo'
      });
    } else {
      setEditingEmployee(null);
      setFormData({
        full_name: '', dni: '', email: '', phone: '', position: '', department: '',
        hire_date: '', contract_type: 'indefinido', work_schedule: 'completa',
        annual_salary: '', ss_number: '', iban: '', address: '', emergency_contact: '',
        status: 'activo'
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingEmployee(null);
  };

  const handleSubmit = () => {
    if (!formData.full_name) {
      toast.error('El nombre es obligatorio');
      return;
    }
    
    if (editingEmployee) {
      updateMutation.mutate({ id: editingEmployee.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleExport = () => {
    const result = exportService.exportEmployeeList(employees);
    toast.success(`Exportados ${result.exported} empleados`);
  };

  const handleExportTimesheets = () => {
    const start = startOfMonth(new Date());
    const end = endOfMonth(new Date());
    const result = exportService.exportTimesheetsByPeriod(timesheets, employees, start, end);
    toast.success(`Exportados ${result.exported} fichajes`);
  };

  // Vista detallada de empleado
  if (selectedEmployee) {
    const stats = getEmployeeStats(selectedEmployee);
    const empDocs = documents.filter(d => 
      d.employee_id === selectedEmployee.id || 
      d.employee_name === selectedEmployee.full_name
    );

    return (
      <div className="p-4 md:p-8 min-h-screen bg-gradient-to-br from-zinc-950 via-neutral-900 to-zinc-950">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              onClick={() => setSelectedEmployee(null)}
              className="text-zinc-400 hover:text-white"
            >
              <ArrowLeft className="w-5 h-5 mr-2" /> Volver
            </Button>
          </div>

          {/* Info principal */}
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 bg-purple-500/20 rounded-xl flex items-center justify-center">
                    <User className="w-8 h-8 text-purple-400" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-white">{selectedEmployee.full_name}</h1>
                    <p className="text-zinc-400">{selectedEmployee.position || 'Sin puesto'}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge className={`${selectedEmployee.status === 'activo' || !selectedEmployee.status ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'} border-0`}>
                        {selectedEmployee.status || 'activo'}
                      </Badge>
                      <Badge className="bg-zinc-700 text-zinc-300 border-0">
                        {CONTRACT_TYPES.find(c => c.value === selectedEmployee.contract_type)?.label || 'Indefinido'}
                      </Badge>
                      {stats.isWorking && (
                        <Badge className="bg-emerald-500/20 text-emerald-400 border-0 animate-pulse">
                          <Activity className="w-3 h-3 mr-1" /> Trabajando
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button onClick={() => handleOpenDialog(selectedEmployee)} className="bg-purple-600 hover:bg-purple-700">
                    <Edit className="w-4 h-4 mr-2" /> Editar
                  </Button>
                </div>
              </div>

              {/* Contacto */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-zinc-800">
                {selectedEmployee.email && (
                  <div className="flex items-center gap-2 text-zinc-400">
                    <Mail className="w-4 h-4" />
                    <span className="text-sm">{selectedEmployee.email}</span>
                  </div>
                )}
                {selectedEmployee.phone && (
                  <div className="flex items-center gap-2 text-zinc-400">
                    <Phone className="w-4 h-4" />
                    <span className="text-sm">{selectedEmployee.phone}</span>
                  </div>
                )}
                {selectedEmployee.dni && (
                  <div className="flex items-center gap-2 text-zinc-400">
                    <CreditCard className="w-4 h-4" />
                    <span className="text-sm">{selectedEmployee.dni}</span>
                  </div>
                )}
                {selectedEmployee.department && (
                  <div className="flex items-center gap-2 text-zinc-400">
                    <Building className="w-4 h-4" />
                    <span className="text-sm">{selectedEmployee.department}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardContent className="p-4">
                <p className="text-zinc-500 text-sm">Horas Este Mes</p>
                <p className="text-2xl font-bold text-white">{stats.totalHoursMonth.toFixed(1)}h</p>
              </CardContent>
            </Card>
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardContent className="p-4">
                <p className="text-zinc-500 text-sm">Días Trabajados</p>
                <p className="text-2xl font-bold text-white">{stats.daysWorkedMonth}</p>
              </CardContent>
            </Card>
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardContent className="p-4">
                <p className="text-zinc-500 text-sm">Total Fichajes</p>
                <p className="text-2xl font-bold text-white">{stats.timesheets.length}</p>
              </CardContent>
            </Card>
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardContent className="p-4">
                <p className="text-zinc-500 text-sm">Nóminas</p>
                <p className="text-2xl font-bold text-white">{stats.payrolls.length}</p>
              </CardContent>
            </Card>
          </div>

          {/* Fichaje hoy y gráfico */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Fichaje de hoy */}
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Clock className="w-5 h-5 text-purple-400" />
                  Fichaje de Hoy
                </CardTitle>
              </CardHeader>
              <CardContent>
                {stats.todayTimesheet ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                          <LogIn className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div>
                          <p className="text-zinc-400 text-sm">Entrada</p>
                          <p className="text-white font-semibold">
                            {stats.todayTimesheet.check_in 
                              ? format(new Date(stats.todayTimesheet.check_in), 'HH:mm')
                              : '-'}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 ${stats.todayTimesheet.check_out ? 'bg-red-500/20' : 'bg-zinc-700'} rounded-lg flex items-center justify-center`}>
                          <LogOut className={`w-5 h-5 ${stats.todayTimesheet.check_out ? 'text-red-400' : 'text-zinc-500'}`} />
                        </div>
                        <div>
                          <p className="text-zinc-400 text-sm">Salida</p>
                          <p className="text-white font-semibold">
                            {stats.todayTimesheet.check_out 
                              ? format(new Date(stats.todayTimesheet.check_out), 'HH:mm')
                              : 'Pendiente'}
                          </p>
                        </div>
                      </div>
                    </div>
                    {stats.todayTimesheet.hours_worked && (
                      <div className="text-center p-4 bg-purple-500/10 rounded-lg border border-purple-500/20">
                        <p className="text-purple-400 text-sm">Horas trabajadas hoy</p>
                        <p className="text-2xl font-bold text-white">{stats.todayTimesheet.hours_worked}h</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-zinc-500">
                    <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Sin fichaje hoy</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Datos adicionales */}
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-purple-400" />
                  Datos Laborales
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {selectedEmployee.hire_date && (
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Fecha alta</span>
                      <span className="text-white">{format(new Date(selectedEmployee.hire_date), 'dd/MM/yyyy')}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Tipo contrato</span>
                    <span className="text-white">{CONTRACT_TYPES.find(c => c.value === selectedEmployee.contract_type)?.label || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Jornada</span>
                    <span className="text-white">{WORK_SCHEDULES.find(w => w.value === selectedEmployee.work_schedule)?.label || '-'}</span>
                  </div>
                  {selectedEmployee.annual_salary && (
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Salario bruto anual</span>
                      <span className="text-white">{Number(selectedEmployee.annual_salary).toLocaleString()}€</span>
                    </div>
                  )}
                  {selectedEmployee.ss_number && (
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Nº Seguridad Social</span>
                      <span className="text-white font-mono text-sm">{selectedEmployee.ss_number}</span>
                    </div>
                  )}
                  {selectedEmployee.iban && (
                    <div className="flex justify-between">
                      <span className="text-zinc-500">IBAN</span>
                      <span className="text-white font-mono text-sm">{selectedEmployee.iban}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabs: Fichajes, Nóminas, Documentos */}
          <Card className="bg-zinc-900/50 border-zinc-800">
            <Tabs defaultValue="timesheets" className="w-full">
              <CardHeader>
                <TabsList className="bg-zinc-800">
                  <TabsTrigger value="timesheets" className="data-[state=active]:bg-purple-600">
                    Fichajes ({stats.timesheets.length})
                  </TabsTrigger>
                  <TabsTrigger value="payrolls" className="data-[state=active]:bg-purple-600">
                    Nóminas ({stats.payrolls.length})
                  </TabsTrigger>
                  <TabsTrigger value="documents" className="data-[state=active]:bg-purple-600">
                    Documentos ({empDocs.length})
                  </TabsTrigger>
                </TabsList>
              </CardHeader>
              <CardContent>
                <TabsContent value="timesheets">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-zinc-800">
                        <TableHead className="text-zinc-400">Fecha</TableHead>
                        <TableHead className="text-zinc-400">Entrada</TableHead>
                        <TableHead className="text-zinc-400">Salida</TableHead>
                        <TableHead className="text-zinc-400 text-right">Horas</TableHead>
                        <TableHead className="text-zinc-400">Tipo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stats.timesheets.slice(0, 15).map((ts) => (
                        <TableRow key={ts.id} className="border-zinc-800">
                          <TableCell className="text-white">
                            {ts.date ? format(new Date(ts.date), 'dd/MM/yyyy') : '-'}
                          </TableCell>
                          <TableCell className="text-zinc-300">
                            {ts.check_in ? format(new Date(ts.check_in), 'HH:mm') : '-'}
                          </TableCell>
                          <TableCell className="text-zinc-300">
                            {ts.check_out ? format(new Date(ts.check_out), 'HH:mm') : '-'}
                          </TableCell>
                          <TableCell className="text-white text-right font-semibold">
                            {ts.hours_worked ? `${ts.hours_worked}h` : '-'}
                          </TableCell>
                          <TableCell>
                            <Badge className="bg-zinc-700 text-zinc-300 border-0">
                              {ts.type || 'normal'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TabsContent>
                
                <TabsContent value="payrolls">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-zinc-800">
                        <TableHead className="text-zinc-400">Período</TableHead>
                        <TableHead className="text-zinc-400 text-right">Bruto</TableHead>
                        <TableHead className="text-zinc-400 text-right">Neto</TableHead>
                        <TableHead className="text-zinc-400">Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stats.payrolls.slice(0, 12).map((p) => (
                        <TableRow key={p.id} className="border-zinc-800">
                          <TableCell className="text-white font-medium">{p.period || '-'}</TableCell>
                          <TableCell className="text-zinc-300 text-right">
                            {(p.gross_salary || 0).toLocaleString()}€
                          </TableCell>
                          <TableCell className="text-white text-right font-semibold">
                            {(p.net_salary || 0).toLocaleString()}€
                          </TableCell>
                          <TableCell>
                            <Badge className={`${
                              p.status === 'pagada' ? 'bg-emerald-500/20 text-emerald-400' :
                              'bg-amber-500/20 text-amber-400'
                            } border-0`}>
                              {p.status || 'pendiente'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TabsContent>
                
                <TabsContent value="documents">
                  {empDocs.length === 0 ? (
                    <div className="text-center py-8 text-zinc-500">
                      <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>No hay documentos asociados</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {empDocs.map((doc) => (
                        <div key={doc.id} className="p-4 bg-zinc-800/50 rounded-lg flex items-center gap-4">
                          <FileText className="w-8 h-8 text-purple-400" />
                          <div className="flex-1">
                            <p className="text-white font-medium">{doc.name || 'Documento'}</p>
                            <p className="text-zinc-500 text-sm">{doc.type || 'Archivo'}</p>
                          </div>
                          {doc.file_url && (
                            <Button variant="ghost" size="sm" asChild>
                              <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                                <Eye className="w-4 h-4" />
                              </a>
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </CardContent>
            </Tabs>
          </Card>
        </div>
      </div>
    );
  }

  // Vista lista de empleados
  return (
    <div className="p-4 md:p-8 min-h-screen bg-gradient-to-br from-zinc-950 via-neutral-900 to-zinc-950">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Users className="w-8 h-8 text-purple-400" style={{ filter: 'drop-shadow(0 0 8px rgba(168, 85, 247, 0.8))' }} />
              <span className="text-purple-400" style={{ textShadow: '0 0 15px rgba(168, 85, 247, 0.6)' }}>
                Control de Empleados
              </span>
            </h1>
            <p className="text-zinc-400 mt-1">Gestión completa del equipo</p>
          </div>
          
          <div className="flex gap-2">
            <Button onClick={handleExportTimesheets} variant="outline" className="border-zinc-700 text-zinc-300">
              <Clock className="w-4 h-4 mr-2" /> Exportar Fichajes
            </Button>
            <Button onClick={handleExport} variant="outline" className="border-zinc-700 text-zinc-300">
              <Download className="w-4 h-4 mr-2" /> Exportar Lista
            </Button>
            <Button onClick={() => handleOpenDialog()} className="bg-purple-600 hover:bg-purple-700">
              <Plus className="w-4 h-4 mr-2" /> Nuevo Empleado
            </Button>
          </div>
        </div>

        {/* KPIs en tiempo real */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-zinc-500 text-sm">Empleados Activos</p>
                  <p className="text-2xl font-bold text-white">{activeEmployees.length}</p>
                </div>
                <Users className="w-8 h-8 text-purple-400" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-emerald-900/20 border-emerald-800/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-emerald-400/80 text-sm">Trabajando Ahora</p>
                  <p className="text-2xl font-bold text-white">{workingNow.length}</p>
                </div>
                <Activity className="w-8 h-8 text-emerald-400 animate-pulse" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-zinc-500 text-sm">Fichados Hoy</p>
                  <p className="text-2xl font-bold text-white">{checkedInToday}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-cyan-400" />
              </div>
            </CardContent>
          </Card>
          <Card className={`${notCheckedIn > 0 ? 'bg-amber-900/20 border-amber-800/50' : 'bg-zinc-900/50 border-zinc-800'}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className={`${notCheckedIn > 0 ? 'text-amber-400/80' : 'text-zinc-500'} text-sm`}>Sin Fichar</p>
                  <p className="text-2xl font-bold text-white">{notCheckedIn}</p>
                </div>
                <AlertTriangle className={`w-8 h-8 ${notCheckedIn > 0 ? 'text-amber-400' : 'text-zinc-600'}`} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <Input
                  placeholder="Buscar por nombre, DNI o puesto..."
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
                  <SelectItem value="activo">Activos</SelectItem>
                  <SelectItem value="baja">De baja</SelectItem>
                  <SelectItem value="vacaciones">Vacaciones</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Lista de empleados */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEmployees.map((employee) => {
            const stats = getEmployeeStats(employee);
            return (
              <Card 
                key={employee.id} 
                className="bg-zinc-900/50 border-zinc-800 hover:border-purple-500/30 transition-all cursor-pointer"
                onClick={() => setSelectedEmployee(employee)}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 ${stats.isWorking ? 'bg-emerald-500/20 ring-2 ring-emerald-500/50' : 'bg-purple-500/20'} rounded-lg flex items-center justify-center relative`}>
                        <User className={`w-6 h-6 ${stats.isWorking ? 'text-emerald-400' : 'text-purple-400'}`} />
                        {stats.isWorking && (
                          <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full animate-pulse" />
                        )}
                      </div>
                      <div>
                        <h3 className="text-white font-semibold">{employee.full_name}</h3>
                        <p className="text-zinc-500 text-sm">{employee.position || 'Sin puesto'}</p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" className="text-zinc-400">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="bg-zinc-800 border-zinc-700">
                        <DropdownMenuItem 
                          onClick={(e) => { e.stopPropagation(); handleOpenDialog(employee); }}
                          className="text-zinc-300 hover:text-white cursor-pointer"
                        >
                          <Edit className="w-4 h-4 mr-2" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={(e) => { e.stopPropagation(); setDeleteConfirm(employee.id); }}
                          className="text-red-400 hover:text-red-300 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4 mr-2" /> Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  
                  <div className="flex items-center gap-2 mt-3">
                    <Badge className={`${employee.status === 'activo' || !employee.status ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'} border-0`}>
                      {employee.status || 'activo'}
                    </Badge>
                    {stats.todayTimesheet && (
                      <Badge className="bg-cyan-500/20 text-cyan-400 border-0">
                        <Clock className="w-3 h-3 mr-1" /> Fichado
                      </Badge>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-zinc-800">
                    <div>
                      <p className="text-zinc-500 text-xs">Horas mes</p>
                      <p className="text-white font-semibold">{stats.totalHoursMonth.toFixed(1)}h</p>
                    </div>
                    <div>
                      <p className="text-zinc-500 text-xs">Días trabajados</p>
                      <p className="text-white font-semibold">{stats.daysWorkedMonth}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {filteredEmployees.length === 0 && (
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
            <p className="text-zinc-500">No se encontraron empleados</p>
          </div>
        )}
      </div>

      {/* Dialog crear/editar */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingEmployee ? 'Editar Empleado' : 'Nuevo Empleado'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-zinc-400">Nombre completo *</Label>
              <Input
                value={formData.full_name}
                onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-400">DNI/NIE</Label>
              <Input
                value={formData.dni}
                onChange={(e) => setFormData({...formData, dni: e.target.value})}
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-400">Email</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-400">Teléfono</Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-400">Puesto</Label>
              <Input
                value={formData.position}
                onChange={(e) => setFormData({...formData, position: e.target.value})}
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-400">Departamento</Label>
              <Input
                value={formData.department}
                onChange={(e) => setFormData({...formData, department: e.target.value})}
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-400">Fecha alta</Label>
              <Input
                type="date"
                value={formData.hire_date}
                onChange={(e) => setFormData({...formData, hire_date: e.target.value})}
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-400">Tipo contrato</Label>
              <Select value={formData.contract_type} onValueChange={(v) => setFormData({...formData, contract_type: v})}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  {CONTRACT_TYPES.map(ct => (
                    <SelectItem key={ct.value} value={ct.value}>{ct.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-400">Jornada</Label>
              <Select value={formData.work_schedule} onValueChange={(v) => setFormData({...formData, work_schedule: v})}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  {WORK_SCHEDULES.map(ws => (
                    <SelectItem key={ws.value} value={ws.value}>{ws.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-400">Salario bruto anual</Label>
              <Input
                type="number"
                value={formData.annual_salary}
                onChange={(e) => setFormData({...formData, annual_salary: e.target.value})}
                className="bg-zinc-800 border-zinc-700 text-white"
                placeholder="25000"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-400">Nº Seguridad Social</Label>
              <Input
                value={formData.ss_number}
                onChange={(e) => setFormData({...formData, ss_number: e.target.value})}
                className="bg-zinc-800 border-zinc-700 text-white font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-400">IBAN</Label>
              <Input
                value={formData.iban}
                onChange={(e) => setFormData({...formData, iban: e.target.value})}
                className="bg-zinc-800 border-zinc-700 text-white font-mono"
                placeholder="ES00 0000 0000 0000 0000"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label className="text-zinc-400">Dirección</Label>
              <Input
                value={formData.address}
                onChange={(e) => setFormData({...formData, address: e.target.value})}
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-400">Contacto emergencia</Label>
              <Input
                value={formData.emergency_contact}
                onChange={(e) => setFormData({...formData, emergency_contact: e.target.value})}
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-400">Estado</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({...formData, status: v})}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  <SelectItem value="activo">Activo</SelectItem>
                  <SelectItem value="baja">De baja</SelectItem>
                  <SelectItem value="vacaciones">Vacaciones</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="ghost" onClick={handleCloseDialog} className="text-zinc-400">
              Cancelar
            </Button>
            <Button onClick={handleSubmit} className="bg-purple-600 hover:bg-purple-700">
              {editingEmployee ? 'Guardar Cambios' : 'Crear Empleado'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog confirmar eliminar */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-white">¿Eliminar empleado?</DialogTitle>
          </DialogHeader>
          <p className="text-zinc-400">
            Esta acción no se puede deshacer. Se eliminarán los datos del empleado.
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
