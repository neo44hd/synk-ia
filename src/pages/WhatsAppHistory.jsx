import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  Phone,
  Clock,
  CheckCircle,
  AlertCircle,
  Send,
  RefreshCw,
  Search,
  Filter,
  Calendar,
  User,
  ShoppingCart,
  ChefHat,
  Building2,
  ExternalLink,
  Eye,
  RotateCcw,
  Download,
  ArrowUpDown,
  X,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import whatsappService from '@/services/whatsappService';

const statusColors = {
  sent: 'bg-green-500/20 text-green-400 border-green-500/30',
  pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  failed: 'bg-red-500/20 text-red-400 border-red-500/30',
  delivered: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  read: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
};

const statusLabels = {
  sent: 'Enviado',
  pending: 'Pendiente',
  failed: 'Fallido',
  delivered: 'Entregado',
  read: 'Leído',
};

const typeIcons = {
  order_confirmation: <ShoppingCart className="w-4 h-4" />,
  ceo_notification: <Building2 className="w-4 h-4" />,
  kitchen_notification: <ChefHat className="w-4 h-4" />,
  test: <Send className="w-4 h-4" />,
  outbound: <MessageSquare className="w-4 h-4" />,
};

const typeLabels = {
  order_confirmation: 'Confirmación Cliente',
  ceo_notification: 'Notificación CEO',
  kitchen_notification: 'Notificación Cocina',
  test: 'Prueba',
  outbound: 'Mensaje Saliente',
};

export default function WhatsAppHistory() {
  const [messages, setMessages] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [activeTab, setActiveTab] = useState('messages');
  const [stats, setStats] = useState({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setLoading(true);
    const allMessages = whatsappService.getMessages();
    const allOrders = whatsappService.getOrders();
    const statistics = whatsappService.getStatistics(30);
    
    setMessages(allMessages);
    setOrders(allOrders);
    setStats(statistics);
    setLoading(false);
  };

  const filteredMessages = useMemo(() => {
    let result = [...messages];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (m) =>
          m.to?.toLowerCase().includes(query) ||
          m.body?.toLowerCase().includes(query) ||
          m.orderId?.toLowerCase().includes(query)
      );
    }

    if (statusFilter !== 'all') {
      result = result.filter((m) => m.status === statusFilter);
    }

    if (typeFilter !== 'all') {
      result = result.filter((m) => m.type === typeFilter);
    }

    if (dateFrom) {
      result = result.filter((m) => new Date(m.timestamp) >= new Date(dateFrom));
    }

    if (dateTo) {
      result = result.filter((m) => new Date(m.timestamp) <= new Date(dateTo + 'T23:59:59'));
    }

    return result;
  }, [messages, searchQuery, statusFilter, typeFilter, dateFrom, dateTo]);

  const filteredOrders = useMemo(() => {
    let result = [...orders];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (o) =>
          o.orderNumber?.toLowerCase().includes(query) ||
          o.customer?.name?.toLowerCase().includes(query) ||
          o.customer?.phone?.toLowerCase().includes(query)
      );
    }

    if (dateFrom) {
      result = result.filter((o) => new Date(o.createdAt) >= new Date(dateFrom));
    }

    if (dateTo) {
      result = result.filter((o) => new Date(o.createdAt) <= new Date(dateTo + 'T23:59:59'));
    }

    return result;
  }, [orders, searchQuery, dateFrom, dateTo]);

  const handleRetryMessage = async (messageId) => {
    setLoading(true);
    await whatsappService.retryFailedMessage(messageId);
    loadData();
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setTypeFilter('all');
    setDateFrom('');
    setDateTo('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <MessageSquare className="w-6 h-6 text-green-400" />
            </div>
            Historial WhatsApp
          </h1>
          <p className="text-zinc-400 mt-1">
            Historial de mensajes y pedidos recibidos por WhatsApp
          </p>
        </div>
        <Button
          onClick={loadData}
          variant="outline"
          className="border-zinc-700 hover:bg-zinc-800"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-zinc-400 text-sm">Total Mensajes</p>
                <p className="text-2xl font-bold text-white">{stats.totalMessages || 0}</p>
              </div>
              <div className="p-3 bg-blue-500/20 rounded-lg">
                <MessageSquare className="w-6 h-6 text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-zinc-400 text-sm">Enviados</p>
                <p className="text-2xl font-bold text-green-400">{stats.sentMessages || 0}</p>
              </div>
              <div className="p-3 bg-green-500/20 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-zinc-400 text-sm">Fallidos</p>
                <p className="text-2xl font-bold text-red-400">{stats.failedMessages || 0}</p>
              </div>
              <div className="p-3 bg-red-500/20 rounded-lg">
                <AlertCircle className="w-6 h-6 text-red-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-zinc-400 text-sm">Pedidos (30d)</p>
                <p className="text-2xl font-bold text-white">{stats.totalOrders || 0}</p>
              </div>
              <div className="p-3 bg-orange-500/20 rounded-lg">
                <ShoppingCart className="w-6 h-6 text-orange-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por teléfono, mensaje, pedido..."
                  className="bg-zinc-800 border-zinc-700 text-white pl-10"
                />
              </div>
            </div>

            {activeTab === 'messages' && (
              <>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[150px] bg-zinc-800 border-zinc-700 text-white">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700">
                    <SelectItem value="all" className="text-white">Todos los estados</SelectItem>
                    <SelectItem value="sent" className="text-white">Enviados</SelectItem>
                    <SelectItem value="pending" className="text-white">Pendientes</SelectItem>
                    <SelectItem value="failed" className="text-white">Fallidos</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-[180px] bg-zinc-800 border-zinc-700 text-white">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700">
                    <SelectItem value="all" className="text-white">Todos los tipos</SelectItem>
                    <SelectItem value="order_confirmation" className="text-white">Confirmación Cliente</SelectItem>
                    <SelectItem value="ceo_notification" className="text-white">Notificación CEO</SelectItem>
                    <SelectItem value="kitchen_notification" className="text-white">Notificación Cocina</SelectItem>
                    <SelectItem value="test" className="text-white">Pruebas</SelectItem>
                  </SelectContent>
                </Select>
              </>
            )}

            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-[150px] bg-zinc-800 border-zinc-700 text-white"
              placeholder="Desde"
            />

            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-[150px] bg-zinc-800 border-zinc-700 text-white"
              placeholder="Hasta"
            />

            <Button
              variant="outline"
              onClick={clearFilters}
              className="border-zinc-700 hover:bg-zinc-800"
            >
              <X className="w-4 h-4 mr-2" />
              Limpiar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-zinc-800 border border-zinc-700">
          <TabsTrigger value="messages" className="data-[state=active]:bg-zinc-700">
            <MessageSquare className="w-4 h-4 mr-2" />
            Mensajes ({filteredMessages.length})
          </TabsTrigger>
          <TabsTrigger value="orders" className="data-[state=active]:bg-zinc-700">
            <ShoppingCart className="w-4 h-4 mr-2" />
            Pedidos ({filteredOrders.length})
          </TabsTrigger>
        </TabsList>

        {/* Messages Tab */}
        <TabsContent value="messages">
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="p-0">
              {filteredMessages.length === 0 ? (
                <div className="py-16 text-center">
                  <MessageSquare className="w-16 h-16 mx-auto text-zinc-600 mb-4" />
                  <p className="text-zinc-400">No hay mensajes que mostrar</p>
                </div>
              ) : (
                <div className="divide-y divide-zinc-800">
                  {filteredMessages.map((message) => (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="p-4 hover:bg-zinc-800/50 transition-colors cursor-pointer"
                      onClick={() => setSelectedMessage(message)}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className={`p-2 rounded-lg flex-shrink-0 ${
                            message.type === 'order_confirmation' ? 'bg-green-500/20' :
                            message.type === 'ceo_notification' ? 'bg-yellow-500/20' :
                            message.type === 'kitchen_notification' ? 'bg-orange-500/20' :
                            'bg-blue-500/20'
                          }`}>
                            {typeIcons[message.type] || <MessageSquare className="w-4 h-4" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-white">{message.to}</span>
                              <Badge variant="outline" className="text-xs">
                                {typeLabels[message.type] || message.type}
                              </Badge>
                              {message.orderId && (
                                <Badge variant="secondary" className="bg-zinc-700 text-xs">
                                  #{message.orderId}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-zinc-400 mt-1 truncate">
                              {message.body?.substring(0, 100)}...
                            </p>
                            <div className="flex items-center gap-4 mt-2 text-xs text-zinc-500">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatDate(message.timestamp)}
                              </span>
                              {message.attempts > 1 && (
                                <span className="flex items-center gap-1">
                                  <RotateCcw className="w-3 h-3" />
                                  {message.attempts} intentos
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Badge
                            variant="outline"
                            className={statusColors[message.status]}
                          >
                            {message.status === 'sent' && <CheckCircle className="w-3 h-3 mr-1" />}
                            {message.status === 'failed' && <AlertCircle className="w-3 h-3 mr-1" />}
                            {message.status === 'pending' && <Clock className="w-3 h-3 mr-1" />}
                            {statusLabels[message.status] || message.status}
                          </Badge>
                          {message.status === 'failed' && message.attempts < 3 && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRetryMessage(message.id);
                              }}
                              className="border-zinc-700 hover:bg-zinc-800"
                            >
                              <RotateCcw className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Orders Tab */}
        <TabsContent value="orders">
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="p-0">
              {filteredOrders.length === 0 ? (
                <div className="py-16 text-center">
                  <ShoppingCart className="w-16 h-16 mx-auto text-zinc-600 mb-4" />
                  <p className="text-zinc-400">No hay pedidos que mostrar</p>
                </div>
              ) : (
                <div className="divide-y divide-zinc-800">
                  {filteredOrders.map((order) => (
                    <motion.div
                      key={order.orderNumber}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="p-4 hover:bg-zinc-800/50 transition-colors cursor-pointer"
                      onClick={() => setSelectedOrder(order)}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1">
                          <div className="p-2 bg-orange-500/20 rounded-lg">
                            <ShoppingCart className="w-5 h-5 text-orange-400" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-white">#{order.orderNumber}</span>
                              <Badge variant="outline" className={order.orderType === 'delivery' ? 'border-blue-500/50 text-blue-400' : 'border-green-500/50 text-green-400'}>
                                {order.orderType === 'delivery' ? '🛵 Domicilio' : '🏪 Recogida'}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <User className="w-4 h-4 text-zinc-400" />
                              <span className="text-white">{order.customer?.name}</span>
                              <span className="text-zinc-500">·</span>
                              <Phone className="w-4 h-4 text-zinc-400" />
                              <span className="text-zinc-400">{order.customer?.phone}</span>
                            </div>
                            <p className="text-sm text-zinc-400 mt-1">
                              {order.items?.length || 0} productos · Total: <span className="text-white font-medium">{order.total?.toFixed(2)}€</span>
                            </p>
                            <div className="flex items-center gap-2 mt-2 text-xs text-zinc-500">
                              <Clock className="w-3 h-3" />
                              {formatDate(order.createdAt)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={
                              order.status === 'completed' ? statusColors.sent :
                              order.status === 'pending' ? statusColors.pending :
                              statusColors.failed
                            }
                          >
                            {order.status === 'completed' ? 'Completado' :
                             order.status === 'pending' ? 'Pendiente' :
                             order.status}
                          </Badge>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Message Detail Dialog */}
      <Dialog open={!!selectedMessage} onOpenChange={() => setSelectedMessage(null)}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-green-400" />
              Detalle del Mensaje
            </DialogTitle>
          </DialogHeader>
          {selectedMessage && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-zinc-500 uppercase">Destinatario</p>
                  <p className="text-white font-medium">{selectedMessage.to}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500 uppercase">Estado</p>
                  <Badge variant="outline" className={statusColors[selectedMessage.status]}>
                    {statusLabels[selectedMessage.status]}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-zinc-500 uppercase">Tipo</p>
                  <p className="text-white">{typeLabels[selectedMessage.type] || selectedMessage.type}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500 uppercase">Fecha</p>
                  <p className="text-white">{formatDate(selectedMessage.timestamp)}</p>
                </div>
                {selectedMessage.orderId && (
                  <div>
                    <p className="text-xs text-zinc-500 uppercase">Nº Pedido</p>
                    <p className="text-white">#{selectedMessage.orderId}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-zinc-500 uppercase">Intentos</p>
                  <p className="text-white">{selectedMessage.attempts || 1}</p>
                </div>
              </div>
              
              <div>
                <p className="text-xs text-zinc-500 uppercase mb-2">Contenido del Mensaje</p>
                <div className="bg-zinc-800 rounded-lg p-4">
                  <pre className="text-white text-sm whitespace-pre-wrap font-sans">
                    {selectedMessage.body}
                  </pre>
                </div>
              </div>

              {selectedMessage.error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <p className="text-xs text-red-400 uppercase mb-1">Error</p>
                  <p className="text-red-300 text-sm">{selectedMessage.error}</p>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 border-zinc-700"
                  onClick={() => {
                    const link = whatsappService.getWhatsAppLink(selectedMessage.to, selectedMessage.body);
                    if (link) window.open(link, '_blank');
                  }}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Abrir en WhatsApp
                </Button>
                {selectedMessage.status === 'failed' && selectedMessage.attempts < 3 && (
                  <Button
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => {
                      handleRetryMessage(selectedMessage.id);
                      setSelectedMessage(null);
                    }}
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Reintentar
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Order Detail Dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-orange-400" />
              Pedido #{selectedOrder?.orderNumber}
            </DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-zinc-500 uppercase">Cliente</p>
                  <p className="text-white font-medium">{selectedOrder.customer?.name}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500 uppercase">Teléfono</p>
                  <p className="text-white">{selectedOrder.customer?.phone}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500 uppercase">Tipo</p>
                  <Badge variant="outline" className={selectedOrder.orderType === 'delivery' ? 'border-blue-500/50 text-blue-400' : 'border-green-500/50 text-green-400'}>
                    {selectedOrder.orderType === 'delivery' ? '🛵 Domicilio' : '🏪 Recogida'}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-zinc-500 uppercase">Fecha</p>
                  <p className="text-white">{formatDate(selectedOrder.createdAt)}</p>
                </div>
              </div>

              {selectedOrder.orderType === 'delivery' && selectedOrder.deliveryAddress && (
                <div>
                  <p className="text-xs text-zinc-500 uppercase mb-1">Dirección de Entrega</p>
                  <p className="text-white">{selectedOrder.deliveryAddress}</p>
                </div>
              )}

              <div>
                <p className="text-xs text-zinc-500 uppercase mb-2">Productos</p>
                <div className="bg-zinc-800 rounded-lg divide-y divide-zinc-700">
                  {selectedOrder.items?.map((item, idx) => (
                    <div key={idx} className="p-3 flex justify-between">
                      <span className="text-white">{item.quantity}x {item.name}</span>
                      <span className="text-zinc-400">{(item.price * item.quantity).toFixed(2)}€</span>
                    </div>
                  ))}
                  <div className="p-3 flex justify-between font-bold">
                    <span className="text-white">Total</span>
                    <span className="text-orange-400">{selectedOrder.total?.toFixed(2)}€</span>
                  </div>
                </div>
              </div>

              {selectedOrder.customer?.notes && (
                <div>
                  <p className="text-xs text-zinc-500 uppercase mb-1">Notas</p>
                  <p className="text-zinc-400 text-sm">{selectedOrder.customer.notes}</p>
                </div>
              )}

              <Button
                variant="outline"
                className="w-full border-zinc-700"
                onClick={() => {
                  const link = whatsappService.getWhatsAppLink(selectedOrder.customer?.phone);
                  if (link) window.open(link, '_blank');
                }}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Contactar Cliente por WhatsApp
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
