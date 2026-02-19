import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ShoppingCart, 
  Clock, 
  CheckCircle2, 
  Loader2,
  Phone,
  MapPin,
  User,
  Calendar,
  DollarSign,
  TrendingUp,
  AlertCircle,
  Package,
  Utensils,
  Bike,
  Store
} from "lucide-react";
import { format, isValid, differenceInMinutes } from "date-fns";
import { es } from "date-fns/locale";

export default function OrdersDashboard() {
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  
  const queryClient = useQueryClient();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: () => base44.entities.Order.list('-order_date', 100),
    initialData: [],
    refetchInterval: autoRefresh ? 10000 : false, // Auto-refresh cada 10s
  });

  const updateOrderMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Order.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  const todayOrders = orders.filter(order => {
    if (!order.order_date) return false;
    const orderDate = new Date(order.order_date);
    const today = new Date();
    return orderDate.toDateString() === today.toDateString();
  });

  const ordersByStatus = {
    nuevo: todayOrders.filter(o => o.status === 'nuevo'),
    confirmado: todayOrders.filter(o => o.status === 'confirmado'),
    en_cocina: todayOrders.filter(o => o.status === 'en_cocina'),
    listo: todayOrders.filter(o => o.status === 'listo'),
    entregado: todayOrders.filter(o => o.status === 'entregado'),
  };

  const activeOrders = [...ordersByStatus.nuevo, ...ordersByStatus.confirmado, ...ordersByStatus.en_cocina, ...ordersByStatus.listo];

  const todayStats = {
    total: todayOrders.length,
    revenue: todayOrders.reduce((sum, o) => sum + (o.total || 0), 0),
    active: activeOrders.length,
    avgTime: Math.round(todayOrders.filter(o => o.preparation_time).reduce((sum, o, _, arr) => sum + o.preparation_time / arr.length, 0) || 0)
  };

  const channelIcons = {
    web: <Store className="w-4 h-4" />,
    telefono: <Phone className="w-4 h-4" />,
    presencial: <User className="w-4 h-4" />,
    glovo: <Bike className="w-4 h-4" />,
    uber_eats: <Bike className="w-4 h-4" />,
    deliveroo: <Bike className="w-4 h-4" />
  };

  const statusColors = {
    nuevo: 'bg-yellow-500',
    confirmado: 'bg-blue-500',
    en_cocina: 'bg-orange-500',
    listo: 'bg-green-500',
    entregado: 'bg-gray-400',
    cancelado: 'bg-red-500'
  };

  const statusLabels = {
    nuevo: 'Nuevo',
    confirmado: 'Confirmado',
    en_cocina: 'En Cocina',
    listo: 'Listo',
    entregado: 'Entregado',
    cancelado: 'Cancelado'
  };

  const handleStatusChange = (order, newStatus) => {
    const updates = { status: newStatus };
    
    if (newStatus === 'en_cocina' && !order.estimated_ready_time) {
      const readyTime = new Date();
      readyTime.setMinutes(readyTime.getMinutes() + 20);
      updates.estimated_ready_time = readyTime.toISOString();
    }
    
    updateOrderMutation.mutate({ id: order.id, data: updates });
  };

  const getTimeInfo = (order) => {
    if (!order.order_date) return null;
    const orderTime = new Date(order.order_date);
    const now = new Date();
    const elapsed = differenceInMinutes(now, orderTime);
    
    if (order.status === 'entregado') return null;
    
    const isUrgent = elapsed > 30;
    return { elapsed, isUrgent };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-neutral-900 to-zinc-950 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold text-white flex items-center gap-3">
                <div 
                  className="w-12 h-12 bg-black rounded-xl flex items-center justify-center border border-cyan-500/50"
                  style={{ boxShadow: '0 0 20px rgba(6, 182, 212, 0.4)' }}
                >
                  <ShoppingCart className="w-7 h-7 text-cyan-400" style={{ filter: 'drop-shadow(0 0 6px rgba(6, 182, 212, 0.8))' }} />
                </div>
                <span className="text-cyan-400" style={{ textShadow: '0 0 15px rgba(6, 182, 212, 0.6)' }}>Portal de Pedidos</span>
              </h1>
              <p className="text-zinc-400 mt-1">Gestión en tiempo real - Chicken Palace</p>
            </div>
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${autoRefresh ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
              <Button
                variant={autoRefresh ? 'default' : 'outline'}
                size="sm"
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={autoRefresh ? 'bg-green-600 hover:bg-green-700' : ''}
              >
                {autoRefresh ? 'Auto-Refresh ON' : 'Auto-Refresh OFF'}
              </Button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="border-none shadow-xl bg-gradient-to-br from-blue-600 to-blue-700 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Package className="w-8 h-8 opacity-80" />
              </div>
              <p className="text-sm opacity-90 mb-1">Pedidos Hoy</p>
              <p className="text-3xl font-bold">{todayStats.total}</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-xl bg-gradient-to-br from-green-600 to-green-700 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <DollarSign className="w-8 h-8 opacity-80" />
              </div>
              <p className="text-sm opacity-90 mb-1">Facturación</p>
              <p className="text-3xl font-bold">{todayStats.revenue.toFixed(0)}€</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-xl bg-gradient-to-br from-orange-600 to-orange-700 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Loader2 className="w-8 h-8 opacity-80 animate-spin" />
              </div>
              <p className="text-sm opacity-90 mb-1">Activos</p>
              <p className="text-3xl font-bold">{todayStats.active}</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-xl bg-gradient-to-br from-purple-600 to-purple-700 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Clock className="w-8 h-8 opacity-80" />
              </div>
              <p className="text-sm opacity-90 mb-1">Tiempo Medio</p>
              <p className="text-3xl font-bold">{todayStats.avgTime}m</p>
            </CardContent>
          </Card>
        </div>

        {/* Orders Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {/* Nuevos */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-yellow-500 rounded-lg flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Nuevos</h3>
                <p className="text-sm text-gray-400">{ordersByStatus.nuevo.length} pedidos</p>
              </div>
            </div>
            {ordersByStatus.nuevo.map(order => (
              <OrderCard 
                key={order.id} 
                order={order} 
                onStatusChange={handleStatusChange}
                timeInfo={getTimeInfo(order)}
                statusColors={statusColors}
                statusLabels={statusLabels}
                channelIcons={channelIcons}
              />
            ))}
          </div>

          {/* Confirmados */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Confirmados</h3>
                <p className="text-sm text-gray-400">{ordersByStatus.confirmado.length} pedidos</p>
              </div>
            </div>
            {ordersByStatus.confirmado.map(order => (
              <OrderCard 
                key={order.id} 
                order={order} 
                onStatusChange={handleStatusChange}
                timeInfo={getTimeInfo(order)}
                statusColors={statusColors}
                statusLabels={statusLabels}
                channelIcons={channelIcons}
              />
            ))}
          </div>

          {/* En Cocina */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
                <Utensils className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">En Cocina</h3>
                <p className="text-sm text-gray-400">{ordersByStatus.en_cocina.length} pedidos</p>
              </div>
            </div>
            {ordersByStatus.en_cocina.map(order => (
              <OrderCard 
                key={order.id} 
                order={order} 
                onStatusChange={handleStatusChange}
                timeInfo={getTimeInfo(order)}
                statusColors={statusColors}
                statusLabels={statusLabels}
                channelIcons={channelIcons}
              />
            ))}
          </div>

          {/* Listos */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                <Package className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Listos</h3>
                <p className="text-sm text-gray-400">{ordersByStatus.listo.length} pedidos</p>
              </div>
            </div>
            {ordersByStatus.listo.map(order => (
              <OrderCard 
                key={order.id} 
                order={order} 
                onStatusChange={handleStatusChange}
                timeInfo={getTimeInfo(order)}
                statusColors={statusColors}
                statusLabels={statusLabels}
                channelIcons={channelIcons}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function OrderCard({ order, onStatusChange, timeInfo, statusColors, statusLabels, channelIcons }) {
  return (
    <Card className="border-none shadow-xl bg-gradient-to-br from-slate-800 to-slate-900 hover:from-slate-700 hover:to-slate-800 transition-all">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg font-bold text-white">{order.order_number}</CardTitle>
            <div className="flex items-center gap-2 mt-1">
              <Badge className="bg-white/10 text-white border-white/20">
                {channelIcons[order.channel]}
                <span className="ml-1 capitalize">{order.channel}</span>
              </Badge>
              {order.priority === 'urgente' && (
                <Badge className="bg-red-500 text-white">Urgente</Badge>
              )}
            </div>
          </div>
          {timeInfo && (
            <div className={`text-right ${timeInfo.isUrgent ? 'text-red-400' : 'text-gray-400'}`}>
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <span className="text-sm font-bold">{timeInfo.elapsed}m</span>
              </div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-gray-300">
            <User className="w-4 h-4" />
            <span className="font-medium">{order.customer_name}</span>
          </div>
          {order.customer_phone && (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Phone className="w-4 h-4" />
              <span>{order.customer_phone}</span>
            </div>
          )}
        </div>

        <div className="bg-slate-950/50 rounded-lg p-3 space-y-1">
          {order.items?.slice(0, 3).map((item, idx) => (
            <div key={idx} className="flex justify-between text-sm">
              <span className="text-gray-300">{item.quantity}x {item.name}</span>
              <span className="text-white font-medium">{item.price}€</span>
            </div>
          ))}
          {order.items?.length > 3 && (
            <p className="text-xs text-gray-500 text-center pt-1">+{order.items.length - 3} más</p>
          )}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-gray-700">
          <span className="text-gray-400 text-sm">Total</span>
          <span className="text-xl font-bold text-green-400">{order.total}€</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {order.status === 'nuevo' && (
            <>
              <Button
                onClick={() => onStatusChange(order, 'confirmado')}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Confirmar
              </Button>
              <Button
                onClick={() => onStatusChange(order, 'en_cocina')}
                size="sm"
                className="bg-orange-600 hover:bg-orange-700 text-white"
              >
                A Cocina
              </Button>
            </>
          )}
          {order.status === 'confirmado' && (
            <Button
              onClick={() => onStatusChange(order, 'en_cocina')}
              size="sm"
              className="col-span-2 bg-orange-600 hover:bg-orange-700 text-white"
            >
              <Utensils className="w-4 h-4 mr-2" />
              Enviar a Cocina
            </Button>
          )}
          {order.status === 'en_cocina' && (
            <Button
              onClick={() => onStatusChange(order, 'listo')}
              size="sm"
              className="col-span-2 bg-green-600 hover:bg-green-700 text-white"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Marcar Listo
            </Button>
          )}
          {order.status === 'listo' && (
            <Button
              onClick={() => onStatusChange(order, 'entregado')}
              size="sm"
              className="col-span-2 bg-gray-600 hover:bg-gray-700 text-white"
            >
              <Package className="w-4 h-4 mr-2" />
              Entregado
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}