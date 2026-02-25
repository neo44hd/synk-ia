/**
 * EmployeePortal - Portal de Empleado Tipo Red Social
 * FASE 2B - Control Horario y Portal Completo
 * Cumplimiento Real Decreto 2026
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
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
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Clock,
  MapPin,
  Camera,
  Play,
  Pause,
  Square,
  Coffee,
  User,
  Bell,
  Calendar,
  MessageSquare,
  Heart,
  ThumbsUp,
  PartyPopper,
  Gift,
  Award,
  Sun,
  Moon,
  Briefcase,
  FileText,
  Download,
  Upload,
  CheckCircle2,
  XCircle,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Plus,
  Send,
  Image,
  MoreHorizontal,
  Megaphone,
  Home,
  Activity,
  TrendingUp,
  Users,
  Settings,
  LogOut,
  Eye,
  EyeOff,
  Share2,
  Bookmark,
  Filter,
  Search,
  X,
  MapPinned,
  Smartphone,
  Wifi,
  WifiOff,
  Building2,
  Plane,
  Stethoscope,
  GraduationCap,
  Info
} from "lucide-react";
import { toast } from "sonner";
import { format, formatDistanceToNow, isToday, isYesterday, startOfWeek, endOfWeek, addDays, differenceInMinutes, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { timeTrackingService, CHECK_TYPES, EMPLOYEE_STATUS } from "@/services/timeTrackingService";

// ==================== COMPONENTES DE FICHAJE ====================

const EnhancedCheckIn = ({ user, onCheckIn, currentStatus }) => {
  const [loading, setLoading] = useState(false);
  const [showRemoteDialog, setShowRemoteDialog] = useState(false);
  const [remoteJustification, setRemoteJustification] = useState('');
  const [location, setLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const [photo, setPhoto] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Obtener ubicación al montar
  useEffect(() => {
    getLocation();
  }, []);

  const getLocation = async () => {
    try {
      setLocationError(null);
      const pos = await timeTrackingService.getCurrentLocation();
      const validation = timeTrackingService.validateLocation(pos);
      setLocation({ ...pos, ...validation });
    } catch (error) {
      setLocationError(error.message);
    }
  };

  const startCamera = async () => {
    setShowCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user' } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      toast.error('No se pudo acceder a la cámara');
      setShowCamera(false);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
      const photoData = canvas.toDataURL('image/jpeg', 0.8);
      setPhoto(photoData);
      
      // Detener cámara
      const stream = video.srcObject;
      stream?.getTracks().forEach(track => track.stop());
      setShowCamera(false);
    }
  };

  const handleCheckIn = async (checkType, forceRemote = false) => {
    setLoading(true);
    try {
      const result = await timeTrackingService.registerCheckIn({
        userId: user.id,
        userName: user.full_name,
        checkType,
        photo,
        remoteJustification: forceRemote ? remoteJustification : null,
        forceRemote
      });

      if (result.requiresJustification) {
        setShowRemoteDialog(true);
        toast.warning(result.message);
      } else if (result.success) {
        toast.success(result.message);
        onCheckIn?.(result.record);
        setPhoto(null);
        setRemoteJustification('');
      } else {
        toast.error(result.error || 'Error al fichar');
      }
    } catch (error) {
      toast.error('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoteCheckIn = async () => {
    if (!remoteJustification.trim()) {
      toast.error('Debes indicar el motivo del fichaje remoto');
      return;
    }
    setShowRemoteDialog(false);
    await handleCheckIn(CHECK_TYPES.ENTRADA, true);
  };

  const getStatusColor = () => {
    switch (currentStatus?.status) {
      case EMPLOYEE_STATUS.WORKING: return 'bg-green-500';
      case EMPLOYEE_STATUS.ON_BREAK: return 'bg-yellow-500';
      case EMPLOYEE_STATUS.NOT_CHECKED_IN: return 'bg-red-500';
      case EMPLOYEE_STATUS.OFF: return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = () => {
    switch (currentStatus?.status) {
      case EMPLOYEE_STATUS.WORKING: return 'Trabajando';
      case EMPLOYEE_STATUS.ON_BREAK: return 'En pausa';
      case EMPLOYEE_STATUS.NOT_CHECKED_IN: return 'Sin fichar';
      case EMPLOYEE_STATUS.OFF: return 'Jornada finalizada';
      default: return 'Desconocido';
    }
  };

  return (
    <>
      <Card className="bg-gradient-to-br from-zinc-900 to-zinc-800 border-zinc-700 overflow-hidden">
        <CardContent className="p-0">
          {/* Header con estado */}
          <div className={`${getStatusColor()} p-4 flex items-center justify-between`}>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur">
                <Clock className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">{getStatusText()}</h3>
                <p className="text-sm text-white/80">
                  {format(new Date(), "EEEE d MMMM, HH:mm", { locale: es })}
                </p>
              </div>
            </div>
            <Badge variant="outline" className="bg-white/20 text-white border-white/30">
              {currentStatus?.lastRecord?.time || '--:--'}
            </Badge>
          </div>

          {/* Ubicación */}
          <div className="p-4 border-b border-zinc-700/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className={`w-4 h-4 ${location?.valid ? 'text-green-500' : 'text-yellow-500'}`} />
                <span className="text-sm text-gray-300">
                  {locationError || location?.message || 'Obteniendo ubicación...'}
                </span>
              </div>
              <Button variant="ghost" size="sm" onClick={getLocation} className="text-gray-400">
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
            {location && !location.valid && (
              <p className="text-xs text-yellow-500 mt-1 ml-6">
                Puedes fichar en modo remoto con justificación
              </p>
            )}
          </div>

          {/* Foto de verificación */}
          <div className="p-4 border-b border-zinc-700/50">
            {showCamera ? (
              <div className="relative">
                <video ref={videoRef} autoPlay playsInline className="w-full rounded-lg" />
                <canvas ref={canvasRef} className="hidden" />
                <Button 
                  onClick={capturePhoto} 
                  className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white text-black"
                >
                  <Camera className="w-4 h-4 mr-2" />
                  Capturar
                </Button>
              </div>
            ) : photo ? (
              <div className="relative">
                <img src={photo} alt="Verificación" className="w-full rounded-lg" />
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setPhoto(null)}
                  className="absolute top-2 right-2 bg-black/50 text-white"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <Button 
                variant="outline" 
                onClick={startCamera}
                className="w-full border-dashed border-zinc-600 text-gray-400 hover:text-white"
              >
                <Camera className="w-4 h-4 mr-2" />
                Añadir foto de verificación (opcional)
              </Button>
            )}
          </div>

          {/* Botones de fichaje */}
          <div className="p-4 space-y-3">
            {currentStatus?.status === EMPLOYEE_STATUS.NOT_CHECKED_IN && (
              <Button 
                onClick={() => handleCheckIn(CHECK_TYPES.ENTRADA)}
                disabled={loading}
                className="w-full h-14 text-lg bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400"
              >
                {loading ? <RefreshCw className="w-5 h-5 mr-2 animate-spin" /> : <Play className="w-5 h-5 mr-2" />}
                Fichar Entrada
              </Button>
            )}

            {currentStatus?.status === EMPLOYEE_STATUS.WORKING && (
              <div className="grid grid-cols-2 gap-3">
                <Button 
                  onClick={() => handleCheckIn(CHECK_TYPES.PAUSA_INICIO)}
                  disabled={loading}
                  variant="outline"
                  className="h-12 border-yellow-500/50 text-yellow-500 hover:bg-yellow-500/10"
                >
                  <Coffee className="w-4 h-4 mr-2" />
                  Pausa
                </Button>
                <Button 
                  onClick={() => handleCheckIn(CHECK_TYPES.SALIDA)}
                  disabled={loading}
                  className="h-12 bg-red-600 hover:bg-red-500"
                >
                  <Square className="w-4 h-4 mr-2" />
                  Salida
                </Button>
              </div>
            )}

            {currentStatus?.status === EMPLOYEE_STATUS.ON_BREAK && (
              <Button 
                onClick={() => handleCheckIn(CHECK_TYPES.PAUSA_FIN)}
                disabled={loading}
                className="w-full h-14 text-lg bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400"
              >
                {loading ? <RefreshCw className="w-5 h-5 mr-2 animate-spin" /> : <Play className="w-5 h-5 mr-2" />}
                Volver de Pausa
              </Button>
            )}

            {currentStatus?.status === EMPLOYEE_STATUS.OFF && (
              <div className="text-center p-4 bg-zinc-800/50 rounded-lg">
                <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
                <p className="text-gray-400">Jornada completada</p>
                <p className="text-sm text-gray-500">
                  Hasta mañana 👋
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Dialog para fichaje remoto */}
      <Dialog open={showRemoteDialog} onOpenChange={setShowRemoteDialog}>
        <DialogContent className="bg-zinc-900 border-zinc-700">
          <DialogHeader>
            <DialogTitle className="text-white">Fichaje Remoto</DialogTitle>
            <DialogDescription className="text-gray-400">
              Estás fuera del área de trabajo. Indica el motivo del fichaje remoto.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-2 p-3 bg-yellow-500/10 rounded-lg">
              <MapPinned className="w-5 h-5 text-yellow-500" />
              <span className="text-sm text-yellow-200">
                Ubicación: {location?.distance}m de {location?.location?.name}
              </span>
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300">Motivo del fichaje remoto *</Label>
              <Textarea
                value={remoteJustification}
                onChange={(e) => setRemoteJustification(e.target.value)}
                placeholder="Ej: Trabajo desde casa por reunión con cliente..."
                className="bg-zinc-800 border-zinc-600 text-white"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRemoteDialog(false)} className="border-zinc-600">
              Cancelar
            </Button>
            <Button onClick={handleRemoteCheckIn} className="bg-blue-600 hover:bg-blue-500">
              Confirmar Fichaje Remoto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

// ==================== STORIES ====================

const StoriesSection = ({ user, employees, onViewStory }) => {
  const { data: todayActivities = [] } = useQuery({
    queryKey: ['today-activities'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const records = await base44.entities.TimeRecord?.filter?.({ date: today }) || [];
      return records;
    },
    refetchInterval: 60000
  });

  // Story personal del usuario
  const myRecords = todayActivities.filter(r => r.user_id === user?.id);
  const myEntry = myRecords.find(r => r.check_type === CHECK_TYPES.ENTRADA);
  const myBreaks = myRecords.filter(r => r.check_type === CHECK_TYPES.PAUSA_INICIO).length;

  // Calcular horas trabajadas
  const calculateWorkedHours = () => {
    if (!myEntry) return 0;
    const [h, m] = myEntry.time.split(':').map(Number);
    const entryMinutes = h * 60 + m;
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    return Math.round((nowMinutes - entryMinutes) / 60 * 10) / 10;
  };

  // Stories de compañeros (agrupados por usuario)
  const employeeStories = employees?.filter(e => e.status !== EMPLOYEE_STATUS.NOT_CHECKED_IN) || [];

  return (
    <div className="space-y-4">
      {/* Mi Story */}
      <div className="bg-gradient-to-r from-cyan-900/30 to-blue-900/30 rounded-xl p-4 border border-cyan-500/30">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Sun className="w-5 h-5 text-yellow-500" />
            Mi día
          </h3>
          <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/30">
            {format(new Date(), 'HH:mm')}
          </Badge>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 bg-zinc-800/50 rounded-lg">
            <Clock className="w-5 h-5 text-green-400 mx-auto mb-1" />
            <p className="text-xl font-bold text-white">{myEntry?.time || '--:--'}</p>
            <p className="text-xs text-gray-400">Entrada</p>
          </div>
          <div className="text-center p-3 bg-zinc-800/50 rounded-lg">
            <TrendingUp className="w-5 h-5 text-blue-400 mx-auto mb-1" />
            <p className="text-xl font-bold text-white">{calculateWorkedHours()}h</p>
            <p className="text-xs text-gray-400">Trabajadas</p>
          </div>
          <div className="text-center p-3 bg-zinc-800/50 rounded-lg">
            <Coffee className="w-5 h-5 text-yellow-400 mx-auto mb-1" />
            <p className="text-xl font-bold text-white">{myBreaks}</p>
            <p className="text-xs text-gray-400">Pausas</p>
          </div>
        </div>

        {myEntry?.is_remote && (
          <div className="mt-3 flex items-center gap-2 text-sm text-yellow-400">
            <Home className="w-4 h-4" />
            Trabajando en remoto
          </div>
        )}
      </div>

      {/* Stories del equipo */}
      <div>
        <h4 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
          <Users className="w-4 h-4" />
          Actividad del equipo
        </h4>
        <ScrollArea className="w-full">
          <div className="flex gap-3 pb-2">
            {employeeStories.map((emp) => (
              <button
                key={emp.userId}
                onClick={() => onViewStory?.(emp)}
                className="flex-shrink-0 group"
              >
                <div className={`w-16 h-16 rounded-full p-0.5 ${
                  emp.status === EMPLOYEE_STATUS.WORKING 
                    ? 'bg-gradient-to-r from-green-500 to-emerald-500' 
                    : emp.status === EMPLOYEE_STATUS.ON_BREAK
                    ? 'bg-gradient-to-r from-yellow-500 to-orange-500'
                    : 'bg-gradient-to-r from-gray-500 to-gray-600'
                }`}>
                  <div className="w-full h-full rounded-full bg-zinc-900 flex items-center justify-center">
                    <Avatar className="w-14 h-14">
                      <AvatarFallback className="bg-zinc-700 text-white text-lg">
                        {emp.userName?.charAt(0) || '?'}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                </div>
                <p className="text-xs text-gray-400 text-center mt-1 max-w-[64px] truncate">
                  {emp.userName?.split(' ')[0]}
                </p>
              </button>
            ))}
            {employeeStories.length === 0 && (
              <div className="text-sm text-gray-500 py-4">
                No hay actividad del equipo aún
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};

// ==================== FEED ====================

const FeedSection = ({ user }) => {
  const queryClient = useQueryClient();

  const { data: feedItems = [] } = useQuery({
    queryKey: ['portal-feed'],
    queryFn: async () => {
      try {
        // Obtener diferentes tipos de actividad
        const today = new Date();
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        
        const [timeRecords, vacations, announcements] = await Promise.all([
          base44.entities.TimeRecord?.list?.('-timestamp', 50) || [],
          base44.entities.VacationRequest?.filter?.({ status: 'aprobada' }) || [],
          base44.entities.Announcement?.list?.('-created_at', 20) || []
        ]);

        // Construir feed unificado
        const feed = [];

        // Fichajes recientes
        timeRecords.slice(0, 20).forEach(record => {
          feed.push({
            id: `time_${record.id}`,
            type: 'check_in',
            userId: record.user_id,
            userName: record.user_name,
            action: record.check_type,
            timestamp: record.timestamp,
            location: record.location_name,
            isRemote: record.is_remote
          });
        });

        // Vacaciones aprobadas
        vacations.forEach(v => {
          feed.push({
            id: `vacation_${v.id}`,
            type: 'vacation',
            userId: v.employee_id,
            userName: v.employee_name,
            startDate: v.start_date,
            endDate: v.end_date,
            timestamp: v.approval_date || v.created_date,
            requestType: v.request_type
          });
        });

        // Ordenar por fecha
        return feed.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      } catch (error) {
        console.error('Error loading feed:', error);
        return [];
      }
    },
    refetchInterval: 30000
  });

  const reactionMutation = useMutation({
    mutationFn: async ({ itemId, reaction }) => {
      // Guardar reacción
      await base44.entities.FeedReaction?.create?.({
        item_id: itemId,
        user_id: user.id,
        reaction,
        created_at: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-feed'] });
    }
  });

  const getActionIcon = (action) => {
    switch (action) {
      case CHECK_TYPES.ENTRADA: return <Play className="w-4 h-4 text-green-400" />;
      case CHECK_TYPES.SALIDA: return <Square className="w-4 h-4 text-red-400" />;
      case CHECK_TYPES.PAUSA_INICIO: return <Coffee className="w-4 h-4 text-yellow-400" />;
      case CHECK_TYPES.PAUSA_FIN: return <Play className="w-4 h-4 text-blue-400" />;
      default: return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getActionText = (action) => {
    switch (action) {
      case CHECK_TYPES.ENTRADA: return 'ha fichado entrada';
      case CHECK_TYPES.SALIDA: return 'ha fichado salida';
      case CHECK_TYPES.PAUSA_INICIO: return 'ha iniciado una pausa';
      case CHECK_TYPES.PAUSA_FIN: return 'ha vuelto de su pausa';
      default: return 'ha fichado';
    }
  };

  const formatFeedTime = (timestamp) => {
    const date = new Date(timestamp);
    if (isToday(date)) {
      return formatDistanceToNow(date, { addSuffix: true, locale: es });
    }
    if (isYesterday(date)) {
      return `Ayer a las ${format(date, 'HH:mm')}`;
    }
    return format(date, "d MMM 'a las' HH:mm", { locale: es });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Activity className="w-5 h-5 text-purple-400" />
          Actividad reciente
        </h3>
        <Button variant="ghost" size="sm" className="text-gray-400">
          <Filter className="w-4 h-4 mr-1" />
          Filtrar
        </Button>
      </div>

      <ScrollArea className="h-[500px]">
        <div className="space-y-3 pr-4">
          {feedItems.map((item) => (
            <Card key={item.id} className="bg-zinc-800/50 border-zinc-700/50 hover:bg-zinc-800 transition-colors">
              <CardContent className="p-4">
                <div className="flex gap-3">
                  <Avatar className="w-10 h-10">
                    <AvatarFallback className="bg-zinc-700 text-white">
                      {item.userName?.charAt(0) || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-medium text-white">
                          {item.userName}
                        </span>
                        {item.type === 'check_in' && (
                          <span className="text-gray-400 ml-1">
                            {getActionText(item.action)}
                          </span>
                        )}
                        {item.type === 'vacation' && (
                          <span className="text-gray-400 ml-1">
                            tiene vacaciones aprobadas
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-500 flex-shrink-0">
                        {formatFeedTime(item.timestamp)}
                      </span>
                    </div>

                    {item.type === 'check_in' && (
                      <div className="flex items-center gap-2 mt-2">
                        {getActionIcon(item.action)}
                        <span className="text-sm text-gray-400">
                          {item.isRemote ? '🏠 Remoto' : `📍 ${item.location || 'Oficina'}`}
                        </span>
                      </div>
                    )}

                    {item.type === 'vacation' && (
                      <div className="flex items-center gap-2 mt-2">
                        <Plane className="w-4 h-4 text-cyan-400" />
                        <span className="text-sm text-gray-400">
                          {format(new Date(item.startDate), 'd MMM', { locale: es })} - {format(new Date(item.endDate), 'd MMM', { locale: es })}
                        </span>
                      </div>
                    )}

                    {/* Reacciones */}
                    <div className="flex items-center gap-2 mt-3">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 px-2 text-gray-500 hover:text-pink-400"
                        onClick={() => reactionMutation.mutate({ itemId: item.id, reaction: 'heart' })}
                      >
                        <Heart className="w-4 h-4 mr-1" />
                        <span className="text-xs">Me gusta</span>
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 px-2 text-gray-500 hover:text-blue-400"
                        onClick={() => reactionMutation.mutate({ itemId: item.id, reaction: 'thumbsup' })}
                      >
                        <ThumbsUp className="w-4 h-4 mr-1" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 px-2 text-gray-500 hover:text-yellow-400"
                        onClick={() => reactionMutation.mutate({ itemId: item.id, reaction: 'party' })}
                      >
                        <PartyPopper className="w-4 h-4 mr-1" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {feedItems.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No hay actividad reciente</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

// ==================== TABLÓN DE ANUNCIOS ====================

const BulletinBoard = ({ user, isAdmin }) => {
  const queryClient = useQueryClient();
  const [showNewPost, setShowNewPost] = useState(false);
  const [newPost, setNewPost] = useState({ title: '', content: '', category: 'general' });

  const { data: announcements = [] } = useQuery({
    queryKey: ['announcements'],
    queryFn: async () => {
      try {
        return await base44.entities.Announcement?.list?.('-created_at', 50) || [];
      } catch {
        return [];
      }
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      return base44.entities.Announcement?.create?.({
        ...data,
        author_id: user.id,
        author_name: user.full_name,
        created_at: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      toast.success('Publicación creada');
      setShowNewPost(false);
      setNewPost({ title: '', content: '', category: 'general' });
    }
  });

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'importante': return <AlertCircle className="w-4 h-4 text-red-400" />;
      case 'evento': return <PartyPopper className="w-4 h-4 text-yellow-400" />;
      case 'horario': return <Clock className="w-4 h-4 text-blue-400" />;
      case 'felicitacion': return <Award className="w-4 h-4 text-green-400" />;
      default: return <Megaphone className="w-4 h-4 text-gray-400" />;
    }
  };

  const getCategoryBadge = (category) => {
    const styles = {
      importante: 'bg-red-500/20 text-red-300 border-red-500/30',
      evento: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
      horario: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      felicitacion: 'bg-green-500/20 text-green-300 border-green-500/30',
      general: 'bg-gray-500/20 text-gray-300 border-gray-500/30'
    };
    return styles[category] || styles.general;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-orange-400" />
          Tablón de anuncios
        </h3>
        {isAdmin && (
          <Button size="sm" className="bg-orange-600 hover:bg-orange-500" onClick={() => setShowNewPost(true)}>
            <Plus className="w-4 h-4 mr-1" />
            Publicar
          </Button>
        )}
      </div>

      <ScrollArea className="h-[500px]">
        <div className="space-y-4 pr-4">
          {announcements.map((post) => (
            <Card 
              key={post.id} 
              className={`bg-zinc-800/50 border-zinc-700/50 ${
                post.category === 'importante' ? 'border-l-4 border-l-red-500' : ''
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    post.category === 'importante' ? 'bg-red-500/20' : 'bg-zinc-700'
                  }`}>
                    {getCategoryIcon(post.category)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <h4 className="font-semibold text-white">{post.title}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-500">{post.author_name}</span>
                          <span className="text-xs text-gray-600">•</span>
                          <span className="text-xs text-gray-500">
                            {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: es })}
                          </span>
                        </div>
                      </div>
                      <Badge className={getCategoryBadge(post.category)}>
                        {post.category}
                      </Badge>
                    </div>
                    <p className="text-gray-300 text-sm whitespace-pre-wrap">{post.content}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {announcements.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <Megaphone className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No hay anuncios publicados</p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Dialog para nuevo anuncio */}
      <Dialog open={showNewPost} onOpenChange={setShowNewPost}>
        <DialogContent className="bg-zinc-900 border-zinc-700">
          <DialogHeader>
            <DialogTitle className="text-white">Nueva publicación</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-gray-300">Categoría</Label>
              <Select value={newPost.category} onValueChange={(v) => setNewPost(p => ({ ...p, category: v }))}>
                <SelectTrigger className="bg-zinc-800 border-zinc-600">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="importante">⚠️ Importante</SelectItem>
                  <SelectItem value="evento">🎉 Evento</SelectItem>
                  <SelectItem value="horario">🕐 Cambio de horario</SelectItem>
                  <SelectItem value="felicitacion">🏆 Felicitación</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-gray-300">Título</Label>
              <Input
                value={newPost.title}
                onChange={(e) => setNewPost(p => ({ ...p, title: e.target.value }))}
                className="bg-zinc-800 border-zinc-600 text-white"
                placeholder="Título del anuncio..."
              />
            </div>
            <div>
              <Label className="text-gray-300">Contenido</Label>
              <Textarea
                value={newPost.content}
                onChange={(e) => setNewPost(p => ({ ...p, content: e.target.value }))}
                className="bg-zinc-800 border-zinc-600 text-white"
                rows={4}
                placeholder="Escribe tu mensaje..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewPost(false)} className="border-zinc-600">
              Cancelar
            </Button>
            <Button 
              onClick={() => createMutation.mutate(newPost)} 
              disabled={!newPost.title.trim() || !newPost.content.trim()}
              className="bg-orange-600 hover:bg-orange-500"
            >
              <Send className="w-4 h-4 mr-2" />
              Publicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ==================== SECCIÓN PERSONAL ====================

const PersonalSection = ({ user }) => {
  const [activeSection, setActiveSection] = useState('datos');

  const { data: myTimesheets = [] } = useQuery({
    queryKey: ['my-timesheets', user?.id],
    queryFn: async () => {
      try {
        const all = await base44.entities.Timesheet?.list?.('-date', 100) || [];
        return all.filter(t => t.user_id === user?.id);
      } catch {
        return [];
      }
    },
    enabled: !!user
  });

  const { data: myVacations = [] } = useQuery({
    queryKey: ['my-vacations', user?.id],
    queryFn: async () => {
      try {
        return await base44.entities.VacationRequest?.filter?.({ employee_id: user?.id }) || [];
      } catch {
        return [];
      }
    },
    enabled: !!user
  });

  const { data: myDocuments = [] } = useQuery({
    queryKey: ['my-documents', user?.id],
    queryFn: async () => {
      try {
        return await base44.entities.Document?.filter?.({ employee_id: user?.id }) || [];
      } catch {
        return [];
      }
    },
    enabled: !!user
  });

  // Estadísticas
  const totalHoursThisMonth = myTimesheets
    .filter(t => new Date(t.date).getMonth() === new Date().getMonth())
    .reduce((sum, t) => sum + (t.total_hours || 0), 0);

  const vacationDaysUsed = myVacations
    .filter(v => v.status === 'aprobada' && v.request_type === 'vacaciones')
    .reduce((sum, v) => sum + (v.total_days || 0), 0);

  const sections = [
    { id: 'datos', label: 'Mis datos', icon: User },
    { id: 'fichajes', label: 'Mis fichajes', icon: Clock },
    { id: 'vacaciones', label: 'Mis vacaciones', icon: Calendar },
    { id: 'documentos', label: 'Mis documentos', icon: FileText },
  ];

  return (
    <div className="space-y-4">
      {/* Navegación */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <Button
              key={section.id}
              variant={activeSection === section.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveSection(section.id)}
              className={activeSection === section.id 
                ? 'bg-cyan-600 hover:bg-cyan-500' 
                : 'border-zinc-600 text-gray-400'
              }
            >
              <Icon className="w-4 h-4 mr-1" />
              {section.label}
            </Button>
          );
        })}
      </div>

      {/* Contenido */}
      <ScrollArea className="h-[450px]">
        {activeSection === 'datos' && (
          <Card className="bg-zinc-800/50 border-zinc-700">
            <CardContent className="p-6 space-y-6">
              <div className="flex items-center gap-4">
                <Avatar className="w-20 h-20">
                  <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-blue-600 text-white text-2xl">
                    {user?.full_name?.charAt(0) || '?'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-xl font-bold text-white">{user?.full_name}</h3>
                  <p className="text-gray-400">{user?.email}</p>
                  <Badge className="mt-2 bg-cyan-500/20 text-cyan-300">
                    {user?.role === 'admin' ? 'Administrador' : 'Empleado'}
                  </Badge>
                </div>
              </div>

              <Separator className="bg-zinc-700" />

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-zinc-900/50 rounded-lg">
                  <p className="text-sm text-gray-500">Horas este mes</p>
                  <p className="text-2xl font-bold text-white">{Math.round(totalHoursThisMonth)}h</p>
                </div>
                <div className="p-4 bg-zinc-900/50 rounded-lg">
                  <p className="text-sm text-gray-500">Días vacaciones usados</p>
                  <p className="text-2xl font-bold text-white">{vacationDaysUsed}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {activeSection === 'fichajes' && (
          <div className="space-y-3">
            {myTimesheets.slice(0, 20).map((ts) => (
              <Card key={ts.id} className="bg-zinc-800/50 border-zinc-700">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-white">
                        {format(new Date(ts.date), "EEEE d MMMM", { locale: es })}
                      </p>
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-400">
                        <span className="flex items-center gap-1">
                          <Play className="w-3 h-3 text-green-400" />
                          {ts.check_in || '--:--'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Square className="w-3 h-3 text-red-400" />
                          {ts.check_out || '--:--'}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-cyan-400">{ts.total_hours || 0}h</p>
                      <Badge 
                        variant="outline" 
                        className={ts.status === 'completo' 
                          ? 'border-green-500/50 text-green-400' 
                          : 'border-yellow-500/50 text-yellow-400'
                        }
                      >
                        {ts.status}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {myTimesheets.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No hay fichajes registrados</p>
              </div>
            )}
          </div>
        )}

        {activeSection === 'vacaciones' && (
          <div className="space-y-3">
            <Card className="bg-gradient-to-r from-cyan-900/30 to-blue-900/30 border-cyan-500/30">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">Días disponibles</p>
                    <p className="text-3xl font-bold text-white">22 <span className="text-lg text-gray-400">días</span></p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-400">Usados</p>
                    <p className="text-xl font-bold text-cyan-400">{vacationDaysUsed}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {myVacations.map((v) => (
              <Card key={v.id} className="bg-zinc-800/50 border-zinc-700">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-white capitalize">{v.request_type}</p>
                      <p className="text-sm text-gray-400">
                        {format(new Date(v.start_date), "d MMM", { locale: es })} - {format(new Date(v.end_date), "d MMM yyyy", { locale: es })}
                      </p>
                    </div>
                    <Badge 
                      className={
                        v.status === 'aprobada' ? 'bg-green-500/20 text-green-400' :
                        v.status === 'pendiente' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-red-500/20 text-red-400'
                      }
                    >
                      {v.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {activeSection === 'documentos' && (
          <div className="space-y-3">
            {['Contrato laboral', 'Nóminas', 'Certificados'].map((cat) => (
              <Card key={cat} className="bg-zinc-800/50 border-zinc-700">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-cyan-500/20 rounded-lg flex items-center justify-center">
                        <FileText className="w-5 h-5 text-cyan-400" />
                      </div>
                      <div>
                        <p className="font-medium text-white">{cat}</p>
                        <p className="text-sm text-gray-500">
                          {myDocuments.filter(d => d.category === cat.toLowerCase()).length} documentos
                        </p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="text-gray-400">
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};

// ==================== PÁGINA PRINCIPAL ====================

export default function EmployeePortal() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('home');
  const [currentStatus, setCurrentStatus] = useState(null);
  const [showStoryDetail, setShowStoryDetail] = useState(null);
  const queryClient = useQueryClient();

  // Cargar usuario
  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  // Cargar estado actual
  const { data: employeeStatus } = useQuery({
    queryKey: ['my-status', user?.id],
    queryFn: () => timeTrackingService.getEmployeeStatus(user.id),
    enabled: !!user,
    refetchInterval: 30000
  });

  // Estado de todos los empleados (para CEO)
  const { data: allEmployeesStatus = [] } = useQuery({
    queryKey: ['all-employees-status'],
    queryFn: () => timeTrackingService.getAllEmployeesStatus(),
    refetchInterval: 30000
  });

  useEffect(() => {
    if (employeeStatus) {
      setCurrentStatus(employeeStatus);
    }
  }, [employeeStatus]);

  const handleCheckIn = (record) => {
    queryClient.invalidateQueries({ queryKey: ['my-status'] });
    queryClient.invalidateQueries({ queryKey: ['all-employees-status'] });
    queryClient.invalidateQueries({ queryKey: ['portal-feed'] });
  };

  const isAdmin = user?.role === 'admin' || user?.permission_level === 'super_admin';

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-cyan-900/30 via-zinc-900 to-purple-900/30 border-b border-zinc-800 px-4 py-4 sticky top-0 z-40 backdrop-blur-xl">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div className="flex items-center gap-3">
            <Avatar className="w-10 h-10">
              <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-blue-600 text-white">
                {user.full_name?.charAt(0) || '?'}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-lg font-bold text-white">{user.full_name}</h1>
              <p className="text-xs text-gray-400">
                {format(new Date(), "EEEE d MMMM", { locale: es })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="relative text-gray-400">
              <Bell className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] flex items-center justify-center text-white">
                3
              </span>
            </Button>
            <Button variant="ghost" size="icon" className="text-gray-400">
              <Settings className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {activeTab === 'home' && (
          <>
            <EnhancedCheckIn 
              user={user} 
              onCheckIn={handleCheckIn}
              currentStatus={currentStatus}
            />
            <StoriesSection 
              user={user} 
              employees={allEmployeesStatus}
              onViewStory={(emp) => setShowStoryDetail(emp)}
            />
          </>
        )}

        {activeTab === 'feed' && <FeedSection user={user} />}
        
        {activeTab === 'board' && <BulletinBoard user={user} isAdmin={isAdmin} />}
        
        {activeTab === 'profile' && <PersonalSection user={user} />}
      </div>

      {/* Tab Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-zinc-900/95 backdrop-blur-xl border-t border-zinc-800 safe-area-pb">
        <div className="max-w-lg mx-auto flex">
          {[
            { id: 'home', icon: Home, label: 'Inicio' },
            { id: 'feed', icon: Activity, label: 'Actividad' },
            { id: 'board', icon: Megaphone, label: 'Tablón' },
            { id: 'profile', icon: User, label: 'Perfil' },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex flex-col items-center py-3 transition-colors ${
                  isActive ? 'text-cyan-400' : 'text-gray-500'
                }`}
              >
                <Icon className={`w-6 h-6 ${isActive ? 'scale-110' : ''} transition-transform`} />
                <span className="text-xs mt-1">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Story Detail Sheet */}
      <Sheet open={!!showStoryDetail} onOpenChange={() => setShowStoryDetail(null)}>
        <SheetContent side="bottom" className="bg-zinc-900 border-zinc-700 h-[70vh] rounded-t-3xl">
          {showStoryDetail && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="w-16 h-16">
                  <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-blue-600 text-white text-xl">
                    {showStoryDetail.userName?.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-xl font-bold text-white">{showStoryDetail.userName}</h3>
                  <Badge className={
                    showStoryDetail.status === EMPLOYEE_STATUS.WORKING ? 'bg-green-500/20 text-green-400' :
                    showStoryDetail.status === EMPLOYEE_STATUS.ON_BREAK ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-gray-500/20 text-gray-400'
                  }>
                    {showStoryDetail.status === EMPLOYEE_STATUS.WORKING ? 'Trabajando' :
                     showStoryDetail.status === EMPLOYEE_STATUS.ON_BREAK ? 'En pausa' :
                     'Jornada finalizada'}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mt-6">
                <div className="text-center p-4 bg-zinc-800 rounded-xl">
                  <Clock className="w-6 h-6 text-green-400 mx-auto mb-2" />
                  <p className="text-xl font-bold text-white">{showStoryDetail.entryTime || '--:--'}</p>
                  <p className="text-xs text-gray-400">Entrada</p>
                </div>
                <div className="text-center p-4 bg-zinc-800 rounded-xl">
                  <TrendingUp className="w-6 h-6 text-cyan-400 mx-auto mb-2" />
                  <p className="text-xl font-bold text-white">{showStoryDetail.workedHours}h</p>
                  <p className="text-xs text-gray-400">Trabajadas</p>
                </div>
                <div className="text-center p-4 bg-zinc-800 rounded-xl">
                  <Coffee className="w-6 h-6 text-yellow-400 mx-auto mb-2" />
                  <p className="text-xl font-bold text-white">{showStoryDetail.breakMinutes}m</p>
                  <p className="text-xs text-gray-400">Pausas</p>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
