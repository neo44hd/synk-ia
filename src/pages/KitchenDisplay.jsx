import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Utensils, 
  Clock, 
  CheckCircle2,
  AlertCircle,
  Flame
} from "lucide-react";
import { format, differenceInMinutes } from "date-fns";

export default function KitchenDisplay() {
  const queryClient = useQueryClient();

  const { data: orders = [] } = useQuery({
    queryKey: ['kitchen-orders'],
    queryFn: () => base44.entities.Order.list('-order_date', 50),
    initialData: [],
    refetchInterval: 5000, // Refresh cada 5s
  });

  const updateOrderMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Order.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kitchen-orders'] });
    },
  });

  const kitchenOrders = orders.filter(o => 
    o.status === 'confirmado' || o.status === 'en_cocina'
  );

  const getTimeColor = (orderDate) => {
    if (!orderDate) return 'text-gray-400';
    const elapsed = differenceInMinutes(new Date(), new Date(orderDate));
    if (elapsed > 30) return 'text-red-500 font-bold animate-pulse';
    if (elapsed > 20) return 'text-orange-500 font-bold';
    if (elapsed > 10) return 'text-yellow-500';
    return 'text-green-500';
  };

  const handleMarkReady = (order) => {
    updateOrderMutation.mutate({
      id: order.id,
      data: { status: 'listo' }
    });
  };

  const handleStartCooking = (order) => {
    const readyTime = new Date();
    readyTime.setMinutes(readyTime.getMinutes() + 20);
    
    updateOrderMutation.mutate({
      id: order.id,
      data: { 
        status: 'en_cocina',
        estimated_ready_time: readyTime.toISOString()
      }
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-4 bg-gradient-to-r from-orange-600 to-red-600 px-8 py-4 rounded-2xl shadow-2xl mb-4">
            <Flame className="w-12 h-12 text-white animate-pulse" />
            <div className="text-left">
              <h1 className="text-4xl font-bold text-white">COCINA</h1>
              <p className="text-orange-100">Pantalla de Producción</p>
            </div>
          </div>
          <div className="flex items-center justify-center gap-4 mt-4">
            <Badge className="bg-yellow-500 text-white text-lg px-4 py-2">
              Pendientes: {kitchenOrders.filter(o => o.status === 'confirmado').length}
            </Badge>
            <Badge className="bg-orange-500 text-white text-lg px-4 py-2">
              En Cocina: {kitchenOrders.filter(o => o.status === 'en_cocina').length}
            </Badge>
          </div>
        </div>

        {/* Orders Grid */}
        {kitchenOrders.length === 0 ? (
          <Card className="border-none shadow-2xl bg-gradient-to-br from-slate-800 to-slate-900">
            <CardContent className="p-16 text-center">
              <Utensils className="w-24 h-24 text-gray-600 mx-auto mb-6" />
              <h2 className="text-3xl font-bold text-white mb-2">No hay pedidos</h2>
              <p className="text-gray-400 text-xl">Todo listo por ahora 👨‍🍳</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {kitchenOrders.map((order) => {
              const elapsed = order.order_date ? differenceInMinutes(new Date(), new Date(order.order_date)) : 0;
              const isUrgent = elapsed > 20;

              return (
                <Card 
                  key={order.id} 
                  className={`border-4 shadow-2xl transition-all ${
                    isUrgent 
                      ? 'border-red-500 bg-gradient-to-br from-red-950 to-red-900 animate-pulse' 
                      : order.status === 'en_cocina'
                      ? 'border-orange-500 bg-gradient-to-br from-orange-950 to-orange-900'
                      : 'border-yellow-500 bg-gradient-to-br from-yellow-950 to-yellow-900'
                  }`}
                >
                  <CardContent className="p-6">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-3xl font-bold text-white mb-1">{order.order_number}</h3>
                        <p className="text-lg text-gray-300">{order.customer_name}</p>
                      </div>
                      <div className="text-right">
                        <div className={`text-2xl font-bold ${getTimeColor(order.order_date)} flex items-center gap-2`}>
                          <Clock className="w-6 h-6" />
                          {elapsed}m
                        </div>
                        {order.priority === 'urgente' && (
                          <Badge className="bg-red-600 text-white mt-1">
                            <AlertCircle className="w-4 h-4 mr-1" />
                            URGENTE
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Items */}
                    <div className="bg-black/30 rounded-xl p-4 mb-4 space-y-2">
                      {order.items?.map((item, idx) => (
                        <div key={idx} className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <span className="text-2xl font-bold text-white bg-white/10 rounded-lg px-3 py-1">
                                {item.quantity}x
                              </span>
                              <div>
                                <p className="text-xl font-bold text-white">{item.name}</p>
                                {item.ration && (
                                  <p className="text-sm text-gray-400">{item.ration}</p>
                                )}
                                {item.notes && (
                                  <p className="text-sm text-yellow-400 mt-1">📝 {item.notes}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Notes */}
                    {order.kitchen_notes && (
                      <div className="bg-yellow-900/30 border-2 border-yellow-500 rounded-lg p-3 mb-4">
                        <p className="text-yellow-300 font-medium">⚠️ {order.kitchen_notes}</p>
                      </div>
                    )}

                    {/* Channel Info */}
                    <div className="flex items-center justify-between mb-4 text-gray-400 text-sm">
                      <span className="capitalize">{order.channel}</span>
                      {order.estimated_ready_time && (
                        <span>Listo: {format(new Date(order.estimated_ready_time), 'HH:mm')}</span>
                      )}
                    </div>

                    {/* Actions */}
                    {order.status === 'confirmado' ? (
                      <Button
                        onClick={() => handleStartCooking(order)}
                        size="lg"
                        className="w-full bg-orange-600 hover:bg-orange-700 text-white text-xl py-6"
                      >
                        <Flame className="w-6 h-6 mr-2" />
                        Empezar a Cocinar
                      </Button>
                    ) : (
                      <Button
                        onClick={() => handleMarkReady(order)}
                        size="lg"
                        className="w-full bg-green-600 hover:bg-green-700 text-white text-xl py-6"
                      >
                        <CheckCircle2 className="w-6 h-6 mr-2" />
                        Marcar Listo
                      </Button>
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