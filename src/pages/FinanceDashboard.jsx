import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  TrendingUp, TrendingDown, DollarSign, FileText, Package, Users, 
  AlertTriangle, CheckCircle2, Clock, Building2, ShoppingCart,
  ArrowUpRight, ArrowDownRight, Eye, Calendar, BarChart3
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format, isValid } from "date-fns";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function FinanceDashboard() {
  const [activeTab, setActiveTab] = useState('resumen');

  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => base44.entities.Invoice.list('-invoice_date'),
  });

  const { data: providers = [] } = useQuery({
    queryKey: ['providers'],
    queryFn: () => base44.entities.Provider.list(),
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list('-total_spent'),
  });

  const { data: salesInvoices = [] } = useQuery({
    queryKey: ['sales-invoices'],
    queryFn: () => base44.entities.SalesInvoice.list('-invoice_date'),
  });

  // KPIs
  const totalGastos = invoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
  const totalIngresos = salesInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
  const pendientePago = invoices.filter(inv => inv.status === 'pendiente').reduce((sum, inv) => sum + (inv.total || 0), 0);
  const pendienteCobro = salesInvoices.filter(inv => inv.status !== 'pagada').reduce((sum, inv) => sum + (inv.total || 0), 0);
  const margenBruto = totalIngresos - totalGastos;

  // Facturas vencidas
  const facturasVencidas = invoices.filter(inv => inv.status === 'vencida');
  
  // Productos con precio subiendo
  const preciosSubiendo = products.filter(p => p.price_trend === 'subiendo').slice(0, 5);
  
  // Top proveedores por gasto
  const gastosPorProveedor = invoices.reduce((acc, inv) => {
    const prov = inv.provider_name || 'Sin proveedor';
    acc[prov] = (acc[prov] || 0) + (inv.total || 0);
    return acc;
  }, {});
  const topProveedores = Object.entries(gastosPorProveedor)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, total]) => ({ name, total }));

  // Evolución mensual
  const gastosMensuales = invoices.reduce((acc, inv) => {
    if (inv.invoice_date) {
      const month = inv.invoice_date.substring(0, 7);
      if (!acc[month]) acc[month] = { month, gastos: 0, ingresos: 0 };
      acc[month].gastos += inv.total || 0;
    }
    return acc;
  }, {});
  
  salesInvoices.forEach(inv => {
    if (inv.invoice_date) {
      const month = inv.invoice_date.substring(0, 7);
      if (!gastosMensuales[month]) gastosMensuales[month] = { month, gastos: 0, ingresos: 0 };
      gastosMensuales[month].ingresos += inv.total || 0;
    }
  });

  const chartData = Object.values(gastosMensuales).sort((a, b) => a.month.localeCompare(b.month)).slice(-6);

  // Por categoría
  const porCategoria = invoices.reduce((acc, inv) => {
    const cat = inv.category || 'otros';
    if (!acc[cat]) acc[cat] = { name: cat, value: 0 };
    acc[cat].value += inv.total || 0;
    return acc;
  }, {});
  const pieData = Object.values(porCategoria);
  const pieColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return isValid(date) ? format(date, 'dd/MM/yyyy') : '';
  };

  return (
    <div className="p-4 md:p-8 min-h-screen bg-gradient-to-br from-zinc-950 via-neutral-900 to-zinc-950">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-3 h-3 bg-cyan-400 rounded-full animate-pulse" style={{ boxShadow: '0 0 10px rgba(6, 182, 212, 0.8)' }} />
            <span className="text-sm font-medium text-cyan-400" style={{ textShadow: '0 0 10px rgba(6, 182, 212, 0.6)' }}>Panel Financiero • Vista Unificada</span>
          </div>
          <h1 className="text-4xl font-black text-white mb-2 flex items-center gap-4">
            <div 
              className="w-14 h-14 bg-black rounded-2xl flex items-center justify-center border border-cyan-500/50"
              style={{ boxShadow: '0 0 25px rgba(6, 182, 212, 0.4), inset 0 0 15px rgba(6, 182, 212, 0.1)' }}
            >
              <BarChart3 className="w-8 h-8 text-cyan-400" style={{ filter: 'drop-shadow(0 0 8px rgba(6, 182, 212, 0.8))' }} />
            </div>
            <span className="text-cyan-400" style={{ textShadow: '0 0 15px rgba(6, 182, 212, 0.6)' }}>FINANZAS</span>
          </h1>
          <p className="text-lg text-zinc-400">Todo tu negocio en una vista</p>
        </div>

        {/* KPIs Principales */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <Card className="border-none shadow-xl bg-gradient-to-br from-green-600 to-emerald-700 text-white">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <ArrowUpRight className="w-6 h-6 opacity-80" />
                <TrendingUp className="w-4 h-4" />
              </div>
              <p className="text-xs opacity-80">Ingresos</p>
              <p className="text-2xl font-bold">{totalIngresos.toFixed(0)}€</p>
            </CardContent>
          </Card>
          
          <Card className="border-none shadow-xl bg-gradient-to-br from-red-600 to-rose-700 text-white">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <ArrowDownRight className="w-6 h-6 opacity-80" />
                <TrendingDown className="w-4 h-4" />
              </div>
              <p className="text-xs opacity-80">Gastos</p>
              <p className="text-2xl font-bold">{totalGastos.toFixed(0)}€</p>
            </CardContent>
          </Card>

          <Card className={`border-none shadow-xl text-white ${margenBruto >= 0 ? 'bg-gradient-to-br from-blue-600 to-indigo-700' : 'bg-gradient-to-br from-orange-600 to-red-700'}`}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <DollarSign className="w-6 h-6 opacity-80" />
                {margenBruto >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              </div>
              <p className="text-xs opacity-80">Margen</p>
              <p className="text-2xl font-bold">{margenBruto.toFixed(0)}€</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-xl bg-gradient-to-br from-yellow-600 to-orange-600 text-white">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <Clock className="w-6 h-6 opacity-80" />
                <AlertTriangle className="w-4 h-4" />
              </div>
              <p className="text-xs opacity-80">Pdte Pagar</p>
              <p className="text-2xl font-bold">{pendientePago.toFixed(0)}€</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-xl bg-gradient-to-br from-purple-600 to-violet-700 text-white">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <Clock className="w-6 h-6 opacity-80" />
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <p className="text-xs opacity-80">Pdte Cobrar</p>
              <p className="text-2xl font-bold">{pendienteCobro.toFixed(0)}€</p>
            </CardContent>
          </Card>
        </div>

        {/* Alertas */}
        {(facturasVencidas.length > 0 || preciosSubiendo.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {facturasVencidas.length > 0 && (
              <Link to={createPageUrl("BiloopImport")}>
                <Card className="border-none shadow-xl bg-red-900/30 border border-red-500/30 hover:bg-red-900/50 hover:border-red-500/50 transition-all cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle className="w-5 h-5 text-red-400" />
                      <span className="font-bold text-red-400">⚠️ {facturasVencidas.length} Facturas Vencidas</span>
                    </div>
                    <div className="space-y-2">
                      {facturasVencidas.slice(0, 3).map(inv => (
                        <div key={inv.id} className="flex justify-between text-sm">
                          <span className="text-gray-300">{inv.provider_name}</span>
                          <span className="text-red-400 font-bold">{inv.total?.toFixed(2)}€</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )}
            
            {preciosSubiendo.length > 0 && (
              <Link to={createPageUrl("ProductInventory")}>
                <Card className="border-none shadow-xl bg-orange-900/30 border border-orange-500/30 hover:bg-orange-900/50 hover:border-orange-500/50 transition-all cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <TrendingUp className="w-5 h-5 text-orange-400" />
                      <span className="font-bold text-orange-400">📈 Precios Subiendo</span>
                    </div>
                    <div className="space-y-2">
                      {preciosSubiendo.map(prod => (
                        <div key={prod.id} className="flex justify-between text-sm">
                          <span className="text-gray-300 truncate">{prod.name}</span>
                          <Badge className="bg-orange-600 text-white">+{prod.price_change_percent?.toFixed(1)}%</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )}
          </div>
        )}

        {/* Contenido Principal */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Gráfico evolución */}
          <Card className="border-none shadow-xl bg-zinc-800/50 border border-zinc-800 lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-white">Evolución Mensual</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="month" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none' }} />
                  <Bar dataKey="ingresos" fill="#10b981" name="Ingresos" />
                  <Bar dataKey="gastos" fill="#ef4444" name="Gastos" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Por categoría */}
          <Card className="border-none shadow-xl bg-zinc-800/50 border border-zinc-800">
            <CardHeader>
              <CardTitle className="text-white">Gastos por Categoría</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name }) => name}>
                    {pieData.map((entry, index) => (<Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />))}
                  </Pie>
                  <Tooltip formatter={(value) => `${value.toFixed(0)}€`} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Resúmenes rápidos */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Top Proveedores */}
          <Link to={createPageUrl("Providers")}>
            <Card className="border-none shadow-xl bg-zinc-800/50 border border-zinc-800 hover:bg-zinc-800 hover:border-purple-500/50 transition-all cursor-pointer h-full">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-white text-lg">Top Proveedores</CardTitle>
                <Eye className="w-4 h-4 text-blue-400" />
              </CardHeader>
              <CardContent className="space-y-3">
                {topProveedores.map((prov, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold ${idx < 3 ? 'bg-blue-600' : 'bg-slate-600'}`}>{idx + 1}</div>
                      <span className="text-gray-300 truncate">{prov.name}</span>
                    </div>
                    <span className="text-white font-bold">{prov.total.toFixed(0)}€</span>
                  </div>
                ))}
                {topProveedores.length === 0 && <p className="text-gray-500 text-center py-4">Sin datos</p>}
              </CardContent>
            </Card>
          </Link>

          {/* Últimas Facturas Compra */}
          <Link to={createPageUrl("BiloopImport")}>
            <Card className="border-none shadow-xl bg-zinc-800/50 border border-zinc-800 hover:bg-zinc-800 hover:border-blue-500/50 transition-all cursor-pointer h-full">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-white text-lg">Últimas Compras</CardTitle>
                <Eye className="w-4 h-4 text-blue-400" />
              </CardHeader>
              <CardContent className="space-y-3">
                {invoices.slice(0, 5).map(inv => (
                  <div key={inv.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-300 text-sm truncate">{inv.provider_name}</p>
                      <p className="text-gray-500 text-xs">{formatDate(inv.invoice_date)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-white font-bold">{inv.total?.toFixed(2)}€</p>
                      <Badge className={inv.status === 'pagada' ? 'bg-green-600' : inv.status === 'vencida' ? 'bg-red-600' : 'bg-yellow-600'}>{inv.status}</Badge>
                    </div>
                  </div>
                ))}
                {invoices.length === 0 && <p className="text-gray-500 text-center py-4">Sin facturas</p>}
              </CardContent>
            </Card>
          </Link>

          {/* Productos más gastados */}
          <Link to={createPageUrl("ProductInventory")}>
            <Card className="border-none shadow-xl bg-zinc-800/50 border border-zinc-800 hover:bg-zinc-800 hover:border-emerald-500/50 transition-all cursor-pointer h-full">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-white text-lg">Top Productos</CardTitle>
                <Eye className="w-4 h-4 text-blue-400" />
              </CardHeader>
              <CardContent className="space-y-3">
                {products.slice(0, 5).map((prod, idx) => (
                  <div key={prod.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold ${idx < 3 ? 'bg-emerald-600' : 'bg-slate-600'}`}>{idx + 1}</div>
                      <span className="text-gray-300 truncate text-sm">{prod.name}</span>
                    </div>
                    <span className="text-white font-bold">{prod.total_spent?.toFixed(0)}€</span>
                  </div>
                ))}
                {products.length === 0 && <p className="text-gray-500 text-center py-4">Sin productos</p>}
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Stats rápidos */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
          <Link to={createPageUrl("BiloopImport")}>
            <Card className="border-none shadow-lg bg-zinc-800/50 border border-zinc-800 hover:bg-zinc-800 hover:border-blue-500/50 transition-all cursor-pointer">
              <CardContent className="p-4 text-center">
                <FileText className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                <p className="text-2xl font-bold text-white">{invoices.length}</p>
                <p className="text-sm text-gray-400">Facturas Compra</p>
              </CardContent>
            </Card>
          </Link>
          <Link to={createPageUrl("Billing")}>
            <Card className="border-none shadow-lg bg-zinc-800/50 border border-zinc-800 hover:bg-zinc-800 hover:border-green-500/50 transition-all cursor-pointer">
              <CardContent className="p-4 text-center">
                <FileText className="w-8 h-8 text-green-400 mx-auto mb-2" />
                <p className="text-2xl font-bold text-white">{salesInvoices.length}</p>
                <p className="text-sm text-gray-400">Facturas Venta</p>
              </CardContent>
            </Card>
          </Link>
          <Link to={createPageUrl("Providers")}>
            <Card className="border-none shadow-lg bg-zinc-800/50 border border-zinc-800 hover:bg-zinc-800 hover:border-purple-500/50 transition-all cursor-pointer">
              <CardContent className="p-4 text-center">
                <Users className="w-8 h-8 text-purple-400 mx-auto mb-2" />
                <p className="text-2xl font-bold text-white">{providers.length}</p>
                <p className="text-sm text-gray-400">Proveedores</p>
              </CardContent>
            </Card>
          </Link>
          <Link to={createPageUrl("ProductInventory")}>
            <Card className="border-none shadow-lg bg-zinc-800/50 border border-zinc-800 hover:bg-zinc-800 hover:border-emerald-500/50 transition-all cursor-pointer">
              <CardContent className="p-4 text-center">
                <Package className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                <p className="text-2xl font-bold text-white">{products.length}</p>
                <p className="text-sm text-gray-400">Productos</p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}