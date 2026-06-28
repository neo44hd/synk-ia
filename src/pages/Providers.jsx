import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";

const eur = (n) =>
  (Number(n) || 0).toLocaleString("es-ES", { style: "currency", currency: "EUR" });

const fmtDate = (s) => {
  if (!s) return "\u2014";
  const d = new Date(s);
  return isNaN(d) ? s : d.toLocaleDateString("es-ES");
};

export default function Providers() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState({ totales: null, providers: [] });
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState({});

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fuentes fiables ya sincronizadas: provider.json (entidades) + invoice.json.
      // Agrupamos facturas por proveedor en el cliente.
      const [provRes, invRes] = await Promise.all([
        fetch("/api/data/provider?limit=1000"),
        fetch("/api/data/invoice?limit=2000"),
      ]);
      const provJson = await provRes.json();
      const invJson = await invRes.json();
      const provs = provJson.data || [];
      const invoices = invJson.data || [];

      const nrm = (s) => (s || "").toLowerCase().trim();
      const keyOf = (name, cif) => (cif && cif.trim() ? "cif:" + nrm(cif) : "name:" + nrm(name));
      const groups = new Map();
      const ensure = (name, cif) => {
        const k = keyOf(name, cif);
        if (!groups.has(k))
          groups.set(k, { id: k, nombre: name || "(sin nombre)", cif_nif: cif || "", facturas: [], total_facturado: 0, total_iva: 0, ultima_factura: null });
        return groups.get(k);
      };

      for (const p of provs) ensure(p.name, p.cif);

      for (const inv of invoices) {
        const g = ensure(inv.provider_name, inv.provider_cif);
        const total = Number(inv.total) || 0;
        const iva = Number(inv.iva) || 0;
        g.total_facturado += total;
        g.total_iva += iva;
        g.facturas.push({ id: inv.id, numero: inv.invoice_number, archivo: inv.file_name, fecha: inv.invoice_date, total });
        if (inv.invoice_date && (!g.ultima_factura || inv.invoice_date > g.ultima_factura)) g.ultima_factura = inv.invoice_date;
      }

      const round2 = (n) => Math.round((n || 0) * 100) / 100;
      const providers = [...groups.values()]
        .map((g) => ({
          ...g,
          num_facturas: g.facturas.length,
          total_facturado: round2(g.total_facturado),
          total_iva: round2(g.total_iva),
          facturas: g.facturas.sort((a, b) => (b.fecha || "").localeCompare(a.fecha || "")),
        }))
        .sort((a, b) => b.total_facturado - a.total_facturado);

      const totales = {
        num_proveedores: providers.length,
        num_facturas: invoices.length,
        total_facturado: round2(providers.reduce((s, p) => s + p.total_facturado, 0)),
        total_iva: round2(providers.reduce((s, p) => s + p.total_iva, 0)),
      };
      setData({ totales, providers });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return data.providers;
    return data.providers.filter(
      (p) =>
        (p.nombre || "").toLowerCase().includes(q) ||
        (p.cif_nif || "").toLowerCase().includes(q) ||
        (p.email || "").toLowerCase().includes(q)
    );
  }, [data.providers, search]);

  const toggle = (id) => setExpanded((e) => ({ ...e, [id]: !e[id] }));

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

  const t = data.totales || {};

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Building2 className="text-purple-500" size={28} />
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Proveedores</h1>
              <p className="text-sm text-slate-500">
                Facturación, IVA y balances por proveedor
              </p>
            </div>
          </div>
          <button
            onClick={load}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500 text-white hover:bg-purple-600 transition"
          >
            <RefreshCw size={16} /> Actualizar
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-100 text-red-700 text-sm">{error}</div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard icon={Building2} color="text-purple-500" label="Proveedores" value={t.num_proveedores ?? filtered.length} />
          <StatCard icon={Receipt} color="text-blue-500" label="Facturas" value={t.num_facturas ?? "\u2014"} />
          <StatCard icon={Euro} color="text-green-500" label="Total facturado" value={eur(t.total_facturado)} />
          <StatCard icon={TrendingUp} color="text-amber-500" label="Total IVA" value={eur(t.total_iva)} />
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-3 text-slate-400" size={18} />
          <Input
            placeholder="Buscar proveedor, CIF o email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* List */}
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Building2 size={40} className="mx-auto mb-4 opacity-40" />
            <p>No hay proveedores todavía.</p>
            <p className="text-xs mt-1">
              Se crearán automáticamente al procesar facturas recibidas.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((p) => {
              const isOpen = !!expanded[p.id];
              return (
                <Card key={p.id} className="overflow-hidden">
                  <CardContent className="p-0">
                    <button
                      onClick={() => toggle(p.id)}
                      className="w-full flex items-center gap-4 p-4 hover:bg-slate-50 transition text-left"
                    >
                      <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                        <Building2 className="text-purple-600" size={20} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-900 truncate">{p.nombre}</p>
                        <p className="text-xs text-slate-500">
                          {p.cif_nif || "Sin CIF"} · {p.num_facturas} factura(s) · última {fmtDate(p.ultima_factura)}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-bold text-slate-900">{eur(p.total_facturado)}</p>
                        <p className="text-xs text-slate-500">IVA {eur(p.total_iva)}</p>
                      </div>
                      {isOpen ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                    </button>

                    {isOpen && (
                      <div className="border-t border-slate-100 bg-slate-50/50 p-4">
                        {/* Desglose IVA */}
                        {p.desglose_iva && Object.keys(p.desglose_iva).length > 0 && (
                          <div className="mb-3 flex flex-wrap gap-2">
                            {Object.entries(p.desglose_iva).map(([pct, v]) => (
                              <Badge key={pct} variant="secondary" className="text-xs">
                                IVA {pct}%: base {eur(v.base)} · cuota {eur(v.cuota)} ({v.facturas})
                              </Badge>
                            ))}
                          </div>
                        )}
                        {/* Facturas */}
                        <div className="space-y-1">
                          {(p.facturas || []).map((f, i) => (
                            <div
                              key={f.id || i}
                              className="flex items-center justify-between text-sm py-1.5 px-2 rounded hover:bg-white"
                            >
                              <div className="min-w-0 flex-1">
                                <span className="text-slate-700 truncate">
                                  {f.numero ? `#${f.numero} · ` : ""}{f.archivo || "documento"}
                                </span>
                              </div>
                              <span className="text-slate-500 mx-3 whitespace-nowrap">{fmtDate(f.fecha)}</span>
                              <span className="font-medium text-slate-900 whitespace-nowrap">{eur(f.total)}</span>
                            </div>
                          ))}
                        </div>
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

function StatCard({ icon: Icon, color, label, value }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-1">
          <Icon className={color} size={18} />
          <span className="text-xs text-slate-500">{label}</span>
        </div>
        <p className="text-xl font-bold text-slate-900">{value}</p>
      </CardContent>
    </Card>
  );
}
