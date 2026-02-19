import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Clock, 
  Calendar, 
  Download, 
  AlertCircle, 
  CheckCircle2, 
  User,
  Search,
  ArrowUpRight
} from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";

export default function AttendanceControl() {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth().toString());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [searchQuery, setSearchQuery] = useState("");

  const { data: timesheets = [], isLoading } = useQuery({
    queryKey: ['timesheets-control', selectedMonth, selectedYear],
    queryFn: () => base44.entities.Timesheet.list('-date', 1000),
    staleTime: 60000,
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees-control'],
    queryFn: () => base44.entities.Employee.list(),
    staleTime: 60000,
  });

  const generateReport = async () => {
    const toastId = toast.loading("Generando informe PDF...");
    try {
      const response = await base44.functions.invoke('generateAttendanceReport', {
        month: String(parseInt(selectedMonth) + 1).padStart(2, '0'),
        year: selectedYear
      });
      
      // Crear blob y descargar
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `asistencia_${parseInt(selectedMonth) + 1}_${selectedYear}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      
      toast.success("Informe generado correctamente", { id: toastId });
    } catch (error) {
      toast.error("Error generando informe: " + error.message, { id: toastId });
    }
  };

  // Filtrar registros por fecha
  const filteredTimesheets = timesheets.filter(t => {
    const d = new Date(t.date);
    return d.getMonth().toString() === selectedMonth && 
           d.getFullYear().toString() === selectedYear &&
           (!searchQuery || t.user_name.toLowerCase().includes(searchQuery.toLowerCase()));
  });

  // Estadísticas del mes
  const totalDelays = filteredTimesheets.filter(t => t.delay_minutes > 0).length;
  const totalHours = filteredTimesheets.reduce((sum, t) => sum + (t.total_hours || 0), 0);
  const totalMinutesLate = filteredTimesheets.reduce((sum, t) => sum + (t.delay_minutes || 0), 0);

  return (
    <div className="p-4 md:p-8 min-h-screen bg-gradient-to-br from-zinc-950 via-neutral-900 to-zinc-950 text-white">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-black text-white flex items-center gap-3">
              <Clock className="w-8 h-8 text-cyan-400" />
              <span className="text-cyan-400">Control de Asistencia</span>
            </h1>
            <p className="text-zinc-400 mt-1">
              Supervisión detallada de horarios, retrasos y fichajes para inspecciones.
            </p>
          </div>
          <Button 
            onClick={generateReport}
            className="bg-black border border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10"
          >
            <Download className="w-4 h-4 mr-2" />
            Exportar Informe Inspección (PDF)
          </Button>
        </div>

        {/* Filtros y KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-zinc-400 text-sm">Mes</span>
                <Calendar className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="flex gap-2">
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="bg-zinc-800 border-zinc-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => (
                      <SelectItem key={i} value={i.toString()}>
                        {format(new Date(2024, i, 1), 'MMMM', { locale: es })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="bg-zinc-800 border-zinc-700 w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2024">2024</SelectItem>
                    <SelectItem value="2025">2025</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-zinc-400 text-sm">Retrasos Totales</span>
                <AlertCircle className="w-4 h-4 text-red-400" />
              </div>
              <div className="flex items-end gap-2">
                <span className="text-3xl font-bold text-white">{totalDelays}</span>
                <span className="text-sm text-red-400 mb-1">({totalMinutesLate} min)</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-zinc-400 text-sm">Horas Trabajadas</span>
                <Clock className="w-4 h-4 text-green-400" />
              </div>
              <span className="text-3xl font-bold text-white">{totalHours.toFixed(1)}h</span>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-zinc-400 text-sm">Búsqueda</span>
                <Search className="w-4 h-4 text-cyan-400" />
              </div>
              <Input 
                placeholder="Buscar empleado..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-zinc-800 border-zinc-700"
              />
            </CardContent>
          </Card>
        </div>

        {/* Tabla Detallada */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white">Registros de Fichaje</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-zinc-400">Cargando registros...</div>
            ) : filteredTimesheets.length === 0 ? (
              <div className="text-center py-8 text-zinc-400">No hay registros para este periodo.</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-zinc-800 hover:bg-zinc-900">
                      <TableHead className="text-zinc-400">Fecha</TableHead>
                      <TableHead className="text-zinc-400">Empleado</TableHead>
                      <TableHead className="text-zinc-400">Entrada Real</TableHead>
                      <TableHead className="text-zinc-400">Entrada Prevista</TableHead>
                      <TableHead className="text-zinc-400">Retraso</TableHead>
                      <TableHead className="text-zinc-400">Salida</TableHead>
                      <TableHead className="text-zinc-400">Total Horas</TableHead>
                      <TableHead className="text-zinc-400">Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTimesheets.map((record) => (
                      <TableRow key={record.id} className="border-zinc-800 hover:bg-zinc-800/50">
                        <TableCell className="font-medium">
                          {format(new Date(record.date), 'dd/MM/yyyy')}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-zinc-500" />
                            {record.user_name}
                          </div>
                        </TableCell>
                        <TableCell>{record.check_in}</TableCell>
                        <TableCell className="text-zinc-500">{record.expected_start || '-'}</TableCell>
                        <TableCell>
                          {record.delay_minutes > 0 ? (
                            <Badge className="bg-red-900/30 text-red-400 border border-red-500/30">
                              +{record.delay_minutes} min
                            </Badge>
                          ) : (
                            <span className="text-green-400 text-sm">Puntual</span>
                          )}
                        </TableCell>
                        <TableCell>{record.check_out || '-'}</TableCell>
                        <TableCell>{record.total_hours ? `${record.total_hours.toFixed(2)}h` : '-'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`
                            ${record.status === 'completo' ? 'border-green-500 text-green-400' : 'border-yellow-500 text-yellow-400'}
                          `}>
                            {record.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}