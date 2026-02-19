import React, { useState } from "react";
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
  Users, 
  Plus, 
  Edit, 
  TrendingUp,
  TrendingDown,
  DollarSign,
  FileText,
  Star,
  Phone,
  Mail,
  MapPin,
  Building2,
  Search,
  Filter,
  Calendar
} from "lucide-react";
import { toast } from "sonner";
import { format, isValid } from "date-fns";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function Providers() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState(null);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
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
    logo_url: ''
  });

  const queryClient = useQueryClient();

  const { data: providers = [], isLoading } = useQuery({
    queryKey: ['providers'],
    queryFn: () => base44.entities.Provider.list('-created_date', 200),
    initialData: [],
    staleTime: 60000,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => base44.entities.Invoice.list('-created_date', 500),
    initialData: [],
    staleTime: 30000,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Provider.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['providers'] });
      toast.success('Proveedor creado correctamente');
      handleCloseDialog();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Provider.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['providers'] });
      toast.success('Proveedor actualizado correctamente');
      handleCloseDialog();
    },
  });

  // Calcular estadísticas por proveedor
  const providerStats = providers.map(provider => {
    const providerInvoices = invoices.filter(inv => inv.provider_name === provider.name);
    const total = providerInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
    const pending = providerInvoices.filter(inv => inv.status === 'pendiente').reduce((sum, inv) => sum + (inv.total || 0), 0);
    
    // Calcular tendencia (últimos 3 meses vs anteriores)
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    
    const recentInvoices = providerInvoices.filter(inv => 
      inv.invoice_date && new Date(inv.invoice_date) > threeMonthsAgo
    );
    const recentTotal = recentInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
    const oldTotal = total - recentTotal;
    const trend = oldTotal > 0 ? ((recentTotal - oldTotal) / oldTotal * 100) : 0;

    return {
      ...provider,
      invoiceCount: providerInvoices.length,
      totalSpent: total,
      pendingAmount: pending,
      lastInvoiceDate: providerInvoices[0]?.invoice_date || null,
      trend: trend,
      invoices: providerInvoices
    };
  });

  // Filtrar proveedores
  const filteredProviders = providerStats
    .filter(p => {
      const matchesSearch = !searchQuery || 
        p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.cif?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = filterCategory === 'all' || p.category === filterCategory;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => b.totalSpent - a.totalSpent);

  // Datos para gráficos del proveedor seleccionado
  const getProviderChartData = (providerInvoices) => {
    const monthlyData = providerInvoices.reduce((acc, invoice) => {
      if (invoice.invoice_date) {
        const date = new Date(invoice.invoice_date);
        if (isValid(date)) {
          const month = format(date, 'MMM yyyy');
          if (!acc[month]) {
            acc[month] = { month, total: 0, count: 0 };
          }
          acc[month].total += invoice.total || 0;
          acc[month].count += 1;
        }
      }
      return acc;
    }, {});
    return Object.values(monthlyData).slice(-6);
  };

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
        logo_url: provider.logo_url || ''
      });
    } else {
      setEditingProvider(null);
      setFormData({
        name: '',
        cif: '',
        email: '',
        phone: '',
        address: '',
        category: 'suministros',
        rating: 3,
        status: 'activo',
        notes: ''
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingProvider(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingProvider) {
      updateMutation.mutate({ id: editingProvider.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const categoryColors = {
    suministros: 'bg-blue-100 text-blue-800',
    servicios: 'bg-green-100 text-green-800',
    materiales: 'bg-orange-100 text-orange-800',
    tecnologia: 'bg-purple-100 text-purple-800',
    otros: 'bg-gray-100 text-gray-800'
  };

  const totalSpent = providerStats.reduce((sum, p) => sum + p.totalSpent, 0);
  const totalPending = providerStats.reduce((sum, p) => sum + p.pendingAmount, 0);

  return (
    <div className="p-4 md:p-8 min-h-screen bg-gradient-to-br from-zinc-950 via-neutral-900 to-zinc-950">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Building2 className="w-8 h-8 text-cyan-400" style={{ filter: 'drop-shadow(0 0 8px rgba(6, 182, 212, 0.8))' }} />
              <span className="text-cyan-400" style={{ textShadow: '0 0 15px rgba(6, 182, 212, 0.6)' }}>Proveedores</span>
            </h1>
            <p className="text-zinc-400 mt-1">
              Gestión y análisis completo de proveedores
            </p>
          </div>
          <Button
            onClick={() => handleOpenDialog()}
            className="bg-black border border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10"
            style={{ boxShadow: '0 0 15px rgba(6, 182, 212, 0.3)' }}
          >
            <Plus className="w-5 h-5 mr-2" />
            Nuevo Proveedor
          </Button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="border-none shadow-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Users className="w-8 h-8 opacity-80" />
              </div>
              <p className="text-sm opacity-90 mb-1">Total Proveedores</p>
              <p className="text-3xl font-bold">{providers.length}</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-lg bg-gradient-to-br from-green-500 to-green-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <DollarSign className="w-8 h-8 opacity-80" />
              </div>
              <p className="text-sm opacity-90 mb-1">Gasto Total</p>
              <p className="text-3xl font-bold">{totalSpent.toFixed(0)}€</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-lg bg-gradient-to-br from-orange-500 to-orange-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <FileText className="w-8 h-8 opacity-80" />
              </div>
              <p className="text-sm opacity-90 mb-1">Pendiente</p>
              <p className="text-3xl font-bold">{totalPending.toFixed(0)}€</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-lg bg-gradient-to-br from-purple-500 to-purple-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <FileText className="w-8 h-8 opacity-80" />
              </div>
              <p className="text-sm opacity-90 mb-1">Total Facturas</p>
              <p className="text-3xl font-bold">{invoices.length}</p>
            </CardContent>
          </Card>
        </div>

        {/* Búsqueda y Filtros */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-500 w-5 h-5" />
              <Input
                placeholder="Buscar por nombre o CIF..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Filter className="w-5 h-5 text-zinc-500 mt-2" />
            {['all', 'suministros', 'servicios', 'materiales', 'tecnologia', 'otros'].map((cat) => (
              <Button
                key={cat}
                variant={filterCategory === cat ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterCategory(cat)}
                className={filterCategory === cat ? 'bg-blue-600' : 'border-zinc-700 text-zinc-300 hover:bg-zinc-800'}
              >
                {cat === 'all' ? 'Todos' : cat.charAt(0).toUpperCase() + cat.slice(1)}
              </Button>
            ))}
          </div>
        </div>

        {/* Lista de Proveedores */}
        {isLoading ? (
          <Card className="border-none shadow-lg bg-zinc-800/50 border border-zinc-800">
            <CardContent className="p-12 text-center">
              <p className="text-zinc-400">Cargando proveedores...</p>
            </CardContent>
          </Card>
        ) : filteredProviders.length === 0 ? (
          <Card className="border-none shadow-lg bg-zinc-800/50 border border-zinc-800">
            <CardContent className="p-12 text-center">
              <Users className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">No hay proveedores</h3>
              <p className="text-zinc-400 mb-6">
                Comienza agregando tu primer proveedor
              </p>
              <Button
                onClick={() => handleOpenDialog()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Agregar proveedor
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredProviders.map((provider) => (
              <Card key={provider.id} className="border-none shadow-lg bg-zinc-800/50 border border-zinc-800 hover:bg-zinc-800 transition-all cursor-pointer" onClick={() => setSelectedProvider(provider)}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4 flex-1">
                      {provider.logo_url ? (
                        <div className="w-14 h-14 bg-white border-2 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden">
                          <img src={provider.logo_url} alt={provider.name} className="w-full h-full object-contain p-1" />
                        </div>
                      ) : (
                        <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center flex-shrink-0">
                          <Building2 className="w-7 h-7 text-white" />
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <CardTitle className="text-xl text-white">{provider.name}</CardTitle>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenDialog(provider);
                            }}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-2 mb-3">
                          <Badge className={categoryColors[provider.category]}>
                            {provider.category}
                          </Badge>
                          <Badge variant="outline" className="flex items-center gap-1">
                            <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                            {provider.rating}/5
                          </Badge>
                          {provider.trend !== 0 && (
                            <Badge className={provider.trend > 0 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}>
                              {provider.trend > 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                              {Math.abs(provider.trend).toFixed(0)}%
                            </Badge>
                          )}
                        </div>
                        {provider.email && (
                          <div className="flex items-center gap-2 text-sm text-zinc-400 mb-1">
                            <Mail className="w-3 h-3" />
                            {provider.email}
                          </div>
                        )}
                        {provider.phone && (
                          <div className="flex items-center gap-2 text-sm text-zinc-400">
                            <Phone className="w-3 h-3" />
                            {provider.phone}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="bg-blue-900/30 border border-blue-600/30 rounded-lg p-3">
                      <p className="text-xs text-zinc-400 mb-1">Facturas</p>
                      <p className="text-xl font-bold text-blue-400">{provider.invoiceCount}</p>
                    </div>
                    <div className="bg-green-900/30 border border-green-600/30 rounded-lg p-3">
                      <p className="text-xs text-zinc-400 mb-1">Total</p>
                      <p className="text-xl font-bold text-green-400">{provider.totalSpent.toFixed(0)}€</p>
                    </div>
                    <div className="bg-orange-900/30 border border-orange-600/30 rounded-lg p-3">
                      <p className="text-xs text-zinc-400 mb-1">Pendiente</p>
                      <p className="text-xl font-bold text-orange-400">{provider.pendingAmount.toFixed(0)}€</p>
                    </div>
                  </div>
                  {provider.lastInvoiceDate && (
                    <div className="mt-3 pt-3 border-t border-zinc-700 text-sm text-zinc-400 flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Última factura: {format(new Date(provider.lastInvoiceDate), 'dd/MM/yyyy')}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Dialog: Detalle del Proveedor */}
        <Dialog open={!!selectedProvider} onOpenChange={() => setSelectedProvider(null)}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto bg-zinc-900 border-zinc-800 text-white">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3 text-2xl text-white">
                <Building2 className="w-8 h-8 text-blue-400" />
                {selectedProvider?.name}
              </DialogTitle>
            </DialogHeader>
            {selectedProvider && (
              <div className="space-y-6">
                {/* Info General */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-blue-900/30 border border-blue-600/30 rounded-lg p-4">
                    <p className="text-sm text-zinc-400 mb-1">Total Facturas</p>
                    <p className="text-2xl font-bold text-blue-400">{selectedProvider.invoiceCount}</p>
                  </div>
                  <div className="bg-green-900/30 border border-green-600/30 rounded-lg p-4">
                    <p className="text-sm text-zinc-400 mb-1">Gasto Total</p>
                    <p className="text-2xl font-bold text-green-400">{selectedProvider.totalSpent.toFixed(2)}€</p>
                  </div>
                  <div className="bg-orange-900/30 border border-orange-600/30 rounded-lg p-4">
                    <p className="text-sm text-zinc-400 mb-1">Pendiente</p>
                    <p className="text-2xl font-bold text-orange-400">{selectedProvider.pendingAmount.toFixed(2)}€</p>
                  </div>
                  <div className="bg-purple-900/30 border border-purple-600/30 rounded-lg p-4">
                    <p className="text-sm text-zinc-400 mb-1">Promedio</p>
                    <p className="text-2xl font-bold text-purple-400">
                      {selectedProvider.invoiceCount > 0 ? (selectedProvider.totalSpent / selectedProvider.invoiceCount).toFixed(2) : 0}€
                    </p>
                  </div>
                </div>

                {/* Gráfico de Tendencia */}
                {selectedProvider.invoices.length > 0 && (
                  <Card className="border-none shadow-lg bg-zinc-800/50 border border-zinc-800">
                    <CardHeader>
                      <CardTitle className="text-white">Histórico de Gastos</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={250}>
                        <LineChart data={getProviderChartData(selectedProvider.invoices)}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="month" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Line type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2} name="Total €" />
                          <Line type="monotone" dataKey="count" stroke="#10b981" strokeWidth={2} name="Nº Facturas" />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}

                {/* Lista de Facturas */}
                <Card className="border-none shadow-lg bg-zinc-800/50 border border-zinc-800">
                  <CardHeader>
                    <CardTitle className="text-white">Facturas ({selectedProvider.invoices.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {selectedProvider.invoices.map((invoice) => (
                        <div key={invoice.id} className="flex items-center justify-between p-4 bg-zinc-900 rounded-lg hover:bg-zinc-800 transition-all">
                          <div className="flex items-center gap-4">
                            <FileText className="w-5 h-5 text-zinc-500" />
                            <div>
                              <p className="font-medium text-white">{invoice.invoice_number}</p>
                              <p className="text-sm text-zinc-500">
                                {invoice.invoice_date && format(new Date(invoice.invoice_date), 'dd/MM/yyyy')}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <Badge className={
                              invoice.status === 'pagada' ? 'bg-green-600 text-white' :
                              invoice.status === 'pendiente' ? 'bg-yellow-600 text-white' :
                              'bg-red-600 text-white'
                            }>
                              {invoice.status}
                            </Badge>
                            <p className="text-lg font-bold text-white">{invoice.total?.toFixed(2)}€</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Dialog: Crear/Editar Proveedor */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-zinc-900 border-zinc-800 text-white">
            <DialogHeader>
              <DialogTitle className="text-white">
                {editingProvider ? 'Editar Proveedor' : 'Nuevo Proveedor'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Nombre *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="cif">CIF/NIF</Label>
                    <Input
                      id="cif"
                      value={formData.cif}
                      onChange={(e) => setFormData({...formData, cif: e.target.value})}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Teléfono</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="address">Dirección</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="category">Categoría</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value) => setFormData({...formData, category: value})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="suministros">Suministros</SelectItem>
                        <SelectItem value="servicios">Servicios</SelectItem>
                        <SelectItem value="materiales">Materiales</SelectItem>
                        <SelectItem value="tecnologia">Tecnología</SelectItem>
                        <SelectItem value="otros">Otros</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="rating">Valoración</Label>
                    <Select
                      value={formData.rating.toString()}
                      onValueChange={(value) => setFormData({...formData, rating: parseInt(value)})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1,2,3,4,5].map(r => (
                          <SelectItem key={r} value={r.toString()}>{r} ⭐</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
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
                        <SelectItem value="activo">Activo</SelectItem>
                        <SelectItem value="inactivo">Inactivo</SelectItem>
                        <SelectItem value="pendiente">Pendiente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="logo_url">URL del Logo</Label>
                  <Input
                    id="logo_url"
                    type="url"
                    placeholder="https://ejemplo.com/logo.png"
                    value={formData.logo_url}
                    onChange={(e) => setFormData({...formData, logo_url: e.target.value})}
                  />
                  {formData.logo_url && (
                    <div className="mt-2">
                      <img src={formData.logo_url} alt="Preview" className="h-12 object-contain border rounded p-1" />
                    </div>
                  )}
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
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  Cancelar
                </Button>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                  {editingProvider ? 'Actualizar' : 'Crear'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}