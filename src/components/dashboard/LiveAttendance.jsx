import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, MapPin, Wifi, AlertCircle, User } from "lucide-react";
import { format } from "date-fns";

export default function LiveAttendance() {
  const { data: activeTimesheets = [], isLoading } = useQuery({
    queryKey: ['live-attendance'],
    queryFn: async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const all = await base44.entities.Timesheet.filter({ date: today });
      return all;
    },
    refetchInterval: 30000, // Actualizar cada 30s
  });

  // Filtrar los que han entrado pero no salido
  const currentlyIn = activeTimesheets.filter(t => t.check_in && !t.check_out);
  const finished = activeTimesheets.filter(t => t.check_in && t.check_out);

  return (
    <Card className="border-none shadow-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-white flex items-center gap-2">
          <Clock className="w-6 h-6 text-cyan-400" />
          Control de Asistencia en Vivo
        </CardTitle>
        <div className="flex gap-2">
          <Badge className="bg-green-500/20 text-green-400 border-green-500/50">
            {currentlyIn.length} En turno
          </Badge>
          <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/50">
            {finished.length} Finalizados
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {isLoading ? (
            <p className="text-slate-500">Cargando datos...</p>
          ) : currentlyIn.length === 0 ? (
            <div className="col-span-full p-4 text-center text-slate-500 bg-slate-800/30 rounded-xl border border-dashed border-slate-700">
              No hay empleados activos en este momento
            </div>
          ) : (
            currentlyIn.map((t) => (
              <div key={t.id} className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 flex items-start gap-3 relative overflow-hidden group hover:border-cyan-500/50 transition-all">
                {/* Indicador lateral */}
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-green-500"></div>
                
                <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-slate-300" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{t.user_name}</p>
                  <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                    <Clock className="w-3 h-3" />
                    <span>Entrada: {t.check_in}</span>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 mt-2">
                    {t.latitude ? (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 border-cyan-500/30 text-cyan-400 bg-cyan-500/10 flex gap-1 items-center">
                        <MapPin className="w-3 h-3" />
                        {t.is_on_site ? 'En Tienda' : 'Remoto'}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 border-yellow-500/30 text-yellow-400 bg-yellow-500/10 flex gap-1 items-center">
                        <AlertCircle className="w-3 h-3" />
                        Sin GPS
                      </Badge>
                    )}
                    
                    {t.ip_address && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 border-purple-500/30 text-purple-400 bg-purple-500/10 flex gap-1 items-center">
                        <Wifi className="w-3 h-3" />
                        IP Detectada
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}