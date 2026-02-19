import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Camera, 
  FileText, 
  Calendar,
  MessageCircle,
  Clock,
  User,
  LogOut,
  Home,
  Bell,
  Package
} from "lucide-react";
import FacialCheckIn from "@/components/worker/FacialCheckIn";
import { format, isValid } from "date-fns";
import { es } from "date-fns/locale";

export default function WorkerMobile() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState("home");

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: todayTimesheet } = useQuery({
    queryKey: ['today-timesheet', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const today = new Date().toISOString().split('T')[0];
      const timesheets = await base44.entities.Timesheet.filter({
        user_id: user.id,
        date: today
      });
      return timesheets[0] || null;
    },
    enabled: !!user,
    refetchInterval: 30000
  });

  const { data: myDocuments = [] } = useQuery({
    queryKey: ['my-documents', user?.id],
    queryFn: () => base44.entities.Document.filter({ 
      tags: user?.email 
    }),
    enabled: !!user,
    initialData: []
  });

  const { data: myVacations = [] } = useQuery({
    queryKey: ['my-vacations', user?.id],
    queryFn: () => base44.entities.VacationRequest.filter({
      employee_id: user?.id
    }),
    enabled: !!user,
    initialData: []
  });

  const { data: notifications = [] } = useQuery({
    queryKey: ['my-notifications', user?.id],
    queryFn: () => base44.entities.Notification.filter({
      user_id: user?.id,
      read: false
    }),
    enabled: !!user,
    initialData: []
  });

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <User className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Cargando...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 pb-8 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
              <User className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">{user.full_name}</h1>
              <p className="text-sm text-blue-100">{user.role === 'admin' ? 'Administrador' : 'Empleado'}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => base44.auth.logout()}
            className="text-white hover:bg-white/10"
          >
            <LogOut className="w-5 h-5" />
          </Button>
        </div>

        {/* Quick Status */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="bg-white/10 backdrop-blur-sm border-white/20">
            <CardContent className="p-3 text-center">
              <Clock className="w-5 h-5 text-white mx-auto mb-1" />
              <p className="text-xs text-blue-100">Hoy</p>
              <p className="text-sm font-bold text-white">
                {todayTimesheet?.check_in ? todayTimesheet.check_in.substring(0, 5) : '--:--'}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-white/10 backdrop-blur-sm border-white/20">
            <CardContent className="p-3 text-center">
              <Bell className="w-5 h-5 text-white mx-auto mb-1" />
              <p className="text-xs text-blue-100">Notif.</p>
              <p className="text-sm font-bold text-white">{notifications.length}</p>
            </CardContent>
          </Card>
          <Card className="bg-white/10 backdrop-blur-sm border-white/20">
            <CardContent className="p-3 text-center">
              <Calendar className="w-5 h-5 text-white mx-auto mb-1" />
              <p className="text-xs text-blue-100">Vacac.</p>
              <p className="text-sm font-bold text-white">{myVacations.filter(v => v.status === 'aprobada').length}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4 space-y-4">
        {activeTab === "home" && (
          <>
            <FacialCheckIn user={user} />

            {/* Today Status */}
            <Card className="border-none shadow-xl">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Estado de Hoy
                </CardTitle>
              </CardHeader>
              <CardContent>
                {todayTimesheet ? (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Entrada:</span>
                      <span className="font-bold text-lg">{todayTimesheet.check_in}</span>
                    </div>
                    {todayTimesheet.check_out ? (
                      <>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Salida:</span>
                          <span className="font-bold text-lg">{todayTimesheet.check_out}</span>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t">
                          <span className="text-gray-600">Total:</span>
                          <span className="font-bold text-xl text-green-600">
                            {todayTimesheet.total_hours?.toFixed(2)}h
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="bg-blue-50 rounded-lg p-3 text-center">
                        <p className="text-sm text-blue-600 font-medium">
                          ⏰ Fichado - Esperando salida
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <Clock className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500">No has fichado hoy</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card className="border-none shadow-xl">
              <CardHeader>
                <CardTitle className="text-lg">Accesos Rápidos</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                <Button
                  onClick={() => setActiveTab("documents")}
                  variant="outline"
                  className="h-20 flex-col gap-2"
                >
                  <FileText className="w-6 h-6" />
                  <span className="text-sm">Documentos</span>
                </Button>
                <Button
                  onClick={() => setActiveTab("vacations")}
                  variant="outline"
                  className="h-20 flex-col gap-2"
                >
                  <Calendar className="w-6 h-6" />
                  <span className="text-sm">Vacaciones</span>
                </Button>
                <Button
                  onClick={() => setActiveTab("orders")}
                  variant="outline"
                  className="h-20 flex-col gap-2"
                >
                  <Package className="w-6 h-6" />
                  <span className="text-sm">Pedidos</span>
                </Button>
                <Button
                  onClick={() => setActiveTab("chat")}
                  variant="outline"
                  className="h-20 flex-col gap-2"
                >
                  <MessageCircle className="w-6 h-6" />
                  <span className="text-sm">Chat Equipo</span>
                </Button>
              </CardContent>
            </Card>
          </>
        )}

        {activeTab === "documents" && (
          <Card className="border-none shadow-xl">
            <CardHeader>
              <CardTitle>Mis Documentos</CardTitle>
            </CardHeader>
            <CardContent>
              {myDocuments.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500">No hay documentos</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {myDocuments.map(doc => (
                    <div key={doc.id} className="p-3 bg-gray-50 rounded-lg">
                      <p className="font-medium">{doc.title}</p>
                      <p className="text-sm text-gray-600">{doc.category}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === "vacations" && (
          <Card className="border-none shadow-xl">
            <CardHeader>
              <CardTitle>Mis Vacaciones</CardTitle>
            </CardHeader>
            <CardContent>
              {myVacations.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500">No hay solicitudes</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {myVacations.map(vac => (
                    <div key={vac.id} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <p className="font-medium">{vac.request_type}</p>
                        <Badge className={
                          vac.status === 'aprobada' ? 'bg-green-100 text-green-800' :
                          vac.status === 'pendiente' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }>
                          {vac.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600">
                        {vac.start_date} → {vac.end_date}
                      </p>
                      <p className="text-sm text-gray-500">{vac.total_days} días</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg">
        <div className="grid grid-cols-4 gap-0">
          <Button
            variant={activeTab === "home" ? "default" : "ghost"}
            className="h-16 rounded-none flex-col gap-1"
            onClick={() => setActiveTab("home")}
          >
            <Home className="w-5 h-5" />
            <span className="text-xs">Inicio</span>
          </Button>
          <Button
            variant={activeTab === "documents" ? "default" : "ghost"}
            className="h-16 rounded-none flex-col gap-1"
            onClick={() => setActiveTab("documents")}
          >
            <FileText className="w-5 h-5" />
            <span className="text-xs">Docs</span>
          </Button>
          <Button
            variant={activeTab === "vacations" ? "default" : "ghost"}
            className="h-16 rounded-none flex-col gap-1"
            onClick={() => setActiveTab("vacations")}
          >
            <Calendar className="w-5 h-5" />
            <span className="text-xs">Vacac.</span>
          </Button>
          <Button
            variant={activeTab === "orders" ? "default" : "ghost"}
            className="h-16 rounded-none flex-col gap-1"
            onClick={() => setActiveTab("orders")}
          >
            <Package className="w-5 h-5" />
            <span className="text-xs">Pedidos</span>
          </Button>
        </div>
      </div>
    </div>
  );
}