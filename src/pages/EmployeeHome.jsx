import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Clock, 
  Calendar, 
  DollarSign, 
  FileText,
  User,
  MessageSquare,
  Sun,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { format } from "date-fns";

export default function EmployeeHome() {
  const [user, setUser] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());

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

    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const { data: myPayrolls = [] } = useQuery({
    queryKey: ['my-payrolls'],
    queryFn: async () => {
      const payrolls = await base44.entities.Payroll.list('-period', 3);
      return payrolls.filter(p => p.employee_id === user?.id || p.employee_name === user?.full_name);
    },
    enabled: !!user,
  });

  const { data: myRequests = [] } = useQuery({
    queryKey: ['my-vacation-requests'],
    queryFn: async () => {
      const requests = await base44.entities.VacationRequest.list('-created_date', 5);
      return requests.filter(r => r.employee_id === user?.id || r.employee_name === user?.full_name);
    },
    enabled: !!user,
  });

  const { data: todayTimesheet } = useQuery({
    queryKey: ['today-timesheet'],
    queryFn: async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const timesheets = await base44.entities.Timesheet.list('-created_date', 10);
      return timesheets.find(t => 
        t.date === today && 
        (t.user_id === user?.id || t.user_name === user?.full_name)
      );
    },
    enabled: !!user,
  });

  const lastPayroll = myPayrolls[0];
  const pendingRequests = myRequests.filter(r => r.status === 'pendiente').length;
  const approvedDays = myRequests
    .filter(r => r.status === 'aprobada')
    .reduce((sum, r) => sum + (r.total_days || 0), 0);
  const availableDays = (user?.vacation_days_available || 22) - approvedDays;

  const quickActions = [
    {
      title: "Fichar",
      icon: Clock,
      to: createPageUrl("Timesheets"),
      color: "from-blue-500 to-blue-700",
      description: todayTimesheet?.check_in && !todayTimesheet?.check_out ? "Fichar salida" : "Fichar entrada"
    },
    {
      title: "Mis Nóminas",
      icon: DollarSign,
      to: createPageUrl("Payrolls"),
      color: "from-green-500 to-emerald-600",
      description: lastPayroll ? `Última: ${lastPayroll.net_salary}€` : "Ver nóminas"
    },
    {
      title: "Vacaciones",
      icon: Sun,
      to: createPageUrl("VacationRequests"),
      color: "from-orange-500 to-red-500",
      description: `${availableDays} días disponibles`
    },
    {
      title: "Mi Contrato",
      icon: FileText,
      to: createPageUrl("Contracts"),
      color: "from-purple-500 to-pink-600",
      description: "Ver detalles"
    },
    {
      title: "Asistente RRHH",
      icon: MessageSquare,
      to: createPageUrl("HRAgent"),
      color: "from-pink-500 to-purple-600",
      description: "Chatear con IA"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 pb-32">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm opacity-90">Bienvenido/a</p>
              <h1 className="text-2xl font-bold">{user?.full_name || 'Empleado'}</h1>
              <p className="text-sm opacity-75">{user?.position || ''}</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold">{format(currentTime, 'HH:mm')}</p>
              <p className="text-sm opacity-75">{format(currentTime, 'dd/MM/yyyy')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="max-w-2xl mx-auto px-4 -mt-24 mb-6">
        <div className="grid grid-cols-3 gap-3">
          <Card className="border-none shadow-lg bg-white">
            <CardContent className="p-4 text-center">
              <Sun className="w-6 h-6 text-orange-500 mx-auto mb-2" />
              <p className="text-2xl font-bold">{availableDays}</p>
              <p className="text-xs text-gray-600">Días libres</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-lg bg-white">
            <CardContent className="p-4 text-center">
              <Calendar className="w-6 h-6 text-blue-500 mx-auto mb-2" />
              <p className="text-2xl font-bold">{pendingRequests}</p>
              <p className="text-xs text-gray-600">Pendientes</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-lg bg-white">
            <CardContent className="p-4 text-center">
              <DollarSign className="w-6 h-6 text-green-500 mx-auto mb-2" />
              <p className="text-2xl font-bold">{myPayrolls.length}</p>
              <p className="text-xs text-gray-600">Nóminas</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Fichaje Today */}
      {todayTimesheet && (
        <div className="max-w-2xl mx-auto px-4 mb-6">
          <Card className="border-none shadow-lg bg-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <Clock className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-semibold">Fichaje de hoy</p>
                    <p className="text-sm text-gray-600">
                      Entrada: {todayTimesheet.check_in || 'No fichada'}
                      {todayTimesheet.check_out && ` • Salida: ${todayTimesheet.check_out}`}
                    </p>
                  </div>
                </div>
                {todayTimesheet.status === 'completo' ? (
                  <CheckCircle2 className="w-6 h-6 text-green-500" />
                ) : (
                  <AlertCircle className="w-6 h-6 text-orange-500" />
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quick Actions */}
      <div className="max-w-2xl mx-auto px-4">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Acciones rápidas</h2>
        <div className="grid grid-cols-2 gap-3">
          {quickActions.map((action, idx) => (
            <Link key={idx} to={action.to}>
              <Card className="border-none shadow-lg hover:shadow-xl transition-all h-full">
                <CardContent className="p-4">
                  <div className={`w-12 h-12 bg-gradient-to-br ${action.color} rounded-xl flex items-center justify-center mb-3`}>
                    <action.icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="font-semibold mb-1">{action.title}</h3>
                  <p className="text-xs text-gray-600">{action.description}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      {myRequests.length > 0 && (
        <div className="max-w-2xl mx-auto px-4 mt-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Mis últimas solicitudes</h2>
          <div className="space-y-3">
            {myRequests.slice(0, 3).map((request) => (
              <Card key={request.id} className="border-none shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-semibold capitalize">{request.request_type}</p>
                        <p className="text-sm text-gray-600">
                          {request.start_date ? format(new Date(request.start_date), 'dd/MM') : ''} - {request.end_date ? format(new Date(request.end_date), 'dd/MM') : ''} ({request.total_days} días)
                        </p>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      request.status === 'aprobada' ? 'bg-green-100 text-green-800' :
                      request.status === 'rechazada' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {request.status}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}