import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Package, 
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle2,
  Clock,
  DollarSign,
  Utensils,
  BarChart3
} from "lucide-react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

export default function ProductionControl() {
  const { data: orders = [] } = useQuery({
    queryKey: ['production-orders'],
    queryFn: () => base44.entities.Order.list('-order_date', 200),
    initialData: [],
  });

  const { data: menuItems = [] } = useQuery({
    queryKey: ['menu-items'],
    queryFn: () => base44.entities.MenuItem.list(),
    initialData: [],
  });

  // Análisis de productos vendidos hoy
  const today = new Date().toISOString().split('T')[0];
  const todayOrders = orders.filter(o => o.order_date?.startsWith(today));
  
  const productStats = {};
  todayOrders.forEach(order => {
    order.items?.forEach(item => {
      if (!productStats[item.name]) {
        productStats[item.name] = {
          name: item.name,
          quantity: 0,
          revenue: 0
        };
      }
      productStats[item.name].quantity += item.quantity;
      productStats[item.name].revenue += (item.price * item.quantity);
    });
  });

  const topProducts = Object.values(productStats)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10);

  // Stats por hora
  const hourlyStats = Array(24).fill(0).map((_, hour) => {
    const hourOrders = todayOrders.filter(o => {
      if (!o.order_date) return false;
      return new Date(o.order_date).getHours() === hour;
    });
    return {
      hour: `${hour}:00`,
      orders: hourOrders.length,
      revenue: hourOrders.reduce((sum, o) => sum + (o.total || 0), 0)
    };
  }).filter(h => h.orders > 0);

  // Stats por canal
  const channelStats = {
    web: { count: 0, revenue: 0, color: '#3b82f6' },
    telefono: { count: 0, revenue: 0, color: '#10b981' },
    presencial: { count: 0, revenue: 0, color: '#f59e0b' },
    glovo: { count: 0, revenue: 0, color: '#ef4444' },
    uber_eats: { count: 0, revenue: 0, color: '#8b5cf6' },
    deliveroo: { count: 0, revenue: 0, color: '#ec4899' }
  };

  todayOrders.forEach(order => {
    if (channelStats[order.channel]) {
      channelStats[order.channel].count++;
      channelStats[order.channel].revenue += order.total || 0;
    }
  });

  const pieData = Object.entries(channelStats)
    .filter(([_, data]) => data.count > 0)
    .map(([name, data]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value: data.count,
      revenue: data.revenue,
      color: data.color
    }));

  const todayRevenue = todayOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  const avgOrderValue = todayOrders.length > 0 ? todayRevenue / todayOrders.length : 0;

  return (
    <div className="p-4 md:p-8 min-h-screen bg-gradient-to-br from-slate-100 to-slate-200">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
              <BarChart3 className="w-7 h-7 text-white" />
            </div>
            Control de Producción
          </h1>
          <p className="text-gray-600 mt-1">Analytics y estadísticas del día</p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="border-none shadow-lg bg-gradient-to-br from-blue-600 to-blue-700 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Package className="w-8 h-8 opacity-80" />
              </div>
              <p className="text-sm opacity-90 mb-1">Pedidos Hoy</p>
              <p className="text-3xl font-bold">{todayOrders.length}</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-lg bg-gradient-to-br from-green-600 to-green-700 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <DollarSign className="w-8 h-8 opacity-80" />
              </div>
              <p className="text-sm opacity-90 mb-1">Facturación</p>
              <p className="text-3xl font-bold">{todayRevenue.toFixed(0)}€</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-lg bg-gradient-to-br from-purple-600 to-purple-700 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <TrendingUp className="w-8 h-8 opacity-80" />
              </div>
              <p className="text-sm opacity-90 mb-1">Ticket Medio</p>
              <p className="text-3xl font-bold">{avgOrderValue.toFixed(2)}€</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-lg bg-gradient-to-br from-orange-600 to-orange-700 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Utensils className="w-8 h-8 opacity-80" />
              </div>
              <p className="text-sm opacity-90 mb-1">Productos Únicos</p>
              <p className="text-3xl font-bold">{Object.keys(productStats).length}</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Top Products */}
          <Card className="border-none shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-600" />
                Top 10 Productos del Día
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topProducts} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={120} />
                  <Tooltip />
                  <Bar dataKey="quantity" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Hourly Revenue */}
          <Card className="border-none shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-600" />
                Facturación por Hora
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={hourlyStats}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} name="Ingresos €" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Channel Distribution */}
          <Card className="border-none shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5 text-purple-600" />
                Distribución por Canal
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Channel Stats Table */}
          <Card className="border-none shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-green-600" />
                Resumen por Canal
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {pieData.map((channel, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: channel.color }}
                      />
                      <span className="font-medium">{channel.name}</span>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg">{channel.value} pedidos</p>
                      <p className="text-sm text-gray-600">{channel.revenue.toFixed(2)}€</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Product List */}
        <Card className="border-none shadow-lg">
          <CardHeader>
            <CardTitle>Detalle de Productos Vendidos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topProducts.map((product, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 bg-gradient-to-r from-slate-50 to-slate-100 rounded-lg hover:from-slate-100 hover:to-slate-200 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold">
                      #{idx + 1}
                    </div>
                    <div>
                      <p className="font-bold text-lg">{product.name}</p>
                      <p className="text-sm text-gray-600">{product.quantity} unidades</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-green-600">{product.revenue.toFixed(2)}€</p>
                    <p className="text-xs text-gray-500">{(product.revenue / product.quantity).toFixed(2)}€ /ud</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}