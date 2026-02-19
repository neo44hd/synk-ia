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
  Building2,
  Plus,
  FileText,
  Upload,
  Eye,
  Filter,
  AlertCircle,
  Lock,
  CheckCircle2
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function CompanyDocs() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [formData, setFormData] = useState({
    title: '',
    document_type: 'otros',
    category: 'legal',
    document_number: '',
    issue_date: '',
    expiry_date: '',
    issuing_authority: '',
    status: 'vigente',
    confidentiality: 'interno',
    notes: ''
  });

  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: documents = [] } = useQuery({
    queryKey: ['company-documents', filterCategory, filterType],
    queryFn: async () => {
      let all = await base44.entities.CompanyDocument.list('-created_date');
      if (filterCategory !== 'all') {
        all = all.filter(d => d.category === filterCategory);
      }
      if (filterType !== 'all') {
        all = all.filter(d => d.document_type === filterType);
      }
      return all;
    },
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.CompanyDocument.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-documents'] });
      toast.success('Documento registrado correctamente');
      setIsDialogOpen(false);
      resetForm();
    },
  });

  const resetForm = () => {
    setFormData({
      title: '',
      document_type: 'otros',
      category: 'legal',
      document_number: '',
      issue_date: '',
      expiry_date: '',
      issuing_authority: '',
      status: 'vigente',
      confidentiality: 'interno',
      notes: ''
    });
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFile(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFormData({
        ...formData,
        file_url,
        file_type: file.type.includes('pdf') ? 'PDF' :
                   file.type.includes('zip') ? 'ZIP' :
                   file.type.includes('doc') ? 'DOCX' : 'Otro'
      });
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

  const categoryColors = {
    legal: 'bg-blue-100 text-blue-800',
    mercantil: 'bg-green-100 text-green-800',
    administrativo: 'bg-purple-100 text-purple-800',
    operativo: 'bg-orange-100 text-orange-800',
    propiedad_intelectual: 'bg-pink-100 text-pink-800'
  };

  const confidentialityIcons = {
    publico: <Eye className="w-4 h-4" />,
    interno: <Building2 className="w-4 h-4" />,
    confidencial: <Lock className="w-4 h-4" />,
    secreto: <Lock className="w-4 h-4" />
  };

  const totalDocs = documents.length;
  const vigentes = documents.filter(d => d.status === 'vigente').length;
  const caducados = documents.filter(d => d.status === 'caducado').length;
  const confidenciales = documents.filter(d => d.confidentiality === 'confidencial' || d.confidentiality === 'secreto').length;

  return (
    <div className="p-4 md:p-8 min-h-screen bg-gradient-to-br from-zinc-950 via-neutral-900 to-zinc-950">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Building2 className="w-8 h-8 text-cyan-400" style={{ filter: 'drop-shadow(0 0 8px rgba(6, 182, 212, 0.8))' }} />
              <span className="text-cyan-400" style={{ textShadow: '0 0 15px rgba(6, 182, 212, 0.6)' }}>Documentación Corporativa</span>
            </h1>
            <p className="text-zinc-400 mt-1">
              Biblioteca digital de documentos legales y corporativos de la empresa
            </p>
          </div>
          <Button
            onClick={() => setIsDialogOpen(true)}
            className="bg-black border border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10"
            style={{ boxShadow: '0 0 15px rgba(6, 182, 212, 0.3)' }}
          >
            <Plus className="w-5 h-5 mr-2" />
            Nuevo Documento
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="border-none shadow-lg bg-zinc-800/50 border border-zinc-800">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <FileText className="w-5 h-5 text-cyan-400" />
                <p className="text-sm text-zinc-400">Total Documentos</p>
              </div>
              <p className="text-3xl font-bold text-white">{totalDocs}</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-lg bg-zinc-800/50 border border-zinc-800">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
                <p className="text-sm text-zinc-400">Vigentes</p>
              </div>
              <p className="text-3xl font-bold text-white">{vigentes}</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-lg bg-zinc-800/50 border border-zinc-800">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <AlertCircle className="w-5 h-5 text-orange-400" />
                <p className="text-sm text-zinc-400">Caducados</p>
              </div>
              <p className="text-3xl font-bold text-orange-400">{caducados}</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-lg bg-zinc-800/50 border border-zinc-800">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <Lock className="w-5 h-5 text-red-400" />
                <p className="text-sm text-zinc-400">Confidenciales</p>
              </div>
              <p className="text-3xl font-bold text-white">{confidenciales}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="space-y-4 mb-6">
          <div className="flex items-center gap-4 flex-wrap">
            <Filter className="w-5 h-5 text-gray-500" />
            <p className="text-sm font-medium text-gray-700">Categoría:</p>
            <div className="flex gap-2 flex-wrap">
              {['all', 'legal', 'mercantil', 'administrativo', 'operativo', 'propiedad_intelectual'].map((cat) => (
                <Button
                  key={cat}
                  variant={filterCategory === cat ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterCategory(cat)}
                  className={filterCategory === cat ? 'bg-slate-600' : ''}
                >
                  {cat === 'all' ? 'Todas' : cat.replace('_', ' ')}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <Filter className="w-5 h-5 text-gray-500" />
            <p className="text-sm font-medium text-gray-700">Tipo:</p>
            <div className="flex gap-2 flex-wrap">
              {['all', 'constitucion', 'estatutos', 'poderes', 'actas_junta', 'licencias', 'seguros', 'contratos_servicios'].map((type) => (
                <Button
                  key={type}
                  variant={filterType === type ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterType(type)}
                  className={filterType === type ? 'bg-slate-600' : ''}
                >
                  {type === 'all' ? 'Todos' : type.replace('_', ' ')}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Documents Grid */}
        {documents.length === 0 ? (
          <Card className="border-none shadow-lg">
            <CardContent className="p-12 text-center">
              <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">Sin documentos corporativos</h3>
              <p className="text-gray-600 mb-6">
                Comienza a digitalizar los documentos legales de tu empresa
              </p>
              <Button
                onClick={() => setIsDialogOpen(true)}
                className="bg-slate-600 hover:bg-slate-700"
              >
                Subir primer documento
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {documents.map((doc) => (
              <Card key={doc.id} className="border-none shadow-lg hover:shadow-xl transition-all">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${categoryColors[doc.category]?.replace('text-', 'bg-').replace('-800', '-200')}`}>
                        <FileText className="w-6 h-6" />
                      </div>
                      <CardTitle className="text-base line-clamp-2">{doc.title}</CardTitle>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3 flex-wrap">
                    <Badge className={categoryColors[doc.category]}>
                      {doc.category}
                    </Badge>
                    <Badge className={
                      doc.status === 'vigente' ? 'bg-green-100 text-green-800' :
                      doc.status === 'caducado' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }>
                      {doc.status}
                    </Badge>
                    {(doc.confidentiality === 'confidencial' || doc.confidentiality === 'secreto') && (
                      <Badge className="bg-red-100 text-red-800 flex items-center gap-1">
                        {confidentialityIcons[doc.confidentiality]}
                        {doc.confidentiality}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 capitalize mb-3">
                    {doc.document_type.replace('_', ' ')}
                  </p>
                  {doc.issue_date && (
                    <p className="text-xs text-gray-500 mb-2">
                      Emisión: {format(new Date(doc.issue_date), 'dd/MM/yyyy')}
                    </p>
                  )}
                  {doc.expiry_date && (
                    <p className="text-xs text-gray-500 mb-3">
                      Vence: {format(new Date(doc.expiry_date), 'dd/MM/yyyy')}
                    </p>
                  )}
                  {doc.file_url && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => window.open(doc.file_url, '_blank')}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      Ver documento
                    </Button>
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
              <DialogTitle>Nuevo Documento Corporativo</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="title">Título *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="document_type">Tipo de Documento *</Label>
                    <Select
                      value={formData.document_type}
                      onValueChange={(value) => setFormData({...formData, document_type: value})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="constitucion">Constitución</SelectItem>
                        <SelectItem value="estatutos">Estatutos</SelectItem>
                        <SelectItem value="poderes">Poderes</SelectItem>
                        <SelectItem value="actas_junta">Actas de Junta</SelectItem>
                        <SelectItem value="registro_mercantil">Registro Mercantil</SelectItem>
                        <SelectItem value="licencias">Licencias</SelectItem>
                        <SelectItem value="certificados">Certificados</SelectItem>
                        <SelectItem value="seguros">Seguros</SelectItem>
                        <SelectItem value="contratos_servicios">Contratos de Servicios</SelectItem>
                        <SelectItem value="politicas_internas">Políticas Internas</SelectItem>
                        <SelectItem value="marca_patente">Marca/Patente</SelectItem>
                        <SelectItem value="otros">Otros</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="category">Categoría *</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value) => setFormData({...formData, category: value})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="legal">Legal</SelectItem>
                        <SelectItem value="mercantil">Mercantil</SelectItem>
                        <SelectItem value="administrativo">Administrativo</SelectItem>
                        <SelectItem value="operativo">Operativo</SelectItem>
                        <SelectItem value="propiedad_intelectual">Propiedad Intelectual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="document_number">Número de Documento</Label>
                    <Input
                      id="document_number"
                      value={formData.document_number}
                      onChange={(e) => setFormData({...formData, document_number: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="issuing_authority">Autoridad Emisora</Label>
                    <Input
                      id="issuing_authority"
                      value={formData.issuing_authority}
                      onChange={(e) => setFormData({...formData, issuing_authority: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="issue_date">Fecha de Emisión</Label>
                    <Input
                      id="issue_date"
                      type="date"
                      value={formData.issue_date}
                      onChange={(e) => setFormData({...formData, issue_date: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="expiry_date">Fecha de Caducidad</Label>
                    <Input
                      id="expiry_date"
                      type="date"
                      value={formData.expiry_date}
                      onChange={(e) => setFormData({...formData, expiry_date: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="status">Estado</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value) => setFormData({...formData, status: value})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="vigente">Vigente</SelectItem>
                        <SelectItem value="caducado">Caducado</SelectItem>
                        <SelectItem value="renovado">Renovado</SelectItem>
                        <SelectItem value="archivado">Archivado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="confidentiality">Confidencialidad</Label>
                    <Select
                      value={formData.confidentiality}
                      onValueChange={(value) => setFormData({...formData, confidentiality: value})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="publico">Público</SelectItem>
                        <SelectItem value="interno">Interno</SelectItem>
                        <SelectItem value="confidencial">Confidencial</SelectItem>
                        <SelectItem value="secreto">Secreto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="notes">Notas</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    rows={3}
                  />
                </div>

                <div>
                  <Label htmlFor="file">Archivo Digital *</Label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx,.zip"
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
                    <p className="text-xs text-green-600 mt-2">✓ Archivo subido correctamente</p>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" className="bg-slate-600 hover:bg-slate-700">
                  Guardar Documento
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}