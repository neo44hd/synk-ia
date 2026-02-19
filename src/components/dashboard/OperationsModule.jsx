import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ShoppingCart,
  Settings,
  Eye,
  Code,
  TrendingUp,
  Clock,
  Users,
  MapPin
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { format } from 'date-fns';

export default function OperationsModule({ orders, sales }) {
  const [showDetail, setShowDetail] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [showAPI, setShowAPI] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const todayOrders = orders.filter(o => o.order_date?.startsWith(new Date().toISOString().split('T')[0]));
  const activeOrders = todayOrders.filter(o => ['nuevo', 'confirmado', 'en_cocina'].includes(o.status));
  const todaySales = sales.filter(s => s.sale_date?.startsWith(new Date().toISOString().split('T')[0]));
  const todayRevenue = todaySales.reduce((sum, s) => sum + (s.total || 0), 0) + todayOrders.reduce((sum, o) => sum + (o.total || 0), 0);

  const ordersByChannel = todayOrders.reduce((acc, order) => {
    const channel = order.channel || 'desconocido';
    if (!acc[channel]) acc[channel] = { count: 0, total: 0 };
    acc[channel].count += 1;
    acc[channel].total += order.total || 0;
    return acc;
  }, {});

  const channelData = Object.entries(ordersByChannel).map(([channel, data]) => ({
    channel,
    pedidos: data.count,
    ingresos: data.total
  }));

  return (
    <>
      <Card className="border-none shadow-2xl bg-gradient-to-br from-slate-800 to-slate-900">
        <CardHeader className="bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-t-xl">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-3">
              <ShoppingCart className="w-7 h-7" />
              🍗 OPERACIONES
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
                Vista Completa
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-gradient-to-br from-orange-900/30 to-red-900/30 p-5 rounded-xl border border-orange-700">
              <p className="text-gray-400 text-sm mb-2">Pedidos Hoy</p>
              <p className="text-4xl font-black text-white mb-1">{todayOrders.length}</p>
              <div className="flex items-center gap-2 text-orange-400 text-sm">
                <Clock className="w-4 h-4" />
                <span>{activeOrders.length} activos</span>
              </div>
            </div>
            <div className="bg-gradient-to-br from-green-900/30 to-emerald-900/30 p-5 rounded-xl border border-green-700">
              <p className="text-gray-400 text-sm mb-2">Facturación</p>
              <p className="text-4xl font-black text-white mb-1">{todayRevenue.toFixed(0)}€</p>
              <div className="flex items-center gap-2 text-green-400 text-sm">
                <TrendingUp className="w-4 h-4" />
                <span>+18% vs ayer</span>
              </div>
            </div>
            <div className="bg-gradient-to-br from-blue-900/30 to-cyan-900/30 p-5 rounded-xl border border-blue-700">
              <p className="text-gray-400 text-sm mb-2">Ticket Medio</p>
              <p className="text-4xl font-black text-white mb-1">{(todayRevenue/todayOrders.length || 0).toFixed(0)}€</p>
              <div className="flex items-center gap-2 text-blue-400 text-sm">
                <Users className="w-4 h-4" />
                <span>{todaySales.length} ventas</span>
              </div>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={channelData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#444" />
              <XAxis dataKey="channel" stroke="#888" />
              <YAxis stroke="#888" />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} />
              <Bar dataKey="pedidos" fill="#f97316" name="Pedidos" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* MODAL DETALLE COMPLETO */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto bg-slate-900 text-white">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center gap-3">
              <ShoppingCart className="w-8 h-8 text-orange-400" />
              Panel Operaciones Completo
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="today" className="w-full">
            <TabsList className="grid w-full grid-cols-4 bg-slate-800">
              <TabsTrigger value="today">📊 Hoy</TabsTrigger>
              <TabsTrigger value="orders">📦 Pedidos</TabsTrigger>
              <TabsTrigger value="channels">📱 Canales</TabsTrigger>
              <TabsTrigger value="team">👥 Equipo</TabsTrigger>
            </TabsList>

            <TabsContent value="today" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Card className="bg-slate-800 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-lg">Estado de Pedidos</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {['nuevo', 'confirmado', 'en_cocina', 'listo', 'entregado'].map((status) => {
                      const count = todayOrders.filter(o => o.status === status).length;
                      return (
                        <div key={status} className="flex justify-between items-center p-3 bg-slate-700 rounded">
                          <span className="capitalize">{status.replace('_', ' ')}</span>
                          <Badge className="bg-orange-600">{count}</Badge>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>

                <Card className="bg-slate-800 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-lg">Rendimiento</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="p-3 bg-gradient-to-r from-green-900/30 to-emerald-900/30 rounded-xl border border-green-700">
                      <p className="text-sm text-gray-400 mb-1">Tiempo Prep. Promedio</p>
                      <p className="text-3xl font-black">18 min</p>
                    </div>
                    <div className="p-3 bg-gradient-to-r from-blue-900/30 to-cyan-900/30 rounded-xl border border-blue-700">
                      <p className="text-sm text-gray-400 mb-1">Satisfacción Cliente</p>
                      <p className="text-3xl font-black">4.8/5</p>
                    </div>
                    <div className="p-3 bg-gradient-to-r from-purple-900/30 to-pink-900/30 rounded-xl border border-purple-700">
                      <p className="text-sm text-gray-400 mb-1">Tasa Entrega a Tiempo</p>
                      <p className="text-3xl font-black text-green-400">94%</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="orders" className="space-y-4">
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {todayOrders.map((order, idx) => (
                  <Card 
                    key={idx}
                    className="bg-slate-800 border-slate-700 hover:bg-slate-750 cursor-pointer"
                    onClick={() => setSelectedOrder(order)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <Badge className="bg-orange-600">{order.order_number}</Badge>
                            <span className="font-bold">{order.customer_name}</span>
                            <Badge variant="outline">{order.channel}</Badge>
                          </div>
                          <div className="text-sm text-gray-400">
                            📞 {order.customer_phone} • 🕐 {order.order_date}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-black text-orange-400">{order.total}€</p>
                          <Badge className={
                            order.status === 'entregado' ? 'bg-green-600' :
                            order.status === 'en_cocina' ? 'bg-blue-600' :
                            'bg-yellow-600'
                          }>
                            {order.status}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="channels" className="space-y-4">
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle>Rendimiento por Canal</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={channelData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                      <XAxis dataKey="channel" stroke="#888" />
                      <YAxis stroke="#888" />
                      <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} />
                      <Bar dataKey="pedidos" fill="#f97316" name="Pedidos" />
                      <Bar dataKey="ingresos" fill="#10b981" name="Ingresos (€)" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="team" className="space-y-4">
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle>Equipo en Turno</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {['Juan - Cocina', 'María - Caja', 'Pedro - Delivery', 'Ana - Cocina'].map((member, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-slate-700 rounded">
                      <span>{member}</span>
                      <Badge className="bg-green-600">Activo</Badge>
                    </div>
                  ))}
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
              Configuración Operaciones
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="font-bold mb-2">Alertas Automáticas</p>
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input type="checkbox" defaultChecked />
                  <span className="text-sm">Notificar pedidos &gt; 30 min</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" defaultChecked />
                  <span className="text-sm">Alertar baja satisfacción</span>
                </label>
              </div>
            </div>
            <Button className="w-full bg-orange-600 hover:bg-orange-700">
              Guardar Configuración
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL API */}
      <Dialog open={showAPI} onOpenChange={setShowAPI}>
        <DialogContent className="max-w-4xl bg-slate-900 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Code className="w-6 h-6 text-blue-400" />
              API Endpoints - Operaciones
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-slate-800 p-4 rounded-lg">
              <p className="text-sm text-gray-400 mb-2">GET /api/operations/orders/today</p>
              <pre className="bg-slate-950 p-3 rounded text-xs overflow-x-auto">
{`fetch('/api/operations/orders/today')
  .then(res => res.json())
  .then(data => console.log(data));

// Respuesta:
{
  "total": 45,
  "active": 12,
  "revenue": 1450.50,
  "orders": [...]
}`}
              </pre>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* DETALLE INDIVIDUAL PEDIDO */}
      {selectedOrder && (
        <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
          <DialogContent className="bg-slate-900 text-white">
            <DialogHeader>
              <DialogTitle>Pedido #{selectedOrder.order_number}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-800 p-4 rounded">
                  <p className="text-sm text-gray-400">Cliente</p>
                  <p className="font-bold">{selectedOrder.customer_name}</p>
                </div>
                <div className="bg-slate-800 p-4 rounded">
                  <p className="text-sm text-gray-400">Total</p>
                  <p className="text-2xl font-black text-orange-400">{selectedOrder.total}€</p>
                </div>
              </div>
              <div className="bg-slate-800 p-4 rounded">
                <p className="text-sm text-gray-400 mb-2">Items</p>
                {selectedOrder.items?.map((item, idx) => (
                  <div key={idx} className="flex justify-between py-1">
                    <span>{item.quantity}x {item.name}</span>
                    <span>{item.price}€</span>
                  </div>
                ))}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}