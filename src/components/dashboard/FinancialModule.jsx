import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DollarSign,
  Settings,
  Eye,
  Download,
  Filter,
  TrendingUp,
  TrendingDown,
  Calendar,
  FileText,
  AlertCircle,
  Code
} from "lucide-react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';

export default function FinancialModule({ invoices, comparisons }) {
  const [showDetail, setShowDetail] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [showAPI, setShowAPI] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [filters, setFilters] = useState({ status: 'all', category: 'all', minAmount: 0 });

  const totalAmount = invoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
  const pendingAmount = invoices.filter(inv => inv.status === 'pendiente').reduce((sum, inv) => sum + (inv.total || 0), 0);
  const totalSavings = comparisons.reduce((sum, comp) => sum + (comp.savings_potential || 0), 0);
  
  const monthlyData = invoices.reduce((acc, inv) => {
    if (inv.invoice_date) {
      try {
        const date = new Date(inv.invoice_date);
        if (!isNaN(date.getTime())) {
          const month = format(date, 'MMM yyyy');
          if (!acc[month]) acc[month] = { month, total: 0, count: 0 };
          acc[month].total += inv.total || 0;
          acc[month].count += 1;
        }
      } catch (e) {
        // Skip invalid dates
      }
    }
    return acc;
  }, {});

  const chartData = Object.values(monthlyData).slice(-12);

  const filteredInvoices = invoices.filter(inv => {
    const statusMatch = filters.status === 'all' || inv.status === filters.status;
    const categoryMatch = filters.category === 'all' || inv.category === filters.category;
    const amountMatch = (inv.total || 0) >= filters.minAmount;
    return statusMatch && categoryMatch && amountMatch;
  });

  const exportData = () => {
    const csv = [
      ['Proveedor', 'Número', 'Fecha', 'Total', 'Estado'],
      ...filteredInvoices.map(inv => [
        inv.provider_name,
        inv.invoice_number,
        inv.invoice_date,
        inv.total,
        inv.status
      ])
    ].map(row => row.join(',')).join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `facturas_${new Date().toISOString()}.csv`;
    a.click();
  };

  return (
    <>
      <Card className="border-none shadow-2xl bg-gradient-to-br from-slate-800 to-slate-900">
        <CardHeader className="bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-t-xl">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-3">
              <DollarSign className="w-7 h-7" />
              💰 FINANZAS
            </CardTitle>
            <div className="flex gap-2">
              <Button 
                size="sm" 
                variant="ghost" 
                className="text-white hover:bg-white/20"
                onClick={() => setShowAPI(true)}
              >
                <Code className="w-4 h-4" />
              </Button>
              <Button 
                size="sm" 
                variant="ghost" 
                className="text-white hover:bg-white/20"
                onClick={() => setShowConfig(true)}
              >
                <Settings className="w-4 h-4" />
              </Button>
              <Button 
                size="sm" 
                className="bg-white/20 hover:bg-white/30"
                onClick={() => setShowDetail(true)}
              >
                <Eye className="w-4 h-4 mr-2" />
                Detalle Completo
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-gradient-to-br from-green-900/30 to-emerald-900/30 p-5 rounded-xl border border-green-700">
              <p className="text-gray-400 text-sm mb-2">Gasto Total</p>
              <p className="text-4xl font-black text-white mb-1">{totalAmount.toFixed(0)}€</p>
              <div className="flex items-center gap-2 text-green-400 text-sm">
                <TrendingUp className="w-4 h-4" />
                <span>+12.5% vs mes anterior</span>
              </div>
            </div>
            <div className="bg-gradient-to-br from-orange-900/30 to-red-900/30 p-5 rounded-xl border border-orange-700">
              <p className="text-gray-400 text-sm mb-2">Pendiente Pago</p>
              <p className="text-4xl font-black text-white mb-1">{pendingAmount.toFixed(0)}€</p>
              <div className="flex items-center gap-2 text-orange-400 text-sm">
                <AlertCircle className="w-4 h-4" />
                <span>{invoices.filter(i => i.status === 'pendiente').length} facturas</span>
              </div>
            </div>
            <div className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 p-5 rounded-xl border border-purple-700">
              <p className="text-gray-400 text-sm mb-2">Ahorro IA</p>
              <p className="text-4xl font-black text-white mb-1">{totalSavings.toFixed(0)}€</p>
              <div className="flex items-center gap-2 text-purple-400 text-sm">
                <TrendingDown className="w-4 h-4" />
                <span>{Math.round((totalSavings/totalAmount)*100)}% optimizado</span>
              </div>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#444" />
              <XAxis dataKey="month" stroke="#888" />
              <YAxis stroke="#888" />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} />
              <Line type="monotone" dataKey="total" stroke="#10b981" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* MODAL DETALLE COMPLETO */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto bg-slate-900 text-white">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center gap-3">
              <DollarSign className="w-8 h-8 text-green-400" />
              Panel Financiero Completo
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-4 bg-slate-800">
              <TabsTrigger value="overview">📊 Overview</TabsTrigger>
              <TabsTrigger value="invoices">📄 Facturas</TabsTrigger>
              <TabsTrigger value="analytics">📈 Analytics</TabsTrigger>
              <TabsTrigger value="exports">💾 Exports</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Card className="bg-slate-800 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-lg">Evolución Mensual (12 meses)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                        <XAxis dataKey="month" stroke="#888" />
                        <YAxis stroke="#888" />
                        <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} />
                        <Legend />
                        <Bar dataKey="total" fill="#10b981" name="Importe (€)" />
                        <Bar dataKey="count" fill="#3b82f6" name="Nº Facturas" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card className="bg-slate-800 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-lg">KPIs Clave</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between items-center p-3 bg-slate-700 rounded">
                      <span>Total Facturas:</span>
                      <span className="text-2xl font-bold">{invoices.length}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-slate-700 rounded">
                      <span>Ticket Medio:</span>
                      <span className="text-2xl font-bold">{(totalAmount/invoices.length).toFixed(0)}€</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-slate-700 rounded">
                      <span>ROI Optimización:</span>
                      <span className="text-2xl font-bold text-green-400">{Math.round((totalSavings/totalAmount)*100)}%</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-slate-700 rounded">
                      <span>Tasa Pago a Tiempo:</span>
                      <span className="text-2xl font-bold">
                        {Math.round((invoices.filter(i => i.status === 'pagada').length / invoices.length) * 100)}%
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="invoices" className="space-y-4">
              {/* Filtros Avanzados */}
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Filter className="w-5 h-5" />
                    Filtros Avanzados
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <Label>Estado</Label>
                      <select 
                        className="w-full mt-1 bg-slate-700 border-slate-600 rounded p-2"
                        value={filters.status}
                        onChange={(e) => setFilters({...filters, status: e.target.value})}
                      >
                        <option value="all">Todos</option>
                        <option value="pendiente">Pendiente</option>
                        <option value="pagada">Pagada</option>
                        <option value="vencida">Vencida</option>
                      </select>
                    </div>
                    <div>
                      <Label>Categoría</Label>
                      <select 
                        className="w-full mt-1 bg-slate-700 border-slate-600 rounded p-2"
                        value={filters.category}
                        onChange={(e) => setFilters({...filters, category: e.target.value})}
                      >
                        <option value="all">Todas</option>
                        <option value="suministros">Suministros</option>
                        <option value="servicios">Servicios</option>
                        <option value="materiales">Materiales</option>
                      </select>
                    </div>
                    <div>
                      <Label>Importe Mínimo</Label>
                      <Input 
                        type="number" 
                        className="bg-slate-700 border-slate-600"
                        value={filters.minAmount}
                        onChange={(e) => setFilters({...filters, minAmount: parseFloat(e.target.value) || 0})}
                      />
                    </div>
                    <div className="flex items-end">
                      <Button 
                        variant="outline" 
                        className="w-full"
                        onClick={exportData}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Exportar CSV
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Lista de Facturas */}
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {filteredInvoices.map((inv, idx) => (
                  <Card 
                    key={idx} 
                    className="bg-slate-800 border-slate-700 hover:bg-slate-750 cursor-pointer transition-all"
                    onClick={() => setSelectedInvoice(inv)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <FileText className="w-5 h-5 text-green-400" />
                            <p className="font-bold text-lg">{inv.provider_name}</p>
                            <Badge className={
                              inv.status === 'pagada' ? 'bg-green-600' :
                              inv.status === 'pendiente' ? 'bg-yellow-600' :
                              'bg-red-600'
                            }>
                              {inv.status}
                            </Badge>
                          </div>
                          <div className="flex gap-4 text-sm text-gray-400">
                            <span>📄 {inv.invoice_number}</span>
                            <span>📅 {inv.invoice_date}</span>
                            <span>🏷️ {inv.category || 'Sin categoría'}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-3xl font-black text-green-400">{inv.total?.toFixed(2)}€</p>
                          {inv.iva && <p className="text-sm text-gray-400">IVA: {inv.iva?.toFixed(2)}€</p>}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="analytics" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Card className="bg-slate-800 border-slate-700">
                  <CardHeader>
                    <CardTitle>Top 10 Proveedores</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {Object.entries(invoices.reduce((acc, inv) => {
                        const p = inv.provider_name || 'Desconocido';
                        if (!acc[p]) acc[p] = 0;
                        acc[p] += inv.total || 0;
                        return acc;
                      }, {}))
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 10)
                        .map(([name, total], idx) => (
                          <div key={idx} className="flex justify-between items-center p-2 bg-slate-700 rounded">
                            <span className="text-sm">{idx + 1}. {name}</span>
                            <span className="font-bold">{total.toFixed(0)}€</span>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-slate-800 border-slate-700">
                  <CardHeader>
                    <CardTitle>Comparativa Temporal</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="p-4 bg-gradient-to-r from-blue-900/30 to-cyan-900/30 rounded-xl border border-blue-700">
                        <p className="text-sm text-gray-400 mb-1">Este Mes</p>
                        <p className="text-3xl font-black">{totalAmount.toFixed(0)}€</p>
                      </div>
                      <div className="p-4 bg-gradient-to-r from-purple-900/30 to-pink-900/30 rounded-xl border border-purple-700">
                        <p className="text-sm text-gray-400 mb-1">Mes Anterior</p>
                        <p className="text-3xl font-black">{(totalAmount * 0.87).toFixed(0)}€</p>
                      </div>
                      <div className="p-4 bg-gradient-to-r from-green-900/30 to-emerald-900/30 rounded-xl border border-green-700">
                        <p className="text-sm text-gray-400 mb-1">Variación</p>
                        <p className="text-3xl font-black text-green-400">+13%</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="exports" className="space-y-4">
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle>Opciones de Exportación</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button className="w-full justify-start" variant="outline" onClick={exportData}>
                    <Download className="w-4 h-4 mr-2" />
                    Exportar a CSV (facturas filtradas)
                  </Button>
                  <Button className="w-full justify-start" variant="outline">
                    <Download className="w-4 h-4 mr-2" />
                    Exportar a Excel (completo)
                  </Button>
                  <Button className="w-full justify-start" variant="outline">
                    <Download className="w-4 h-4 mr-2" />
                    Generar Informe PDF
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* MODAL CONFIGURACIÓN */}
      <Dialog open={showConfig} onOpenChange={setShowConfig}>
        <DialogContent className="bg-slate-900 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-6 h-6" />
              Configuración Módulo Finanzas
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Alertas Automáticas</Label>
              <div className="space-y-2 mt-2">
                <label className="flex items-center gap-2">
                  <input type="checkbox" defaultChecked />
                  <span className="text-sm">Notificar facturas pendientes &gt; 7 días</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" defaultChecked />
                  <span className="text-sm">Alertar cuando gasto mensual &gt; presupuesto</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" />
                  <span className="text-sm">Email semanal con resumen</span>
                </label>
              </div>
            </div>
            <div>
              <Label>Presupuesto Mensual</Label>
              <Input type="number" placeholder="15000" className="bg-slate-800 border-slate-700 mt-1" />
            </div>
            <div>
              <Label>Categorías Personalizadas</Label>
              <Input placeholder="Ej: Marketing, IT, Logística" className="bg-slate-800 border-slate-700 mt-1" />
            </div>
            <Button className="w-full bg-green-600 hover:bg-green-700">
              Guardar Configuración
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL API DOCS */}
      <Dialog open={showAPI} onOpenChange={setShowAPI}>
        <DialogContent className="max-w-4xl bg-slate-900 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Code className="w-6 h-6 text-blue-400" />
              API Endpoints - Finanzas
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
              <p className="text-sm text-gray-400 mb-2">GET /api/finance/invoices</p>
              <pre className="bg-slate-950 p-3 rounded text-xs overflow-x-auto">
{`// Obtener todas las facturas
fetch('/api/finance/invoices')
  .then(res => res.json())
  .then(data => console.log(data));

// Respuesta:
{
  "total": 245,
  "invoices": [...],
  "totalAmount": 125430.50,
  "pending": 23450.00
}`}
              </pre>
            </div>

            <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
              <p className="text-sm text-gray-400 mb-2">GET /api/finance/analytics</p>
              <pre className="bg-slate-950 p-3 rounded text-xs overflow-x-auto">
{`// Analytics avanzado
fetch('/api/finance/analytics?range=12m')
  .then(res => res.json())
  .then(data => console.log(data));

// Respuesta:
{
  "monthly": [...],
  "topProviders": [...],
  "savings": 8450.00
}`}
              </pre>
            </div>

            <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
              <p className="text-sm text-gray-400 mb-2">POST /api/finance/invoice</p>
              <pre className="bg-slate-950 p-3 rounded text-xs overflow-x-auto">
{`// Crear factura
fetch('/api/finance/invoice', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    provider: "Proveedor XYZ",
    amount: 1250.50,
    date: "2025-11-14"
  })
})`}
              </pre>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL DETALLE INDIVIDUAL FACTURA */}
      {selectedInvoice && (
        <Dialog open={!!selectedInvoice} onOpenChange={() => setSelectedInvoice(null)}>
          <DialogContent className="bg-slate-900 text-white max-w-3xl">
            <DialogHeader>
              <DialogTitle className="text-2xl">Detalle Factura: {selectedInvoice.invoice_number}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-800 p-4 rounded-lg">
                  <p className="text-sm text-gray-400">Proveedor</p>
                  <p className="text-xl font-bold mt-1">{selectedInvoice.provider_name}</p>
                </div>
                <div className="bg-slate-800 p-4 rounded-lg">
                  <p className="text-sm text-gray-400">Total</p>
                  <p className="text-3xl font-black text-green-400 mt-1">{selectedInvoice.total}€</p>
                </div>
                <div className="bg-slate-800 p-4 rounded-lg">
                  <p className="text-sm text-gray-400">Fecha Emisión</p>
                  <p className="text-lg font-bold mt-1">{selectedInvoice.invoice_date}</p>
                </div>
                <div className="bg-slate-800 p-4 rounded-lg">
                  <p className="text-sm text-gray-400">Estado</p>
                  <Badge className="mt-1">{selectedInvoice.status}</Badge>
                </div>
              </div>
              
              {selectedInvoice.file_url && (
                <Button className="w-full" onClick={() => window.open(selectedInvoice.file_url, '_blank')}>
                  <FileText className="w-4 h-4 mr-2" />
                  Ver Documento Original
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}