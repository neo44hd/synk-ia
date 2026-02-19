import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  Calendar, 
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  Sun
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function VacationRequests() {
  const [user, setUser] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    employee_name: '',
    request_type: 'vacaciones',
    start_date: '',
    end_date: '',
    total_days: 0,
    reason: '',
    status: 'pendiente'
  });

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
        setFormData(prev => ({ ...prev, employee_name: currentUser.full_name, employee_id: currentUser.id }));
      } catch (error) {
        console.error('Error loading user:', error);
      }
    };
    loadUser();
  }, []);

  const queryClient = useQueryClient();

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['vacation-requests'],
    queryFn: async () => {
      const allRequests = await base44.entities.VacationRequest.list('-created_date');
      
      // Si no es admin o manager, solo muestra sus solicitudes
      if (user && user.permission_level !== 'super_admin' && user.permission_level !== 'admin' && !user.can_approve_vacations) {
        return allRequests.filter(r => r.employee_id === user.id || r.employee_name === user.full_name);
      }
      
      return allRequests;
    },
    initialData: [],
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.VacationRequest.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vacation-requests'] });
      toast.success('Solicitud creada correctamente');
      setIsDialogOpen(false);
      resetForm();
    },
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, approved }) => 
      base44.entities.VacationRequest.update(id, {
        status: approved ? 'aprobada' : 'rechazada',
        approved_by: user?.id,
        approval_date: new Date().toISOString().split('T')[0]
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vacation-requests'] });
      toast.success('Solicitud actualizada');
    },
  });

  const resetForm = () => {
    setFormData({
      employee_name: user?.full_name || '',
      employee_id: user?.id || '',
      request_type: 'vacaciones',
      start_date: '',
      end_date: '',
      total_days: 0,
      reason: '',
      status: 'pendiente'
    });
  };

  const calculateDays = () => {
    if (formData.start_date && formData.end_date) {
      const start = new Date(formData.start_date);
      const end = new Date(formData.end_date);
      const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
      setFormData({ ...formData, total_days: days });
    }
  };

  useEffect(() => {
    calculateDays();
  }, [formData.start_date, formData.end_date]);

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const statusColors = {
    pendiente: 'bg-yellow-100 text-yellow-800',
    aprobada: 'bg-green-100 text-green-800',
    rechazada: 'bg-red-100 text-red-800',
    cancelada: 'bg-gray-100 text-gray-800'
  };

  const typeColors = {
    vacaciones: 'bg-blue-100 text-blue-800',
    permiso: 'bg-purple-100 text-purple-800',
    baja: 'bg-red-100 text-red-800',
    asuntos_propios: 'bg-orange-100 text-orange-800'
  };

  const myRequests = requests.filter(r => r.employee_id === user?.id || r.employee_name === user?.full_name);
  const pendingRequests = requests.filter(r => r.status === 'pendiente').length;
  const approvedDays = myRequests.filter(r => r.status === 'aprobada').reduce((sum, r) => sum + (r.total_days || 0), 0);
  const availableDays = (user?.vacation_days_available || 22) - approvedDays;

  return (
    <div className="p-4 md:p-8 min-h-screen bg-gradient-to-br from-zinc-950 via-neutral-900 to-zinc-950">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Calendar className="w-8 h-8 text-cyan-400" style={{ filter: 'drop-shadow(0 0 8px rgba(6, 182, 212, 0.8))' }} />
            <span className="text-cyan-400" style={{ textShadow: '0 0 15px rgba(6, 182, 212, 0.6)' }}>Vacaciones y Permisos</span>
          </h1>
          <p className="text-zinc-400 mt-1">
            Gestiona tus solicitudes de ausencias
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="border-none shadow-lg bg-black border border-cyan-500/50" style={{ boxShadow: '0 0 20px rgba(6, 182, 212, 0.3)' }}>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <Sun className="w-6 h-6 text-cyan-400" />
                <p className="text-sm text-cyan-400/80">Días Disponibles</p>
              </div>
              <p className="text-4xl font-bold text-cyan-400">{availableDays}</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-lg bg-zinc-800/50 border border-zinc-800">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
                <p className="text-sm text-zinc-400">Días Usados</p>
              </div>
              <p className="text-3xl font-bold text-white">{approvedDays}</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-lg bg-zinc-800/50 border border-zinc-800">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <Clock className="w-5 h-5 text-yellow-400" />
                <p className="text-sm text-zinc-400">Solicitudes Pendientes</p>
              </div>
              <p className="text-3xl font-bold text-white">{pendingRequests}</p>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex justify-end mb-6">
          <Button
            onClick={() => setIsDialogOpen(true)}
            className="bg-black border border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10"
            style={{ boxShadow: '0 0 15px rgba(6, 182, 212, 0.3)' }}
          >
            <Plus className="w-5 h-5 mr-2" />
            Nueva Solicitud
          </Button>
        </div>

        {/* Requests List */}
        {isLoading ? (
          <Card className="border-none shadow-lg bg-zinc-800/50 border border-zinc-800">
            <CardContent className="p-12 text-center">
              <p className="text-zinc-400">Cargando solicitudes...</p>
            </CardContent>
          </Card>
        ) : requests.length === 0 ? (
          <Card className="border-none shadow-lg bg-zinc-800/50 border border-zinc-800">
            <CardContent className="p-12 text-center">
              <Calendar className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
              <p className="text-zinc-400 mb-4">No hay solicitudes registradas</p>
              <Button
                onClick={() => setIsDialogOpen(true)}
                className="bg-black border border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10"
              >
                Crear primera solicitud
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => (
              <Card key={request.id} className="border-none shadow-lg bg-zinc-800/50 border border-zinc-800 hover:bg-zinc-800 transition-all">
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="w-12 h-12 bg-black border border-cyan-500/50 rounded-xl flex items-center justify-center flex-shrink-0" style={{ boxShadow: '0 0 15px rgba(6, 182, 212, 0.3)' }}>
                        <Calendar className="w-6 h-6 text-cyan-400" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <h3 className="text-lg font-bold text-white">{request.employee_name}</h3>
                          <Badge className={typeColors[request.request_type]}>
                            {request.request_type.replace('_', ' ')}
                          </Badge>
                          <Badge className={statusColors[request.status]}>
                            {request.status}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm mb-3">
                          <div>
                            <p className="text-zinc-500">Desde</p>
                            <p className="font-semibold text-white">{request.start_date ? format(new Date(request.start_date), 'dd/MM/yyyy') : 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-zinc-500">Hasta</p>
                            <p className="font-semibold text-white">{request.end_date ? format(new Date(request.end_date), 'dd/MM/yyyy') : 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-zinc-500">Total</p>
                            <p className="font-semibold text-cyan-400">{request.total_days} días</p>
                          </div>
                        </div>
                        {request.reason && (
                          <p className="text-sm text-zinc-400">
                            <strong className="text-white">Motivo:</strong> {request.reason}
                          </p>
                        )}
                        {request.approval_date && (
                          <p className="text-xs text-zinc-500 mt-2">
                            {request.status === 'aprobada' ? 'Aprobada' : 'Rechazada'} el {format(new Date(request.approval_date), 'dd/MM/yyyy')}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    {request.status === 'pendiente' && user && (user.can_approve_vacations || user.permission_level === 'super_admin' || user.permission_level === 'admin') && (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={() => approveMutation.mutate({ id: request.id, approved: true })}
                          className="border-green-500 text-green-600 hover:bg-green-50"
                        >
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          Aprobar
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => approveMutation.mutate({ id: request.id, approved: false })}
                          className="border-red-500 text-red-600 hover:bg-red-50"
                        >
                          <XCircle className="w-4 h-4 mr-2" />
                          Rechazar
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nueva Solicitud</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="request_type">Tipo de Solicitud *</Label>
                  <Select
                    value={formData.request_type}
                    onValueChange={(value) => setFormData({...formData, request_type: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vacaciones">Vacaciones</SelectItem>
                      <SelectItem value="permiso">Permiso</SelectItem>
                      <SelectItem value="baja">Baja</SelectItem>
                      <SelectItem value="asuntos_propios">Asuntos Propios</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="start_date">Fecha Inicio *</Label>
                    <Input
                      id="start_date"
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => setFormData({...formData, start_date: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="end_date">Fecha Fin *</Label>
                    <Input
                      id="end_date"
                      type="date"
                      value={formData.end_date}
                      onChange={(e) => setFormData({...formData, end_date: e.target.value})}
                      required
                    />
                  </div>
                </div>
                <div>
                  <Label>Días solicitados</Label>
                  <p className="text-2xl font-bold text-blue-600">{formData.total_days} días</p>
                  <p className="text-sm text-gray-600">Te quedarán {availableDays - formData.total_days} días disponibles</p>
                </div>
                <div>
                  <Label htmlFor="reason">Motivo (opcional)</Label>
                  <Textarea
                    id="reason"
                    value={formData.reason}
                    onChange={(e) => setFormData({...formData, reason: e.target.value})}
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                  Solicitar
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}