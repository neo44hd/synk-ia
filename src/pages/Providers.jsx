import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { syncEmailInvoices } from "@/services/functionsService";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Users, Plus, Edit, TrendingUp, TrendingDown, DollarSign,
  FileText, Star, Phone, Mail, MapPin, Building2, Search, Filter, Calendar, RefreshCw, Loader2
} from "lucide-react";
import { toast } from "sonner";

function safeFormatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return ''; }
}

export default function Providers() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState(null);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [syncing, setSyncing] = useState(false);
  const [formData, setFormData] = useState({
    name: '', cif: '', email: '', phone: '', address: '',
    category: 'suministros', rating: 3, status: 'activo', notes: '', logo_url: ''
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

  useEffect(() => {
    if (!isLoading && providers.length === 0) {
      setSyncing(true);
      syncEmailInvoices().then(() => {
        queryClient.invalidateQueries({ queryKey: ['providers'] });
        queryClient.invalidateQueries({ queryKey: ['invoices'] });
      }).catch(e => console.error('Sync error:', e)).finally(() => setSyncing(false));
    }
  }, [isLoading, providers.length]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncEmailInvoices();
      queryClient.invalidateQueries({ queryKey: ['providers'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Proveedores sincronizados');
    } catch (e) { toast.error('Error: ' + e.message); }
    finally { setSyncing(false); }
  };

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Provider.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['providers'] });
      toast.success('Proveedor creado');
      handleCloseDialog();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Provider.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['providers'] });
      toast.success('Proveedor actualizado');
      handleCloseDialog();
    },
  });

  const providerStats = providers.map(provider => {
    const providerInvoices = invoices.filter(inv => inv.provider_name === provider.name || inv.provider === provider.name);
    const total = providerInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
    const pending = providerInvoices.filter(inv => inv.status === 'pendiente').reduce((sum, inv) => sum + (inv.total || 0), 0);
    return {
      ...provider,
      invoiceCount: providerInvoices.length,
      totalSpent: total,
      pendingAmount: pending,
      lastInvoiceDate: providerInvoices[0]?.invoice_date || null,
      invoices: providerInvoices
    };
  });

  const filteredProviders = providerStats
    .filter(p => {
      const matchesSearch = !searchQuery || p.name?.toLowerCase().includes(searchQuery.toLowerCase()) || p.cif?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = filterCategory === 'all' || p.category === filterCategory;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => b.totalSpent - a.totalSpent);

  const handleOpenDialog = (provider = null) => {
    if (provider) {
      setEditingProvider(provider);
      setFormData({ name: provider.name || '', cif: provider.cif || '', email: provider.email || '', phone: provider.phone || '', address: provider.address || '', category: provider.category || 'suministros', rating: provider.rating || 3, status: provider.status || 'activo', notes: provider.notes || '', logo_url: provider.logo_url || '' });
    } else {
      setEditingProvider(null);
      setFormData({ name: '', cif: '', email: '', phone: '', address: '', category: 'suministros', rating: 3, status: 'activo', notes: '', logo_url: '' });
    }
    setIsDialogOpen(true);
  };
  const handleCloseDialog = () => { setIsDialogOpen(false); setEditingProvider(null); };
  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingProvider) { updateMutation.mutate({ id: editingProvider.id, data: formData }); }
    else { createMutation.mutate(formData); }
  };

  const totalSpent = providerStats.reduce((sum, p) => sum + p.totalSpent, 0);
  const totalPending = providerStats.reduce((sum, p) => sum + p.pendingAmount, 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Users className="text-cyan-400" /> Proveedores
          </h1>
          <p className="text-zinc-400 mt-1">Datos reales desde email scan y Biloop</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSync} disabled={syncing} variant="outline" className="border-cyan-500/50 text-cyan-400">
            {syncing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Sincronizar
          </Button>
          <Button onClick={() => handleOpenDialog()} className="bg-cyan-600 hover:bg-cyan-700">
            <Plus className="w-4 h-4 mr-2" /> Nuevo
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4">
            <p className="text-zinc-400 text-sm">Proveedores</p>
            <p className="text-2xl font-bold text-white">{providers.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4">
            <p className="text-zinc-400 text-sm">Gasto Total</p>
            <p className="text-2xl font-bold text-white">{totalSpent.toFixed(0)}\u20ac</p>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4">
            <p className="text-zinc-400 text-sm">Pendiente</p>
            <p className="text-2xl font-bold text-orange-400">{totalPending.toFixed(0)}\u20ac</p>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4">
            <p className="text-zinc-400 text-sm">Facturas</p>
            <p className="text-2xl font-bold text-white">{invoices.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex gap-4 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 w-4 h-4 text-zinc-400" />
          <Input placeholder="Buscar por nombre o CIF..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 bg-zinc-800 border-zinc-700 text-white" />
        </div>
        {['all','suministros','servicios','materiales','tecnologia','otros'].map(cat => (
          <Button key={cat} size="sm" variant={filterCategory === cat ? 'default' : 'outline'} onClick={() => setFilterCategory(cat)} className={filterCategory === cat ? 'bg-cyan-600' : 'border-zinc-700 text-zinc-300'}>
            {cat === 'all' ? 'Todos' : cat.charAt(0).toUpperCase() + cat.slice(1)}
          </Button>
        ))}
      </div>

      {/* Provider List */}
      {(isLoading || syncing) ? (
        <div className="text-center py-20"><Loader2 className="w-8 h-8 animate-spin text-cyan-400 mx-auto" /><p className="text-zinc-400 mt-2">Cargando proveedores...</p></div>
      ) : filteredProviders.length === 0 ? (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-12 text-center">
            <Building2 className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
            <h3 className="text-lg text-white mb-2">No hay proveedores</h3>
            <p className="text-zinc-400 mb-4">Sincroniza para cargar datos reales</p>
            <Button onClick={handleSync} className="bg-cyan-600"><RefreshCw className="w-4 h-4 mr-2" /> Sincronizar</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProviders.map(provider => (
            <Card key={provider.id} className="bg-zinc-900 border-zinc-800 hover:border-cyan-500/50 cursor-pointer transition-all" onClick={() => setSelectedProvider(provider)}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400 font-bold">
                      {(provider.name || '?').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">{provider.name}</h3>
                      <Badge variant="outline" className="text-xs">{provider.category || 'otros'}</Badge>
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); handleOpenDialog(provider); }}><Edit className="w-4 h-4" /></Button>
                </div>
                {provider.email && <p className="text-xs text-zinc-400 flex items-center gap-1"><Mail className="w-3 h-3" />{provider.email}</p>}
                <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                  <div><p className="text-xs text-zinc-500">Facturas</p><p className="text-sm font-bold text-white">{provider.invoiceCount}</p></div>
                  <div><p className="text-xs text-zinc-500">Total</p><p className="text-sm font-bold text-white">{provider.totalSpent.toFixed(0)}\u20ac</p></div>
                  <div><p className="text-xs text-zinc-500">Pendiente</p><p className="text-sm font-bold text-orange-400">{provider.pendingAmount.toFixed(0)}\u20ac</p></div>
                </div>
                {provider.lastInvoiceDate && <p className="text-xs text-zinc-500 mt-2">Ultima: {safeFormatDate(provider.lastInvoiceDate)}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedProvider} onOpenChange={() => setSelectedProvider(null)}>
        <DialogContent className="max-w-lg bg-zinc-900 border-zinc-800 text-white">
          <DialogHeader><DialogTitle>{selectedProvider?.name}</DialogTitle></DialogHeader>
          {selectedProvider && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <Card className="bg-zinc-800 border-zinc-700"><CardContent className="p-3 text-center"><p className="text-xs text-zinc-400">Facturas</p><p className="text-lg font-bold">{selectedProvider.invoiceCount}</p></CardContent></Card>
                <Card className="bg-zinc-800 border-zinc-700"><CardContent className="p-3 text-center"><p className="text-xs text-zinc-400">Total</p><p className="text-lg font-bold">{selectedProvider.totalSpent.toFixed(2)}\u20ac</p></CardContent></Card>
                <Card className="bg-zinc-800 border-zinc-700"><CardContent className="p-3 text-center"><p className="text-xs text-zinc-400">Pendiente</p><p className="text-lg font-bold text-orange-400">{selectedProvider.pendingAmount.toFixed(2)}\u20ac</p></CardContent></Card>
              </div>
              {selectedProvider.email && <p className="text-sm text-zinc-400"><Mail className="w-4 h-4 inline mr-2" />{selectedProvider.email}</p>}
              {selectedProvider.phone && <p className="text-sm text-zinc-400"><Phone className="w-4 h-4 inline mr-2" />{selectedProvider.phone}</p>}
              <div className="max-h-60 overflow-y-auto space-y-2">
                <h4 className="text-sm font-semibold text-zinc-300">Facturas ({selectedProvider.invoices.length})</h4>
                {selectedProvider.invoices.map(inv => (
                  <div key={inv.id} className="flex justify-between items-center p-2 bg-zinc-800 rounded text-sm">
                    <span className="text-zinc-300">{inv.invoice_number || inv.filename || inv.subject || 'Factura'}</span>
                    <div className="flex gap-3 items-center">
                      <span className="text-zinc-500">{safeFormatDate(inv.invoice_date)}</span>
                      <Badge variant="outline" className="text-xs">{inv.status}</Badge>
                      <span className="font-bold">{(inv.total || 0).toFixed(2)}\u20ac</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent className="max-w-md bg-zinc-900 border-zinc-800 text-white">
          <DialogHeader><DialogTitle>{editingProvider ? 'Editar Proveedor' : 'Nuevo Proveedor'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div><Label>Nombre *</Label><Input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required className="bg-zinc-800 border-zinc-700" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>CIF/NIF</Label><Input value={formData.cif} onChange={(e) => setFormData({...formData, cif: e.target.value})} className="bg-zinc-800 border-zinc-700" /></div>
              <div><Label>Email</Label><Input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="bg-zinc-800 border-zinc-700" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Telefono</Label><Input value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} className="bg-zinc-800 border-zinc-700" /></div>
              <div><Label>Categoria</Label>
                <Select value={formData.category} onValueChange={(v) => setFormData({...formData, category: v})}>
                  <SelectTrigger className="bg-zinc-800 border-zinc-700"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="suministros">Suministros</SelectItem>
                    <SelectItem value="servicios">Servicios</SelectItem>
                    <SelectItem value="materiales">Materiales</SelectItem>
                    <SelectItem value="tecnologia">Tecnologia</SelectItem>
                    <SelectItem value="otros">Otros</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Direccion</Label><Input value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} className="bg-zinc-800 border-zinc-700" /></div>
            <div><Label>Notas</Label><Textarea value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} rows={2} className="bg-zinc-800 border-zinc-700" /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog}>Cancelar</Button>
              <Button type="submit" className="bg-cyan-600 hover:bg-cyan-700">{editingProvider ? 'Actualizar' : 'Crear'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
