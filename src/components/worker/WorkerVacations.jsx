import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Calendar, Plus, CheckCircle2, Clock, XCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function WorkerVacations({ onClose, user }) {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    start_date: '',
    end_date: '',
    reason: ''
  });

  const queryClient = useQueryClient();

  const { data: requests = [] } = useQuery({
    queryKey: ['my-vacation-requests'],
    queryFn: async () => {
      const all = await base44.entities.VacationRequest.list('-created_date');
      return all.filter(r => r.employee_id === user?.id || r.employee_name === user?.full_name);
    },
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.VacationRequest.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-vacation-requests'] });
      toast.success('✅ Solicitud enviada');
      setShowForm(false);
      setFormData({ start_date: '', end_date: '', reason: '' });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const start = new Date(formData.start_date);
    const end = new Date(formData.end_date);
    const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

    createMutation.mutate({
      employee_id: user.id,
      employee_name: user.full_name,
      request_type: 'vacaciones',
      start_date: formData.start_date,
      end_date: formData.end_date,
      total_days: totalDays,
      reason: formData.reason,
      status: 'pendiente'
    });
  };

  const approvedDays = requests
    .filter(r => r.status === 'aprobada')
    .reduce((sum, r) => sum + (r.total_days || 0), 0);
  const availableDays = (user?.vacation_days_available || 22) - approvedDays;

  const statusIcons = {
    pendiente: <Clock className="w-5 h-5 text-yellow-400" />,
    aprobada: <CheckCircle2 className="w-5 h-5 text-green-400" />,
    rechazada: <XCircle className="w-5 h-5 text-red-400" />
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl p-8 max-w-4xl w-full max-h-[80vh] overflow-y-auto border-2 border-purple-500/30 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-purple-700 rounded-2xl flex items-center justify-center">
              <Calendar className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-white">Vacaciones</h2>
              <p className="text-slate-400">Gestiona tus días libres</p>
            </div>
          </div>
          <Button
            onClick={onClose}
            variant="ghost"
            size="icon"
            className="text-slate-400 hover:text-white hover:bg-slate-700 rounded-full"
          >
            <X className="w-6 h-6" />
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-purple-500/20 rounded-2xl p-6 border-2 border-purple-500/30">
            <p className="text-purple-400 text-sm mb-1">Días Disponibles</p>
            <p className="text-white text-4xl font-bold">{availableDays}</p>
          </div>
          <div className="bg-slate-700/50 rounded-2xl p-6 border border-slate-600">
            <p className="text-slate-400 text-sm mb-1">Días Usados</p>
            <p className="text-white text-4xl font-bold">{approvedDays}</p>
          </div>
        </div>

        {/* Nueva Solicitud Button */}
        {!showForm && (
          <Button
            onClick={() => setShowForm(true)}
            className="w-full mb-6 bg-purple-600 hover:bg-purple-700 h-14 text-lg"
          >
            <Plus className="w-5 h-5 mr-2" />
            Nueva Solicitud
          </Button>
        )}

        {/* Form */}
        {showForm && (
          <form onSubmit={handleSubmit} className="bg-slate-700/50 rounded-2xl p-6 border border-slate-600 mb-6">
            <h3 className="text-white font-bold text-lg mb-4">Nueva Solicitud de Vacaciones</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <Label className="text-slate-300 mb-2 block">Fecha Inicio</Label>
                <Input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({...formData, start_date: e.target.value})}
                  required
                  className="bg-slate-800 border-slate-600 text-white"
                />
              </div>
              <div>
                <Label className="text-slate-300 mb-2 block">Fecha Fin</Label>
                <Input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({...formData, end_date: e.target.value})}
                  required
                  className="bg-slate-800 border-slate-600 text-white"
                />
              </div>
            </div>
            <div className="mb-4">
              <Label className="text-slate-300 mb-2 block">Motivo (opcional)</Label>
              <Input
                value={formData.reason}
                onChange={(e) => setFormData({...formData, reason: e.target.value})}
                placeholder="Ej: Vacaciones familiares..."
                className="bg-slate-800 border-slate-600 text-white"
              />
            </div>
            <div className="flex gap-3">
              <Button type="submit" className="flex-1 bg-purple-600 hover:bg-purple-700">
                Enviar Solicitud
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)} className="border-slate-600">
                Cancelar
              </Button>
            </div>
          </form>
        )}

        {/* Requests List */}
        <div>
          <h3 className="text-white font-bold text-lg mb-4">Mis Solicitudes</h3>
          {requests.length === 0 ? (
            <div className="bg-slate-700/50 rounded-2xl p-12 border border-slate-600 text-center">
              <Calendar className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">No tienes solicitudes</p>
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map((request) => (
                <div key={request.id} className="bg-slate-700/50 rounded-2xl p-6 border border-slate-600">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        {statusIcons[request.status]}
                        <p className="text-white font-bold capitalize">{request.status}</p>
                      </div>
                      <p className="text-slate-400 text-sm">
                        {format(new Date(request.start_date), 'dd/MM/yyyy')} - {format(new Date(request.end_date), 'dd/MM/yyyy')}
                      </p>
                      {request.reason && (
                        <p className="text-slate-400 text-sm mt-1">Motivo: {request.reason}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-white text-2xl font-bold">{request.total_days}</p>
                      <p className="text-slate-400 text-sm">días</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}