import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Building2, 
  Plus, 
  Edit, 
  Trash2,
  TrendingUp,
  DollarSign,
  FileText,
  Star,
  Phone,
  Mail,
  MapPin,
  Search,
  Filter,
  Download,
  ArrowLeft,
  Eye,
  Calendar,
  Package,
  AlertCircle,
  CheckCircle,
  XCircle,
  MoreVertical,
  ExternalLink
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { format, isValid, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { exportService } from "@/services/exportService";

const CATEGORIES = [
  { value: 'alimentacion', label: 'Alimentación' },
  { value: 'bebidas', label: 'Bebidas' },
  { value: 'suministros', label: 'Suministros' },
  { value: 'servicios', label: 'Servicios' },
  { value: 'mantenimiento', label: 'Mantenimiento' },
  { value: 'limpieza', label: 'Limpieza' },
  { value: 'tecnologia', label: 'Tecnología' },
  { value: 'otros', label: 'Otros' }
];

export default function ProvidersComplete() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState(null);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    cif: '',
    email: '',
    phone: '',
    address: '',
    category: 'suministros',
    rating: 3,
    status: 'activo',
    notes: '',
    contact_person: '',
    website: '',
    payment_terms: '30',
    iban: ''
  });

  const queryClient = useQueryClient();

  const { data: providers = [], isLoading } = useQuery({
    queryKey: ['providers-complete'],
    queryFn: () => base44.entities.Provider.list('-created_date', 200),
    staleTime: 60000
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['provider-invoices'],
    queryFn: () => base44.entities.Invoice.list('-created_date', 1000),
    staleTime: 30000
  });

  const { data: documents = [] } = useQuery({
    queryKey: ['provider-documents'],
    queryFn: async () => {
      try {
        return await base44.entities.Document.list('-created_date', 500);
      } catch {
        return [];
      }
    },
    staleTime: 60000
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Provider.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['providers-complete'] });
      toast.success('Proveedor creado correctamente');
      handleCloseDialog();
    },
    onError: () => toast.error('Error al crear proveedor')
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Provider.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['providers-complete'] });
      toast.success('Proveedor actualizado');
      handleCloseDialog();
    },
    onError: () => toast.error('Error al actualizar')
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Provider.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['providers-complete'] });
      toast.success('Proveedor eliminado');
      setDeleteConfirm(null);
      if (selectedProvider?.id === deleteConfirm) {
        setSelectedProvider(null);
      }
    },
    onError: () => toast.error('Error al eliminar')
  });

  // Calcular estadísticas por proveedor
  const getProviderStats = (provider) => {
    const provInvoices = invoices.filter(inv => 
      inv.provider_name === provider.name || inv.provider_id === provider.id
    );
    
    const total = provInvoices.reduce((sum, inv) => sum + (inv.total_amount || inv.total || 0), 0);
    const pending = provInvoices.filter(inv => inv.status === 'pendiente');
    const pendingAmount = pending.reduce((sum, inv) => sum + (inv.total_amount || inv.total || 0), 0);
    
    // Gastos por mes (últimos 6 meses)
    const monthlyExpenses = [];
    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(new Date(), i);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);
      
      const monthTotal = provInvoices
        .filter(inv => {
          const d = new Date(inv.date || inv.created_date);
          return d >= monthStart && d <= monthEnd;
        })
        .reduce((sum, inv) => sum + (inv.total_amount || inv.total || 0), 0);
      
      monthlyExpenses.push({
        month: format(monthDate, 'MMM', { locale: es }),
        total: monthTotal
      });
    }
    
    return {
      invoices: provInvoices,
      totalSpent: total,
      invoiceCount: provInvoices.length,
      pendingCount: pending.length,
      pendingAmount,
      monthlyExpenses
    };
  };

  // Filtrar proveedores
  const filteredProviders = providers.filter(p => {
    const matchesSearch = p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         p.cif?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === 'all' || p.category === filterCategory;
    const matchesStatus = filterStatus === 'all' || p.status === filterStatus;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const handleOpenDialog = (provider = null) => {
    if (provider) {
      setEditingProvider(provider);
      setFormData({
        name: provider.name || '',
        cif: provider.cif || '',
        email: provider.email || '',
        phone: provider.phone || '',
        address: provider.address || '',
        category: provider.category || 'suministros',
        rating: provider.rating || 3,
        status: provider.status || 'activo',
        notes: provider.notes || '',
        contact_person: provider.contact_person || '',
        website: provider.website || '',
        payment_terms: provider.payment_terms || '30',
        iban: provider.iban || ''
      });
    } else {
      setEditingProvider(null);
      setFormData({
        name: '', cif: '', email: '', phone: '', address: '',
        category: 'suministros', rating: 3, status: 'activo', notes: '',
        contact_person: '', website: '', payment_terms: '30', iban: ''
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingProvider(null);
  };

  const handleSubmit = () => {
    if (!formData.name) {
      toast.error('El nombre es obligatorio');
      return;
    }
    
    if (editingProvider) {
      updateMutation.mutate({ id: editingProvider.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleExport = () => {
    const result = exportService.exportProviderList(providers, invoices);
    toast.success(`Exportados ${result.exported} proveedores`);
  };

  // Vista detallada de proveedor
  if (selectedProvider) {
    const stats = getProviderStats(selectedProvider);
    const providerDocs = documents.filter(d => 
      d.provider_id === selectedProvider.id || 
      d.provider_name === selectedProvider.name
    );

    return (
      <div className="p-4 md:p-8 min-h-screen bg-gradient-to-br from-zinc-950 via-neutral-900 to-zinc-950">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              onClick={() => setSelectedProvider(null)}
              className="text-zinc-400 hover:text-white"
            >
              <ArrowLeft className="w-5 h-5 mr-2" /> Volver
            </Button>
          </div>

          {/* Info principal */}
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 bg-cyan-500/20 rounded-xl flex items-center justify-center">
                    <Building2 className="w-8 h-8 text-cyan-400" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-white">{selectedProvider.name}</h1>
                    <p className="text-zinc-400">{selectedProvider.cif || 'Sin CIF'}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge className={`${selectedProvider.status === 'activo' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'} border-0`}>
                        {selectedProvider.status || 'activo'}
                      </Badge>
                      <Badge className="bg-zinc-700 text-zinc-300 border-0">
                        {CATEGORIES.find(c => c.value === selectedProvider.category)?.label || 'Sin categoría'}
                      </Badge>
                      <div className="flex items-center">
                        {[1,2,3,4,5].map(i => (
                          <Star key={i} className={`w-4 h-4 ${i <= (selectedProvider.rating || 3) ? 'text-amber-400 fill-amber-400' : 'text-zinc-600'}`} />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button onClick={() => handleOpenDialog(selectedProvider)} className="bg-cyan-600 hover:bg-cyan-700">
                    <Edit className="w-4 h-4 mr-2" /> Editar
                  </Button>
                  <Button variant="outline" onClick={handleExport} className="border-zinc-700 text-zinc-300">
                    <Download className="w-4 h-4 mr-2" /> Exportar
                  </Button>
                </div>
              </div>

              {/* Contacto */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-zinc-800">
                {selectedProvider.email && (
                  <div className="flex items-center gap-2 text-zinc-400">
                    <Mail className="w-4 h-4" />
                    <a href={`mailto:${selectedProvider.email}`} className="hover:text-cyan-400">{selectedProvider.email}</a>
                  </div>
                )}
                {selectedProvider.phone && (
                  <div className="flex items-center gap-2 text-zinc-400">
                    <Phone className="w-4 h-4" />
                    <a href={`tel:${selectedProvider.phone}`} className="hover:text-cyan-400">{selectedProvider.phone}</a>
                  </div>
                )}
                {selectedProvider.address && (
                  <div className="flex items-center gap-2 text-zinc-400">
                    <MapPin className="w-4 h-4" />
                    <span>{selectedProvider.address}</span>
                  </div>
                )}
                {selectedProvider.website && (
                  <div className="flex items-center gap-2 text-zinc-400">
                    <ExternalLink className="w-4 h-4" />
                    <a href={selectedProvider.website} target="_blank" rel="noopener noreferrer" className="hover:text-cyan-400">
                      Web
                    </a>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardContent className="p-4">
                <p className="text-zinc-500 text-sm">Total Gastado</p>
                <p className="text-2xl font-bold text-white">{stats.totalSpent.toLocaleString()}€</p>
              </CardContent>
            </Card>
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardContent className="p-4">
                <p className="text-zinc-500 text-sm">Nº Facturas</p>
                <p className="text-2xl font-bold text-white">{stats.invoiceCount}</p>
              </CardContent>
            </Card>
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardContent className="p-4">
                <p className="text-zinc-500 text-sm">Pendiente Pago</p>
                <p className="text-2xl font-bold text-amber-400">{stats.pendingAmount.toLocaleString()}€</p>
              </CardContent>
            </Card>
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardContent className="p-4">
                <p className="text-zinc-500 text-sm">Facturas Pendientes</p>
                <p className="text-2xl font-bold text-white">{stats.pendingCount}</p>
              </CardContent>
            </Card>
          </div>

          {/* Gráfico y Facturas */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Gráfico evolución */}
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-cyan-400" />
                  Evolución de Gastos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stats.monthlyExpenses}>
                      <defs>
                        <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="month" stroke="#9ca3af" />
                      <YAxis stroke="#9ca3af" />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '8px' }}
                        formatter={(value) => [`${value.toLocaleString()}€`, 'Gasto']}
                      />
                      <Area type="monotone" dataKey="total" stroke="#06b6d4" fillOpacity={1} fill="url(#colorTotal)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Notas */}
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-cyan-400" />
                  Notas y Observaciones
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {selectedProvider.contact_person && (
                    <div>
                      <p className="text-zinc-500 text-sm">Persona de contacto</p>
                      <p className="text-white">{selectedProvider.contact_person}</p>
                    </div>
                  )}
                  {selectedProvider.payment_terms && (
                    <div>
                      <p className="text-zinc-500 text-sm">Condiciones de pago</p>
                      <p className="text-white">{selectedProvider.payment_terms} días</p>
                    </div>
                  )}
                  {selectedProvider.iban && (
                    <div>
                      <p className="text-zinc-500 text-sm">IBAN</p>
                      <p className="text-white font-mono text-sm">{selectedProvider.iban}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-zinc-500 text-sm">Notas</p>
                    <p className="text-zinc-300">{selectedProvider.notes || 'Sin notas'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabs: Facturas y Documentos */}
          <Card className="bg-zinc-900/50 border-zinc-800">
            <Tabs defaultValue="invoices" className="w-full">
              <CardHeader>
                <TabsList className="bg-zinc-800">
                  <TabsTrigger value="invoices" className="data-[state=active]:bg-cyan-600">
                    Facturas ({stats.invoiceCount})
                  </TabsTrigger>
                  <TabsTrigger value="documents" className="data-[state=active]:bg-cyan-600">
                    Documentos ({providerDocs.length})
                  </TabsTrigger>
                </TabsList>
              </CardHeader>
              <CardContent>
                <TabsContent value="invoices">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-zinc-800">
                        <TableHead className="text-zinc-400">Nº Factura</TableHead>
                        <TableHead className="text-zinc-400">Fecha</TableHead>
                        <TableHead className="text-zinc-400">Concepto</TableHead>
                        <TableHead className="text-zinc-400 text-right">Importe</TableHead>
                        <TableHead className="text-zinc-400">Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stats.invoices.slice(0, 10).map((inv) => (
                        <TableRow key={inv.id} className="border-zinc-800">
                          <TableCell className="text-white font-mono">{inv.number || inv.invoice_number || '-'}</TableCell>
                          <TableCell className="text-zinc-400">
                            {inv.date ? format(new Date(inv.date), 'dd/MM/yyyy') : '-'}
                          </TableCell>
                          <TableCell className="text-zinc-300">{inv.concept || inv.description || '-'}</TableCell>
                          <TableCell className="text-white text-right font-semibold">
                            {(inv.total_amount || inv.total || 0).toLocaleString()}€
                          </TableCell>
                          <TableCell>
                            <Badge className={`${
                              inv.status === 'pagada' ? 'bg-emerald-500/20 text-emerald-400' :
                              inv.status === 'pendiente' ? 'bg-amber-500/20 text-amber-400' :
                              'bg-zinc-500/20 text-zinc-400'
                            } border-0`}>
                              {inv.status || 'pendiente'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {stats.invoices.length > 10 && (
                    <p className="text-zinc-500 text-sm mt-4 text-center">
                      Mostrando 10 de {stats.invoices.length} facturas
                    </p>
                  )}
                </TabsContent>
                
                <TabsContent value="documents">
                  {providerDocs.length === 0 ? (
                    <div className="text-center py-8 text-zinc-500">
                      <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>No hay documentos asociados</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {providerDocs.map((doc) => (
                        <div key={doc.id} className="p-4 bg-zinc-800/50 rounded-lg flex items-center gap-4">
                          <FileText className="w-8 h-8 text-cyan-400" />
                          <div className="flex-1">
                            <p className="text-white font-medium">{doc.name || 'Documento'}</p>
                            <p className="text-zinc-500 text-sm">{doc.type || 'Archivo'}</p>
                          </div>
                          {doc.file_url && (
                            <Button variant="ghost" size="sm" asChild>
                              <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                                <Eye className="w-4 h-4" />
                              </a>
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </CardContent>
            </Tabs>
          </Card>
        </div>
      </div>
    );
  }

  // Vista lista de proveedores
  return (
    <div className="p-4 md:p-8 min-h-screen bg-gradient-to-br from-zinc-950 via-neutral-900 to-zinc-950">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Building2 className="w-8 h-8 text-cyan-400" style={{ filter: 'drop-shadow(0 0 8px rgba(6, 182, 212, 0.8))' }} />
              <span className="text-cyan-400" style={{ textShadow: '0 0 15px rgba(6, 182, 212, 0.6)' }}>
                Proveedores
              </span>
            </h1>
            <p className="text-zinc-400 mt-1">Gestión completa de proveedores</p>
          </div>
          
          <div className="flex gap-2">
            <Button onClick={handleExport} variant="outline" className="border-zinc-700 text-zinc-300">
              <Download className="w-4 h-4 mr-2" /> Exportar
            </Button>
            <Button onClick={() => handleOpenDialog()} className="bg-cyan-600 hover:bg-cyan-700">
              <Plus className="w-4 h-4 mr-2" /> Nuevo Proveedor
            </Button>
          </div>
        </div>

        {/* Filtros */}
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <Input
                  placeholder="Buscar por nombre o CIF..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-zinc-800 border-zinc-700 text-white"
                />
              </div>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-48 bg-zinc-800 border-zinc-700 text-white">
                  <SelectValue placeholder="Categoría" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  <SelectItem value="all">Todas las categorías</SelectItem>
                  {CATEGORIES.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-40 bg-zinc-800 border-zinc-700 text-white">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="activo">Activos</SelectItem>
                  <SelectItem value="inactivo">Inactivos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Lista de proveedores */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProviders.map((provider) => {
            const stats = getProviderStats(provider);
            return (
              <Card 
                key={provider.id} 
                className="bg-zinc-900/50 border-zinc-800 hover:border-cyan-500/30 transition-all cursor-pointer"
                onClick={() => setSelectedProvider(provider)}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-cyan-500/20 rounded-lg flex items-center justify-center">
                        <Building2 className="w-6 h-6 text-cyan-400" />
                      </div>
                      <div>
                        <h3 className="text-white font-semibold">{provider.name}</h3>
                        <p className="text-zinc-500 text-sm">{provider.cif || 'Sin CIF'}</p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" className="text-zinc-400">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="bg-zinc-800 border-zinc-700">
                        <DropdownMenuItem 
                          onClick={(e) => { e.stopPropagation(); handleOpenDialog(provider); }}
                          className="text-zinc-300 hover:text-white cursor-pointer"
                        >
                          <Edit className="w-4 h-4 mr-2" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={(e) => { e.stopPropagation(); setDeleteConfirm(provider.id); }}
                          className="text-red-400 hover:text-red-300 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4 mr-2" /> Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  
                  <div className="flex items-center gap-2 mt-3">
                    <Badge className={`${provider.status === 'activo' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'} border-0`}>
                      {provider.status || 'activo'}
                    </Badge>
                    <Badge className="bg-zinc-700 text-zinc-300 border-0">
                      {CATEGORIES.find(c => c.value === provider.category)?.label || 'Otros'}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-zinc-800">
                    <div>
                      <p className="text-zinc-500 text-xs">Total gastado</p>
                      <p className="text-white font-semibold">{stats.totalSpent.toLocaleString()}€</p>
                    </div>
                    <div>
                      <p className="text-zinc-500 text-xs">Facturas</p>
                      <p className="text-white font-semibold">{stats.invoiceCount}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-800">
                    <div className="flex items-center">
                      {[1,2,3,4,5].map(i => (
                        <Star key={i} className={`w-3 h-3 ${i <= (provider.rating || 3) ? 'text-amber-400 fill-amber-400' : 'text-zinc-600'}`} />
                      ))}
                    </div>
                    {stats.pendingCount > 0 && (
                      <Badge className="bg-amber-500/20 text-amber-400 border-0">
                        {stats.pendingCount} pendiente{stats.pendingCount > 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {filteredProviders.length === 0 && (
          <div className="text-center py-12">
            <Building2 className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
            <p className="text-zinc-500">No se encontraron proveedores</p>
          </div>
        )}
      </div>

      {/* Dialog crear/editar */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingProvider ? 'Editar Proveedor' : 'Nuevo Proveedor'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-zinc-400">Nombre *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="bg-zinc-800 border-zinc-700 text-white"
                placeholder="Nombre del proveedor"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-400">CIF/NIF</Label>
              <Input
                value={formData.cif}
                onChange={(e) => setFormData({...formData, cif: e.target.value})}
                className="bg-zinc-800 border-zinc-700 text-white"
                placeholder="B12345678"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-400">Email</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-400">Teléfono</Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label className="text-zinc-400">Dirección</Label>
              <Input
                value={formData.address}
                onChange={(e) => setFormData({...formData, address: e.target.value})}
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-400">Persona de contacto</Label>
              <Input
                value={formData.contact_person}
                onChange={(e) => setFormData({...formData, contact_person: e.target.value})}
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-400">Web</Label>
              <Input
                value={formData.website}
                onChange={(e) => setFormData({...formData, website: e.target.value})}
                className="bg-zinc-800 border-zinc-700 text-white"
                placeholder="https://"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-400">Categoría</Label>
              <Select value={formData.category} onValueChange={(v) => setFormData({...formData, category: v})}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  {CATEGORIES.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-400">Estado</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({...formData, status: v})}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  <SelectItem value="activo">Activo</SelectItem>
                  <SelectItem value="inactivo">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-400">Condiciones pago (días)</Label>
              <Input
                value={formData.payment_terms}
                onChange={(e) => setFormData({...formData, payment_terms: e.target.value})}
                className="bg-zinc-800 border-zinc-700 text-white"
                placeholder="30"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-400">IBAN</Label>
              <Input
                value={formData.iban}
                onChange={(e) => setFormData({...formData, iban: e.target.value})}
                className="bg-zinc-800 border-zinc-700 text-white font-mono"
                placeholder="ES00 0000 0000 0000 0000"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-400">Valoración</Label>
              <div className="flex gap-1">
                {[1,2,3,4,5].map(i => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setFormData({...formData, rating: i})}
                    className="p-1"
                  >
                    <Star className={`w-6 h-6 ${i <= formData.rating ? 'text-amber-400 fill-amber-400' : 'text-zinc-600'}`} />
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label className="text-zinc-400">Notas</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                className="bg-zinc-800 border-zinc-700 text-white"
                rows={3}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="ghost" onClick={handleCloseDialog} className="text-zinc-400">
              Cancelar
            </Button>
            <Button onClick={handleSubmit} className="bg-cyan-600 hover:bg-cyan-700">
              {editingProvider ? 'Guardar Cambios' : 'Crear Proveedor'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog confirmar eliminar */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-white">¿Eliminar proveedor?</DialogTitle>
          </DialogHeader>
          <p className="text-zinc-400">
            Esta acción no se puede deshacer. Se eliminarán los datos del proveedor pero no las facturas asociadas.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteConfirm(null)} className="text-zinc-400">
              Cancelar
            </Button>
            <Button 
              onClick={() => deleteMutation.mutate(deleteConfirm)} 
              className="bg-red-600 hover:bg-red-700"
            >
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
