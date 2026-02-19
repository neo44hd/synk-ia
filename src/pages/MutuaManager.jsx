
import React, { useState, useRef } from "react";
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
  Heart,
  Plus,
  AlertTriangle,
  Upload,
  FileText,
  Calendar,
  TrendingUp,
  CheckCircle2,
  Clock,
  XCircle
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function MutuaManager() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [formData, setFormData] = useState({
    employee_name: '',
    incident_type: 'baja_medica',
    incident_date: new Date().toISOString().slice(0, 16),
    description: '',
    severity: 'leve',
    body_part_affected: '',
    medical_attention: 'no_requerida',
    days_off: 0,
    mutua_name: 'Mutua Universal',
    status: 'reportado'
  });
  
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: incidents = [] } = useQuery({
    queryKey: ['mutua-incidents', filterStatus],
    queryFn: async () => {
      const all = await base44.entities.MutuaIncident.list('-incident_date');
      if (filterStatus === 'all') return all;
      return all.filter(i => i.status === filterStatus);
    },
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.MutuaIncident.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mutua-incidents'] });
      toast.success('Incidente registrado correctamente');
      setIsDialogOpen(false);
      resetForm();
    },
  });

  const resetForm = () => {
    setFormData({
      employee_name: '',
      incident_type: 'baja_medica',
      incident_date: new Date().toISOString().slice(0, 16),
      description: '',
      severity: 'leve',
      body_part_affected: '',
      medical_attention: 'no_requerida',
      days_off: 0,
      mutua_name: 'Mutua Universal',
      status: 'reportado'
    });
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFile(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFormData({ ...formData, parte_file_url: file_url });
      toast.success('Parte subido correctamente');
    } catch (error) {
      toast.error('Error al subir archivo');
    } finally {
      setUploadingFile(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const severityColors = {
    leve: 'bg-blue-100 text-blue-800',
    grave: 'bg-orange-100 text-orange-800',
    muy_grave: 'bg-red-100 text-red-800',
    mortal: 'bg-black text-white'
  };

  const statusIcons = {
    reportado: <Clock className="w-4 h-4" />,
    en_tramite: <TrendingUp className="w-4 h-4" />,
    aprobado: <CheckCircle2 className="w-4 h-4" />,
    cerrado: <CheckCircle2 className="w-4 h-4" />,
    rechazado: <XCircle className="w-4 h-4" />
  };

  const totalIncidents = incidents.length;
  const activeIncidents = incidents.filter(i => i.status !== 'cerrado').length;
  const totalDaysOff = incidents.reduce((sum, i) => sum + (i.days_off || 0), 0);

  return (
    <div className="p-4 md:p-8 min-h-screen bg-gradient-to-br from-red-50 to-pink-50">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Heart className="w-8 h-8 text-red-600" />
              Gestión de Mutua
            </h1>
            <p className="text-gray-600 mt-1">
              Registro y seguimiento de incidentes laborales y bajas médicas
            </p>
          </div>
          <Button
            onClick={() => setIsDialogOpen(true)}
            className="bg-red-600 hover:bg-red-700"
          >
            <Plus className="w-5 h-5 mr-2" />
            Reportar Incidente
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="border-none shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <p className="text-sm text-gray-600">Total Incidentes</p>
              </div>
              <p className="text-3xl font-bold">{totalIncidents}</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <Clock className="w-5 h-5 text-orange-600" />
                <p className="text-sm text-gray-600">En Proceso</p>
              </div>
              <p className="text-3xl font-bold">{activeIncidents}</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <Calendar className="w-5 h-5 text-blue-600" />
                <p className="text-sm text-gray-600">Días de Baja</p>
              </div>
              <p className="text-3xl font-bold">{totalDaysOff}</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <p className="text-sm text-gray-600">Cerrados</p>
              </div>
              <p className="text-3xl font-bold">
                {incidents.filter(i => i.status === 'cerrado').length}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 mb-6">
          <p className="text-sm font-medium text-gray-700">Filtrar por estado:</p>
          <div className="flex gap-2">
            {['all', 'reportado', 'en_tramite', 'aprobado', 'cerrado', 'rechazado'].map((status) => (
              <Button
                key={status}
                variant={filterStatus === status ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterStatus(status)}
                className={filterStatus === status ? 'bg-red-600' : ''}
              >
                {status === 'all' ? 'Todos' : status.replace('_', ' ')}
              </Button>
            ))}
          </div>
        </div>

        {/* Incidents List */}
        {incidents.length === 0 ? (
          <Card className="border-none shadow-lg">
            <CardContent className="p-12 text-center">
              <Heart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">No hay incidentes registrados</h3>
              <p className="text-gray-600 mb-6">
                Comienza a registrar incidentes y bajas médicas
              </p>
              <Button
                onClick={() => setIsDialogOpen(true)}
                className="bg-red-600 hover:bg-red-700"
              >
                Reportar primer incidente
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {incidents.map((incident) => (
              <Card key={incident.id} className="border-none shadow-lg hover:shadow-xl transition-all">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${severityColors[incident.severity]}`}>
                        <AlertTriangle className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg">{incident.employee_name}</h3>
                        <p className="text-sm text-gray-600 capitalize">
                          {incident.incident_type.replace('_', ' ')}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {format(new Date(incident.incident_date), 'dd/MM/yyyy HH:mm')}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge className={severityColors[incident.severity]}>
                        {incident.severity}
                      </Badge>
                      <Badge className="flex items-center gap-1">
                        {statusIcons[incident.status]}
                        {incident.status}
                      </Badge>
                    </div>
                  </div>

                  <p className="text-gray-700 mb-4">{incident.description}</p>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    {incident.body_part_affected && (
                      <div>
                        <p className="text-gray-500">Parte afectada</p>
                        <p className="font-medium">{incident.body_part_affected}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-gray-500">Atención médica</p>
                      <p className="font-medium capitalize">{incident.medical_attention?.replace('_', ' ')}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Días de baja</p>
                      <p className="font-medium">{incident.days_off || 0} días</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Mutua</p>
                      <p className="font-medium">{incident.mutua_name}</p>
                    </div>
                  </div>

                  {incident.parte_file_url && (
                    <div className="mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(incident.parte_file_url, '_blank')}
                      >
                        <FileText className="w-4 h-4 mr-2" />
                        Ver Parte de Accidente
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Reportar Nuevo Incidente</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="employee_name">Nombre del Empleado *</Label>
                    <Input
                      id="employee_name"
                      value={formData.employee_name}
                      onChange={(e) => setFormData({...formData, employee_name: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="incident_type">Tipo de Incidente *</Label>
                    <Select
                      value={formData.incident_type}
                      onValueChange={(value) => setFormData({...formData, incident_type: value})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="accidente_trabajo">Accidente de Trabajo</SelectItem>
                        <SelectItem value="accidente_itinere">Accidente In Itinere</SelectItem>
                        <SelectItem value="baja_medica">Baja Médica</SelectItem>
                        <SelectItem value="recaida">Recaída</SelectItem>
                        <SelectItem value="alta_medica">Alta Médica</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="incident_date">Fecha y Hora del Incidente *</Label>
                  <Input
                    id="incident_date"
                    type="datetime-local"
                    value={formData.incident_date}
                    onChange={(e) => setFormData({...formData, incident_date: e.target.value})}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="description">Descripción Detallada *</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    rows={4}
                    required
                    placeholder="Describe qué ocurrió, cómo sucedió, dónde..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="severity">Gravedad *</Label>
                    <Select
                      value={formData.severity}
                      onValueChange={(value) => setFormData({...formData, severity: value})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="leve">Leve</SelectItem>
                        <SelectItem value="grave">Grave</SelectItem>
                        <SelectItem value="muy_grave">Muy Grave</SelectItem>
                        <SelectItem value="mortal">Mortal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="body_part">Parte del Cuerpo Afectada</Label>
                    <Input
                      id="body_part"
                      value={formData.body_part_affected}
                      onChange={(e) => setFormData({...formData, body_part_affected: e.target.value})}
                      placeholder="Ej: Mano derecha, espalda..."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="medical_attention">Atención Médica</Label>
                    <Select
                      value={formData.medical_attention}
                      onValueChange={(value) => setFormData({...formData, medical_attention: value})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="no_requerida">No Requerida</SelectItem>
                        <SelectItem value="primeros_auxilios">Primeros Auxilios</SelectItem>
                        <SelectItem value="centro_salud">Centro de Salud</SelectItem>
                        <SelectItem value="hospital">Hospital</SelectItem>
                        <SelectItem value="urgencias">Urgencias</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="days_off">Días de Baja Estimados</Label>
                    <Input
                      id="days_off"
                      type="number"
                      value={formData.days_off}
                      onChange={(e) => setFormData({...formData, days_off: parseInt(e.target.value)})}
                      min="0"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="mutua_name">Mutua</Label>
                  <Input
                    id="mutua_name"
                    value={formData.mutua_name}
                    onChange={(e) => setFormData({...formData, mutua_name: e.target.value})}
                  />
                </div>

                <div>
                  <Label htmlFor="file">Parte de Accidente (PDF/ZIP)</Label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.zip"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingFile}
                    className="w-full"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {uploadingFile ? 'Subiendo...' : formData.parte_file_url ? 'Cambiar archivo' : 'Subir parte'}
                  </Button>
                  {formData.parte_file_url && (
                    <p className="text-xs text-green-600 mt-2">✓ Archivo subido</p>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" className="bg-red-600 hover:bg-red-700">
                  Reportar Incidente
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
