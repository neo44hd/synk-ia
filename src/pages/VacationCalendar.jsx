/**
 * VacationCalendar - Calendario de Vacaciones Interactivo
 * Sistema de solicitud y aprobación de vacaciones
 * FASE 2B - Control de Vacaciones
 */

import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
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
  Calendar,
  CalendarDays,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  Sun,
  Plane,
  Stethoscope,
  GraduationCap,
  User,
  Users,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  MessageSquare,
  Send,
  FileText,
  Download
} from "lucide-react";
import { toast } from "sonner";
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths,
  isWeekend,
  parseISO,
  differenceInBusinessDays,
  addDays
} from "date-fns";
import { es } from "date-fns/locale";

// ==================== TIPOS DE AUSENCIA ====================

const ABSENCE_TYPES = {
  vacaciones: { 
    label: 'Vacaciones', 
    icon: Plane, 
    color: 'bg-cyan-500', 
    textColor: 'text-cyan-400',
    bgLight: 'bg-cyan-500/20'
  },
  baja_medica: { 
    label: 'Baja médica', 
    icon: Stethoscope, 
    color: 'bg-red-500', 
    textColor: 'text-red-400',
    bgLight: 'bg-red-500/20'
  },
  permiso_personal: { 
    label: 'Permiso personal', 
    icon: User, 
    color: 'bg-purple-500', 
    textColor: 'text-purple-400',
    bgLight: 'bg-purple-500/20'
  },
  formacion: { 
    label: 'Formación', 
    icon: GraduationCap, 
    color: 'bg-yellow-500', 
    textColor: 'text-yellow-400',
    bgLight: 'bg-yellow-500/20'
  },
  otros: { 
    label: 'Otros', 
    icon: Calendar, 
    color: 'bg-gray-500', 
    textColor: 'text-gray-400',
    bgLight: 'bg-gray-500/20'
  }
};

// ==================== FESTIVOS (ejemplo para España) ====================

const HOLIDAYS_2026 = [
  '2026-01-01', // Año Nuevo
  '2026-01-06', // Reyes
  '2026-04-02', // Jueves Santo
  '2026-04-03', // Viernes Santo
  '2026-05-01', // Día del Trabajo
  '2026-08-15', // Asunción
  '2026-10-12', // Fiesta Nacional
  '2026-11-01', // Todos los Santos
  '2026-12-06', // Constitución
  '2026-12-08', // Inmaculada
  '2026-12-25', // Navidad
];

// ==================== CALENDAR COMPONENT ====================

const CalendarGrid = ({ 
  currentMonth, 
  selectedDates, 
  onSelectDate, 
  vacations, 
  employees,
  isSelecting 
}) => {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Obtener el día de la semana del primer día (0 = domingo, 1 = lunes, etc.)
  const startDayOfWeek = monthStart.getDay();
  // Ajustar para que la semana empiece en lunes
  const paddingDays = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

  const isHoliday = (date) => {
    return HOLIDAYS_2026.includes(format(date, 'yyyy-MM-dd'));
  };

  const getVacationsForDay = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return vacations.filter(v => {
      const start = parseISO(v.start_date);
      const end = parseISO(v.end_date);
      return date >= start && date <= end && v.status === 'aprobada';
    });
  };

  const isSelected = (date) => {
    return selectedDates.some(d => isSameDay(d, date));
  };

  const dayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  return (
    <div className="space-y-2">
      {/* Header de días */}
      <div className="grid grid-cols-7 gap-1">
        {dayNames.map((day) => (
          <div key={day} className="text-center text-xs text-gray-500 font-medium py-2">
            {day}
          </div>
        ))}
      </div>

      {/* Grid de días */}
      <div className="grid grid-cols-7 gap-1">
        {/* Padding days */}
        {Array.from({ length: paddingDays }).map((_, i) => (
          <div key={`pad-${i}`} className="h-24" />
        ))}

        {/* Days */}
        {days.map((day) => {
          const dayVacations = getVacationsForDay(day);
          const holiday = isHoliday(day);
          const weekend = isWeekend(day);
          const selected = isSelected(day);
          const today = isSameDay(day, new Date());

          return (
            <button
              key={day.toISOString()}
              onClick={() => isSelecting && onSelectDate(day)}
              disabled={!isSelecting || weekend || holiday}
              className={`
                h-24 p-1 rounded-lg border transition-all text-left relative overflow-hidden
                ${today ? 'border-cyan-500' : 'border-zinc-700/50'}
                ${selected ? 'bg-cyan-500/30 border-cyan-500' : ''}
                ${weekend ? 'bg-zinc-800/30 cursor-not-allowed' : ''}
                ${holiday ? 'bg-red-900/20 cursor-not-allowed' : ''}
                ${isSelecting && !weekend && !holiday ? 'hover:bg-zinc-700/50 cursor-pointer' : ''}
              `}
            >
              <span className={`
                text-sm font-medium
                ${today ? 'text-cyan-400' : ''}
                ${weekend ? 'text-gray-600' : ''}
                ${holiday ? 'text-red-400' : ''}
                ${!weekend && !holiday && !today ? 'text-gray-300' : ''}
              `}>
                {format(day, 'd')}
              </span>

              {holiday && (
                <Badge className="absolute top-1 right-1 text-[8px] bg-red-500/30 text-red-300 px-1">
                  Festivo
                </Badge>
              )}

              {/* Vacaciones del día */}
              <div className="mt-1 space-y-0.5">
                {dayVacations.slice(0, 2).map((v, i) => {
                  const type = ABSENCE_TYPES[v.request_type] || ABSENCE_TYPES.otros;
                  return (
                    <div 
                      key={i}
                      className={`text-[10px] px-1 py-0.5 rounded truncate ${type.bgLight} ${type.textColor}`}
                      title={`${v.employee_name} - ${type.label}`}
                    >
                      {v.employee_name?.split(' ')[0]}
                    </div>
                  );
                })}
                {dayVacations.length > 2 && (
                  <div className="text-[10px] text-gray-500">
                    +{dayVacations.length - 2} más
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ==================== REQUEST CARD ====================

const RequestCard = ({ request, isAdmin, onApprove, onReject }) => {
  const type = ABSENCE_TYPES[request.request_type] || ABSENCE_TYPES.otros;
  const Icon = type.icon;

  const getStatusBadge = () => {
    switch (request.status) {
      case 'aprobada':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Aprobada</Badge>;
      case 'rechazada':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Rechazada</Badge>;
      default:
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Pendiente</Badge>;
    }
  };

  return (
    <Card className="bg-zinc-800/50 border-zinc-700">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${type.bgLight}`}>
            <Icon className={`w-6 h-6 ${type.textColor}`} />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="font-semibold text-white">{request.employee_name}</h4>
                <p className="text-sm text-gray-400">{type.label}</p>
              </div>
              {getStatusBadge()}
            </div>

            <div className="mt-2 flex items-center gap-4 text-sm text-gray-400">
              <span className="flex items-center gap-1">
                <CalendarDays className="w-4 h-4" />
                {format(parseISO(request.start_date), 'd MMM', { locale: es })} - {format(parseISO(request.end_date), 'd MMM yyyy', { locale: es })}
              </span>
              <span className="flex items-center gap-1">
                <Sun className="w-4 h-4" />
                {request.total_days} días
              </span>
            </div>

            {request.reason && (
              <p className="mt-2 text-sm text-gray-500 bg-zinc-900/50 p-2 rounded">
                "{request.reason}"
              </p>
            )}

            {isAdmin && request.status === 'pendiente' && (
              <div className="mt-3 flex gap-2">
                <Button 
                  size="sm" 
                  className="bg-green-600 hover:bg-green-500"
                  onClick={() => onApprove(request.id)}
                >
                  <CheckCircle2 className="w-4 h-4 mr-1" />
                  Aprobar
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                  onClick={() => onReject(request.id)}
                >
                  <XCircle className="w-4 h-4 mr-1" />
                  Rechazar
                </Button>
              </div>
            )}

            {request.status !== 'pendiente' && request.approved_by && (
              <p className="mt-2 text-xs text-gray-500">
                {request.status === 'aprobada' ? 'Aprobada' : 'Rechazada'} el {format(parseISO(request.approval_date), 'd MMM yyyy', { locale: es })}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// ==================== MAIN COMPONENT ====================

export default function VacationCalendar() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDates, setSelectedDates] = useState([]);
  const [isSelecting, setIsSelecting] = useState(false);
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [activeTab, setActiveTab] = useState('calendar');
  const [newRequest, setNewRequest] = useState({
    request_type: 'vacaciones',
    reason: ''
  });

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const isAdmin = user?.role === 'admin' || user?.permission_level === 'super_admin';

  // Cargar vacaciones
  const { data: vacations = [] } = useQuery({
    queryKey: ['vacations'],
    queryFn: async () => {
      try {
        return await base44.entities.VacationRequest?.list?.('-created_date', 200) || [];
      } catch {
        return [];
      }
    }
  });

  // Mis vacaciones
  const myVacations = vacations.filter(v => v.employee_id === user?.id);
  const pendingRequests = vacations.filter(v => v.status === 'pendiente');
  const myApprovedDays = myVacations
    .filter(v => v.status === 'aprobada' && v.request_type === 'vacaciones')
    .reduce((sum, v) => sum + (v.total_days || 0), 0);

  // Crear solicitud
  const createMutation = useMutation({
    mutationFn: async (data) => {
      if (selectedDates.length === 0) {
        throw new Error('Selecciona al menos un día');
      }

      const sortedDates = [...selectedDates].sort((a, b) => a - b);
      const startDate = format(sortedDates[0], 'yyyy-MM-dd');
      const endDate = format(sortedDates[sortedDates.length - 1], 'yyyy-MM-dd');
      
      // Calcular días laborables
      const totalDays = sortedDates.filter(d => !isWeekend(d) && !HOLIDAYS_2026.includes(format(d, 'yyyy-MM-dd'))).length;

      return base44.entities.VacationRequest?.create?.({
        employee_id: user.id,
        employee_name: user.full_name,
        request_type: data.request_type,
        start_date: startDate,
        end_date: endDate,
        total_days: totalDays,
        reason: data.reason,
        status: 'pendiente',
        created_date: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vacations'] });
      toast.success('Solicitud enviada correctamente');
      setShowRequestDialog(false);
      setSelectedDates([]);
      setIsSelecting(false);
      setNewRequest({ request_type: 'vacaciones', reason: '' });
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });

  // Aprobar/Rechazar
  const updateMutation = useMutation({
    mutationFn: async ({ id, status }) => {
      return base44.entities.VacationRequest?.update?.(id, {
        status,
        approved_by: user.id,
        approval_date: new Date().toISOString().split('T')[0]
      });
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ['vacations'] });
      toast.success(status === 'aprobada' ? 'Solicitud aprobada' : 'Solicitud rechazada');
    }
  });

  const handleSelectDate = (date) => {
    setSelectedDates(prev => {
      const exists = prev.some(d => isSameDay(d, date));
      if (exists) {
        return prev.filter(d => !isSameDay(d, date));
      }
      return [...prev, date];
    });
  };

  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <Calendar className="w-7 h-7 text-cyan-400" />
              Calendario de Vacaciones
            </h1>
            <p className="text-gray-400 mt-1">
              Gestiona tus vacaciones y ausencias
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {isSelecting ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsSelecting(false);
                    setSelectedDates([]);
                  }}
                  className="border-zinc-600"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={() => setShowRequestDialog(true)}
                  disabled={selectedDates.length === 0}
                  className="bg-cyan-600 hover:bg-cyan-500"
                >
                  Solicitar ({selectedDates.length} días)
                </Button>
              </>
            ) : (
              <Button
                onClick={() => setIsSelecting(true)}
                className="bg-cyan-600 hover:bg-cyan-500"
              >
                <Plus className="w-4 h-4 mr-2" />
                Nueva solicitud
              </Button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-zinc-800/50 border-zinc-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-cyan-500/20 rounded-lg flex items-center justify-center">
                  <Sun className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-400">Días disponibles</p>
                  <p className="text-2xl font-bold text-white">{22 - myApprovedDays}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-zinc-800/50 border-zinc-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-400">Días usados</p>
                  <p className="text-2xl font-bold text-white">{myApprovedDays}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {isAdmin && (
            <Card className="bg-zinc-800/50 border-zinc-700">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                    <Clock className="w-5 h-5 text-yellow-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Pendientes</p>
                    <p className="text-2xl font-bold text-white">{pendingRequests.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="bg-zinc-800/50 border-zinc-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center">
                  <CalendarDays className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-400">Festivos 2026</p>
                  <p className="text-2xl font-bold text-white">{HOLIDAYS_2026.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-zinc-800/50 border border-zinc-700">
            <TabsTrigger value="calendar" className="data-[state=active]:bg-cyan-600">
              <Calendar className="w-4 h-4 mr-2" />
              Calendario
            </TabsTrigger>
            <TabsTrigger value="requests" className="data-[state=active]:bg-cyan-600">
              <FileText className="w-4 h-4 mr-2" />
              Solicitudes
              {pendingRequests.length > 0 && (
                <Badge className="ml-2 bg-yellow-500/20 text-yellow-300">
                  {pendingRequests.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="team" className="data-[state=active]:bg-cyan-600">
              <Users className="w-4 h-4 mr-2" />
              Equipo
            </TabsTrigger>
          </TabsList>

          <TabsContent value="calendar" className="mt-4">
            <Card className="bg-zinc-800/50 border-zinc-700">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white">
                    {format(currentMonth, 'MMMM yyyy', { locale: es })}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={prevMonth} className="border-zinc-600">
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={nextMonth} className="border-zinc-600">
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                {isSelecting && (
                  <CardDescription className="text-cyan-400">
                    Haz clic en los días que quieres solicitar
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <CalendarGrid
                  currentMonth={currentMonth}
                  selectedDates={selectedDates}
                  onSelectDate={handleSelectDate}
                  vacations={vacations}
                  isSelecting={isSelecting}
                />

                {/* Leyenda */}
                <div className="mt-4 flex flex-wrap gap-4 text-sm">
                  {Object.entries(ABSENCE_TYPES).map(([key, type]) => (
                    <div key={key} className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded ${type.color}`} />
                      <span className="text-gray-400">{type.label}</span>
                    </div>
                  ))}
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-red-900" />
                    <span className="text-gray-400">Festivo</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="requests" className="mt-4">
            <div className="space-y-4">
              {isAdmin && pendingRequests.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-yellow-400" />
                    Pendientes de aprobación
                  </h3>
                  <div className="space-y-3">
                    {pendingRequests.map((req) => (
                      <RequestCard
                        key={req.id}
                        request={req}
                        isAdmin={isAdmin}
                        onApprove={(id) => updateMutation.mutate({ id, status: 'aprobada' })}
                        onReject={(id) => updateMutation.mutate({ id, status: 'rechazada' })}
                      />
                    ))}
                  </div>
                  <Separator className="my-6 bg-zinc-700" />
                </div>
              )}

              <div>
                <h3 className="text-lg font-semibold text-white mb-3">
                  {isAdmin ? 'Todas las solicitudes' : 'Mis solicitudes'}
                </h3>
                <ScrollArea className="h-[500px]">
                  <div className="space-y-3 pr-4">
                    {(isAdmin ? vacations : myVacations).filter(v => v.status !== 'pendiente' || !isAdmin).map((req) => (
                      <RequestCard
                        key={req.id}
                        request={req}
                        isAdmin={false}
                      />
                    ))}
                    {(isAdmin ? vacations : myVacations).length === 0 && (
                      <div className="text-center py-12 text-gray-500">
                        <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>No hay solicitudes</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="team" className="mt-4">
            <Card className="bg-zinc-800/50 border-zinc-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-cyan-400" />
                  Disponibilidad del equipo
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Vista de vacaciones aprobadas del equipo
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {vacations
                    .filter(v => v.status === 'aprobada')
                    .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))
                    .slice(0, 10)
                    .map((v) => {
                      const type = ABSENCE_TYPES[v.request_type] || ABSENCE_TYPES.otros;
                      const Icon = type.icon;
                      const isUpcoming = new Date(v.start_date) > new Date();
                      
                      return (
                        <div 
                          key={v.id}
                          className={`flex items-center gap-4 p-3 rounded-lg ${
                            isUpcoming ? 'bg-zinc-700/30' : 'bg-zinc-800/30 opacity-60'
                          }`}
                        >
                          <Avatar className="w-10 h-10">
                            <AvatarFallback className="bg-zinc-700 text-white">
                              {v.employee_name?.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <p className="font-medium text-white">{v.employee_name}</p>
                            <p className="text-sm text-gray-400">
                              {format(parseISO(v.start_date), 'd MMM', { locale: es })} - {format(parseISO(v.end_date), 'd MMM', { locale: es })}
                            </p>
                          </div>
                          <Badge className={`${type.bgLight} ${type.textColor}`}>
                            <Icon className="w-3 h-3 mr-1" />
                            {type.label}
                          </Badge>
                        </div>
                      );
                    })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Request Dialog */}
      <Dialog open={showRequestDialog} onOpenChange={setShowRequestDialog}>
        <DialogContent className="bg-zinc-900 border-zinc-700">
          <DialogHeader>
            <DialogTitle className="text-white">Nueva solicitud de ausencia</DialogTitle>
            <DialogDescription className="text-gray-400">
              Completa los detalles de tu solicitud
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="p-4 bg-cyan-900/20 border border-cyan-500/30 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-gray-300">Días seleccionados</span>
                <Badge className="bg-cyan-500/30 text-cyan-300">{selectedDates.length} días</Badge>
              </div>
              {selectedDates.length > 0 && (
                <p className="text-sm text-gray-400 mt-2">
                  {format(selectedDates.sort((a, b) => a - b)[0], 'd MMM', { locale: es })} - {format(selectedDates.sort((a, b) => a - b)[selectedDates.length - 1], 'd MMM yyyy', { locale: es })}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-gray-300">Tipo de ausencia</Label>
              <Select 
                value={newRequest.request_type} 
                onValueChange={(v) => setNewRequest(p => ({ ...p, request_type: v }))}
              >
                <SelectTrigger className="bg-zinc-800 border-zinc-600">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  {Object.entries(ABSENCE_TYPES).map(([key, type]) => {
                    const Icon = type.icon;
                    return (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center gap-2">
                          <Icon className={`w-4 h-4 ${type.textColor}`} />
                          {type.label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-gray-300">Comentario (opcional)</Label>
              <Textarea
                value={newRequest.reason}
                onChange={(e) => setNewRequest(p => ({ ...p, reason: e.target.value }))}
                className="bg-zinc-800 border-zinc-600 text-white"
                placeholder="Añade un comentario si lo deseas..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowRequestDialog(false)} 
              className="border-zinc-600"
            >
              Cancelar
            </Button>
            <Button 
              onClick={() => createMutation.mutate(newRequest)}
              disabled={createMutation.isPending}
              className="bg-cyan-600 hover:bg-cyan-500"
            >
              <Send className="w-4 h-4 mr-2" />
              Enviar solicitud
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
