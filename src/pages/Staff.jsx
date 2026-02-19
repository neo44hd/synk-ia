import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Users, Search, Plus, User, FileText, Calendar, Clock, 
  DollarSign, ChevronRight, Phone, Mail, MapPin, 
  Download, Eye, Trash2, Edit, Building2, Lock, QrCode, Copy, Share2, CheckCircle2
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import EmployeeDetail from "@/components/staff/EmployeeDetail";
import { toast } from "sonner";

export default function Staff() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [qrEmployee, setQrEmployee] = useState(null);
  const [showGlobalQr, setShowGlobalQr] = useState(false);
  const queryClient = useQueryClient();
  
  const generatePortalLink = (employee) => {
    if (!employee?.magic_token) return '';
    return `${window.location.origin}/PortalLogin?token=${employee.magic_token}`;
  };

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list('-created_date', 500),
    staleTime: 30000,
  });

  const [statusFilter, setStatusFilter] = useState('todos');

  const filteredEmployees = employees
    .filter(emp => 
      !searchQuery || 
      emp.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.dni?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.position?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .filter(emp => statusFilter === 'todos' || emp.status === statusFilter);

  const activeCount = employees.filter(e => e.status === 'activo').length;
  const totalPayroll = employees.reduce((sum, e) => sum + (e.salary_net || 0), 0);
  
  const generatePin = async (employee) => {
    const pin = Math.floor(1000 + Math.random() * 9000).toString();
    await base44.entities.Employee.update(employee.id, { access_pin: pin });
    queryClient.invalidateQueries({ queryKey: ['employees'] });
    toast.success(`PIN generado para ${employee.full_name}: ${pin}`);
  };

  const generateMagicToken = async (employee) => {
    const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    await base44.entities.Employee.update(employee.id, { magic_token: token });
    queryClient.invalidateQueries({ queryKey: ['employees'] });
    return token;
  };

  const handleOpenQr = async (employee) => {
    if (!employee.magic_token) {
      const newToken = await generateMagicToken(employee);
      setQrEmployee({...employee, magic_token: newToken});
    } else {
      setQrEmployee(employee);
    }
  };

  const statusColors = {
    activo: 'bg-green-600 text-white',
    baja: 'bg-red-600 text-white',
    vacaciones: 'bg-blue-600 text-white',
    baja_medica: 'bg-orange-600 text-white',
    excedencia: 'bg-purple-600 text-white'
  };

  const departmentLabels = {
    cocina: '👨‍🍳 Cocina',
    sala: '🍽️ Sala',
    barra: '🍺 Barra',
    delivery: '🛵 Delivery',
    administracion: '💼 Administración',
    gerencia: '👔 Gerencia',
    limpieza: '🧹 Limpieza',
    otros: '📋 Otros'
  };

  if (selectedEmployee) {
    return (
      <EmployeeDetail 
        employee={selectedEmployee} 
        onBack={() => {
          setSelectedEmployee(null);
          queryClient.invalidateQueries({ queryKey: ['employees'] });
        }} 
      />
    );
  }

  return (
    <div className="p-4 md:p-8 min-h-screen bg-gradient-to-br from-zinc-950 via-neutral-900 to-zinc-950">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-3 h-3 bg-cyan-400 rounded-full animate-pulse" style={{ boxShadow: '0 0 10px rgba(6, 182, 212, 0.8)' }} />
            <span className="text-sm font-medium text-cyan-400" style={{ textShadow: '0 0 10px rgba(6, 182, 212, 0.6)' }}>
              Gestión de Personal
            </span>
          </div>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <h1 className="text-4xl font-black text-white mb-2 flex items-center gap-4">
                <div 
                  className="w-14 h-14 bg-black rounded-2xl flex items-center justify-center border border-cyan-500/50"
                  style={{ boxShadow: '0 0 25px rgba(6, 182, 212, 0.4), inset 0 0 15px rgba(6, 182, 212, 0.1)' }}
                >
                  <Users className="w-8 h-8 text-cyan-400" style={{ filter: 'drop-shadow(0 0 8px rgba(6, 182, 212, 0.8))' }} />
                </div>
                <span className="text-cyan-400" style={{ textShadow: '0 0 15px rgba(6, 182, 212, 0.6)' }}>PERSONAL</span>
              </h1>
              <p className="text-lg text-zinc-400">Fichas completas de cada trabajador</p>
            </div>
            
            <div className="flex gap-3 items-center">
              <Button 
                onClick={async () => {
                  if (!confirm('⚠️ Esto sincronizará todas las nóminas del Archivo Global con cada ficha de empleado. ¿Continuar?')) return;
                  const toastId = toast.loading('🔄 Sincronizando nóminas...');
                  try {
                    const res = await base44.functions.invoke('syncPayrollsToEmployees');
                    if (res.data.success) {
                      toast.success(res.data.message, { id: toastId });
                      queryClient.invalidateQueries({ queryKey: ['employees'] });
                    } else {
                      toast.error('Error: ' + res.data.error, { id: toastId });
                    }
                  } catch (err) {
                    toast.error('Error: ' + err.message, { id: toastId });
                  }
                }}
                className="bg-green-600 hover:bg-green-700 text-white font-bold"
              >
                <CheckCircle2 className="w-5 h-5 mr-2" />
                Sincronizar Nóminas
              </Button>
              <Button 
                onClick={async () => {
                  if (!confirm('⚠️ Esto unificará todos los empleados duplicados en fichas únicas. ¿Continuar?')) return;
                  const toastId = toast.loading('🔄 Unificando empleados duplicados...');
                  try {
                    const res = await base44.functions.invoke('mergeEmployeeDuplicates');
                    if (res.data.success) {
                      toast.success(res.data.message, { id: toastId });
                      queryClient.invalidateQueries({ queryKey: ['employees'] });
                    } else {
                      toast.error('Error: ' + res.data.error, { id: toastId });
                    }
                  } catch (err) {
                    toast.error('Error: ' + err.message, { id: toastId });
                  }
                }}
                className="bg-red-600 hover:bg-red-700 text-white font-bold"
              >
                <Trash2 className="w-5 h-5 mr-2" />
                Limpiar Duplicados
              </Button>
              <Button 
                onClick={() => setShowGlobalQr(true)}
                className="bg-zinc-800 border border-cyan-500/30 text-cyan-400 hover:bg-zinc-700 hover:text-cyan-300"
              >
                <QrCode className="w-5 h-5 mr-2" />
                Portal Acceso
              </Button>
            </div>
          </div>
        </div>

        {/* QR Dialog Personalizado */}
        <Dialog open={!!qrEmployee} onOpenChange={() => setQrEmployee(null)}>
          <DialogContent className="bg-zinc-900 border-zinc-800 text-white sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-center text-xl font-bold flex flex-col items-center gap-2">
                <div className="w-12 h-12 bg-cyan-500/10 rounded-xl flex items-center justify-center border border-cyan-500/50 mb-2">
                  <QrCode className="w-6 h-6 text-cyan-400" />
                </div>
                <span>Acceso Personal</span>
                <span className="text-cyan-400 text-base font-normal">{qrEmployee?.full_name}</span>
              </DialogTitle>
            </DialogHeader>
            
            <div className="flex flex-col items-center justify-center py-4 space-y-6">
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl opacity-50 blur group-hover:opacity-75 transition duration-200"></div>
                <div className="relative bg-white p-4 rounded-xl">
                  {qrEmployee && (
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(generatePortalLink(qrEmployee))}&bgcolor=ffffff`} 
                      alt="QR Portal Empleado" 
                      className="w-56 h-56"
                    />
                  )}
                </div>
              </div>

              <div className="text-center space-y-2 max-w-xs">
                <p className="text-zinc-400 text-sm">
                  Este QR contiene la llave de acceso única.
                  <br/>
                  <span className="text-cyan-400 font-bold">¡No compartir con nadie más!</span>
                </p>
              </div>

              <div className="w-full bg-zinc-950 p-3 rounded-lg border border-zinc-800 flex items-center gap-2">
                <code className="flex-1 text-xs text-zinc-400 truncate font-mono px-2">
                  {generatePortalLink(qrEmployee)}
                </code>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="text-zinc-400 hover:text-white"
                  onClick={() => {
                    navigator.clipboard.writeText(generatePortalLink(qrEmployee));
                    toast.success("Enlace mágico copiado");
                  }}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3 w-full">
                <Button 
                  variant="outline" 
                  className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                  onClick={() => {
                    if (navigator.share) {
                      navigator.share({
                        title: `Acceso Portal: ${qrEmployee?.full_name}`,
                        text: 'Aquí tienes tu enlace de acceso directo al Portal del Empleado.',
                        url: generatePortalLink(qrEmployee)
                      });
                    } else {
                      toast.error("Tu navegador no soporta compartir nativo");
                    }
                  }}
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  Enviar
                </Button>
                <Button 
                  onClick={() => setQrEmployee(null)}
                  className="bg-cyan-600 hover:bg-cyan-700 text-white"
                >
                  Cerrar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* QR Global del Portal */}
        <Dialog open={showGlobalQr} onOpenChange={setShowGlobalQr}>
          <DialogContent className="bg-zinc-900 border-zinc-800 text-white sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-center text-xl font-bold flex flex-col items-center gap-2">
                <div className="w-12 h-12 bg-violet-500/10 rounded-xl flex items-center justify-center border border-violet-500/50 mb-2">
                  <Building2 className="w-6 h-6 text-violet-400" />
                </div>
                <span>Portal del Empleado</span>
                <span className="text-zinc-400 text-sm font-normal">Acceso General</span>
              </DialogTitle>
            </DialogHeader>
            
            <div className="flex flex-col items-center justify-center py-4 space-y-6">
              <div className="bg-white p-4 rounded-xl">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(`${window.location.origin}/PortalLogin`)}&bgcolor=ffffff`} 
                  alt="QR Portal General" 
                  className="w-56 h-56"
                />
              </div>

              <p className="text-center text-zinc-400 text-sm max-w-xs">
                Escanea este código para acceder a la página de inicio del portal. Cada empleado necesitará su propio PIN o enlace mágico para entrar.
              </p>

              <div className="w-full bg-zinc-950 p-3 rounded-lg border border-zinc-800 flex items-center gap-2">
                <code className="flex-1 text-xs text-zinc-400 truncate font-mono px-2">
                  {`${window.location.origin}/PortalLogin`}
                </code>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="text-zinc-400 hover:text-white"
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/PortalLogin`);
                    toast.success("Enlace copiado");
                  }}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>

              <Button 
                onClick={() => setShowGlobalQr(false)}
                className="w-full bg-violet-600 hover:bg-violet-700 text-white"
              >
                Entendido
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* KPIs simplificados */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
            <Users className="w-6 h-6 text-violet-400 mb-2" />
            <p className="text-2xl font-black text-white">{employees.length}</p>
            <p className="text-xs text-zinc-500">Trabajadores</p>
          </div>
          <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
            <FileText className="w-6 h-6 text-blue-400 mb-2" />
            <p className="text-2xl font-black text-white">{employees.reduce((sum, e) => sum + (e.payrolls?.length || 0), 0)}</p>
            <p className="text-xs text-zinc-500">Nóminas</p>
          </div>
          <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
            <Clock className="w-6 h-6 text-orange-400 mb-2" />
            <p className="text-2xl font-black text-white">{employees.reduce((sum, e) => sum + (e.timesheets?.length || 0), 0)}</p>
            <p className="text-xs text-zinc-500">Fichajes</p>
          </div>
          <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
            <DollarSign className="w-6 h-6 text-green-400 mb-2" />
            <p className="text-2xl font-black text-white">{totalPayroll.toFixed(0)}€</p>
            <p className="text-xs text-zinc-500">Coste Total</p>
          </div>
        </div>

        {/* Búsqueda + Filtros */}
        <div className="flex gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-zinc-500 w-5 h-5" />
            <Input
              placeholder="🔍 Buscar trabajador..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 bg-zinc-900 border-zinc-800 text-white h-12 text-base"
            />
          </div>
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-12 px-4 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-base focus:outline-none focus:border-violet-500 min-w-40"
          >
            <option value="todos">📋 Todos</option>
            <option value="activo">✅ Activos</option>
            <option value="baja">❌ Bajas</option>
            <option value="vacaciones">🏖️ Vacaciones</option>
            <option value="baja_medica">🏥 Baja Médica</option>
            <option value="excedencia">📋 Excedencia</option>
          </select>
        </div>

        {/* Lista de Empleados */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-cyan-400 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-zinc-400">Cargando personal...</p>
          </div>
        ) : filteredEmployees.length === 0 ? (
          <Card className="border-none shadow-xl bg-zinc-800/50 border border-zinc-800">
            <CardContent className="p-12 text-center">
              <Users className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">No hay empleados</h3>
              <p className="text-zinc-400">Sube documentos con el Escáner IA para crear fichas automáticamente</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredEmployees.map((employee) => {
              const lastPayroll = employee.payrolls?.sort((a, b) => (b.period || '').localeCompare(a.period || ''))[0];
              return (
                <Card 
                  key={employee.id} 
                  className="relative border-none bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-800 hover:from-violet-950 hover:via-zinc-900 hover:to-zinc-900 border border-zinc-800 hover:border-violet-500/50 transition-all duration-300 cursor-pointer group overflow-hidden"
                  onClick={() => setSelectedEmployee(employee)}
                  style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}
                >
                  {/* Efecto glow */}
                  <div className="absolute inset-0 bg-gradient-to-r from-violet-500/0 via-violet-500/5 to-purple-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  
                  <CardContent className="relative p-6">
                    {/* Avatar + Status */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="relative">
                        {employee.photo_url ? (
                          <div className="relative">
                            <div className="absolute inset-0 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl blur opacity-50 group-hover:opacity-75 transition-opacity" />
                            <img 
                              src={employee.photo_url} 
                              alt={employee.full_name}
                              className="relative w-20 h-20 rounded-2xl object-cover ring-2 ring-violet-500/50 group-hover:ring-violet-400 transition-all"
                            />
                          </div>
                        ) : (
                          <div className="relative">
                            <div className="absolute inset-0 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl blur opacity-30 group-hover:opacity-50 transition-opacity" />
                            <div className="relative w-20 h-20 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center ring-2 ring-violet-500/50 group-hover:ring-violet-400 transition-all">
                              <User className="w-10 h-10 text-white" />
                            </div>
                          </div>
                        )}
                        <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-zinc-900 ${employee.status === 'activo' ? 'bg-green-500 shadow-lg shadow-green-500/50' : 'bg-zinc-500'}`} />
                      </div>
                      
                      <Button 
                        size="sm"
                        variant="ghost" 
                        className="bg-cyan-900/20 text-cyan-400 hover:bg-cyan-900/40 border border-cyan-500/20 h-9 px-3 backdrop-blur-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenQr(employee);
                        }}
                      >
                        <QrCode className="w-4 h-4 mr-1" />
                        QR
                      </Button>
                    </div>

                    {/* Info */}
                    <div className="mb-4">
                      <h3 className="text-xl font-bold text-white mb-1 group-hover:text-violet-300 transition-colors line-clamp-1">
                        {employee.full_name}
                      </h3>
                      <div className="flex items-center gap-2 text-sm text-zinc-400 mb-2">
                        {employee.position && <span className="truncate">{employee.position}</span>}
                        {employee.department && employee.position && <span>•</span>}
                        {employee.department && <span>{departmentLabels[employee.department] || employee.department}</span>}
                      </div>
                      <Badge className={`${statusColors[employee.status]} text-xs`}>
                        {employee.status}
                      </Badge>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div className="bg-violet-950/30 rounded-xl p-3 border border-violet-500/20 text-center group-hover:bg-violet-950/50 transition-all">
                        <FileText className="w-5 h-5 text-violet-400 mx-auto mb-1" />
                        <p className="text-2xl font-black text-white">{employee.payrolls?.length || 0}</p>
                        <p className="text-xs text-zinc-500">Nóminas</p>
                      </div>
                      <div className="bg-blue-950/30 rounded-xl p-3 border border-blue-500/20 text-center group-hover:bg-blue-950/50 transition-all">
                        <Clock className="w-5 h-5 text-blue-400 mx-auto mb-1" />
                        <p className="text-2xl font-black text-white">{employee.timesheets?.length || 0}</p>
                        <p className="text-xs text-zinc-500">Fichajes</p>
                      </div>
                      <div className="bg-green-950/30 rounded-xl p-3 border border-green-500/20 text-center group-hover:bg-green-950/50 transition-all">
                        <DollarSign className="w-5 h-5 text-green-400 mx-auto mb-1" />
                        <p className="text-2xl font-black text-white">{employee.salary_net?.toFixed(0) || '0'}€</p>
                        <p className="text-xs text-zinc-500">Salario</p>
                      </div>
                    </div>

                    {/* Última nómina */}
                    {lastPayroll && (
                      <div className="bg-zinc-950/50 rounded-lg p-3 border border-zinc-800 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-zinc-500" />
                          <span className="text-xs text-zinc-400">Última: <span className="text-white font-medium">{lastPayroll.period}</span></span>
                        </div>
                        <span className="text-sm font-bold text-green-400">{lastPayroll.net_salary?.toFixed(0)}€</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}