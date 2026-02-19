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
  Shield,
  Plus,
  Lock,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Upload,
  Clock
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function RGPDManager() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [formData, setFormData] = useState({
    item_type: 'consentimiento',
    title: '',
    description: '',
    affected_person: '',
    data_categories: [],
    legal_basis: 'consentimiento',
    consent_date: '',
    purpose: '',
    status: 'activo'
  });
  
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: items = [] } = useQuery({
    queryKey: ['rgpd-items', filterType],
    queryFn: async () => {
      const all = await base44.entities.RGPDCompliance.list('-created_date');
      if (filterType === 'all') return all;
      return all.filter(i => i.item_type === filterType);
    },
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.RGPDCompliance.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rgpd-items'] });
      toast.success('Registro creado correctamente');
      setIsDialogOpen(false);
      resetForm();
    },
  });

  const resetForm = () => {
    setFormData({
      item_type: 'consentimiento',
      title: '',
      description: '',
      affected_person: '',
      data_categories: [],
      legal_basis: 'consentimiento',
      consent_date: '',
      purpose: '',
      status: 'activo'
    });
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFile(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFormData({ ...formData, file_url });
      toast.success('Archivo subido');
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

  const typeColors = {
    consentimiento: 'bg-green-100 text-green-800',
    tratamiento: 'bg-blue-100 text-blue-800',
    auditoria: 'bg-purple-100 text-purple-800',
    brecha: 'bg-red-100 text-red-800',
    dpo: 'bg-indigo-100 text-indigo-800',
    registro_actividades: 'bg-orange-100 text-orange-800'
  };

  const totalItems = items.length;
  const activeConsents = items.filter(i => i.item_type === 'consentimiento' && i.status === 'activo').length;
  const breaches = items.filter(i => i.item_type === 'brecha').length;
  const audits = items.filter(i => i.item_type === 'auditoria').length;

  return (
    <div className="p-4 md:p-8 min-h-screen bg-gradient-to-br from-zinc-950 via-neutral-900 to-zinc-950">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Shield className="w-8 h-8 text-cyan-400" style={{ filter: 'drop-shadow(0 0 8px rgba(6, 182, 212, 0.8))' }} />
              <span className="text-cyan-400" style={{ textShadow: '0 0 15px rgba(6, 182, 212, 0.6)' }}>Protección de Datos (RGPD)</span>
            </h1>
            <p className="text-zinc-400 mt-1">
              Gestión de cumplimiento RGPD y protección de datos personales
            </p>
          </div>
          <Button
            onClick={() => setIsDialogOpen(true)}
            className="bg-black border border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10"
            style={{ boxShadow: '0 0 15px rgba(6, 182, 212, 0.3)' }}
          >
            <Plus className="w-5 h-5 mr-2" />
            Nuevo Registro
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="border-none shadow-lg bg-zinc-800/50 border border-zinc-800">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <Shield className="w-5 h-5 text-cyan-400" />
                <p className="text-sm text-zinc-400">Total Registros</p>
              </div>
              <p className="text-3xl font-bold text-white">{totalItems}</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-lg bg-zinc-800/50 border border-zinc-800">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
                <p className="text-sm text-zinc-400">Consentimientos Activos</p>
              </div>
              <p className="text-3xl font-bold text-white">{activeConsents}</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-lg bg-zinc-800/50 border border-zinc-800">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <AlertTriangle className="w-5 h-5 text-red-400" />
                <p className="text-sm text-zinc-400">Brechas Registradas</p>
              </div>
              <p className="text-3xl font-bold text-white">{breaches}</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-lg bg-zinc-800/50 border border-zinc-800">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <FileText className="w-5 h-5 text-purple-400" />
                <p className="text-sm text-zinc-400">Auditorías</p>
              </div>
              <p className="text-3xl font-bold text-white">{audits}</p>
            </CardContent>
          </Card>
        </div>

        {/* Info Alert */}
        <Card className="border-none shadow-lg mb-8 bg-gradient-to-r from-blue-500 to-indigo-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <Lock className="w-6 h-6 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-bold text-lg mb-2">🔒 Cumplimiento RGPD</h3>
                <p className="text-sm opacity-90">
                  El Reglamento General de Protección de Datos (RGPD) requiere:
                </p>
                <ul className="text-sm opacity-90 mt-2 space-y-1 list-disc ml-4">
                  <li>Registro de actividades de tratamiento</li>
                  <li>Consentimientos documentados</li>
                  <li>Evaluaciones de impacto de privacidad</li>
                  <li>Notificación de brechas en 72h</li>
                  <li>DPO (Delegado de Protección de Datos) si aplica</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <div className="flex items-center gap-4 mb-6 flex-wrap">
          <p className="text-sm font-medium text-gray-700">Filtrar por tipo:</p>
          <div className="flex gap-2 flex-wrap">
            {['all', 'consentimiento', 'tratamiento', 'auditoria', 'brecha', 'dpo', 'registro_actividades'].map((type) => (
              <Button
                key={type}
                variant={filterType === type ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterType(type)}
                className={filterType === type ? 'bg-indigo-600' : ''}
              >
                {type === 'all' ? 'Todos' : type.replace('_', ' ')}
              </Button>
            ))}
          </div>
        </div>

        {/* Items List */}
        {items.length === 0 ? (
          <Card className="border-none shadow-lg">
            <CardContent className="p-12 text-center">
              <Shield className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">No hay registros RGPD</h3>
              <p className="text-gray-600 mb-6">
                Comienza a documentar tu cumplimiento de protección de datos
              </p>
              <Button
                onClick={() => setIsDialogOpen(true)}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                Crear primer registro
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {items.map((item) => (
              <Card key={item.id} className="border-none shadow-lg hover:shadow-xl transition-all">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start gap-4 flex-1">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${typeColors[item.item_type]?.replace('text-', 'bg-').replace('-800', '-200')}`}>
                        {item.item_type === 'brecha' ? <AlertTriangle className="w-6 h-6" /> : <Shield className="w-6 h-6" />}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-lg">{item.title}</h3>
                        <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                        {item.affected_person && (
                          <p className="text-xs text-gray-500 mt-2">
                            Afectado: {item.affected_person}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge className={typeColors[item.item_type]}>
                        {item.item_type.replace('_', ' ')}
                      </Badge>
                      <Badge className={
                        item.status === 'activo' ? 'bg-green-100 text-green-800' :
                        item.status === 'caducado' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }>
                        {item.status}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mt-4">
                    {item.legal_basis && (
                      <div>
                        <p className="text-gray-500">Base Legal</p>
                        <p className="font-medium capitalize">{item.legal_basis.replace('_', ' ')}</p>
                      </div>
                    )}
                    {item.consent_date && (
                      <div>
                        <p className="text-gray-500">Fecha</p>
                        <p className="font-medium">{format(new Date(item.consent_date), 'dd/MM/yyyy')}</p>
                      </div>
                    )}
                    {item.data_categories && item.data_categories.length > 0 && (
                      <div>
                        <p className="text-gray-500">Categorías de Datos</p>
                        <p className="font-medium">{item.data_categories.length} categorías</p>
                      </div>
                    )}
                    {item.breach_severity && (
                      <div>
                        <p className="text-gray-500">Severidad</p>
                        <Badge className="bg-red-100 text-red-800">{item.breach_severity}</Badge>
                      </div>
                    )}
                  </div>

                  {item.file_url && (
                    <div className="mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(item.file_url, '_blank')}
                      >
                        <FileText className="w-4 h-4 mr-2" />
                        Ver Documento
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
              <DialogTitle>Nuevo Registro RGPD</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="item_type">Tipo de Registro *</Label>
                  <Select
                    value={formData.item_type}
                    onValueChange={(value) => setFormData({...formData, item_type: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="consentimiento">Consentimiento</SelectItem>
                      <SelectItem value="tratamiento">Tratamiento de Datos</SelectItem>
                      <SelectItem value="auditoria">Auditoría</SelectItem>
                      <SelectItem value="brecha">Brecha de Seguridad</SelectItem>
                      <SelectItem value="dpo">DPO</SelectItem>
                      <SelectItem value="registro_actividades">Registro de Actividades</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="title">Título *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="description">Descripción *</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    rows={3}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="affected_person">Persona/Grupo Afectado</Label>
                    <Input
                      id="affected_person"
                      value={formData.affected_person}
                      onChange={(e) => setFormData({...formData, affected_person: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="legal_basis">Base Legal</Label>
                    <Select
                      value={formData.legal_basis}
                      onValueChange={(value) => setFormData({...formData, legal_basis: value})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="consentimiento">Consentimiento</SelectItem>
                        <SelectItem value="contrato">Contrato</SelectItem>
                        <SelectItem value="obligacion_legal">Obligación Legal</SelectItem>
                        <SelectItem value="interes_vital">Interés Vital</SelectItem>
                        <SelectItem value="interes_publico">Interés Público</SelectItem>
                        <SelectItem value="interes_legitimo">Interés Legítimo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="purpose">Finalidad del Tratamiento</Label>
                  <Textarea
                    id="purpose"
                    value={formData.purpose}
                    onChange={(e) => setFormData({...formData, purpose: e.target.value})}
                    rows={2}
                  />
                </div>

                <div>
                  <Label htmlFor="consent_date">Fecha</Label>
                  <Input
                    id="consent_date"
                    type="date"
                    value={formData.consent_date}
                    onChange={(e) => setFormData({...formData, consent_date: e.target.value})}
                  />
                </div>

                <div>
                  <Label htmlFor="file">Documento Adjunto</Label>
                  <input
                    ref={fileInputRef}
                    type="file"
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
                    {uploadingFile ? 'Subiendo...' : formData.file_url ? 'Cambiar archivo' : 'Subir documento'}
                  </Button>
                  {formData.file_url && (
                    <p className="text-xs text-green-600 mt-2">✓ Archivo subido</p>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700">
                  Crear Registro
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}