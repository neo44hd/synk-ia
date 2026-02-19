import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { 
  TrendingUp, 
  DollarSign, 
  ShoppingCart,
  Users,
  Award,
  AlertCircle,
  TrendingDown,
  RefreshCw,
  Zap
} from "lucide-react";
import { format, subDays } from "date-fns";

export default function RevoDashboard() {
  const { data: sales = [] } = useQuery({
    queryKey: ['sales'],
    queryFn: () => base44.entities.Sale.list('-sale_date'),
    initialData: [],
  });

  const { data: menuItems = [] } = useQuery({
    queryKey: ['menu-items'],
    queryFn: () => base44.entities.MenuItem.list(),
    initialData: [],
  });

  const { data: revoEmployees = [] } = useQuery({
    queryKey: ['revo-employees'],
    queryFn: () => base44.entities.RevoEmployee.list(),
    initialData: [],
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => base44.entities.Invoice.list(),
    initialData: [],
  });

  // Cálculos
  const totalSales = sales.reduce((sum, s) => sum + (s.total || 0), 0);
  const totalCosts = invoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
  const margin = totalSales - totalCosts;
  const marginPercentage = totalSales > 0 ? (margin / totalSales) * 100 : 0;

  const todaySales = sales.filter(s => {
    const today = format(new Date(), 'yyyy-MM-dd');
    return s.sale_date?.startsWith(today);
  });
  const todayTotal = todaySales.reduce((sum, s) => sum + (s.total || 0), 0);

  const avgTicket = sales.length > 0 ? totalSales / sales.length : 0;

  // Ventas por día (últimos 7 días)
  const dailyData = [];
  for (let i = 6; i >= 0; i--) {
    const date = subDays(new Date(), i);
    const dateStr = format(date, 'yyyy-MM-dd');
    const daySales = sales.filter(s => s.sale_date?.startsWith(dateStr));
    const dayTotal = daySales.reduce((sum, s) => sum + (s.total || 0), 0);
    
    dailyData.push({
      day: format(date, 'EEE'),
      ventas: Math.round(dayTotal),
      tickets: daySales.length
    });
  }

  // Top productos
  const productSales = {};
  sales.forEach(sale => {
    (sale.items || []).forEach(item => {
      if (!productSales[item.product_name]) {
        productSales[item.product_name] = { name: item.product_name, quantity: 0, total: 0 };
      }
      productSales[item.product_name].quantity += item.quantity || 0;
      productSales[item.product_name].total += item.total || 0;
    });
  });

  const topProducts = Object.values(productSales)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)
    .map(p => ({
      name: p.name.length > 15 ? p.name.substring(0, 15) + '...' : p.name,
      ventas: Math.round(p.total)
    }));

  // Ventas por categoría
  const categoryData = menuItems.reduce((acc, item) => {
    const cat = item.category || 'otros';
    if (!acc[cat]) acc[cat] = 0;
    
    sales.forEach(sale => {
      (sale.items || []).forEach(saleItem => {
        if (saleItem.product_name === item.name) {
          acc[cat] += saleItem.total || 0;
        }
      });
    });
    
    return acc;
  }, {});

  const pieData = Object.entries(categoryData)
    .filter(([_, value]) => value > 0)
    .map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value: Math.round(value)
    }));

  // Performance empleados
  const employeePerformance = revoEmployees
    .sort((a, b) => (b.total_sales || 0) - (a.total_sales || 0))
    .slice(0, 5)
    .map(emp => ({
      name: emp.name.split(' ')[0],
      ventas: Math.round(emp.total_sales || 0),
      tickets: emp.sales_count || 0
    }));

  const COLORS = ['#06b6d4', '#22c55e', '#a855f7', '#f59e0b', '#3b82f6', '#ef4444'];

  return (
    <div className="p-4 md:p-8 min-h-screen bg-gradient-to-br from-zinc-950 via-neutral-900 to-zinc-950">
      <div className="max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-white flex items-center gap-3">
              <ShoppingCart className="w-10 h-10 text-cyan-400" />
              Dashboard Revo Xef
            </h1>
            <p className="text-gray-400 mt-1">
              Chicken Palace Ibiza • Análisis en tiempo real
            </p>
          </div>
          <Link to={createPageUrl("RevoSync")}>
            <Button className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white shadow-lg shadow-cyan-500/50">
              <RefreshCw className="w-5 h-5 mr-2" />
              Sincronizar
            </Button>
          </Link>
        </div>

        {/* KPIs Principales */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="border-none shadow-2xl bg-gradient-to-br from-green-600 to-emerald-700 text-white border border-green-400/20">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <DollarSign className="w-6 h-6" />
                <p className="text-sm opacity-90">Ventas Totales</p>
              </div>
              <p className="text-4xl font-bold">{totalSales.toLocaleString('es-ES')}€</p>
              <p className="text-sm opacity-75 mt-2">{sales.length} tickets</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-2xl bg-gradient-to-br from-cyan-600 to-blue-700 text-white border border-cyan-400/20">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <TrendingUp className="w-6 h-6" />
                <p className="text-sm opacity-90">Hoy</p>
              </div>
              <p className="text-4xl font-bold">{todayTotal.toLocaleString('es-ES')}€</p>
              <p className="text-sm opacity-75 mt-2">{todaySales.length} tickets</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-2xl bg-gradient-to-br from-purple-600 to-pink-700 text-white border border-purple-400/20">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <ShoppingCart className="w-6 h-6" />
                <p className="text-sm opacity-90">Ticket Medio</p>
              </div>
              <p className="text-4xl font-bold">{avgTicket.toFixed(2)}€</p>
              <p className="text-sm opacity-75 mt-2">Por venta</p>
            </CardContent>
          </Card>

          <Card className={`border-none shadow-2xl bg-gradient-to-br ${margin >= 0 ? 'from-green-600 to-emerald-700' : 'from-red-600 to-red-700'} text-white border ${margin >= 0 ? 'border-green-400/20' : 'border-red-400/20'}`}>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-2">
                {margin >= 0 ? <TrendingUp className="w-6 h-6" /> : <TrendingDown className="w-6 h-6" />}
                <p className="text-sm opacity-90">Margen Real</p>
              </div>
              <p className="text-4xl font-bold">{margin.toLocaleString('es-ES')}€</p>
              <p className="text-sm opacity-75 mt-2">{marginPercentage.toFixed(1)}% margen</p>
            </CardContent>
          </Card>
        </div>

        {/* Análisis de Margen */}
        <Card className="border-none shadow-2xl mb-8 bg-gradient-to-r from-zinc-800 to-zinc-900 text-white border border-cyan-500/20">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-cyan-500/20 rounded-xl flex items-center justify-center flex-shrink-0 border border-cyan-500/30">
                <Zap className="w-6 h-6 text-cyan-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-xl mb-3">💰 Análisis Ventas vs Gastos</h3>
                <div className="grid grid-cols-3 gap-8">
                  <div className="bg-zinc-900/50 rounded-lg p-4 border border-cyan-500/20">
                    <p className="text-sm text-gray-400">Ventas (Revo)</p>
                    <p className="text-3xl font-bold text-cyan-400">{totalSales.toLocaleString('es-ES')}€</p>
                  </div>
                  <div className="bg-zinc-900/50 rounded-lg p-4 border border-orange-500/20">
                    <p className="text-sm text-gray-400">Gastos (Facturas)</p>
                    <p className="text-3xl font-bold text-orange-400">{totalCosts.toLocaleString('es-ES')}€</p>
                  </div>
                  <div className="bg-zinc-900/50 rounded-lg p-4 border border-green-500/20">
                    <p className="text-sm text-gray-400">Beneficio Real</p>
                    <p className={`text-3xl font-bold ${margin >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {margin.toLocaleString('es-ES')}€
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Ventas Diarias */}
          <Card className="border-none shadow-2xl bg-zinc-800/50 border border-zinc-800">
            <CardHeader>
              <CardTitle className="text-white">📊 Ventas Últimos 7 Días</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="day" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #06b6d4', borderRadius: '8px' }} />
                  <Bar dataKey="ventas" fill="#06b6d4" name="Ventas (€)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Top Productos */}
          <Card className="border-none shadow-2xl bg-zinc-800/50 border border-zinc-800">
            <CardHeader>
              <CardTitle className="text-white">🔥 Top 5 Productos Más Vendidos</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topProducts} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis type="number" stroke="#9ca3af" />
                  <YAxis dataKey="name" type="category" width={120} stroke="#9ca3af" />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #22c55e', borderRadius: '8px' }} />
                  <Bar dataKey="ventas" fill="#22c55e" name="Ventas (€)" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Ventas por Categoría */}
          <Card className="border-none shadow-2xl bg-zinc-800/50 border border-zinc-800">
            <CardHeader>
              <CardTitle className="text-white">🎯 Ventas por Categoría</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #a855f7', borderRadius: '8px' }} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Performance Empleados */}
          <Card className="border-none shadow-2xl bg-zinc-800/50 border border-zinc-800">
            <CardHeader>
              <CardTitle className="text-white">👨‍🍳 Top Empleados del Mes</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={employeePerformance}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #06b6d4', borderRadius: '8px' }} />
                  <Legend />
                  <Bar dataKey="ventas" fill="#06b6d4" name="Ventas (€)" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="tickets" fill="#a855f7" name="Nº Tickets" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Top Empleados Cards */}
        <Card className="border-none shadow-2xl bg-slate-800 border border-gray-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Award className="w-6 h-6 text-yellow-400" />
              Ranking de Empleados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {revoEmployees.slice(0, 5).map((emp, idx) => (
                <div key={emp.id} className="bg-gradient-to-br from-zinc-900 to-zinc-800 rounded-xl p-4 border-2 border-cyan-500/20 hover:border-cyan-500/40 transition-all">
                  <div className="flex items-center gap-3 mb-3">
                    {emp.photo_url ? (
                      <img src={emp.photo_url} alt={emp.name} className="w-12 h-12 rounded-full object-cover border-2 border-cyan-400" />
                    ) : (
                      <div className="w-12 h-12 bg-cyan-500/20 rounded-full flex items-center justify-center border-2 border-cyan-400/30">
                        <Users className="w-6 h-6 text-cyan-400" />
                      </div>
                    )}
                    {idx === 0 && <Badge className="bg-yellow-500 border-none">🏆 #1</Badge>}
                    {idx === 1 && <Badge className="bg-gray-400 border-none">🥈 #2</Badge>}
                    {idx === 2 && <Badge className="bg-orange-600 border-none">🥉 #3</Badge>}
                  </div>
                  <p className="font-bold text-lg text-white">{emp.name}</p>
                  <p className="text-sm text-gray-400 capitalize">{emp.role}</p>
                  <div className="mt-3">
                    <p className="text-2xl font-bold text-cyan-400">
                      {(emp.total_sales || 0).toLocaleString('es-ES')}€
                    </p>
                    <p className="text-xs text-gray-500">{emp.sales_count || 0} tickets</p>
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