import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Package, TrendingUp, TrendingDown, Minus, Search, Loader2, BarChart3,
  DollarSign, ShoppingCart, AlertTriangle, Building2, ArrowUpRight, ArrowDownRight, Sparkles
} from "lucide-react";
import { toast } from "sonner";
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// Force rebuild
export default function ProductInventory() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const queryClient = useQueryClient();

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list('-total_spent'),
  });

  const { data: purchases = [] } = useQuery({
    queryKey: ['product-purchases'],
    queryFn: () => base44.entities.ProductPurchase.list('-purchase_date'),
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => base44.entities.Invoice.list(),
  });

  const analyzeInvoices = async () => {
    setIsAnalyzing(true);
    
    try {
      toast.info('🔍 Analizando facturas para extraer productos...', { duration: 5000 });

      const invoicesWithPdf = invoices.filter(inv => inv.file_url);
      
      for (const invoice of invoicesWithPdf.slice(0, 30)) {
        try {
          const extraction = await base44.integrations.Core.InvokeLLM({
            prompt: `Analiza esta factura y extrae TODOS los productos/items con cantidades y precios.
            Proveedor: ${invoice.provider_name}
            Fecha: ${invoice.invoice_date}`,
            file_urls: [invoice.file_url],
            response_json_schema: {
              type: "object",
              properties: {
                items: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      quantity: { type: "number" },
                      unit: { type: "string" },
                      unit_price: { type: "number" },
                      total: { type: "number" }
                    }
                  }
                }
              }
            }
          });

          if (extraction.items?.length > 0) {
            const month = invoice.invoice_date ? invoice.invoice_date.substring(0, 7) : '';
            for (const item of extraction.items) {
              if (!item.name?.trim()) continue;
              await base44.entities.ProductPurchase.create({
                product_name: item.name,
                provider_name: invoice.provider_name,
                invoice_id: invoice.id,
                invoice_number: invoice.invoice_number,
                purchase_date: invoice.invoice_date,
                quantity: item.quantity || 1,
                unit: item.unit || 'unidad',
                unit_price: item.unit_price || 0,
                total_price: item.total || (item.quantity * item.unit_price) || 0,
                month: month
              });
            }
          }
        } catch (err) {
          console.error(`Error factura ${invoice.invoice_number}:`, err);
        }
      }

      await recalculateProductStats();
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product-purchases'] });
      toast.success('✅ Análisis de productos completado');
    } catch (error) {
      toast.error('Error: ' + error.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const recalculateProductStats = async () => {
    const allPurchases = await base44.entities.ProductPurchase.list();
    const productMap = {};
    
    for (const purchase of allPurchases) {
      const key = purchase.product_name.toLowerCase().trim();
      if (!productMap[key]) {
        productMap[key] = { name: purchase.product_name, purchases: [], suppliers: {}, totalQty: 0, totalSpent: 0, prices: [] };
      }
      productMap[key].purchases.push(purchase);
      productMap[key].totalQty += purchase.quantity || 0;
      productMap[key].totalSpent += purchase.total_price || 0;
      productMap[key].prices.push({ price: purchase.unit_price, date: purchase.purchase_date });
      
      const provider = purchase.provider_name;
      if (!productMap[key].suppliers[provider]) {
        productMap[key].suppliers[provider] = { provider_name: provider, prices: [], count: 0 };
      }
      productMap[key].suppliers[provider].prices.push(purchase.unit_price);
      productMap[key].suppliers[provider].count++;
    }

    const existingProducts = await base44.entities.Product.list();
    const existingByName = {};
    existingProducts.forEach(p => { existingByName[p.name.toLowerCase().trim()] = p; });

    for (const [key, data] of Object.entries(productMap)) {
      const prices = data.prices.map(p => p.price).filter(p => p > 0);
      const sortedPrices = data.prices.sort((a, b) => new Date(a.date) - new Date(b.date));
      
      const avgPrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
      const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
      const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
      const lastPrice = sortedPrices.length > 0 ? sortedPrices[sortedPrices.length - 1].price : 0;
      const prevPrice = sortedPrices.length > 1 ? sortedPrices[sortedPrices.length - 2].price : lastPrice;
      
      const priceChange = prevPrice > 0 ? ((lastPrice - prevPrice) / prevPrice) * 100 : 0;
      let trend = 'estable';
      if (priceChange > 5) trend = 'subiendo';
      else if (priceChange < -5) trend = 'bajando';

      const suppliers = Object.values(data.suppliers).map(s => ({
        provider_name: s.provider_name,
        last_price: s.prices[s.prices.length - 1],
        average_price: s.prices.reduce((a, b) => a + b, 0) / s.prices.length,
        purchase_count: s.count
      }));

      const productData = {
        name: data.name,
        total_quantity_purchased: data.totalQty,
        total_spent: data.totalSpent,
        average_price: avgPrice,
        last_price: lastPrice,
        min_price: minPrice,
        max_price: maxPrice,
        price_trend: trend,
        price_change_percent: priceChange,
        purchase_count: data.purchases.length,
        last_purchase_date: sortedPrices.length > 0 ? sortedPrices[sortedPrices.length - 1].date : '',
        suppliers: suppliers
      };

      if (existingByName[key]) {
        await base44.entities.Product.update(existingByName[key].id, productData);
      } else {
        await base44.entities.Product.create(productData);
      }
    }
  };

  const filteredProducts = products.filter(p => !searchQuery || p.name?.toLowerCase().includes(searchQuery.toLowerCase()));
  const topProducts = [...products].sort((a, b) => (b.purchase_count || 0) - (a.purchase_count || 0)).slice(0, 10);
  const leastUsedProducts = [...products].sort((a, b) => (a.purchase_count || 0) - (b.purchase_count || 0)).slice(0, 10);
  const priceIncreasing = products.filter(p => p.price_trend === 'subiendo').sort((a, b) => (b.price_change_percent || 0) - (a.price_change_percent || 0));
  const priceDecreasing = products.filter(p => p.price_trend === 'bajando');

  const categoryData = products.reduce((acc, p) => {
    const cat = p.category || 'otros';
    if (!acc[cat]) acc[cat] = { name: cat, total: 0, count: 0 };
    acc[cat].total += p.total_spent || 0;
    acc[cat].count++;
    return acc;
  }, {});
  const pieData = Object.values(categoryData);
  const pieColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

  const monthlyPrices = purchases.reduce((acc, p) => {
    if (!p.month) return acc;
    if (!acc[p.month]) acc[p.month] = { month: p.month, total: 0, count: 0 };
    acc[p.month].total += p.total_price || 0;
    acc[p.month].count++;
    return acc;
  }, {});
  const monthlyData = Object.values(monthlyPrices).sort((a, b) => a.month.localeCompare(b.month));

  const totalProducts = products.length;
  const totalSpent = products.reduce((sum, p) => sum + (p.total_spent || 0), 0);
  const avgPriceIncrease = priceIncreasing.length > 0 ? priceIncreasing.reduce((sum, p) => sum + (p.price_change_percent || 0), 0) / priceIncreasing.length : 0;

  const trendIcon = (trend) => {
    if (trend === 'subiendo') return <TrendingUp className="w-4 h-4 text-red-500" />;
    if (trend === 'bajando') return <TrendingDown className="w-4 h-4 text-green-500" />;
    return <Minus className="w-4 h-4 text-gray-400" />;
  };

  const trendBadge = (trend, percent) => {
    if (trend === 'subiendo') return <Badge className="bg-red-100 text-red-700">+{percent?.toFixed(1)}%</Badge>;
    if (trend === 'bajando') return <Badge className="bg-green-100 text-green-700">{percent?.toFixed(1)}%</Badge>;
    return <Badge className="bg-gray-100 text-gray-600">Estable</Badge>;
  };

  return (
    <div className="p-4 md:p-8 min-h-screen bg-gradient-to-br from-zinc-950 via-neutral-900 to-zinc-950">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-3 h-3 bg-cyan-400 rounded-full animate-pulse" style={{ boxShadow: '0 0 10px rgba(6, 182, 212, 0.8)' }} />
            <span className="text-sm font-medium text-cyan-400" style={{ textShadow: '0 0 10px rgba(6, 182, 212, 0.6)' }}>Inventario de Productos • Análisis de Precios</span>
          </div>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <h1 className="text-4xl font-black text-white mb-2 flex items-center gap-4">
                <div 
                  className="w-14 h-14 bg-black rounded-2xl flex items-center justify-center border border-cyan-500/50"
                  style={{ boxShadow: '0 0 25px rgba(6, 182, 212, 0.4), inset 0 0 15px rgba(6, 182, 212, 0.1)' }}
                >
                  <Package className="w-8 h-8 text-cyan-400" style={{ filter: 'drop-shadow(0 0 8px rgba(6, 182, 212, 0.8))' }} />
                </div>
                <span className="text-cyan-400" style={{ textShadow: '0 0 15px rgba(6, 182, 212, 0.6)' }}>INVENTARIO DE PRODUCTOS</span>
              </h1>
              <p className="text-lg text-zinc-400">📊 Análisis de compras, precios y tendencias</p>
            </div>
            <Button 
              onClick={analyzeInvoices} 
              disabled={isAnalyzing} 
              size="lg" 
              className="bg-black border border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10 font-bold"
              style={{ boxShadow: '0 0 15px rgba(6, 182, 212, 0.3)' }}
            >
              {isAnalyzing ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Analizando...</> : <><Sparkles className="w-5 h-5 mr-2" />Analizar Facturas con IA</>}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="border-none shadow-xl bg-gradient-to-br from-blue-600 to-blue-700 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2"><Package className="w-8 h-8 opacity-80" /><BarChart3 className="w-5 h-5" /></div>
              <p className="text-sm opacity-90">Total Productos</p>
              <p className="text-3xl font-bold">{totalProducts}</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-xl bg-gradient-to-br from-green-600 to-emerald-700 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2"><DollarSign className="w-8 h-8 opacity-80" /><TrendingUp className="w-5 h-5" /></div>
              <p className="text-sm opacity-90">Gasto Total</p>
              <p className="text-3xl font-bold">{totalSpent.toFixed(0)}€</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-xl bg-gradient-to-br from-red-600 to-rose-700 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2"><AlertTriangle className="w-8 h-8 opacity-80" /><ArrowUpRight className="w-5 h-5" /></div>
              <p className="text-sm opacity-90">Precios Subiendo</p>
              <p className="text-3xl font-bold">{priceIncreasing.length}</p>
              <p className="text-xs opacity-75">Media: +{avgPriceIncrease.toFixed(1)}%</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-xl bg-gradient-to-br from-purple-600 to-violet-700 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2"><ShoppingCart className="w-8 h-8 opacity-80" /><ArrowDownRight className="w-5 h-5" /></div>
              <p className="text-sm opacity-90">Precios Bajando</p>
              <p className="text-3xl font-bold">{priceDecreasing.length}</p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5 mb-6 bg-slate-800">
            <TabsTrigger value="overview">📊 Resumen</TabsTrigger>
            <TabsTrigger value="top">🔥 Más Usados</TabsTrigger>
            <TabsTrigger value="least">📉 Menos Usados</TabsTrigger>
            <TabsTrigger value="prices">💰 Precios</TabsTrigger>
            <TabsTrigger value="all">📋 Todos</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border-none shadow-xl bg-slate-800">
                <CardHeader><CardTitle className="text-white">Gasto por Categoría</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={pieData} dataKey="total" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {pieData.map((entry, index) => (<Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />))}
                      </Pie>
                      <Tooltip formatter={(value) => `${value.toFixed(2)}€`} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card className="border-none shadow-xl bg-slate-800">
                <CardHeader><CardTitle className="text-white">Evolución de Compras por Mes</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="month" stroke="#9ca3af" />
                      <YAxis stroke="#9ca3af" />
                      <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none' }} />
                      <Line type="monotone" dataKey="total" stroke="#10b981" strokeWidth={3} name="Total €" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
            {priceIncreasing.length > 0 && (
              <Card className="border-none shadow-xl bg-gradient-to-r from-red-900/50 to-orange-900/50 border-red-500/50">
                <CardHeader><CardTitle className="text-white flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-red-400" />⚠️ Productos con Precio Subiendo</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {priceIncreasing.slice(0, 6).map((product) => (
                      <div key={product.id} className="bg-slate-800 rounded-xl p-4 border border-red-500/30 cursor-pointer hover:bg-slate-700" onClick={() => setSelectedProduct(product)}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-white truncate">{product.name}</span>
                          {trendBadge(product.price_trend, product.price_change_percent)}
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-400">Último: {product.last_price?.toFixed(2)}€</span>
                          <span className="text-gray-400">Media: {product.average_price?.toFixed(2)}€</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="top" className="space-y-4">
            <Card className="border-none shadow-xl bg-slate-800">
              <CardHeader><CardTitle className="text-white">🔥 Top 10 Productos Más Comprados</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {topProducts.map((product, idx) => (
                    <div key={product.id} className="flex items-center justify-between p-4 bg-slate-700 rounded-xl hover:bg-slate-600 cursor-pointer" onClick={() => setSelectedProduct(product)}>
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white ${idx < 3 ? 'bg-gradient-to-br from-yellow-500 to-orange-500' : 'bg-slate-600'}`}>{idx + 1}</div>
                        <div>
                          <p className="font-bold text-white">{product.name}</p>
                          <p className="text-sm text-gray-400">{product.purchase_count} compras • {product.total_quantity_purchased} unidades</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-emerald-400">{product.total_spent?.toFixed(2)}€</p>
                        <div className="flex items-center gap-2 justify-end">{trendIcon(product.price_trend)}<span className="text-sm text-gray-400">{product.last_price?.toFixed(2)}€/ud</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="least" className="space-y-4">
            <Card className="border-none shadow-xl bg-slate-800">
              <CardHeader><CardTitle className="text-white">📉 Productos Menos Comprados</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {leastUsedProducts.map((product) => (
                    <div key={product.id} className="flex items-center justify-between p-4 bg-slate-700 rounded-xl hover:bg-slate-600 cursor-pointer" onClick={() => setSelectedProduct(product)}>
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-gray-600 rounded-xl flex items-center justify-center"><Package className="w-5 h-5 text-gray-400" /></div>
                        <div><p className="font-bold text-white">{product.name}</p><p className="text-sm text-gray-400">{product.purchase_count} compras</p></div>
                      </div>
                      <div className="text-right"><p className="text-lg font-bold text-gray-300">{product.total_spent?.toFixed(2)}€</p><span className="text-sm text-gray-400">{product.last_price?.toFixed(2)}€/ud</span></div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="prices" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border-none shadow-xl bg-slate-800 border-l-4 border-red-500">
                <CardHeader><CardTitle className="text-white flex items-center gap-2"><TrendingUp className="w-5 h-5 text-red-500" />Precios Subiendo</CardTitle></CardHeader>
                <CardContent className="space-y-3 max-h-96 overflow-y-auto">
                  {priceIncreasing.map((product) => (
                    <div key={product.id} className="flex items-center justify-between p-3 bg-red-900/20 rounded-lg cursor-pointer hover:bg-red-900/30" onClick={() => setSelectedProduct(product)}>
                      <span className="text-white font-medium truncate">{product.name}</span>
                      <Badge className="bg-red-600 text-white">+{product.price_change_percent?.toFixed(1)}%</Badge>
                    </div>
                  ))}
                  {priceIncreasing.length === 0 && <p className="text-gray-400 text-center py-4">No hay productos con precio subiendo</p>}
                </CardContent>
              </Card>
              <Card className="border-none shadow-xl bg-slate-800 border-l-4 border-green-500">
                <CardHeader><CardTitle className="text-white flex items-center gap-2"><TrendingDown className="w-5 h-5 text-green-500" />Precios Bajando</CardTitle></CardHeader>
                <CardContent className="space-y-3 max-h-96 overflow-y-auto">
                  {priceDecreasing.map((product) => (
                    <div key={product.id} className="flex items-center justify-between p-3 bg-green-900/20 rounded-lg cursor-pointer hover:bg-green-900/30" onClick={() => setSelectedProduct(product)}>
                      <span className="text-white font-medium truncate">{product.name}</span>
                      <Badge className="bg-green-600 text-white">{product.price_change_percent?.toFixed(1)}%</Badge>
                    </div>
                  ))}
                  {priceDecreasing.length === 0 && <p className="text-gray-400 text-center py-4">No hay productos con precio bajando</p>}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="all" className="space-y-4">
            <div className="flex gap-4 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input placeholder="Buscar producto..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 bg-slate-800 border-slate-600 text-white" />
              </div>
            </div>
            <Card className="border-none shadow-xl bg-slate-800">
              <CardContent className="p-0">
                <div className="divide-y divide-slate-700">
                  {filteredProducts.map((product) => (
                    <div key={product.id} className="flex items-center justify-between p-4 hover:bg-slate-700 cursor-pointer" onClick={() => setSelectedProduct(product)}>
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center"><Package className="w-6 h-6 text-white" /></div>
                        <div><p className="font-bold text-white">{product.name}</p><div className="flex items-center gap-3 text-sm text-gray-400"><span>{product.purchase_count} compras</span><span>•</span><span>{product.suppliers?.length || 0} proveedores</span></div></div>
                      </div>
                      <div className="text-right flex items-center gap-4">
                        <div><p className="text-lg font-bold text-white">{product.last_price?.toFixed(2)}€</p><p className="text-sm text-gray-400">Media: {product.average_price?.toFixed(2)}€</p></div>
                        {trendBadge(product.price_trend, product.price_change_percent)}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={!!selectedProduct} onOpenChange={() => setSelectedProduct(null)}>
          <DialogContent className="max-w-2xl bg-slate-900 border-slate-700 text-white">
            <DialogHeader><DialogTitle className="text-2xl flex items-center gap-3"><Package className="w-8 h-8 text-emerald-400" />{selectedProduct?.name}</DialogTitle></DialogHeader>
            {selectedProduct && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-slate-800 rounded-xl p-4 text-center"><p className="text-2xl font-bold text-emerald-400">{selectedProduct.purchase_count}</p><p className="text-sm text-gray-400">Compras</p></div>
                  <div className="bg-slate-800 rounded-xl p-4 text-center"><p className="text-2xl font-bold text-blue-400">{selectedProduct.total_spent?.toFixed(0)}€</p><p className="text-sm text-gray-400">Gasto Total</p></div>
                  <div className="bg-slate-800 rounded-xl p-4 text-center"><p className="text-2xl font-bold text-white">{selectedProduct.last_price?.toFixed(2)}€</p><p className="text-sm text-gray-400">Último Precio</p></div>
                  <div className="bg-slate-800 rounded-xl p-4 text-center"><p className="text-2xl font-bold text-purple-400">{selectedProduct.average_price?.toFixed(2)}€</p><p className="text-sm text-gray-400">Precio Medio</p></div>
                </div>
                <div className="bg-slate-800 rounded-xl p-4">
                  <p className="text-sm text-gray-400 mb-2">Rango de Precios</p>
                  <div className="flex items-center justify-between">
                    <span className="text-green-400 font-bold">Min: {selectedProduct.min_price?.toFixed(2)}€</span>
                    <div className="flex-1 mx-4 h-2 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 rounded-full" />
                    <span className="text-red-400 font-bold">Max: {selectedProduct.max_price?.toFixed(2)}€</span>
                  </div>
                </div>
                {selectedProduct.suppliers?.length > 0 && (
                  <div>
                    <p className="font-bold text-white mb-3 flex items-center gap-2"><Building2 className="w-5 h-5" />Proveedores ({selectedProduct.suppliers.length})</p>
                    <div className="space-y-2">
                      {selectedProduct.suppliers.sort((a, b) => a.average_price - b.average_price).map((supplier, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-slate-800 rounded-lg">
                          <div className="flex items-center gap-3">{idx === 0 && <Badge className="bg-green-600 text-white">Mejor precio</Badge>}<span className="text-white">{supplier.provider_name}</span></div>
                          <div className="text-right"><p className="font-bold text-white">{supplier.average_price?.toFixed(2)}€</p><p className="text-xs text-gray-400">{supplier.purchase_count} compras</p></div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}