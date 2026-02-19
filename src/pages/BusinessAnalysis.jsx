import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { 
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle2,
  DollarSign, Building2, FileText, Loader2, RefreshCw,
  ArrowUp, ArrowDown, Search
} from "lucide-react";
import { toast } from "sonner";

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export default function BusinessAnalysis() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  const runScan = async () => {
    setLoading(true);
    toast.info('🔍 Escaneando negocio completo...');
    
    try {
      const response = await base44.functions.invoke('fullBusinessScan');
      setData(response.data.results);
      toast.success('✅ Análisis completado');
    } catch (error) {
      toast.error('❌ Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runScan();
  }, []);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value || 0);
  };

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-16 h-16 text-blue-500 animate-spin mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Analizando tu negocio...</h2>
          <p className="text-gray-400">Conectando con Biloop, analizando facturas y proveedores</p>
        </div>
      </div>
    );
  }

  const analysis = data?.analysis || {};
  const topProviders = analysis.top_providers || [];
  const priceChanges = analysis.price_changes || [];
  const recommendations = analysis.recommendations || [];
  const byCategory = analysis.by_category || {};

  // Preparar datos para gráficos
  const categoryData = Object.entries(byCategory).map(([name, data]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    total: data.total,
    count: data.count
  })).sort((a, b) => b.total - a.total);

  const providerData = topProviders.slice(0, 8).map(p => ({
    name: p.name.length > 15 ? p.name.substring(0, 15) + '...' : p.name,
    total: p.total_spent,
    facturas: p.invoice_count
  }));

  return (
    <div className="p-4 md:p-6 min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-cyan-600 rounded-2xl flex items-center justify-center shadow-2xl">
              <Search className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-white">ANÁLISIS DE NEGOCIO</h1>
              <p className="text-gray-400">Facturas, proveedores y comparativa de precios</p>
            </div>
          </div>
          
          <Button 
            onClick={runScan} 
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            {loading ? 'Escaneando...' : 'Actualizar Análisis'}
          </Button>
        </div>

        {/* KPIs Principales */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="bg-gradient-to-br from-blue-600 to-blue-800 border-none">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-200 text-sm">Total Facturas</p>
                  <p className="text-4xl font-black text-white">{analysis.total_invoices || 0}</p>
                </div>
                <FileText className="w-12 h-12 text-blue-300 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-600 to-emerald-800 border-none">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-emerald-200 text-sm">Total Gastado</p>
                  <p className="text-3xl font-black text-white">{formatCurrency(analysis.total_spent)}</p>
                </div>
                <DollarSign className="w-12 h-12 text-emerald-300 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-600 to-purple-800 border-none">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-200 text-sm">Proveedores</p>
                  <p className="text-4xl font-black text-white">{analysis.total_providers || 0}</p>
                </div>
                <Building2 className="w-12 h-12 text-purple-300 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-600 to-red-600 border-none">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-200 text-sm">Cambios Precio</p>
                  <p className="text-4xl font-black text-white">{priceChanges.length}</p>
                </div>
                <TrendingUp className="w-12 h-12 text-orange-300 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recomendaciones */}
        {recommendations.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {recommendations.map((rec, idx) => (
              <Card key={idx} className={`border-none ${
                rec.type === 'warning' ? 'bg-yellow-900/30 border-yellow-700' :
                rec.type === 'danger' ? 'bg-red-900/30 border-red-700' :
                'bg-blue-900/30 border-blue-700'
              }`}>
                <CardContent className="p-4">
                  <h4 className="text-white font-bold mb-2">{rec.title}</h4>
                  <p className="text-gray-300 text-sm">{rec.message}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-slate-800 border-slate-700 mb-6">
            <TabsTrigger value="overview">📊 Resumen</TabsTrigger>
            <TabsTrigger value="providers">🏢 Proveedores</TabsTrigger>
            <TabsTrigger value="prices">💰 Precios</TabsTrigger>
            <TabsTrigger value="categories">📁 Categorías</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Gasto por Proveedor */}
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white">💰 Gasto por Proveedor (Top 8)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={providerData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis type="number" stroke="#9ca3af" tickFormatter={(v) => `${(v/1000).toFixed(0)}k€`} />
                      <YAxis type="category" dataKey="name" stroke="#9ca3af" width={100} tick={{ fontSize: 11 }} />
                      <Tooltip 
                        formatter={(value) => formatCurrency(value)}
                        contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                      />
                      <Bar dataKey="total" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Gasto por Categoría */}
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white">📁 Gasto por Categoría</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="total"
                      >
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatCurrency(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Providers Tab */}
          <TabsContent value="providers">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">🏢 Ranking de Proveedores por Gasto</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {topProviders.map((provider, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 bg-slate-900 rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${
                          idx === 0 ? 'bg-yellow-500' : idx === 1 ? 'bg-gray-400' : idx === 2 ? 'bg-orange-600' : 'bg-slate-600'
                        }`}>
                          {idx + 1}
                        </div>
                        <div>
                          <p className="text-white font-bold">{provider.name}</p>
                          <p className="text-gray-400 text-sm">
                            {provider.invoice_count} facturas · Última: {provider.last_invoice ? new Date(provider.last_invoice).toLocaleDateString('es-ES') : 'N/A'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-emerald-400">{formatCurrency(provider.total_spent)}</p>
                        <p className="text-gray-400 text-sm">Media: {formatCurrency(provider.avg_invoice)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Prices Tab */}
          <TabsContent value="prices">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">📈 Cambios de Precio Detectados</CardTitle>
              </CardHeader>
              <CardContent>
                {priceChanges.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                    <p className="text-gray-400">No se detectaron cambios significativos de precio (&gt;5%)</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {priceChanges.map((change, idx) => {
                      const isIncrease = parseFloat(change.change_percent) > 0;
                      return (
                        <div key={idx} className={`p-4 rounded-lg border ${
                          isIncrease ? 'bg-red-900/20 border-red-700' : 'bg-green-900/20 border-green-700'
                        }`}>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-white font-bold">{change.product}</p>
                              <p className="text-gray-400 text-sm">Proveedor: {change.provider}</p>
                            </div>
                            <div className="text-right">
                              <div className="flex items-center gap-2">
                                {isIncrease ? (
                                  <ArrowUp className="w-5 h-5 text-red-400" />
                                ) : (
                                  <ArrowDown className="w-5 h-5 text-green-400" />
                                )}
                                <span className={`text-2xl font-bold ${isIncrease ? 'text-red-400' : 'text-green-400'}`}>
                                  {change.change_percent}%
                                </span>
                              </div>
                              <p className="text-gray-400 text-sm">
                                {formatCurrency(change.first_price)} → {formatCurrency(change.last_price)}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Categories Tab */}
          <TabsContent value="categories">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categoryData.map((cat, idx) => (
                <Card key={idx} className="bg-slate-800 border-slate-700">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-white font-bold text-lg">{cat.name}</h3>
                      <div 
                        className="w-4 h-4 rounded-full" 
                        style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                      />
                    </div>
                    <p className="text-3xl font-black text-white mb-2">{formatCurrency(cat.total)}</p>
                    <p className="text-gray-400">{cat.count} facturas</p>
                    {byCategory[cat.name.toLowerCase()]?.providers && (
                      <div className="mt-3 pt-3 border-t border-slate-700">
                        <p className="text-gray-500 text-xs mb-1">Proveedores:</p>
                        <p className="text-gray-300 text-sm">
                          {byCategory[cat.name.toLowerCase()].providers.slice(0, 3).join(', ')}
                          {byCategory[cat.name.toLowerCase()].providers.length > 3 && '...'}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}