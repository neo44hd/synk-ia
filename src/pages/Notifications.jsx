import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Bell, 
  CheckCircle2, 
  Trash2,
  Filter,
  AlertTriangle,
  Info
} from "lucide-react";
import { format } from "date-fns";
import { Link } from "react-router-dom";

export default function Notifications() {
  const [user, setUser] = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [filterRead, setFilterRead] = useState('all');

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        console.error('Error loading user:', error);
      }
    };
    loadUser();
  }, []);

  const queryClient = useQueryClient();

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', filterType, filterRead],
    queryFn: async () => {
      let all = await base44.entities.Notification.list('-created_date');
      all = all.filter(n => n.user_id === user?.id || n.user_id === 'all');
      
      if (filterType !== 'all') {
        all = all.filter(n => n.type === filterType);
      }
      
      if (filterRead === 'unread') {
        all = all.filter(n => !n.read);
      } else if (filterRead === 'read') {
        all = all.filter(n => n.read);
      }
      
      return all;
    },
    enabled: !!user,
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const unread = notifications.filter(n => !n.read);
      await Promise.all(
        unread.map(n => base44.entities.Notification.update(n.id, { read: true }))
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAsReadMutation = useMutation({
    mutationFn: (id) => base44.entities.Notification.update(id, { read: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Notification.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  const typeColors = {
    info: 'bg-blue-100 text-blue-800',
    success: 'bg-green-100 text-green-800',
    warning: 'bg-orange-100 text-orange-800',
    error: 'bg-red-100 text-red-800',
    alert: 'bg-red-100 text-red-800'
  };

  const typeIcons = {
    info: Info,
    success: CheckCircle2,
    warning: AlertTriangle,
    error: AlertTriangle,
    alert: AlertTriangle
  };

  return (
    <div className="p-4 md:p-8 min-h-screen bg-gradient-to-br from-zinc-950 via-neutral-900 to-zinc-950">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Bell className="w-8 h-8 text-cyan-400" style={{ filter: 'drop-shadow(0 0 8px rgba(6, 182, 212, 0.8))' }} />
            <span className="text-cyan-400" style={{ textShadow: '0 0 15px rgba(6, 182, 212, 0.6)' }}>Centro de Notificaciones</span>
          </h1>
          <p className="text-zinc-400 mt-1">
            Todas tus alertas y actualizaciones en un solo lugar
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="border-none shadow-lg bg-zinc-800/50 border border-zinc-800">
            <CardContent className="p-4">
              <p className="text-sm text-zinc-400 mb-1">Total</p>
              <p className="text-2xl font-bold text-white">{notifications.length}</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-lg bg-black border border-cyan-500/50" style={{ boxShadow: '0 0 20px rgba(6, 182, 212, 0.3)' }}>
            <CardContent className="p-4">
              <p className="text-sm text-cyan-400/80 mb-1">Sin leer</p>
              <p className="text-2xl font-bold text-cyan-400">{unreadCount}</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-lg bg-zinc-800/50 border border-zinc-800">
            <CardContent className="p-4">
              <p className="text-sm text-zinc-400 mb-1">Leídas</p>
              <p className="text-2xl font-bold text-white">{notifications.filter(n => n.read).length}</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-lg bg-zinc-800/50 border border-zinc-800">
            <CardContent className="p-4">
              <p className="text-sm text-zinc-400 mb-1">Urgentes</p>
              <p className="text-2xl font-bold text-red-400">
                {notifications.filter(n => n.priority === 'urgente').length}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters & Actions */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <Filter className="w-5 h-5 text-gray-500" />
            <div className="flex gap-2">
              {['all', 'info', 'success', 'warning', 'alert'].map((type) => (
                <Button
                  key={type}
                  variant={filterType === type ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterType(type)}
                  className={filterType === type ? 'bg-blue-600' : ''}
                >
                  {type === 'all' ? 'Todas' : type}
                </Button>
              ))}
            </div>
            <div className="flex gap-2">
              {['all', 'unread', 'read'].map((status) => (
                <Button
                  key={status}
                  variant={filterRead === status ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterRead(status)}
                  className={filterRead === status ? 'bg-blue-600' : ''}
                >
                  {status === 'all' ? 'Todas' : status === 'unread' ? 'Sin leer' : 'Leídas'}
                </Button>
              ))}
            </div>
          </div>
          {unreadCount > 0 && (
            <Button
              onClick={() => markAllAsReadMutation.mutate()}
              variant="outline"
              size="sm"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Marcar todas como leídas
            </Button>
          )}
        </div>

        {/* Notifications List */}
        {notifications.length === 0 ? (
          <Card className="border-none shadow-lg bg-zinc-800/50 border border-zinc-800">
            <CardContent className="p-12 text-center">
              <Bell className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">No hay notificaciones</h3>
              <p className="text-zinc-400">
                {filterType !== 'all' || filterRead !== 'all' 
                  ? 'Prueba cambiando los filtros'
                  : 'Cuando recibas notificaciones aparecerán aquí'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {notifications.map((notification) => {
              const Icon = typeIcons[notification.type] || Info;
              return (
                <Card 
                  key={notification.id} 
                  className={`border-none shadow-lg hover:shadow-xl transition-all bg-zinc-800/50 border ${
                    !notification.read ? 'border-cyan-500/50' : 'border-zinc-800'
                  }`}
                  style={!notification.read ? { boxShadow: '0 0 15px rgba(6, 182, 212, 0.2)' } : {}}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${typeColors[notification.type]}`}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <div>
                            <h3 className="font-semibold text-lg text-white">{notification.title}</h3>
                            {!notification.read && (
                              <Badge className="bg-cyan-600 mt-1">Nueva</Badge>
                            )}
                          </div>
                          <span className="text-sm text-zinc-500 whitespace-nowrap">
                            {format(new Date(notification.created_date), 'dd/MM/yyyy HH:mm')}
                          </span>
                        </div>
                        <p className="text-zinc-300 mb-4">{notification.message}</p>
                        <div className="flex items-center gap-3">
                          {!notification.read && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => markAsReadMutation.mutate(notification.id)}
                            >
                              <CheckCircle2 className="w-4 h-4 mr-2" />
                              Marcar como leída
                            </Button>
                          )}
                          {notification.link_to && (
                            <Link to={notification.link_to}>
                              <Button variant="outline" size="sm">
                                Ver detalles
                              </Button>
                            </Link>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteMutation.mutate(notification.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Eliminar
                          </Button>
                        </div>
                      </div>
                    </div>
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