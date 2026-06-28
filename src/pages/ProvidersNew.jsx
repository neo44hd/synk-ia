import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
} from 'lucide-react';

const eur = (n) =>
  (Number(n) || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

const fmtDate = (s) => {
  if (!s) return '—';
  const d = new Date(s);
  return isNaN(d) ? s : d.toLocaleDateString('es-ES');
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

  const enrichedProviders = useMemo(() => {
    return providers.map((prov) => {
      // Facturas de este proveedor
      const provInvoices = invoices.filter(
        (inv) =>
          (inv.provider_name && prov.nombre && inv.provider_name.toLowerCase() === prov.nombre.toLowerCase()) ||
          (inv.provider_cif && prov.cif_nif && inv.provider_cif === prov.cif_nif)
      );

      // Análisis de gastos por mes
      const monthlySpend = {};
      provInvoices.forEach((inv) => {
        const date = new Date(inv.invoice_date);
        const month = date.toISOString().slice(0, 7); // YYYY-MM
        monthlySpend[month] = (monthlySpend[month] || 0) + (Number(inv.total) || 0);
      });

      // Análisis de productos/conceptos
      const products = {};
      provInvoices.forEach((inv) => {
        const desc = inv.description || inv.concepto || 'Otros';
        if (!products[desc]) {
          products[desc] = { count: 0, total: 0 };
        }
        products[desc].count += 1;
        products[desc].total += Number(inv.total) || 0;
      });

      const totalSpend = provInvoices.reduce((s, inv) => s + (Number(inv.total) || 0), 0);
      const avgInvoice = provInvoices.length > 0 ? totalSpend / provInvoices.length : 0;
      const lastInvoice = provInvoices.length > 0 ? new Date(Math.max(...provInvoices.map((inv) => new Date(inv.invoice_date)))) : null;

      // IVA desglosado
      const ivaBreakdown = {};
      provInvoices.forEach((inv) => {
        const ivaRate = inv.iva_rate || '21';
        if (!ivaBreakdown[ivaRate]) {
          ivaBreakdown[ivaRate] = { base: 0, iva: 0, count: 0 };
        }
        const base = Number(inv.base) || Number(inv.total) / (1 + Number(ivaRate) / 100);
        ivaBreakdown[ivaRate].base += base;
        ivaBreakdown[ivaRate].iva += Number(inv.iva) || 0;
        ivaBreakdown[ivaRate].count += 1;
      });

      return {
        ...prov,
        invoices: provInvoices,
        totalSpend: Math.round(totalSpend * 100) / 100,
        invoiceCount: provInvoices.length,
        avgInvoice: Math.round(avgInvoice * 100) / 100,
        lastInvoice,
        monthlySpend,
        products,
        ivaBreakdown,
        status: prov.status || 'pending_review',
        approved: prov.approved_by_user || false,
        dedupKey: prov.deduplication_key,
      };
    });
  }, [providers, invoices]);

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
  const rejected = filtered.filter((p) => p.status === 'rejected');

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Building2 className="text-purple-500" size={28} />
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Gestión de Proveedores</h1>
              <p className="text-sm text-slate-500">Fichas completas, análisis y aprobación</p>
            </div>
          </div>
          <button
            onClick={load}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500 text-white hover:bg-purple-600 transition"
          >
            <RefreshCw size={16} /> Actualizar
          </button>
        </div>

        {error && <div className="mb-4 p-3 rounded-lg bg-red-100 text-red-700 text-sm">{error}</div>}

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
                        {prov.status === 'pending_review' && (
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
                        )}

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
