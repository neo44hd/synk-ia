import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { syncEmailInvoices } from "@/services/functionsService";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Building2, Search, RefreshCw, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";

function safeDate(d) {
  if (!d) return '';
  try {
    var dt = new Date(d);
    if (isNaN(dt.getTime())) return '';
    return dt.toLocaleDateString('es-ES');
  } catch(err) { return ''; }
}

export default function Providers() {
  var [search, setSearch] = useState('');
  var [syncing, setSyncing] = useState(false);
  var qc = useQueryClient();

  var pq = useQuery({
    queryKey: ['providers'],
    queryFn: function() { return base44.entities.Provider.list('-created_date', 200); },
    initialData: [],
    staleTime: 60000,
  });
  var providers = pq.data || [];
  var isLoading = pq.isLoading;

  var iq = useQuery({
    queryKey: ['invoices'],
    queryFn: function() { return base44.entities.Invoice.list('-created_date', 500); },
    initialData: [],
    staleTime: 30000,
  });
  var invoices = iq.data || [];

  useEffect(function() {
    if (!isLoading && providers.length === 0) {
      setSyncing(true);
      syncEmailInvoices()
        .then(function() {
          qc.invalidateQueries({ queryKey: ['providers'] });
          qc.invalidateQueries({ queryKey: ['invoices'] });
        })
        .catch(function(e) { console.error('Sync:', e); })
        .finally(function() { setSyncing(false); });
    }
  }, [isLoading, providers.length]);

  function doSync() {
    setSyncing(true);
    syncEmailInvoices().then(function() {
      qc.invalidateQueries({ queryKey: ['providers'] });
      qc.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Sincronizado');
    }).catch(function(e) {
      toast.error('Error: ' + e.message);
    }).finally(function() { setSyncing(false); });
  }

  var stats = providers.map(function(p) {
    var pinv = invoices.filter(function(i) { return i.provider === p.name || i.provider_name === p.name; });
    var tot = pinv.reduce(function(s, i) { return s + (i.total || 0); }, 0);
    var pend = pinv.filter(function(i) { return i.status === 'pendiente'; }).reduce(function(s, i) { return s + (i.total || 0); }, 0);
    return { id: p.id, name: p.name, email: p.email, category: p.category, status: p.status, invoiceCount: pinv.length, totalSpent: tot, pendingAmount: pend, lastDate: pinv[0] ? pinv[0].invoice_date : null };
  });

  var filtered = stats
    .filter(function(p) {
      if (!search) return true;
      return (p.name || '').toLowerCase().indexOf(search.toLowerCase()) >= 0;
    })
    .sort(function(a, b) { return b.totalSpent - a.totalSpent; });

  var totalSpent = stats.reduce(function(s, p) { return s + p.totalSpent; }, 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <Users className="text-cyan-400" /> Proveedores
        </h1>
        <Button onClick={doSync} disabled={syncing} variant="outline" className="border-cyan-500/50 text-cyan-400">
          {syncing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
          Sincronizar
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-zinc-900 border-zinc-800"><CardContent className="p-4"><p className="text-zinc-400 text-sm">Proveedores</p><p className="text-2xl font-bold text-white">{providers.length}</p></CardContent></Card>
        <Card className="bg-zinc-900 border-zinc-800"><CardContent className="p-4"><p className="text-zinc-400 text-sm">Gasto Total</p><p className="text-2xl font-bold text-white">{totalSpent.toFixed(0)}€</p></CardContent></Card>
        <Card className="bg-zinc-900 border-zinc-800"><CardContent className="p-4"><p className="text-zinc-400 text-sm">Facturas</p><p className="text-2xl font-bold text-white">{invoices.length}</p></CardContent></Card>
      </div>
      <input placeholder="Buscar..." value={search} onChange={function(e){setSearch(e.target.value);}} className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 text-white rounded-md" />
      {(isLoading || syncing) ? (
        <div className="text-center py-20"><Loader2 className="w-8 h-8 animate-spin text-cyan-400 mx-auto" /><p className="text-zinc-400 mt-2">Cargando...</p></div>
      ) : filtered.length === 0 ? (
        <Card className="bg-zinc-900 border-zinc-800"><CardContent className="p-12 text-center">
          <Building2 className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
          <p className="text-white mb-4">No hay proveedores. Sincroniza para cargar datos reales.</p>
          <Button onClick={doSync} className="bg-cyan-600"><RefreshCw className="w-4 h-4 mr-2" /> Sincronizar</Button>
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(function(p) { return (
            <Card key={p.id} className="bg-zinc-900 border-zinc-800 hover:border-cyan-500/50 transition-all">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400 font-bold">{(p.name||'?').charAt(0).toUpperCase()}</div>
                  <div><p className="font-semibold text-white">{p.name}</p><Badge variant="outline" className="text-xs">{p.category||'otros'}</Badge></div>
                </div>
                {p.email && <p className="text-xs text-zinc-400 mb-2"><Mail className="w-3 h-3 inline mr-1" />{p.email}</p>}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div><p className="text-xs text-zinc-500">Facturas</p><p className="text-sm font-bold text-white">{p.invoiceCount}</p></div>
                  <div><p className="text-xs text-zinc-500">Total</p><p className="text-sm font-bold text-white">{p.totalSpent.toFixed(0)}€</p></div>
                  <div><p className="text-xs text-zinc-500">Pendiente</p><p className="text-sm font-bold text-orange-400">{p.pendingAmount.toFixed(0)}€</p></div>
                </div>
                {p.lastDate && <p className="text-xs text-zinc-500 mt-2">Ultima: {safeDate(p.lastDate)}</p>}
              </CardContent>
            </Card>
          );})}
        </div>
      )}
    </div>
  );
}
