import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle2, AlertCircle, Calendar, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function Timesheets() {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [currentUser, setCurrentUser] = useState(null);

  React.useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);
      } catch (error) {
        console.error('Error loading user:', error);
      }
    };
    loadUser();
  }, []);

  const queryClient = useQueryClient();

  const { data: timesheets = [] } = useQuery({
    queryKey: ['timesheets', selectedDate],
    queryFn: async () => {
      const all = await base44.entities.Timesheet.list('-date');
      return all.filter(t => t.date === selectedDate);
    },
    initialData: [],
  });

  const { data: allTimesheets = [] } = useQuery({
    queryKey: ['timesheets-all'],
    queryFn: () => base44.entities.Timesheet.list('-date', 100),
    initialData: [],
  });

  const checkInMutation = useMutation({
    mutationFn: async () => {
      const now = new Date();
      const checkInTime = format(now, 'HH:mm');
      
      return base44.entities.Timesheet.create({
        user_id: currentUser.id,
        user_name: currentUser.full_name,
        date: selectedDate,
        check_in: checkInTime,
        status: 'incompleto'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      toast.success('Fichaje de entrada registrado');
    },
  });

  const checkOutMutation = useMutation({
    mutationFn: async (timesheetId) => {
      const timesheet = timesheets.find(t => t.id === timesheetId);
      const now = new Date();
      const checkOutTime = format(now, 'HH:mm');
      
      // Calculate hours
      const [inHour, inMin] = timesheet.check_in.split(':').map(Number);
      const [outHour, outMin] = checkOutTime.split(':').map(Number);
      const totalHours = ((outHour * 60 + outMin) - (inHour * 60 + inMin)) / 60;
      
      return base44.entities.Timesheet.update(timesheetId, {
        check_out: checkOutTime,
        total_hours: Math.round(totalHours * 100) / 100,
        status: 'completo'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      toast.success('Fichaje de salida registrado');
    },
  });

  const todayTimesheet = timesheets.find(t => t.user_id === currentUser?.id);
  const hasCheckedIn = todayTimesheet && todayTimesheet.check_in;
  const hasCheckedOut = todayTimesheet && todayTimesheet.check_out;

  // Stats
  const totalHoursThisWeek = allTimesheets
    .filter(t => {
      const date = new Date(t.date);
      const now = new Date();
      const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
      return date >= weekStart && t.total_hours;
    })
    .reduce((sum, t) => sum + (t.total_hours || 0), 0);

  const avgHoursPerDay = allTimesheets.length > 0 
    ? allTimesheets.reduce((sum, t) => sum + (t.total_hours || 0), 0) / allTimesheets.filter(t => t.total_hours).length
    : 0;

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Clock className="w-8 h-8 text-blue-600" />
            Control de Fichajes
          </h1>
          <p className="text-gray-600 mt-1">
            Registro de entradas y salidas del personal
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="border-none shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <Clock className="w-5 h-5 text-blue-600" />
                <p className="text-sm text-gray-600">Horas esta semana</p>
              </div>
              <p className="text-3xl font-bold">{totalHoursThisWeek.toFixed(1)}h</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <TrendingUp className="w-5 h-5 text-green-600" />
                <p className="text-sm text-gray-600">Promedio diario</p>
              </div>
              <p className="text-3xl font-bold">{avgHoursPerDay.toFixed(1)}h</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <Calendar className="w-5 h-5 text-purple-600" />
                <p className="text-sm text-gray-600">Registros totales</p>
              </div>
              <p className="text-3xl font-bold">{allTimesheets.length}</p>
            </CardContent>
          </Card>
        </div>

        {/* Check In/Out Card */}
        <Card className="border-none shadow-lg mb-8 bg-gradient-to-br from-blue-500 to-blue-700 text-white">
          <CardContent className="p-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div>
                <h2 className="text-2xl font-bold mb-2">
                  {format(new Date(), 'EEEE, d MMMM yyyy')}
                </h2>
                <p className="text-blue-100">
                  {hasCheckedIn && !hasCheckedOut && `Entrada: ${todayTimesheet.check_in}`}
                  {hasCheckedOut && `Jornada completada: ${todayTimesheet.total_hours}h`}
                  {!hasCheckedIn && 'No has fichado hoy'}
                </p>
              </div>
              <div className="flex gap-4">
                {!hasCheckedIn && (
                  <Button
                    size="lg"
                    onClick={() => checkInMutation.mutate()}
                    className="bg-white text-blue-700 hover:bg-blue-50"
                    disabled={!currentUser}
                  >
                    <Clock className="w-5 h-5 mr-2" />
                    Fichar Entrada
                  </Button>
                )}
                {hasCheckedIn && !hasCheckedOut && (
                  <Button
                    size="lg"
                    onClick={() => checkOutMutation.mutate(todayTimesheet.id)}
                    className="bg-white text-blue-700 hover:bg-blue-50"
                  >
                    <CheckCircle2 className="w-5 h-5 mr-2" />
                    Fichar Salida
                  </Button>
                )}
                {hasCheckedOut && (
                  <div className="flex items-center gap-2 bg-green-500 px-6 py-3 rounded-lg">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="font-semibold">Jornada completada</span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Date selector */}
        <div className="mb-6">
          <Label className="text-sm font-medium text-gray-700 mb-2 block">
            Ver fichajes del día:
          </Label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Timesheets List */}
        <Card className="border-none shadow-lg">
          <CardHeader>
            <CardTitle>Fichajes de {format(new Date(selectedDate), 'dd/MM/yyyy')}</CardTitle>
          </CardHeader>
          <CardContent>
            {timesheets.length === 0 ? (
              <div className="text-center py-12">
                <Clock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600">No hay fichajes para este día</p>
              </div>
            ) : (
              <div className="space-y-3">
                {timesheets.map((timesheet) => (
                  <div
                    key={timesheet.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                        <Clock className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium">{timesheet.user_name}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-sm text-gray-600">
                            Entrada: {timesheet.check_in || '-'}
                          </span>
                          <span className="text-sm text-gray-600">
                            Salida: {timesheet.check_out || '-'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {timesheet.total_hours && (
                        <div className="text-right">
                          <p className="text-2xl font-bold">{timesheet.total_hours}h</p>
                          <p className="text-sm text-gray-600">trabajadas</p>
                        </div>
                      )}
                      <Badge className={
                        timesheet.status === 'completo' 
                          ? 'bg-green-100 text-green-800'
                          : timesheet.status === 'incompleto'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-blue-100 text-blue-800'
                      }>
                        {timesheet.status === 'completo' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                        {timesheet.status === 'incompleto' && <AlertCircle className="w-3 h-3 mr-1" />}
                        {timesheet.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Label({ children, className = '' }) {
  return <label className={`block text-sm font-medium ${className}`}>{children}</label>;
}