import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Building2,
  Search,
  Loader2,
  Receipt,
  Euro,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Clock,
  FileText,
  BarChart3,
  ThumbsUp,
  ThumbsDown,
  Mail,
  Phone,
  MapPin,
  Zap,
  TrendingDown,
  DollarSign,
  Calendar,
  Lock,
  Eye,
  Link as LinkIcon,
} from 'lucide-react';

const eur = (n) =>
  (Number(n) || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

const fmtDate = (s) => {
  if (!s) return '—';
  const d = new Date(s);
  return isNaN(d) ? s : d.toLocaleDateString('es-ES');
};

const normalizeText = (v) =>
  String(v || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const blockedProviderTokens = [
  'chicken palace ibiza',
  'b56908486',
  'josep riquer llobet 7 local 3',
  'david roldan hueso',
  'david roldan',
];

const isBlockedOwnIdentity = (prov) => {
  const haystack = normalizeText([
    prov?.nombre,
    prov?.name,
    prov?.cif_nif,
    prov?.cif,
    prov?.direccion,
    prov?.address,
    prov?.email,
    prov?.deduplication_key,
  ].filter(Boolean).join(' '));
  return blockedProviderTokens.some((token) => haystack.includes(normalizeText(token)));
};

const monthKey = (dateValue) => {
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return 'Sin fecha';
  return d.toISOString().slice(0, 7);
};

const productKey = (value) => normalizeText(value || 'otros');

const getProviderNames = (prov) => [
  prov?.nombre,
  prov?.name,
  prov?.legal_name,
  prov?.commercial_name,
].filter(Boolean).map(normalizeText);

const invoiceMatchesProvider = (inv, prov) => {
  const providerNames = getProviderNames(prov);
  const invName = normalizeText(inv.provider_name || inv.emisor || inv.supplier_name);
  const invCif = normalizeText(inv.provider_cif || inv.cif || inv.tax_id);
  const provCif = normalizeText(prov.cif_nif || prov.cif || prov.tax_id);
  return (
    (provCif && invCif && invCif === provCif) ||
    (inv.provider_id && (inv.provider_id === prov.id || inv.provider_id === prov.source_id)) ||
    (invName && providerNames.some((name) => name && (invName === name || invName.includes(name) || name.includes(invName))))
  );
};

const buildProductMarket = (invoices) => {
  const market = {};
  invoices.forEach((inv) => {
    const provider = inv.provider_name || 'Proveedor desconocido';
    (inv.items || []).forEach((item) => {
      const key = productKey(item.description || item.name || item.concepto);
      const unitPrice = Number(item.unit_price || item.price || 0);
      const quantity = Number(item.quantity || 0);
      if (!key || !unitPrice) return;
      if (!market[key]) market[key] = [];
      market[key].push({
        provider,
        description: item.description || item.name || item.concepto || 'Producto',
        unitPrice,
        quantity,
        total: Number(item.total || unitPrice * quantity || 0),
        invoiceDate: inv.invoice_date,
      });
    });
  });
  return market;
};

export default function ProvidersNew() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [providers, setProviders] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState({});
  const [approving, setApproving] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      // Cargar proveedores desde entities.json
      const entRes = await fetch('/api/data/entities');
      const entJson = await entRes.json();
      const proveList = entJson.data?.proveedores || [];

      // Cargar facturas
      const invRes = await fetch('/api/data/invoice?limit=2000');
      const invJson = await invRes.json();
      const invoiceList = invJson.data || [];

      setProviders(proveList);
      setInvoices(invoiceList);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const productMarket = useMemo(() => buildProductMarket(invoices), [invoices]);

  const enrichedProviders = useMemo(() => {
    return providers.map((prov) => {
      const isBlocked = isBlockedOwnIdentity(prov);
      
      // Facturas de este proveedor usando match mejorado
      const provInvoices = invoices.filter((inv) => invoiceMatchesProvider(inv, prov));
      
      // Análisis de gastos por mes
      const monthlySpend = {};
      const monthlyItems = {};
      provInvoices.forEach((inv) => {
        const month = monthKey(inv.invoice_date);
        const total = Number(inv.total) || 0;
        monthlySpend[month] = (monthlySpend[month] || 0) + total;
        if (!monthlyItems[month]) monthlyItems[month] = [];
        monthlyItems[month].push(inv);
      });
      
      // Productos desde líneas de factura
      const productsByKey = {};
      const products = {};
      provInvoices.forEach((inv) => {
        (inv.items || []).forEach((item) => {
          const pKey = productKey(item.description || item.concepto);
          const desc = item.description || item.concepto || 'Otros';
          const qty = Number(item.quantity) || 0;
          const unitPrice = Number(item.unit_price) || Number(item.price) || 0;
          const total = Number(item.total) || (qty * unitPrice) || 0;
          
          if (!productsByKey[pKey]) productsByKey[pKey] = { key: pKey, desc, items: [] };
          productsByKey[pKey].items.push({ qty, unitPrice, total, invoiceDate: inv.invoice_date });
          
          if (!products[desc]) products[desc] = { count: 0, total: 0, qty: 0 };
          products[desc].count += 1;
          products[desc].total += total;
          products[desc].qty += qty;
        });
      });
      
      // Consolidar productos con estadísticas
      const productsAnalysis = Object.entries(productsByKey).map(([key, data]) => {
        const prices = data.items.filter(i => i.unitPrice > 0).map(i => i.unitPrice);
        const avgPrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
        const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
        const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
        const totalQty = data.items.reduce((s, i) => s + (i.qty || 0), 0);
        const totalValue = data.items.reduce((s, i) => s + (i.total || 0), 0);
        
        // Comparativa: buscar en mercado
        const marketData = productMarket[key] || [];
        const bestAlternative = marketData
          .filter(m => normalizeText(m.provider) !== normalizeText(prov.nombre))
          .sort((a, b) => a.unitPrice - b.unitPrice)[0];
        
        return {
          key,
          description: data.desc,
          frequency: data.items.length,
          totalQuantity: totalQty,
          avgPrice: Math.round(avgPrice * 100) / 100,
          minPrice,
          maxPrice,
          totalValue: Math.round(totalValue * 100) / 100,
          lastPurchase: Math.max(...data.items.map(i => new Date(i.invoiceDate).getTime())),
          priceChange: prices.length > 1 ? prices[prices.length - 1] - prices[0] : 0,
          bestAlternative: bestAlternative ? {
            provider: bestAlternative.provider,
            unitPrice: bestAlternative.unitPrice,
            saving: (avgPrice - bestAlternative.unitPrice) * (totalQty / data.items.length),
            savingPercent: avgPrice > 0 ? Math.round((1 - bestAlternative.unitPrice / avgPrice) * 100) : 0,
          } : null,
        };
      });
      
      const totalSpend = provInvoices.reduce((s, inv) => s + (Number(inv.total) || 0), 0);
      const avgInvoice = provInvoices.length > 0 ? totalSpend / provInvoices.length : 0;
      const currentMonth = monthKey(new Date());
      const prevMonth = monthKey(new Date(new Date().setMonth(new Date().getMonth() - 1)));
      const spendTrend = (monthlySpend[currentMonth] || 0) - (monthlySpend[prevMonth] || 0);
      
      // IVA desglosado
      const ivaBreakdown = {};
      provInvoices.forEach((inv) => {
        const ivaRate = inv.iva_rate || (inv.iva && inv.subtotal ? Math.round((Number(inv.iva) / Number(inv.subtotal)) * 100) : 21);
        if (!ivaBreakdown[ivaRate]) {
          ivaBreakdown[ivaRate] = { base: 0, iva: 0, count: 0 };
        }
        const base = Number(inv.base) || Number(inv.subtotal) || (Number(inv.total) / (1 + Number(ivaRate) / 100));
        const iva = Number(inv.iva) || (base * Number(ivaRate) / 100);
        ivaBreakdown[ivaRate].base += base;
        ivaBreakdown[ivaRate].iva += iva;
        ivaBreakdown[ivaRate].count += 1;
      });
      const totalIva = Object.values(ivaBreakdown).reduce((s, d) => s + d.iva, 0);
      
      // Alertas inteligentes
      const alerts = [];
      if (isBlocked) alerts.push({ type: 'blocked', message: '🔒 Entidad bloqueada como propia. No puede aprobarse como proveedor.' });
      if (prov.status === 'pending_review') alerts.push({ type: 'pending', message: '⏳ Pendiente de aprobación' });
      if (!prov.cif_nif) alerts.push({ type: 'warning', message: '⚠️ Falta CIF/NIF' });
      if (provInvoices.length === 0) alerts.push({ type: 'info', message: 'ℹ️ Sin facturas asociadas' });
      if (spendTrend > totalSpend * 0.3) alerts.push({ type: 'warning', message: `📈 Gasto subió ${Math.round((spendTrend / (monthlySpend[prevMonth] || 1)) * 100)}% este mes` });
      if (productsAnalysis.some(p => p.bestAlternative && p.bestAlternative.savingPercent > 10)) {
        alerts.push({ type: 'opportunity', message: `💰 Hay oportunidades de ahorro en ${productsAnalysis.filter(p => p.bestAlternative?.savingPercent > 10).length} producto(s)` });
      }
      
      return {
        ...prov,
        isBlocked,
        invoices: provInvoices,
        totalSpend: Math.round(totalSpend * 100) / 100,
        invoiceCount: provInvoices.length,
        avgInvoice: Math.round(avgInvoice * 100) / 100,
        lastInvoice: provInvoices.length > 0 ? new Date(Math.max(...provInvoices.map(inv => new Date(inv.invoice_date).getTime()))) : null,
        monthlySpend,
        monthlyItems,
        products,
        productsAnalysis,
        ivaBreakdown,
        totalIva: Math.round(totalIva * 100) / 100,
        spendTrend: Math.round(spendTrend * 100) / 100,
        status: prov.status || 'pending_review',
        approved: prov.approved_by_user || false,
        dedupKey: prov.deduplication_key,
        alerts,
      };
    });
  }, [providers, invoices, productMarket]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return enrichedProviders;
    return enrichedProviders.filter(
      (p) =>
        (p.nombre || '').toLowerCase().includes(q) ||
        (p.cif_nif || '').toLowerCase().includes(q) ||
        (p.email || '').toLowerCase().includes(q)
    );
  }, [enrichedProviders, search]);

  const toggle = (id) => setExpanded((e) => ({ ...e, [id]: !e[id] }));

  const handleApprove = async (provId) => {
    setApproving(provId);
    try {
      const res = await fetch(`/api/data/provider/${provId}/approve`, { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        setProviders((ps) =>
          ps.map((p) => (p.id === provId ? { ...p, status: 'approved', approved_by_user: true, approved_at: new Date().toISOString() } : p))
        );
      }
    } catch (e) {
      alert('Error al aprobar: ' + e.message);
    } finally {
      setApproving(null);
    }
  };

  const handleReject = async (provId, reason) => {
    setApproving(provId);
    try {
      const res = await fetch(`/api/data/provider/${provId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const json = await res.json();
      if (json.success) {
        setProviders((ps) =>
          ps.map((p) =>
            p.id === provId ? { ...p, status: 'rejected', approved_by_user: false, rejected_reason: reason, rejected_at: new Date().toISOString() } : p
          )
        );
      }
    } catch (e) {
      alert('Error al rechazar: ' + e.message);
    } finally {
      setApproving(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="text-center">
          <Loader2 className="animate-spin mx-auto mb-4 text-purple-500" size={40} />
          <p className="text-slate-600">Cargando proveedores...</p>
        </div>
      </div>
    );
  }

  const pending = filtered.filter((p) => p.status === 'pending_review');
  const approved = filtered.filter((p) => p.status === 'approved');
  const blocked = filtered.filter((p) => p.isBlocked);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/50">
              <Building2 className="text-white" size={24} />
            </div>
            <div>
              <h1 className="text-3xl font-black text-white">Fichas de Proveedores</h1>
              <p className="text-sm text-slate-400 mt-1">Análisis completo, comparativas y recomendaciones</p>
            </div>
          </div>
          <button
            onClick={load}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-semibold transition shadow-lg"
          >
            <RefreshCw size={16} /> Actualizar
          </button>
        </div>

        {/* Estadísticas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
            <p className="text-slate-400 text-xs uppercase mb-1">Total Proveedores</p>
            <p className="text-2xl font-bold text-white">{filtered.length}</p>
          </div>
          {pending.length > 0 && (
            <div className="bg-yellow-950/40 border border-yellow-700/50 rounded-lg p-4">
              <p className="text-yellow-300 text-xs uppercase mb-1">Pendientes</p>
              <p className="text-2xl font-bold text-yellow-400">{pending.length}</p>
            </div>
          )}
          {approved.length > 0 && (
            <div className="bg-green-950/40 border border-green-700/50 rounded-lg p-4">
              <p className="text-green-300 text-xs uppercase mb-1">Aprobados</p>
              <p className="text-2xl font-bold text-green-400">{approved.length}</p>
            </div>
          )}
          {blocked.length > 0 && (
            <div className="bg-red-950/40 border border-red-700/50 rounded-lg p-4">
              <p className="text-red-300 text-xs uppercase mb-1">Bloqueados</p>
              <p className="text-2xl font-bold text-red-400">{blocked.length}</p>
            </div>
          )}
        </div>

        {error && <div className="mb-4 p-4 rounded-lg bg-red-900/30 border border-red-700 text-red-300 text-sm">{error}</div>}

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-3 text-slate-400" size={18} />
          <Input
            placeholder="Buscar proveedor, CIF o email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-slate-200">
          <button className="pb-3 px-2 border-b-2 border-purple-500 text-purple-600 font-semibold">
            Todos ({filtered.length})
          </button>
          {pending.length > 0 && (
            <button className="pb-3 px-2 text-slate-600 hover:text-slate-900">
              ⏳ Pendientes ({pending.length})
            </button>
          )}
          {approved.length > 0 && (
            <button className="pb-3 px-2 text-slate-600 hover:text-slate-900">
              ✓ Aprobados ({approved.length})
            </button>
          )}
        </div>

        {/* Provider List */}
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Building2 size={40} className="mx-auto mb-4 opacity-40" />
            <p>No hay proveedores.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((prov) => {
              const isOpen = !!expanded[prov.id];
              const statusColor =
                prov.status === 'approved'
                  ? 'bg-green-100 text-green-700'
                  : prov.status === 'rejected'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-yellow-100 text-yellow-700';

              return (
                <Card key={prov.id} className="overflow-hidden">
                  <CardContent className="p-0">
                    <button
                      onClick={() => toggle(prov.id)}
                      className="w-full flex items-center gap-4 p-4 hover:bg-slate-50 transition text-left"
                    >
                      <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                        <Building2 className="text-purple-600" size={20} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-slate-900">{prov.nombre}</p>
                          <Badge className={statusColor}>
                            {prov.status === 'pending_review' && '⏳ Pendiente'}
                            {prov.status === 'approved' && '✓ Aprobado'}
                            {prov.status === 'rejected' && '✗ Rechazado'}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          {prov.cif_nif || 'Sin CIF'} · {prov.invoiceCount} factura(s) · {fmtDate(prov.lastInvoice)}
                        </p>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <p className="font-bold text-slate-900">{eur(prov.totalSpend)}</p>
                        <p className="text-xs text-slate-500">Media {eur(prov.avgInvoice)}</p>
                      </div>

                      {isOpen ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                    </button>

                    {isOpen && (
                      <div className="border-t border-slate-100 bg-slate-50/50 p-6 space-y-6">
                        {/* Datos básicos */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <label className="text-xs text-slate-500 font-semibold">CIF/NIF</label>
                            <p className="text-sm text-slate-900">{prov.cif_nif || '—'}</p>
                          </div>
                          <div>
                            <label className="text-xs text-slate-500 font-semibold">Email</label>
                            <p className="text-sm text-slate-900 flex items-center gap-1">
                              {prov.email ? (
                                <>
                                  <Mail size={14} /> {prov.email}
                                </>
                              ) : (
                                '—'
                              )}
                            </p>
                          </div>
                          <div>
                            <label className="text-xs text-slate-500 font-semibold">Teléfono</label>
                            <p className="text-sm text-slate-900 flex items-center gap-1">
                              {prov.telefono ? (
                                <>
                                  <Phone size={14} /> {prov.telefono}
                                </>
                              ) : (
                                '—'
                              )}
                            </p>
                          </div>
                          <div>
                            <label className="text-xs text-slate-500 font-semibold">Tipo</label>
                            <p className="text-sm text-slate-900">{prov.tipo_entidad || 'empresa'}</p>
                          </div>
                        </div>

                        {prov.direccion && (
                          <div>
                            <label className="text-xs text-slate-500 font-semibold flex items-center gap-1">
                              <MapPin size={14} /> Dirección
                            </label>
                            <p className="text-sm text-slate-900">{prov.direccion}</p>
                          </div>
                        )}

                        {/* Análisis financiero */}
                        <div className="border-t pt-4">
                          <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                            <BarChart3 size={16} /> Análisis Financiero
                          </h3>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-white p-3 rounded-lg border border-slate-200">
                              <p className="text-xs text-slate-500">Total facturado</p>
                              <p className="text-lg font-bold text-slate-900">{eur(prov.totalSpend)}</p>
                            </div>
                            <div className="bg-white p-3 rounded-lg border border-slate-200">
                              <p className="text-xs text-slate-500">Nº facturas</p>
                              <p className="text-lg font-bold text-slate-900">{prov.invoiceCount}</p>
                            </div>
                            <div className="bg-white p-3 rounded-lg border border-slate-200">
                              <p className="text-xs text-slate-500">Factura media</p>
                              <p className="text-lg font-bold text-slate-900">{eur(prov.avgInvoice)}</p>
                            </div>
                            <div className="bg-white p-3 rounded-lg border border-slate-200">
                              <p className="text-xs text-slate-500">Última factura</p>
                              <p className="text-lg font-bold text-slate-900">{fmtDate(prov.lastInvoice)}</p>
                            </div>
                          </div>
                        </div>

                        {/* Alertas inteligentes */}
                        {prov.alerts.length > 0 && (
                          <div className="border-t pt-4">
                            <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                              <Zap size={16} /> Alertas & Recomendaciones
                            </h3>
                            <div className="space-y-2">
                              {prov.alerts.map((alert, idx) => {
                                const colors = {
                                  blocked: 'bg-red-50 border-red-200 text-red-700',
                                  pending: 'bg-yellow-50 border-yellow-200 text-yellow-700',
                                  warning: 'bg-orange-50 border-orange-200 text-orange-700',
                                  opportunity: 'bg-green-50 border-green-200 text-green-700',
                                  info: 'bg-blue-50 border-blue-200 text-blue-700',
                                }[alert.type] || 'bg-slate-50 border-slate-200 text-slate-700';
                                return (
                                  <div key={idx} className={`p-3 rounded-lg border ${colors} text-sm`}>
                                    {alert.message}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Comparativa de productos */}
                        {prov.productsAnalysis.length > 0 && prov.productsAnalysis.some(p => p.bestAlternative) && (
                          <div className="border-t pt-4">
                            <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                              <DollarSign size={16} /> Oportunidades de Ahorro
                            </h3>
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                              {prov.productsAnalysis
                                .filter(p => p.bestAlternative && p.bestAlternative.savingPercent > 5)
                                .sort((a, b) => (b.bestAlternative?.savingPercent || 0) - (a.bestAlternative?.savingPercent || 0))
                                .map((prod) => (
                                  <div key={prod.key} className="p-3 rounded-lg border border-slate-200 bg-white text-sm">
                                    <div className="flex items-start justify-between mb-1">
                                      <span className="font-semibold text-slate-900">{prod.description}</span>
                                      <span className="px-2 py-1 rounded bg-green-100 text-green-700 text-xs font-bold">
                                        {prod.bestAlternative.savingPercent}% ahorro
                                      </span>
                                    </div>
                                    <p className="text-xs text-slate-600 mb-2">
                                      Actual: {eur(prod.avgPrice)}/u | Mejor: {eur(prod.bestAlternative.unitPrice)}/u ({prod.bestAlternative.provider})
                                    </p>
                                    <p className="text-xs text-green-700 font-semibold">
                                      Potencial: {eur(prod.bestAlternative.saving)}/compra
                                    </p>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}

                        {/* IVA desglosado */}
                        {Object.keys(prov.ivaBreakdown).length > 0 && (
                          <div className="border-t pt-4">
                            <h3 className="font-semibold text-slate-900 mb-3">Desglose IVA</h3>
                            <div className="space-y-2">
                              {Object.entries(prov.ivaBreakdown).map(([rate, data]) => (
                                <div key={rate} className="flex items-center justify-between p-2 bg-white rounded border border-slate-200">
                                  <span className="text-sm text-slate-700">IVA {rate}%</span>
                                  <div className="text-right">
                                    <p className="text-sm font-semibold text-slate-900">
                                      Base {eur(data.base)} + {eur(data.iva)}
                                    </p>
                                    <p className="text-xs text-slate-500">{data.count} factura(s)</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Productos/Conceptos */}
                        {Object.keys(prov.products).length > 0 && (
                          <div className="border-t pt-4">
                            <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                              <Receipt size={16} /> Productos/Servicios Comprados
                            </h3>
                            <div className="space-y-1 max-h-48 overflow-y-auto">
                              {Object.entries(prov.products)
                                .sort(([, a], [, b]) => b.total - a.total)
                                .map(([prod, data]) => (
                                  <div key={prod} className="flex items-center justify-between p-2 text-sm bg-white rounded border border-slate-200">
                                    <span className="text-slate-700 truncate">{prod}</span>
                                    <div className="text-right whitespace-nowrap">
                                      <span className="font-medium text-slate-900">{eur(data.total)}</span>
                                      <span className="text-xs text-slate-500 ml-2">({data.count}x)</span>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}

                        {/* Gasto por mes */}
                        {Object.keys(prov.monthlySpend).length > 0 && (
                          <div className="border-t pt-4">
                            <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                              <TrendingUp size={16} /> Gasto Mensual
                            </h3>
                            <div className="space-y-1">
                              {Object.entries(prov.monthlySpend)
                                .sort(([a], [b]) => b.localeCompare(a))
                                .map(([month, total]) => (
                                  <div key={month} className="flex items-center justify-between p-2 text-sm bg-white rounded border border-slate-200">
                                    <span className="text-slate-700">{month}</span>
                                    <span className="font-medium text-slate-900">{eur(total)}</span>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}

                        {/* Facturas */}
                        {prov.invoices.length > 0 && (
                          <div className="border-t pt-4">
                            <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                              <FileText size={16} /> Historial de Facturas
                            </h3>
                            <div className="space-y-1 max-h-48 overflow-y-auto">
                              {prov.invoices
                                .sort((a, b) => (b.invoice_date || '').localeCompare(a.invoice_date || ''))
                                .map((inv, i) => (
                                  <div
                                    key={inv.id || i}
                                    className="flex items-center justify-between p-2 text-sm bg-white rounded border border-slate-200"
                                  >
                                    <div className="min-w-0 flex-1">
                                      <span className="text-slate-700 truncate">
                                        {inv.invoice_number ? `#${inv.invoice_number} · ` : ''}
                                        {inv.file_name || 'documento'}
                                      </span>
                                    </div>
                                    <span className="text-slate-500 mx-3 whitespace-nowrap">{fmtDate(inv.invoice_date)}</span>
                                    <span className="font-medium text-slate-900 whitespace-nowrap">{eur(inv.total)}</span>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}

                        {/* Aprobación */}
                        {prov.isBlocked ? (
                          <div className="border-t pt-4 p-4 bg-red-50 rounded-lg border border-red-200">
                            <div className="flex items-center gap-2 mb-2">
                              <Lock size={18} className="text-red-600" />
                              <span className="font-semibold text-red-700">Entidad Bloqueada</span>
                            </div>
                            <p className="text-sm text-red-600">No se puede aprobar como proveedor porque coincide con tu empresa o datos personales.</p>
                          </div>
                        ) : prov.status === 'pending_review' ? (
                          <div className="border-t pt-4 flex gap-3">
                            <button
                              onClick={() => handleApprove(prov.id)}
                              disabled={approving === prov.id}
                              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-green-500 text-white hover:bg-green-600 transition disabled:opacity-50"
                            >
                              <ThumbsUp size={16} /> Aprobar Proveedor
                            </button>
                            <button
                              onClick={() => {
                                const reason = prompt('¿Por qué rechazar este proveedor?');
                                if (reason) handleReject(prov.id, reason);
                              }}
                              disabled={approving === prov.id}
                              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition disabled:opacity-50"
                            >
                              <ThumbsDown size={16} /> Rechazar
                            </button>
                          </div>
                        ) : null}

                        {prov.status === 'approved' && (
                          <div className="border-t pt-4 p-3 bg-green-50 rounded-lg flex items-center gap-2 text-green-700">
                            <CheckCircle size={16} />
                            <span className="text-sm">Proveedor aprobado el {fmtDate(prov.approved_at)}</span>
                          </div>
                        )}

                        {prov.status === 'rejected' && (
                          <div className="border-t pt-4 p-3 bg-red-50 rounded-lg flex items-center gap-2 text-red-700">
                            <AlertCircle size={16} />
                            <div className="text-sm">
                              <p>Rechazado: {prov.rejected_reason}</p>
                              <p className="text-xs mt-1">{fmtDate(prov.rejected_at)}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
