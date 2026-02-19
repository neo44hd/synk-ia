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
  FolderLock, 
  Upload,
  FileText,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Eye,
  Plus,
  Filter
} from "lucide-react";
import { toast } from "sonner";
import { format, isValid } from "date-fns";

export default function LegalVault() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [filterCategory, setFilterCategory] = useState('all');
  const [formData, setFormData] = useState({
    title: '',
    category: 'otros',
    file_url: '',
    file_type: '',
    expiry_date: '',
    status: 'vigente',
    tags: [],
    notes: ''
  });
  const fileInputRef = useRef(null);

  const queryClient = useQueryClient();

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['documents', filterCategory],
    queryFn: async () => {
      const allDocs = await base44.entities.Document.list('-created_date');
      if (filterCategory === 'all') return allDocs;
      return allDocs.filter(doc => doc.category === filterCategory);
    },
    initialData: [],
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Document.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast.success('Documento guardado correctamente');
      setIsDialogOpen(false);
      resetForm();
    },
  });

  const resetForm = () => {
    setFormData({
      title: '',
      category: 'otros',
      file_url: '',
      file_type: '',
      expiry_date: '',
      status: 'vigente',
      tags: [],
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
                   file.type.includes('doc') ? 'DOCX' : 'Otro',
        title: formData.title || file.name
      });
      toast.success('Archivo subido correctamente');
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

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return isValid(date) ? format(date, 'dd/MM/yyyy') : '';
  };

  const categoryColors = {
    PRL: 'bg-red-100 text-red-800',
    contratos: 'bg-blue-100 text-blue-800',
    inspecciones: 'bg-orange-100 text-orange-800',
    RGPD: 'bg-purple-100 text-purple-800',
    fiscal: 'bg-green-100 text-green-800',
    otros: 'bg-gray-100 text-gray-800'
  };

  const statusColors = {
    vigente: 'bg-green-100 text-green-800',
    vencido: 'bg-red-100 text-red-800',
    proximo_vencer: 'bg-yellow-100 text-yellow-800',
    revision: 'bg-blue-100 text-blue-800'
  };

  const categoryIcons = {
    PRL: Shield,
    contratos: FileText,
    inspecciones: AlertTriangle,
    RGPD: FolderLock,
    fiscal: CheckCircle2,
    otros: FileText
  };

  const vencidos = documents.filter(d => d.status === 'vencido').length;
  const proximosVencer = documents.filter(d => d.status === 'proximo_vencer').length;

  return (
    <div className="p-4 md:p-8 min-h-screen bg-gradient-to-br from-zinc-950 via-neutral-900 to-zinc-950">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <FolderLock className="w-8 h-8 text-cyan-400" style={{ filter: 'drop-shadow(0 0 8px rgba(6, 182, 212, 0.8))' }} />
              <span className="text-cyan-400" style={{ textShadow: '0 0 15px rgba(6, 182, 212, 0.6)' }}>LegalVault</span>
            </h1>
            <p className="text-zinc-400 mt-1">
              Gestión segura de documentos legales y de cumplimiento
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

        {(vencidos > 0 || proximosVencer > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {vencidos > 0 && (
              <Card className="border-red-800/50 bg-red-900/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-6 h-6 text-red-400" />
                    <div>
                      <p className="font-semibold text-red-300">
                        {vencidos} documento{vencidos > 1 ? 's' : ''} vencido{vencidos > 1 ? 's' : ''}
                      </p>
                      <p className="text-sm text-red-400">Requiere atención inmediata</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            {proximosVencer > 0 && (
              <Card className="border-yellow-800/50 bg-yellow-900/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-6 h-6 text-yellow-400" />
                    <div>
                      <p className="font-semibold text-yellow-300">
                        {proximosVencer} próximo{proximosVencer > 1 ? 's' : ''} a vencer
                      </p>
                      <p className="text-sm text-yellow-400">Planifica la renovación</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="border-zinc-800 bg-zinc-800/50">
            <CardContent className="p-4">
              <p className="text-sm text-zinc-400 mb-1">Total Documentos</p>
              <p className="text-2xl font-bold text-white">{documents.length}</p>
            </CardContent>
          </Card>
          <Card className="border-zinc-800 bg-zinc-800/50">
            <CardContent className="p-4">
              <p className="text-sm text-zinc-400 mb-1">PRL</p>
              <p className="text-2xl font-bold text-white">
                {documents.filter(d => d.category === 'PRL').length}
              </p>
            </CardContent>
          </Card>
          <Card className="border-zinc-800 bg-zinc-800/50">
            <CardContent className="p-4">
              <p className="text-sm text-zinc-400 mb-1">RGPD</p>
              <p className="text-2xl font-bold text-white">
                {documents.filter(d => d.category === 'RGPD').length}
              </p>
            </CardContent>
          </Card>
          <Card className="border-zinc-800 bg-zinc-800/50">
            <CardContent className="p-4">
              <p className="text-sm text-zinc-400 mb-1">Contratos</p>
              <p className="text-2xl font-bold text-white">
                {documents.filter(d => d.category === 'contratos').length}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center gap-4 mb-6">
          <Filter className="w-5 h-5 text-zinc-500" />
          <div className="flex gap-2 flex-wrap">
            {['all', 'PRL', 'RGPD', 'contratos', 'inspecciones', 'fiscal', 'otros'].map((cat) => (
              <Button
                key={cat}
                variant={filterCategory === cat ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterCategory(cat)}
                className={filterCategory === cat ? 'bg-rose-600 hover:bg-rose-700' : 'border-zinc-700 text-zinc-300 hover:bg-zinc-800'}
              >
                {cat === 'all' ? 'Todos' : cat}
              </Button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <Card className="border-zinc-800 bg-zinc-800/50">
            <CardContent className="p-12 text-center">
              <p className="text-zinc-400">Cargando documentos...</p>
            </CardContent>
          </Card>
        ) : documents.length === 0 ? (
          <Card className="border-zinc-800 bg-zinc-800/50">
            <CardContent className="p-12 text-center">
              <FolderLock className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">Bóveda vacía</h3>
              <p className="text-zinc-400 mb-6">
                Comienza a organizar tus documentos legales de forma segura
              </p>
              <Button
                onClick={() => setIsDialogOpen(true)}
                className="bg-rose-600 hover:bg-rose-700"
              >
                Subir primer documento
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {documents.map((doc) => {
              const CategoryIcon = categoryIcons[doc.category] || FileText;
              return (
                <Card key={doc.id} className="border-zinc-800 bg-zinc-800/50 hover:bg-zinc-800 transition-all">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                          categoryColors[doc.category]?.replace('text-', 'bg-').replace('-800', '-200')
                        }`}>
                          <CategoryIcon className={`w-6 h-6 ${categoryColors[doc.category]?.split(' ')[1]}`} />
                        </div>
                        <div className="flex-1">
                          <CardTitle className="text-base line-clamp-2 text-white">{doc.title}</CardTitle>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3 flex-wrap">
                      <Badge className={categoryColors[doc.category]}>
                        {doc.category}
                      </Badge>
                      <Badge className={statusColors[doc.status]}>
                        {doc.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {doc.expiry_date && (
                      <p className="text-sm text-zinc-400 mb-3">
                        Vence: {formatDate(doc.expiry_date)}
                      </p>
                    )}
                    {doc.file_url && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full border-zinc-700 text-zinc-300 hover:bg-zinc-700"
                        onClick={() => window.open(doc.file_url, '_blank')}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Ver documento
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-zinc-900 border-zinc-800 text-white">
            <DialogHeader>
              <DialogTitle className="text-white">Nuevo Documento</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="title" className="text-zinc-300">Título *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    required
                    className="bg-zinc-800 border-zinc-700 text-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="category" className="text-zinc-300">Categoría *</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value) => setFormData({...formData, category: value})}
                    >
                      <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-800 border-zinc-700">
                        <SelectItem value="PRL">PRL</SelectItem>
                        <SelectItem value="contratos">Contratos</SelectItem>
                        <SelectItem value="inspecciones">Inspecciones</SelectItem>
                        <SelectItem value="RGPD">RGPD</SelectItem>
                        <SelectItem value="fiscal">Fiscal</SelectItem>
                        <SelectItem value="otros">Otros</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="status" className="text-zinc-300">Estado</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value) => setFormData({...formData, status: value})}
                    >
                      <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-800 border-zinc-700">
                        <SelectItem value="vigente">Vigente</SelectItem>
                        <SelectItem value="proximo_vencer">Próximo a vencer</SelectItem>
                        <SelectItem value="vencido">Vencido</SelectItem>
                        <SelectItem value="revision">En revisión</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="expiry_date" className="text-zinc-300">Fecha de vencimiento</Label>
                  <Input
                    id="expiry_date"
                    type="date"
                    value={formData.expiry_date}
                    onChange={(e) => setFormData({...formData, expiry_date: e.target.value})}
                    className="bg-zinc-800 border-zinc-700 text-white"
                  />
                </div>
                <div>
                  <Label htmlFor="file" className="text-zinc-300">Archivo</Label>
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
                    className="w-full border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {uploadingFile ? 'Subiendo...' : formData.file_url ? 'Cambiar archivo' : 'Subir archivo'}
                  </Button>
                  {formData.file_url && (
                    <p className="text-xs text-green-400 mt-2">✓ Archivo subido correctamente</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="notes" className="text-zinc-300">Notas</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    rows={3}
                    className="bg-zinc-800 border-zinc-700 text-white"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
                  Cancelar
                </Button>
                <Button type="submit" className="bg-rose-600 hover:bg-rose-700">
                  Guardar
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}