/**
 * LegalTimeRegistry - Registro Digital con Trazabilidad
 * Cumplimiento Real Decreto 8/2019 (actualizado 2026)
 * FASE 2B - Control Horario Legal
 */

import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Shield,
  FileText,
  Download,
  Clock,
  Calendar,
  User,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Edit,
  History,
  Lock,
  Eye,
  Search,
  Filter,
  Fingerprint,
  Scale,
  Building2,
  AlertCircle,
  Info
} from "lucide-react";
import { toast } from "sonner";
import { format, parseISO, differenceInHours, differenceInMinutes, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { timeTrackingService } from "@/services/timeTrackingService";

// ==================== COMPLIANCE CONFIG ====================

const COMPLIANCE_RULES = {
  maxDailyHours: 10, // Máximo horas diarias
  maxWeeklyHours: 40, // Máximo horas semanales
  minRestBetweenShifts: 12, // Mínimo horas entre jornadas
  minDailyRest: 11, // Mínimo descanso diario
  maxOvertimeMonthly: 80, // Máximo horas extra mensuales
  retentionYears: 4, // Años de retención obligatoria
};

const ALERT_TYPES = {
  missing_entry: { label: 'Sin entrada', color: 'text-red-400', bg: 'bg-red-500/20' },
  missing_exit: { label: 'Sin salida', color: 'text-orange-400', bg: 'bg-orange-500/20' },
  excessive_hours: { label: 'Exceso horas', color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
  insufficient_rest: { label: 'Descanso insuficiente', color: 'text-purple-400', bg: 'bg-purple-500/20' },
  overtime_warning: { label: 'Horas extra', color: 'text-cyan-400', bg: 'bg-cyan-500/20' },
  modification: { label: 'Modificación', color: 'text-blue-400', bg: 'bg-blue-500/20' },
};

// ==================== AUDIT LOG CARD ====================

const AuditLogItem = ({ log }) => {
  return (
    <div className="flex items-start gap-3 p-3 bg-zinc-800/30 rounded-lg">
      <div className="w-8 h-8 bg-zinc-700 rounded-full flex items-center justify-center flex-shrink-0">
        <History className="w-4 h-4 text-gray-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="text-sm font-medium text-white">{log.action}</span>
            <span className="text-sm text-gray-500 ml-2">por {log.modified_by_name || 'Sistema'}</span>
          </div>
          <span className="text-xs text-gray-500">
            {format(parseISO(log.timestamp), "d MMM HH:mm", { locale: es })}
          </span>
        </div>
        <p className="text-sm text-gray-400 mt-1">{log.reason}</p>
        {log.old_value && log.new_value && (
          <div className="flex items-center gap-2 mt-2 text-xs">
            <Badge variant="outline" className="border-red-500/50 text-red-400">
              {log.old_value}
            </Badge>
            <span className="text-gray-600">→</span>
            <Badge variant="outline" className="border-green-500/50 text-green-400">
              {log.new_value}
            </Badge>
          </div>
        )}
      </div>
    </div>
  );
};

// ==================== COMPLIANCE ALERT ====================

const ComplianceAlert = ({ alert }) => {
  const config = ALERT_TYPES[alert.type] || ALERT_TYPES.modification;
  
  return (
    <Card className={`${config.bg} border-zinc-700`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className={`w-5 h-5 ${config.color} flex-shrink-0 mt-0.5`} />
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <Badge className={`${config.bg} ${config.color}`}>
                {config.label}
              </Badge>
              <span className="text-xs text-gray-500">
                {format(parseISO(alert.date), "d MMM yyyy", { locale: es })}
              </span>
            </div>
            <p className="text-sm text-gray-300 mt-2">{alert.message}</p>
            <p className="text-xs text-gray-500 mt-1">
              Empleado: {alert.employee_name}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// ==================== EMPLOYEE RECORD ====================

const EmployeeRecordRow = ({ record, onEdit, onViewHistory }) => {
  const getStatusBadge = () => {
    if (!record.check_in) {
      return <Badge className="bg-red-500/20 text-red-400">Sin entrada</Badge>;
    }
    if (!record.check_out) {
      return <Badge className="bg-yellow-500/20 text-yellow-400">Incompleto</Badge>;
    }
    if (record.total_hours > 10) {
      return <Badge className="bg-orange-500/20 text-orange-400">Exceso</Badge>;
    }
    return <Badge className="bg-green-500/20 text-green-400">Completo</Badge>;
  };

  return (
    <TableRow className="border-zinc-700/50 hover:bg-zinc-800/50">
      <TableCell className="text-white">
        {format(parseISO(record.date), "d MMM yyyy", { locale: es })}
      </TableCell>
      <TableCell className="text-white">{record.user_name}</TableCell>
      <TableCell className="text-gray-300">{record.check_in || '--:--'}</TableCell>
      <TableCell className="text-gray-300">{record.check_out || '--:--'}</TableCell>
      <TableCell className="text-gray-300">{record.break_time || 0}m</TableCell>
      <TableCell className="text-cyan-400 font-semibold">
        {record.total_hours ? `${record.total_hours}h` : '-'}
      </TableCell>
      <TableCell>{getStatusBadge()}</TableCell>
      <TableCell>
        {record.is_modified && (
          <Badge variant="outline" className="border-blue-500/50 text-blue-400">
            <Edit className="w-3 h-3 mr-1" />
            Editado
          </Badge>
        )}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-gray-400"
            onClick={() => onViewHistory(record)}
          >
            <History className="w-4 h-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-gray-400"
            onClick={() => onEdit(record)}
          >
            <Edit className="w-4 h-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
};

// ==================== MAIN COMPONENT ====================

export default function LegalTimeRegistry() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('records');
  const [dateRange, setDateRange] = useState({
    start: format(subMonths(new Date(), 1), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [editForm, setEditForm] = useState({
    check_in: '',
    check_out: '',
    reason: ''
  });

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const isAdmin = user?.role === 'admin' || user?.permission_level === 'super_admin';

  // Cargar registros
  const { data: timesheets = [], isLoading } = useQuery({
    queryKey: ['legal-timesheets', dateRange],
    queryFn: async () => {
      try {
        const all = await base44.entities.Timesheet?.list?.('-date', 500) || [];
        return all.filter(t => {
          const date = t.date;
          return date >= dateRange.start && date <= dateRange.end;
        });
      } catch {
        return [];
      }
    }
  });

  // Cargar alertas de cumplimiento
  const { data: complianceAlerts = [] } = useQuery({
    queryKey: ['compliance-alerts', dateRange],
    queryFn: async () => {
      const alerts = [];
      
      // Generar alertas basadas en los registros
      timesheets.forEach(ts => {
        // Sin entrada
        if (!ts.check_in) {
          alerts.push({
            type: 'missing_entry',
            date: ts.date,
            employee_id: ts.user_id,
            employee_name: ts.user_name,
            message: `El empleado no registró entrada el ${format(parseISO(ts.date), "d MMM", { locale: es })}`
          });
        }
        
        // Sin salida
        if (ts.check_in && !ts.check_out && new Date(ts.date) < new Date()) {
          alerts.push({
            type: 'missing_exit',
            date: ts.date,
            employee_id: ts.user_id,
            employee_name: ts.user_name,
            message: `El empleado no registró salida el ${format(parseISO(ts.date), "d MMM", { locale: es })}`
          });
        }
        
        // Exceso de horas
        if (ts.total_hours && ts.total_hours > COMPLIANCE_RULES.maxDailyHours) {
          alerts.push({
            type: 'excessive_hours',
            date: ts.date,
            employee_id: ts.user_id,
            employee_name: ts.user_name,
            message: `Jornada de ${ts.total_hours}h (máximo permitido: ${COMPLIANCE_RULES.maxDailyHours}h)`
          });
        }
        
        // Horas extra
        if (ts.total_hours && ts.total_hours > 8) {
          alerts.push({
            type: 'overtime_warning',
            date: ts.date,
            employee_id: ts.user_id,
            employee_name: ts.user_name,
            message: `${Math.round((ts.total_hours - 8) * 100) / 100}h extra registradas`
          });
        }
      });

      return alerts.sort((a, b) => new Date(b.date) - new Date(a.date));
    },
    enabled: timesheets.length > 0
  });

  // Cargar historial de modificaciones
  const { data: auditLogs = [] } = useQuery({
    queryKey: ['audit-logs', selectedRecord?.id],
    queryFn: async () => {
      try {
        return await base44.entities.AuditLog?.filter?.({ 
          record_id: selectedRecord?.id 
        }) || [];
      } catch {
        return [];
      }
    },
    enabled: !!selectedRecord
  });

  // Filtrar registros
  const filteredRecords = timesheets.filter(ts => {
    const matchesSearch = !searchTerm || 
      ts.user_name?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  // Estadísticas de cumplimiento
  const stats = {
    totalRecords: timesheets.length,
    completeRecords: timesheets.filter(t => t.check_in && t.check_out).length,
    incompleteRecords: timesheets.filter(t => !t.check_in || !t.check_out).length,
    totalHours: timesheets.reduce((sum, t) => sum + (t.total_hours || 0), 0),
    overtimeHours: timesheets.reduce((sum, t) => sum + Math.max(0, (t.total_hours || 0) - 8), 0),
    alertsCount: complianceAlerts.length
  };

  const complianceScore = timesheets.length > 0 
    ? Math.round((stats.completeRecords / stats.totalRecords) * 100) 
    : 100;

  // Editar registro
  const editMutation = useMutation({
    mutationFn: async () => {
      if (!editForm.reason.trim()) {
        throw new Error('Debes indicar el motivo de la modificación');
      }

      // Calcular nuevas horas
      let totalHours = null;
      if (editForm.check_in && editForm.check_out) {
        const [inH, inM] = editForm.check_in.split(':').map(Number);
        const [outH, outM] = editForm.check_out.split(':').map(Number);
        totalHours = Math.round(((outH * 60 + outM) - (inH * 60 + inM)) / 60 * 100) / 100;
      }

      // Guardar log de auditoría
      await base44.entities.AuditLog?.create?.({
        record_id: selectedRecord.id,
        record_type: 'timesheet',
        action: 'MODIFICATION',
        modified_by: user.id,
        modified_by_name: user.full_name,
        timestamp: new Date().toISOString(),
        reason: editForm.reason,
        old_value: JSON.stringify({
          check_in: selectedRecord.check_in,
          check_out: selectedRecord.check_out,
          total_hours: selectedRecord.total_hours
        }),
        new_value: JSON.stringify({
          check_in: editForm.check_in,
          check_out: editForm.check_out,
          total_hours: totalHours
        })
      });

      // Actualizar registro
      return base44.entities.Timesheet?.update?.(selectedRecord.id, {
        check_in: editForm.check_in || null,
        check_out: editForm.check_out || null,
        total_hours: totalHours,
        status: editForm.check_in && editForm.check_out ? 'completo' : 'incompleto',
        is_modified: true,
        modified_at: new Date().toISOString(),
        modified_by: user.id,
        modification_reason: editForm.reason
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['legal-timesheets'] });
      toast.success('Registro actualizado correctamente');
      setShowEditDialog(false);
      setSelectedRecord(null);
      setEditForm({ check_in: '', check_out: '', reason: '' });
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });

  // Exportar reporte legal
  const handleExport = async () => {
    try {
      const report = await timeTrackingService.exportLegalReport({
        startDate: dateRange.start,
        endDate: dateRange.end
      });

      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `registro_jornada_legal_${dateRange.start}_${dateRange.end}.json`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success('Reporte exportado correctamente');
      setShowExportDialog(false);
    } catch (error) {
      toast.error('Error al exportar: ' + error.message);
    }
  };

  const handleEditRecord = (record) => {
    setSelectedRecord(record);
    setEditForm({
      check_in: record.check_in || '',
      check_out: record.check_out || '',
      reason: ''
    });
    setShowEditDialog(true);
  };

  const handleViewHistory = (record) => {
    setSelectedRecord(record);
    setShowHistoryDialog(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <Shield className="w-7 h-7 text-green-400" />
              Registro Legal de Jornada
            </h1>
            <p className="text-gray-400 mt-1">
              Cumplimiento Real Decreto 8/2019 (actualizado 2026)
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => setShowExportDialog(true)}
              className="border-zinc-600"
            >
              <Download className="w-4 h-4 mr-2" />
              Exportar
            </Button>
          </div>
        </div>

        {/* Compliance Banner */}
        <Card className={`border ${
          complianceScore >= 95 ? 'bg-green-900/20 border-green-500/30' :
          complianceScore >= 80 ? 'bg-yellow-900/20 border-yellow-500/30' :
          'bg-red-900/20 border-red-500/30'
        }`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center ${
                  complianceScore >= 95 ? 'bg-green-500/30' :
                  complianceScore >= 80 ? 'bg-yellow-500/30' :
                  'bg-red-500/30'
                }`}>
                  <Scale className={`w-7 h-7 ${
                    complianceScore >= 95 ? 'text-green-400' :
                    complianceScore >= 80 ? 'text-yellow-400' :
                    'text-red-400'
                  }`} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    Índice de Cumplimiento: {complianceScore}%
                  </h3>
                  <p className="text-sm text-gray-400">
                    {stats.completeRecords} de {stats.totalRecords} registros completos
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-6 text-right">
                <div>
                  <p className="text-sm text-gray-500">Alertas</p>
                  <p className={`text-xl font-bold ${
                    stats.alertsCount > 0 ? 'text-yellow-400' : 'text-green-400'
                  }`}>
                    {stats.alertsCount}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Horas Extra</p>
                  <p className="text-xl font-bold text-cyan-400">
                    {Math.round(stats.overtimeHours)}h
                  </p>
                </div>
              </div>
            </div>
            <Progress 
              value={complianceScore} 
              className={`mt-4 h-2 ${
                complianceScore >= 95 ? '[&>div]:bg-green-500' :
                complianceScore >= 80 ? '[&>div]:bg-yellow-500' :
                '[&>div]:bg-red-500'
              }`}
            />
          </CardContent>
        </Card>

        {/* Legal Info Box */}
        <Card className="bg-cyan-900/20 border-cyan-500/30">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-cyan-300">Requisitos Legales RD 8/2019</h4>
                <ul className="text-sm text-gray-400 mt-2 space-y-1">
                  <li>✓ Registro diario de jornada con hora de inicio y fin</li>
                  <li>✓ Conservación durante 4 años</li>
                  <li>✓ Disponible para trabajadores, representantes e Inspección de Trabajo</li>
                  <li>✓ Trazabilidad completa de modificaciones</li>
                  <li>✓ Multas de hasta 10.000€/empleado por incumplimiento</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar empleado..."
              className="pl-10 bg-zinc-800 border-zinc-700 text-white"
            />
          </div>
          <div className="flex gap-3">
            <Input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange(p => ({ ...p, start: e.target.value }))}
              className="bg-zinc-800 border-zinc-700 text-white w-40"
            />
            <Input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange(p => ({ ...p, end: e.target.value }))}
              className="bg-zinc-800 border-zinc-700 text-white w-40"
            />
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-zinc-800/50 border border-zinc-700">
            <TabsTrigger value="records" className="data-[state=active]:bg-green-600">
              <FileText className="w-4 h-4 mr-2" />
              Registros
            </TabsTrigger>
            <TabsTrigger value="alerts" className="data-[state=active]:bg-green-600">
              <AlertTriangle className="w-4 h-4 mr-2" />
              Alertas
              {complianceAlerts.length > 0 && (
                <Badge className="ml-2 bg-yellow-500/20 text-yellow-300">
                  {complianceAlerts.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="records" className="mt-4">
            <Card className="bg-zinc-800/50 border-zinc-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-green-400" />
                  Registro de Jornada
                </CardTitle>
                <CardDescription className="text-gray-400">
                  {filteredRecords.length} registros en el período seleccionado
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-zinc-700">
                        <TableHead className="text-gray-400">Fecha</TableHead>
                        <TableHead className="text-gray-400">Empleado</TableHead>
                        <TableHead className="text-gray-400">Entrada</TableHead>
                        <TableHead className="text-gray-400">Salida</TableHead>
                        <TableHead className="text-gray-400">Pausas</TableHead>
                        <TableHead className="text-gray-400">Total</TableHead>
                        <TableHead className="text-gray-400">Estado</TableHead>
                        <TableHead className="text-gray-400">Modificado</TableHead>
                        <TableHead className="text-gray-400"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRecords.map((record) => (
                        <EmployeeRecordRow
                          key={record.id}
                          record={record}
                          onEdit={handleEditRecord}
                          onViewHistory={handleViewHistory}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="alerts" className="mt-4">
            <div className="space-y-4">
              {complianceAlerts.length > 0 ? (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-3 pr-4">
                    {complianceAlerts.map((alert, i) => (
                      <ComplianceAlert key={i} alert={alert} />
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <Card className="bg-green-900/20 border-green-500/30">
                  <CardContent className="p-8 text-center">
                    <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-white">
                      Sin alertas de cumplimiento
                    </h3>
                    <p className="text-gray-400 mt-2">
                      Todos los registros cumplen con los requisitos legales
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="bg-zinc-900 border-zinc-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Edit className="w-5 h-5 text-cyan-400" />
              Modificar Registro
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              {selectedRecord && `${selectedRecord.user_name} - ${format(parseISO(selectedRecord.date), "d MMMM yyyy", { locale: es })}`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Card className="bg-yellow-900/20 border-yellow-500/30">
              <CardContent className="p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-yellow-200">
                    Las modificaciones quedan registradas con trazabilidad completa según RD 8/2019
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-gray-300">Hora de entrada</Label>
                <Input
                  type="time"
                  value={editForm.check_in}
                  onChange={(e) => setEditForm(p => ({ ...p, check_in: e.target.value }))}
                  className="bg-zinc-800 border-zinc-600 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">Hora de salida</Label>
                <Input
                  type="time"
                  value={editForm.check_out}
                  onChange={(e) => setEditForm(p => ({ ...p, check_out: e.target.value }))}
                  className="bg-zinc-800 border-zinc-600 text-white"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-gray-300">Motivo de la modificación *</Label>
              <Textarea
                value={editForm.reason}
                onChange={(e) => setEditForm(p => ({ ...p, reason: e.target.value }))}
                className="bg-zinc-800 border-zinc-600 text-white"
                placeholder="Indica el motivo de la modificación (obligatorio)..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowEditDialog(false)} 
              className="border-zinc-600"
            >
              Cancelar
            </Button>
            <Button 
              onClick={() => editMutation.mutate()}
              disabled={editMutation.isPending || !editForm.reason.trim()}
              className="bg-cyan-600 hover:bg-cyan-500"
            >
              <Lock className="w-4 h-4 mr-2" />
              Guardar con trazabilidad
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="bg-zinc-900 border-zinc-700 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <History className="w-5 h-5 text-cyan-400" />
              Historial de Modificaciones
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              {selectedRecord && `${selectedRecord.user_name} - ${format(parseISO(selectedRecord.date), "d MMMM yyyy", { locale: es })}`}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
              {auditLogs.length > 0 ? (
                auditLogs.map((log, i) => (
                  <AuditLogItem key={i} log={log} />
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <History className="w-10 h-10 mx-auto mb-3 opacity-50" />
                  <p>Sin modificaciones registradas</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Export Dialog */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent className="bg-zinc-900 border-zinc-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Download className="w-5 h-5 text-cyan-400" />
              Exportar Registro Legal
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Formato válido para Inspección de Trabajo
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-gray-300">Fecha inicio</Label>
                <Input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange(p => ({ ...p, start: e.target.value }))}
                  className="bg-zinc-800 border-zinc-600 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">Fecha fin</Label>
                <Input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange(p => ({ ...p, end: e.target.value }))}
                  className="bg-zinc-800 border-zinc-600 text-white"
                />
              </div>
            </div>

            <Card className="bg-green-900/20 border-green-500/30">
              <CardContent className="p-4">
                <h4 className="font-medium text-green-300 mb-2">📋 El reporte incluye:</h4>
                <ul className="text-sm text-gray-400 space-y-1">
                  <li>✓ Hora exacta de entrada y salida por empleado</li>
                  <li>✓ Duración de jornada y pausas</li>
                  <li>✓ Horas extraordinarias</li>
                  <li>✓ Historial de modificaciones</li>
                  <li>✓ Firma digital y trazabilidad</li>
                </ul>
              </CardContent>
            </Card>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowExportDialog(false)} 
              className="border-zinc-600"
            >
              Cancelar
            </Button>
            <Button onClick={handleExport} className="bg-green-600 hover:bg-green-500">
              <Download className="w-4 h-4 mr-2" />
              Descargar Reporte
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
