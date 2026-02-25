/**
 * CEOTimeDashboard - Vista CEO en Tiempo Real
 * Panel de control de fichajes y estado de empleados
 * FASE 2B - Cumplimiento Real Decreto 2026
 */

import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
  Clock,
  Users,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Coffee,
  TrendingUp,
  TrendingDown,
  Download,
  RefreshCw,
  Bell,
  BellRing,
  Volume2,
  VolumeX,
  Filter,
  Search,
  Calendar,
  FileText,
  MapPin,
  Smartphone,
  Home,
  Building2,
  Play,
  Square,
  AlertCircle,
  Eye,
  ChevronDown,
  ChevronUp,
  MoreHorizontal
} from "lucide-react";
import { toast } from "sonner";
import { format, formatDistanceToNow, isToday, differenceInMinutes } from "date-fns";
import { es } from "date-fns/locale";
import { timeTrackingService, CHECK_TYPES, EMPLOYEE_STATUS } from "@/services/timeTrackingService";

// ==================== STATUS CONFIG ====================

const STATUS_CONFIG = {
  [EMPLOYEE_STATUS.WORKING]: {
    label: 'Trabajando',
    icon: CheckCircle2,
    color: 'text-green-400',
    bg: 'bg-green-500/20',
    border: 'border-green-500/30'
  },
  [EMPLOYEE_STATUS.ON_BREAK]: {
    label: 'En pausa',
    icon: Coffee,
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/20',
    border: 'border-yellow-500/30'
  },
  [EMPLOYEE_STATUS.NOT_CHECKED_IN]: {
    label: 'Sin fichar',
    icon: XCircle,
    color: 'text-red-400',
    bg: 'bg-red-500/20',
    border: 'border-red-500/30'
  },
  [EMPLOYEE_STATUS.LATE]: {
    label: 'Tarde',
    icon: AlertTriangle,
    color: 'text-orange-400',
    bg: 'bg-orange-500/20',
    border: 'border-orange-500/30'
  },
  [EMPLOYEE_STATUS.OFF]: {
    label: 'Jornada finalizada',
    icon: CheckCircle2,
    color: 'text-gray-400',
    bg: 'bg-gray-500/20',
    border: 'border-gray-500/30'
  }
};

// ==================== ALERT SOUND ====================

const playAlertSound = () => {
  try {
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdG+Onp6fjHhkW2d4hpKVkIR1aGNpc4GNkZGLf3NqaHF+i5GSjoR4bmtwfIqTlZKGd2xscX+MlZeTiHltbnOAjZaWk4l6b3B1gY6Xl5SKe3FydoKQmJiUi3xzdHeDkZmZlYx9dHV4hJKampaMfnV2eYWTm5uWjX52d3qGlJyclo5/d3h7h5WdnZePgHh5fIiWnp6YkIF5en2Jl5+fmZGCenx/ipigoJqSg3t9gIuZoaCbk4R8foGMmp+gnJSFfX+CjZugoZ2VhX5/g46coqKdloZ/gISPnaOinpeHgIGFkJ6jo5+YiIGChpGfo6SgmYmCg4eTn6SkoJqKg4SIlKCkpKGbi4SFiZWhpaWhnIyFhoqWoqampqCdjYaHi5ejp6emo46HiIyYpKiopp+PiImNmaSoqKagkImKjpmmpqinopGKi4+aq6mqp6KSi4yQm6urqqmjk4yNkZyrrKuqpJSNjpKdrKysq6SVjo+Tnq2trayllo+QlJ+urq2tp5eQkZWgr6+urqiYkZKWobCwrrCpmZKTl6KxsbCwqpqTlJijsrGxsaubl5WWpLOysrKsnJaWl6W0s7OzrZ2XmJmmtbS0tK6emZmZp7a1tbWvn5qbmqi3trW1sKCbnJupu7e3trGhnJ2crLy4uLiyo52enK2+ube5s6KfnpyuwLq6urmjn5+drr+7u7u6pKCgnq/Bu7y7u6WhoJ+wwby9vLympKGgscK9vb28p6Wio7LDv7+9vqimp6O0xMDAv7+pqqik');
    audio.volume = 0.5;
    audio.play();
  } catch (e) {
    console.log('Could not play alert sound');
  }
};

// ==================== EMPLOYEE STATUS CARD ====================

const EmployeeStatusCard = ({ employee, expanded, onToggle }) => {
  const config = STATUS_CONFIG[employee.status] || STATUS_CONFIG[EMPLOYEE_STATUS.NOT_CHECKED_IN];
  const Icon = config.icon;

  const isLate = employee.status === EMPLOYEE_STATUS.NOT_CHECKED_IN && 
    new Date().getHours() >= 9 && new Date().getMinutes() >= 15;

  return (
    <Card 
      className={`${config.bg} ${config.border} border transition-all hover:scale-[1.02] cursor-pointer ${
        isLate ? 'animate-pulse' : ''
      }`}
      onClick={onToggle}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="w-12 h-12">
              <AvatarFallback className="bg-zinc-800 text-white text-lg">
                {employee.userName?.charAt(0) || '?'}
              </AvatarFallback>
            </Avatar>
            <div>
              <h4 className="font-semibold text-white">{employee.userName}</h4>
              <div className="flex items-center gap-2 mt-1">
                <Icon className={`w-4 h-4 ${config.color}`} />
                <span className={`text-sm ${config.color}`}>
                  {isLate ? '⚠️ Sin fichar (TARDE)' : config.label}
                </span>
              </div>
            </div>
          </div>
          
          <div className="text-right">
            {employee.entryTime && (
              <div className="flex items-center gap-1 text-sm text-gray-400">
                <Play className="w-3 h-3 text-green-400" />
                <span>{employee.entryTime}</span>
              </div>
            )}
            {employee.workedHours > 0 && (
              <p className="text-lg font-bold text-cyan-400">
                {employee.workedHours}h
              </p>
            )}
          </div>
        </div>

        {expanded && (
          <div className="mt-4 pt-4 border-t border-zinc-700/50">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-gray-500">Entrada</p>
                <p className="text-sm font-medium text-white">
                  {employee.entryTime || '--:--'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Pausas</p>
                <p className="text-sm font-medium text-white">
                  {employee.breakMinutes}m
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Fichajes</p>
                <p className="text-sm font-medium text-white">
                  {employee.recordsCount}
                </p>
              </div>
            </div>
            
            {employee.lastRecord?.is_remote && (
              <div className="mt-3 flex items-center gap-2 text-sm text-yellow-400">
                <Home className="w-4 h-4" />
                Trabajando en remoto
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// ==================== STATS CARD ====================

const StatCard = ({ title, value, subtitle, icon: Icon, color, trend }) => (
  <Card className="bg-zinc-800/50 border-zinc-700">
    <CardContent className="p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-400">{title}</p>
          <p className={`text-3xl font-bold ${color || 'text-white'}`}>{value}</p>
          {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
        </div>
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
          color?.includes('green') ? 'bg-green-500/20' :
          color?.includes('red') ? 'bg-red-500/20' :
          color?.includes('yellow') ? 'bg-yellow-500/20' :
          'bg-cyan-500/20'
        }`}>
          <Icon className={`w-6 h-6 ${color || 'text-cyan-400'}`} />
        </div>
      </div>
      {trend !== undefined && (
        <div className={`flex items-center gap-1 mt-2 text-sm ${trend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {trend >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          <span>{Math.abs(trend)}% vs ayer</span>
        </div>
      )}
    </CardContent>
  </Card>
);

// ==================== MAIN COMPONENT ====================

export default function CEOTimeDashboard() {
  const queryClient = useQueryClient();
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [expandedEmployee, setExpandedEmployee] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportOptions, setExportOptions] = useState({
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    format: 'json'
  });

  const previousNotCheckedRef = useRef(0);

  // Obtener estado de todos los empleados
  const { data: employeesStatus = [], isLoading, refetch } = useQuery({
    queryKey: ['ceo-employees-status'],
    queryFn: () => timeTrackingService.getAllEmployeesStatus(),
    refetchInterval: 15000 // Cada 15 segundos
  });

  // Alertas para empleados sin fichar después de las 9:15
  useEffect(() => {
    if (!soundEnabled) return;
    
    const now = new Date();
    if (now.getHours() >= 9 && now.getMinutes() >= 15) {
      const notChecked = employeesStatus.filter(e => e.status === EMPLOYEE_STATUS.NOT_CHECKED_IN).length;
      
      if (notChecked > previousNotCheckedRef.current && notChecked > 0) {
        playAlertSound();
        toast.warning(`⚠️ ${notChecked} empleado(s) sin fichar`, {
          description: 'Han pasado 15 minutos desde la hora de entrada'
        });
      }
      
      previousNotCheckedRef.current = notChecked;
    }
  }, [employeesStatus, soundEnabled]);

  // Estadísticas
  const stats = {
    working: employeesStatus.filter(e => e.status === EMPLOYEE_STATUS.WORKING).length,
    onBreak: employeesStatus.filter(e => e.status === EMPLOYEE_STATUS.ON_BREAK).length,
    notChecked: employeesStatus.filter(e => e.status === EMPLOYEE_STATUS.NOT_CHECKED_IN).length,
    finished: employeesStatus.filter(e => e.status === EMPLOYEE_STATUS.OFF).length,
    total: employeesStatus.length,
    totalHours: employeesStatus.reduce((sum, e) => sum + (e.workedHours || 0), 0)
  };

  // Filtrar empleados
  const filteredEmployees = employeesStatus.filter(emp => {
    const matchesSearch = !searchTerm || 
      emp.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || emp.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  // Exportar reporte
  const handleExport = async () => {
    try {
      const report = await timeTrackingService.exportLegalReport({
        startDate: exportOptions.startDate,
        endDate: exportOptions.endDate
      });

      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `registro_jornada_${exportOptions.startDate}_${exportOptions.endDate}.json`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success('Reporte exportado correctamente');
      setShowExportDialog(false);
    } catch (error) {
      toast.error('Error al exportar: ' + error.message);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <Clock className="w-7 h-7 text-cyan-400" />
              Control Horario en Tiempo Real
            </h1>
            <p className="text-gray-400 mt-1">
              Última actualización: {format(new Date(), "HH:mm:ss", { locale: es })}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`border-zinc-600 ${soundEnabled ? 'text-cyan-400' : 'text-gray-500'}`}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="border-zinc-600 text-gray-400"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
            <Button
              size="sm"
              onClick={() => setShowExportDialog(true)}
              className="bg-cyan-600 hover:bg-cyan-500"
            >
              <Download className="w-4 h-4 mr-2" />
              Exportar
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard
            title="Trabajando"
            value={stats.working}
            icon={CheckCircle2}
            color="text-green-400"
          />
          <StatCard
            title="En pausa"
            value={stats.onBreak}
            icon={Coffee}
            color="text-yellow-400"
          />
          <StatCard
            title="Sin fichar"
            value={stats.notChecked}
            icon={XCircle}
            color={stats.notChecked > 0 ? "text-red-400" : "text-gray-400"}
          />
          <StatCard
            title="Finalizados"
            value={stats.finished}
            icon={CheckCircle2}
            color="text-gray-400"
          />
          <StatCard
            title="Horas hoy"
            value={`${Math.round(stats.totalHours)}h`}
            icon={TrendingUp}
            color="text-cyan-400"
          />
        </div>

        {/* Alerta de empleados sin fichar */}
        {stats.notChecked > 0 && new Date().getHours() >= 9 && (
          <Card className="bg-red-900/30 border-red-500/50 animate-pulse">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <BellRing className="w-6 h-6 text-red-400" />
                <div>
                  <h4 className="font-semibold text-red-300">
                    ⚠️ {stats.notChecked} empleado(s) sin fichar
                  </h4>
                  <p className="text-sm text-red-400/80">
                    Son las {format(new Date(), 'HH:mm')} y hay empleados que no han fichado entrada
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar empleado..."
              className="pl-10 bg-zinc-800 border-zinc-700 text-white"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-48 bg-zinc-800 border-zinc-700">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Filtrar por estado" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-800 border-zinc-700">
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value={EMPLOYEE_STATUS.WORKING}>✅ Trabajando</SelectItem>
              <SelectItem value={EMPLOYEE_STATUS.ON_BREAK}>☕ En pausa</SelectItem>
              <SelectItem value={EMPLOYEE_STATUS.NOT_CHECKED_IN}>❌ Sin fichar</SelectItem>
              <SelectItem value={EMPLOYEE_STATUS.OFF}>🏁 Finalizados</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Grid de empleados */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEmployees.map((employee) => (
            <EmployeeStatusCard
              key={employee.userId}
              employee={employee}
              expanded={expandedEmployee === employee.userId}
              onToggle={() => setExpandedEmployee(
                expandedEmployee === employee.userId ? null : employee.userId
              )}
            />
          ))}
        </div>

        {filteredEmployees.length === 0 && (
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No se encontraron empleados</p>
          </div>
        )}

        {/* Tabla detallada */}
        <Card className="bg-zinc-800/50 border-zinc-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-cyan-400" />
              Registro detallado del día
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-700">
                    <TableHead className="text-gray-400">Empleado</TableHead>
                    <TableHead className="text-gray-400">Estado</TableHead>
                    <TableHead className="text-gray-400">Entrada</TableHead>
                    <TableHead className="text-gray-400">Pausas</TableHead>
                    <TableHead className="text-gray-400">Horas</TableHead>
                    <TableHead className="text-gray-400">Ubicación</TableHead>
                    <TableHead className="text-gray-400"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employeesStatus.map((emp) => {
                    const config = STATUS_CONFIG[emp.status];
                    const Icon = config?.icon || XCircle;
                    return (
                      <TableRow key={emp.userId} className="border-zinc-700/50">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="w-8 h-8">
                              <AvatarFallback className="bg-zinc-700 text-white text-sm">
                                {emp.userName?.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-white">{emp.userName}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={`${config?.bg} ${config?.color} ${config?.border}`}>
                            <Icon className="w-3 h-3 mr-1" />
                            {config?.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-gray-300">
                          {emp.entryTime || '--:--'}
                        </TableCell>
                        <TableCell className="text-gray-300">
                          {emp.breakMinutes}m
                        </TableCell>
                        <TableCell className="text-cyan-400 font-semibold">
                          {emp.workedHours}h
                        </TableCell>
                        <TableCell>
                          {emp.lastRecord?.is_remote ? (
                            <Badge variant="outline" className="border-yellow-500/50 text-yellow-400">
                              <Home className="w-3 h-3 mr-1" />
                              Remoto
                            </Badge>
                          ) : emp.lastRecord?.location_name ? (
                            <Badge variant="outline" className="border-green-500/50 text-green-400">
                              <Building2 className="w-3 h-3 mr-1" />
                              {emp.lastRecord.location_name}
                            </Badge>
                          ) : (
                            <span className="text-gray-500">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" className="text-gray-400">
                            <Eye className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Export Dialog */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent className="bg-zinc-900 border-zinc-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Download className="w-5 h-5 text-cyan-400" />
              Exportar Registro de Jornada
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Exportar registro según Real Decreto 8/2019 (actualizado 2026)
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-gray-300">Fecha inicio</Label>
                <Input
                  type="date"
                  value={exportOptions.startDate}
                  onChange={(e) => setExportOptions(p => ({ ...p, startDate: e.target.value }))}
                  className="bg-zinc-800 border-zinc-600 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">Fecha fin</Label>
                <Input
                  type="date"
                  value={exportOptions.endDate}
                  onChange={(e) => setExportOptions(p => ({ ...p, endDate: e.target.value }))}
                  className="bg-zinc-800 border-zinc-600 text-white"
                />
              </div>
            </div>

            <div className="p-4 bg-cyan-900/20 border border-cyan-500/30 rounded-lg">
              <h4 className="font-medium text-cyan-300 mb-2">📋 Cumplimiento Legal</h4>
              <ul className="text-sm text-gray-400 space-y-1">
                <li>✓ Hora exacta de entrada y salida</li>
                <li>✓ Duración de jornada y pausas</li>
                <li>✓ Horas extraordinarias</li>
                <li>✓ Trazabilidad y firma digital</li>
                <li>✓ Formato válido para Inspección de Trabajo</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExportDialog(false)} className="border-zinc-600">
              Cancelar
            </Button>
            <Button onClick={handleExport} className="bg-cyan-600 hover:bg-cyan-500">
              <Download className="w-4 h-4 mr-2" />
              Descargar Reporte
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
