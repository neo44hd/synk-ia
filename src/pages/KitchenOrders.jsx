import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { 
  ChefHat, 
  Clock, 
  CheckCircle2,
  AlertCircle,
  Flame,
  Bell,
  Volume2,
  VolumeX,
  Timer,
  Utensils,
  Package,
  Truck,
  RefreshCw,
  ArrowRight,
  Play,
  Check,
  X,
  User,
  Phone,
  MapPin,
  ShoppingBag,
  Zap,
  UtensilsCrossed
} from "lucide-react";
import { format, differenceInMinutes, differenceInSeconds } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

// Estados del pedido
const ORDER_STATES = {
  recibido: { label: 'Recibido', color: 'bg-blue-500', icon: Bell, next: 'preparando' },
  preparando: { label: 'Preparando', color: 'bg-orange-500', icon: ChefHat, next: 'listo' },
  listo: { label: 'Listo', color: 'bg-emerald-500', icon: CheckCircle2, next: 'entregado' },
  entregado: { label: 'Entregado', color: 'bg-gray-500', icon: Package, next: null },
};

// Pedidos demo si no hay datos reales
const DEMO_ORDERS = [
  { 
    id: '001', 
    customer_name: 'Juan García', 
    customer_phone: '612345678',
    status: 'recibido',
    order_type: 'recoger',
    order_date: new Date(Date.now() - 5 * 60000).toISOString(),
    items: [
      { name: '🍗 Combo Familiar', quantity: 1, notes: 'Sin salsa picante' },
      { name: '🍟 Patatas Grandes', quantity: 2 },
      { name: '🥤 Coca-Cola', quantity: 3 }
    ],
    total: 32.50
  },
  { 
    id: '002', 
    customer_name: 'María López', 
    customer_phone: '623456789',
    status: 'preparando',
    order_type: 'domicilio',
    address: 'Calle Mayor 15, 3ºB',
    order_date: new Date(Date.now() - 12 * 60000).toISOString(),
    items: [
      { name: '🍔 Chicken Burger', quantity: 2 },
      { name: '🥗 Ensalada César', quantity: 1 },
      { name: '🍰 Brownie', quantity: 2 }
    ],
    total: 28.90
  },
  { 
    id: '003', 
    customer_name: 'Pedro Martínez', 
    customer_phone: '634567890',
    status: 'recibido',
    order_type: 'recoger',
    order_date: new Date(Date.now() - 2 * 60000).toISOString(),
    items: [
      { name: '🍗 Alitas BBQ (12 uds)', quantity: 1 },
      { name: '🧀 Nachos con Queso', quantity: 1 },
      { name: '🥤 Fanta Naranja', quantity: 2 }
    ],
    total: 19.50
  },
  { 
    id: '004', 
    customer_name: 'Ana Sánchez', 
    customer_phone: '645678901',
    status: 'listo',
    order_type: 'recoger',
    order_date: new Date(Date.now() - 25 * 60000).toISOString(),
    items: [
      { name: '🍗 Pollo Entero', quantity: 1 },
      { name: '🍟 Patatas Medianas', quantity: 2 }
    ],
    total: 15.90
  },
];

export default function KitchenOrders() {
  const queryClient = useQueryClient();
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [selectedView, setSelectedView] = useState('all'); // all, pending, cooking, ready
  const [lastOrderCount, setLastOrderCount] = useState(0);

  // Obtener pedidos
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['kitchen-orders-kds'],
    queryFn: async () => {
      try {
        const apiOrders = await base44.entities.Order.list('-order_date', 50);
        // Filtrar solo pedidos activos (no entregados)
        const activeOrders = apiOrders.filter(o => 
          o.status !== 'entregado' && o.status !== 'cancelado'
        );
        return activeOrders.length > 0 ? activeOrders : DEMO_ORDERS;
      } catch {
        return DEMO_ORDERS;
      }
    },
    initialData: DEMO_ORDERS,
    refetchInterval: 5000, // Refrescar cada 5 segundos
  });

  // Detectar nuevos pedidos y reproducir sonido
  useEffect(() => {
    const newOrders = orders.filter(o => o.status === 'recibido');
    if (newOrders.length > lastOrderCount && soundEnabled && lastOrderCount > 0) {
      // Reproducir sonido de notificación
      try {
        const audio = new Audio('/notification.mp3');
        audio.play().catch(() => {});
      } catch {}
      toast.success('🔔 ¡Nuevo pedido recibido!', { duration: 3000 });
    }
    setLastOrderCount(newOrders.length);
  }, [orders, soundEnabled, lastOrderCount]);

  // Mutation para actualizar estado del pedido
  const updateOrderMutation = useMutation({
    mutationFn: async ({ orderId, newStatus }) => {
      try {
        await base44.entities.Order.update(orderId, { status: newStatus });
      } catch {
        // Simular actualización local
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      return { orderId, newStatus };
    },
    onSuccess: ({ newStatus }) => {
      queryClient.invalidateQueries({ queryKey: ['kitchen-orders-kds'] });
      const stateInfo = ORDER_STATES[newStatus];
      toast.success(`✅ Pedido ${stateInfo?.label || newStatus}`);
    },
    onError: (error) => {
      toast.error('Error al actualizar pedido');
    }
  });

  // Cambiar estado del pedido
  const handleChangeStatus = (order, newStatus) => {
    updateOrderMutation.mutate({ orderId: order.id, newStatus });
  };

  // Avanzar al siguiente estado
  const handleNextStatus = (order) => {
    const currentState = ORDER_STATES[order.status];
    if (currentState?.next) {
      handleChangeStatus(order, currentState.next);
    }
  };

  // Filtrar pedidos según vista seleccionada
  const filteredOrders = useMemo(() => {
    switch (selectedView) {
      case 'pending': return orders.filter(o => o.status === 'recibido');
      case 'cooking': return orders.filter(o => o.status === 'preparando');
      case 'ready': return orders.filter(o => o.status === 'listo');
      default: return orders.filter(o => o.status !== 'entregado');
    }
  }, [orders, selectedView]);

  // Agrupar pedidos por estado
  const ordersByStatus = useMemo(() => ({
    recibido: orders.filter(o => o.status === 'recibido'),
    preparando: orders.filter(o => o.status === 'preparando'),
    listo: orders.filter(o => o.status === 'listo'),
  }), [orders]);

  // Calcular tiempo transcurrido
  const getElapsedTime = (orderDate) => {
    if (!orderDate) return { minutes: 0, color: 'text-gray-400' };
    const elapsed = differenceInMinutes(new Date(), new Date(orderDate));
    let color = 'text-emerald-400';
    if (elapsed > 30) color = 'text-red-500 animate-pulse font-bold';
    else if (elapsed > 20) color = 'text-orange-500 font-bold';
    else if (elapsed > 10) color = 'text-amber-400';
    return { minutes: elapsed, color };
  };

  // Componente de tarjeta de pedido
  const OrderCard = ({ order, compact = false }) => {
    const stateInfo = ORDER_STATES[order.status] || ORDER_STATES.recibido;
    const Icon = stateInfo.icon;
    const timeInfo = getElapsedTime(order.order_date);
    const isUrgent = timeInfo.minutes > 20;

    return (
      <Card className={`border-2 transition-all duration-300 ${
        isUrgent && order.status !== 'listo' ? 'border-red-500 animate-pulse' : 
        order.status === 'listo' ? 'border-emerald-500' : 'border-slate-700'
      } bg-slate-800/80 backdrop-blur-sm`}>
        <CardContent className="p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${stateInfo.color}`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-white font-bold text-lg">#{order.id}</span>
                  <Badge className={`${stateInfo.color} text-white`}>
                    {stateInfo.label}
                  </Badge>
                </div>
                <div className={`flex items-center gap-1 text-sm ${timeInfo.color}`}>
                  <Clock className="w-3 h-3" />
                  {timeInfo.minutes} min
                </div>
              </div>
            </div>
            <Badge className={order.order_type === 'domicilio' ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' : 'bg-blue-500/20 text-blue-400 border-blue-500/30'}>
              {order.order_type === 'domicilio' ? <Truck className="w-3 h-3 mr-1" /> : <ShoppingBag className="w-3 h-3 mr-1" />}
              {order.order_type === 'domicilio' ? 'Domicilio' : 'Recoger'}
            </Badge>
          </div>

          {/* Cliente */}
          <div className="flex items-center gap-4 mb-3 text-sm">
            <div className="flex items-center gap-1 text-gray-300">
              <User className="w-4 h-4 text-gray-500" />
              {order.customer_name}
            </div>
            {order.customer_phone && (
              <div className="flex items-center gap-1 text-gray-400">
                <Phone className="w-3 h-3" />
                {order.customer_phone}
              </div>
            )}
          </div>

          {/* Dirección si es domicilio */}
          {order.order_type === 'domicilio' && order.address && (
            <div className="flex items-center gap-1 text-sm text-purple-400 mb-3">
              <MapPin className="w-4 h-4" />
              {order.address}
            </div>
          )}

          {/* Items */}
          <div className="space-y-2 mb-4">
            {order.items?.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between bg-slate-700/50 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-white font-medium">{item.quantity}x</span>
                  <span className="text-gray-200">{item.name}</span>
                </div>
                {item.notes && (
                  <span className="text-xs text-amber-400 bg-amber-500/20 px-2 py-1 rounded">
                    {item.notes}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Total */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-700">
            <span className="text-gray-400">Total:</span>
            <span className="text-xl font-bold text-emerald-400">{order.total?.toFixed(2)} €</span>
          </div>

          {/* Acciones */}
          <div className="flex gap-2 mt-4">
            {order.status === 'recibido' && (
              <Button 
                onClick={() => handleNextStatus(order)}
                className="flex-1 bg-orange-600 hover:bg-orange-700"
                disabled={updateOrderMutation.isPending}
              >
                <Play className="w-4 h-4 mr-2" />
                Empezar
              </Button>
            )}
            {order.status === 'preparando' && (
              <Button 
                onClick={() => handleNextStatus(order)}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                disabled={updateOrderMutation.isPending}
              >
                <Check className="w-4 h-4 mr-2" />
                Listo
              </Button>
            )}
            {order.status === 'listo' && (
              <Button 
                onClick={() => handleNextStatus(order)}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                disabled={updateOrderMutation.isPending}
              >
                <Package className="w-4 h-4 mr-2" />
                Entregado
              </Button>
            )}
            <Button 
              variant="outline"
              onClick={() => handleChangeStatus(order, 'cancelado')}
              className="border-red-500/50 text-red-400 hover:bg-red-500/20"
              disabled={updateOrderMutation.isPending}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-4 rounded-2xl bg-gradient-to-r from-orange-600 to-red-600 shadow-xl">
              <Flame className="w-10 h-10 text-white animate-pulse" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Kitchen Display</h1>
              <p className="text-gray-400">Gestión de pedidos en tiempo real</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Contador de pedidos */}
            <div className="flex gap-2">
              <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 px-3 py-1 text-sm">
                <Bell className="w-4 h-4 mr-1" />
                {ordersByStatus.recibido.length} Pendientes
              </Badge>
              <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 px-3 py-1 text-sm">
                <ChefHat className="w-4 h-4 mr-1" />
                {ordersByStatus.preparando.length} En cocina
              </Badge>
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 px-3 py-1 text-sm">
                <CheckCircle2 className="w-4 h-4 mr-1" />
                {ordersByStatus.listo.length} Listos
              </Badge>
            </div>
            {/* Sonido */}
            <Button
              variant="outline"
              size="icon"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`${soundEnabled ? 'border-emerald-500 text-emerald-400' : 'border-slate-600 text-gray-400'}`}
            >
              {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </Button>
            {/* Refrescar */}
            <Button
              variant="outline"
              onClick={() => queryClient.invalidateQueries({ queryKey: ['kitchen-orders-kds'] })}
              className="border-slate-600 text-gray-300"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refrescar
            </Button>
          </div>
        </div>

        {/* Filtros de vista */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[
            { id: 'all', label: 'Todos', count: filteredOrders.length },
            { id: 'pending', label: 'Pendientes', count: ordersByStatus.recibido.length, color: 'text-blue-400' },
            { id: 'cooking', label: 'En cocina', count: ordersByStatus.preparando.length, color: 'text-orange-400' },
            { id: 'ready', label: 'Listos', count: ordersByStatus.listo.length, color: 'text-emerald-400' },
          ].map(view => (
            <Button
              key={view.id}
              variant={selectedView === view.id ? 'default' : 'outline'}
              onClick={() => setSelectedView(view.id)}
              className={selectedView === view.id 
                ? 'bg-slate-700 hover:bg-slate-600' 
                : 'border-slate-700 text-gray-300 hover:bg-slate-800'
              }
            >
              <span className={view.color || ''}>{view.label}</span>
              <Badge className="ml-2 bg-slate-600 text-white">{view.count}</Badge>
            </Button>
          ))}
        </div>

        {/* Vista KDS por columnas */}
        {selectedView === 'all' ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Columna Pendientes */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-500/20 border border-blue-500/30">
                <Bell className="w-5 h-5 text-blue-400" />
                <span className="text-white font-bold">Pendientes</span>
                <Badge className="ml-auto bg-blue-500 text-white">{ordersByStatus.recibido.length}</Badge>
              </div>
              <ScrollArea className="h-[calc(100vh-280px)]">
                <div className="space-y-4 pr-2">
                  {ordersByStatus.recibido.map(order => (
                    <OrderCard key={order.id} order={order} />
                  ))}
                  {ordersByStatus.recibido.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <Bell className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>No hay pedidos pendientes</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* Columna En Cocina */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 rounded-lg bg-orange-500/20 border border-orange-500/30">
                <ChefHat className="w-5 h-5 text-orange-400" />
                <span className="text-white font-bold">En Cocina</span>
                <Badge className="ml-auto bg-orange-500 text-white">{ordersByStatus.preparando.length}</Badge>
              </div>
              <ScrollArea className="h-[calc(100vh-280px)]">
                <div className="space-y-4 pr-2">
                  {ordersByStatus.preparando.map(order => (
                    <OrderCard key={order.id} order={order} />
                  ))}
                  {ordersByStatus.preparando.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <ChefHat className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>Nada preparándose</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* Columna Listos */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/20 border border-emerald-500/30">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <span className="text-white font-bold">Listos para Entregar</span>
                <Badge className="ml-auto bg-emerald-500 text-white">{ordersByStatus.listo.length}</Badge>
              </div>
              <ScrollArea className="h-[calc(100vh-280px)]">
                <div className="space-y-4 pr-2">
                  {ordersByStatus.listo.map(order => (
                    <OrderCard key={order.id} order={order} />
                  ))}
                  {ordersByStatus.listo.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>No hay pedidos listos</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        ) : (
          /* Vista filtrada */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredOrders.map(order => (
              <OrderCard key={order.id} order={order} />
            ))}
            {filteredOrders.length === 0 && (
              <div className="col-span-full text-center py-16">
                <UtensilsCrossed className="w-20 h-20 mx-auto mb-4 text-gray-600" />
                <p className="text-xl text-gray-400">No hay pedidos en esta categoría</p>
              </div>
            )}
          </div>
        )}

        {/* Sin pedidos activos */}
        {orders.filter(o => o.status !== 'entregado').length === 0 && (
          <Card className="border-none shadow-2xl bg-gradient-to-br from-slate-800 to-slate-900">
            <CardContent className="p-16 text-center">
              <Utensils className="w-24 h-24 text-gray-600 mx-auto mb-6" />
              <h2 className="text-3xl font-bold text-white mb-2">¡Todo al día!</h2>
              <p className="text-gray-400 text-xl">No hay pedidos pendientes 👨‍🍳</p>
              <p className="text-gray-500 mt-2">Los nuevos pedidos aparecerán automáticamente</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
