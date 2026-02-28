import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, AlertTriangle, Info, AlertCircle, Download, Trash2, 
  Search, Filter, Calendar, User, Activity, RefreshCw,
  ChevronDown, ChevronRight, Eye, Clock, FileText
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { auditService, AUDIT_ACTIONS, SEVERITY } from '../services/auditService';

const severityConfig = {
  info: { color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: Info },
  warning: { color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', icon: AlertTriangle },
  critical: { color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: AlertCircle },
  error: { color: 'bg-red-600/20 text-red-500 border-red-600/30', icon: AlertCircle }
};

const actionIcons = {
  LOGIN: User,
  LOGOUT: User,
  CREATE: FileText,
  UPDATE: RefreshCw,
  DELETE: Trash2,
  EXPORT_DATA: Download,
  EXPORT_BACKUP: Download,
  CONFIG_CHANGE: Activity,
  ERROR: AlertCircle
};

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({});
  const [filters, setFilters] = useState({
    search: '',
    action: '',
    severity: '',
    startDate: '',
    endDate: ''
  });
  const [selectedLog, setSelectedLog] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);

  useEffect(() => {
    loadLogs();
  }, [filters]);

  const loadLogs = () => {
    const filteredLogs = auditService.getFilteredLogs(filters);
    setLogs(filteredLogs);
    setStats(auditService.getStats());
  };

  const handleExportLogs = () => {
    const exportData = auditService.exportLogs();
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const date = new Date().toISOString().split('T')[0];
    const a = document.createElement('a');
    a.href = url;
    a.download = `synkia_audit_logs_${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Logs de auditoría exportados correctamente');
  };

  const handleClearLogs = () => {
    auditService.clearLogs();
    loadLogs();
    setIsClearDialogOpen(false);
    toast.success('Logs de auditoría eliminados');
  };

  const viewLogDetail = (log) => {
    setSelectedLog(log);
    setIsDetailOpen(true);
  };

  const SeverityIcon = ({ severity }) => {
    const config = severityConfig[severity] || severityConfig.info;
    const IconComponent = config.icon;
    return <IconComponent className="w-4 h-4" />;
  };

  const ActionIcon = ({ action }) => {
    const IconComponent = actionIcons[action] || Activity;
    return <IconComponent className="w-4 h-4" />;
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6 p-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30">
            <Shield className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Logs de Auditoría</h1>
            <p className="text-sm text-gray-400">Registro de todas las acciones críticas del sistema</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={handleExportLogs}
            className="gap-2 border-gray-700 hover:bg-gray-800"
          >
            <Download className="w-4 h-4" /> Exportar
          </Button>
          <Button 
            variant="destructive" 
            onClick={() => setIsClearDialogOpen(true)}
            className="gap-2"
          >
            <Trash2 className="w-4 h-4" /> Limpiar
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div whileHover={{ scale: 1.02 }} transition={{ duration: 0.2 }}>
          <Card className="bg-gray-900/50 border-gray-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Total Logs</p>
                  <p className="text-2xl font-bold text-white">{stats.total || 0}</p>
                </div>
                <Activity className="w-8 h-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>
        </motion.div>
        
        <motion.div whileHover={{ scale: 1.02 }} transition={{ duration: 0.2 }}>
          <Card className="bg-gray-900/50 border-gray-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Hoy</p>
                  <p className="text-2xl font-bold text-white">{stats.today || 0}</p>
                </div>
                <Calendar className="w-8 h-8 text-green-400" />
              </div>
            </CardContent>
          </Card>
        </motion.div>
        
        <motion.div whileHover={{ scale: 1.02 }} transition={{ duration: 0.2 }}>
          <Card className="bg-gray-900/50 border-gray-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Críticos</p>
                  <p className="text-2xl font-bold text-red-400">{stats.critical || 0}</p>
                </div>
                <AlertCircle className="w-8 h-8 text-red-400" />
              </div>
            </CardContent>
          </Card>
        </motion.div>
        
        <motion.div whileHover={{ scale: 1.02 }} transition={{ duration: 0.2 }}>
          <Card className="bg-gray-900/50 border-gray-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Errores</p>
                  <p className="text-2xl font-bold text-orange-400">{stats.errors || 0}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-orange-400" />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Filters */}
      <Card className="bg-gray-900/50 border-gray-800">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input 
                  placeholder="Buscar en logs..."
                  value={filters.search}
                  onChange={(e) => setFilters({...filters, search: e.target.value})}
                  className="pl-10 bg-gray-800/50 border-gray-700"
                />
              </div>
            </div>
            
            <Select 
              value={filters.action} 
              onValueChange={(v) => setFilters({...filters, action: v})}
            >
              <SelectTrigger className="w-[180px] bg-gray-800/50 border-gray-700">
                <SelectValue placeholder="Acción" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todas las acciones</SelectItem>
                {Object.keys(AUDIT_ACTIONS).map(action => (
                  <SelectItem key={action} value={action}>{action}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select 
              value={filters.severity} 
              onValueChange={(v) => setFilters({...filters, severity: v})}
            >
              <SelectTrigger className="w-[150px] bg-gray-800/50 border-gray-700">
                <SelectValue placeholder="Severidad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todas</SelectItem>
                {Object.values(SEVERITY).map(sev => (
                  <SelectItem key={sev} value={sev}>{sev.toUpperCase()}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Input 
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({...filters, startDate: e.target.value})}
              className="w-[150px] bg-gray-800/50 border-gray-700"
            />
            <Input 
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({...filters, endDate: e.target.value})}
              className="w-[150px] bg-gray-800/50 border-gray-700"
            />
            
            <Button 
              variant="ghost" 
              onClick={() => setFilters({ search: '', action: '', severity: '', startDate: '', endDate: '' })}
              className="text-gray-400"
            >
              Limpiar filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Logs List */}
      <Card className="bg-gray-900/50 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Historial de Eventos ({logs.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            <AnimatePresence>
              {logs.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No hay logs de auditoría</p>
                </div>
              ) : (
                logs.map((log, index) => {
                  const config = severityConfig[log.severity] || severityConfig.info;
                  return (
                    <motion.div
                      key={log.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ delay: index * 0.03 }}
                      className={`p-4 rounded-lg border ${config.color} cursor-pointer hover:bg-gray-800/50 transition-colors`}
                      onClick={() => viewLogDetail(log)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-gray-800/50">
                            <ActionIcon action={log.action} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-white">{log.action}</span>
                              <Badge variant="outline" className={config.color}>
                                <SeverityIcon severity={log.severity} />
                                <span className="ml-1">{log.severity}</span>
                              </Badge>
                            </div>
                            <div className="text-sm text-gray-400 flex items-center gap-2 mt-1">
                              <User className="w-3 h-3" />
                              {log.user?.name || 'Unknown'}
                              <span className="text-gray-600">•</span>
                              <Clock className="w-3 h-3" />
                              {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true, locale: es })}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">
                            {format(new Date(log.timestamp), 'dd/MM/yyyy HH:mm:ss')}
                          </span>
                          <ChevronRight className="w-4 h-4 text-gray-500" />
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </AnimatePresence>
          </div>
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="bg-gray-900 border-gray-800 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Detalle del Log
            </DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-400">Acción</label>
                  <p className="text-white font-medium">{selectedLog.action}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-400">Severidad</label>
                  <Badge className={severityConfig[selectedLog.severity]?.color}>
                    {selectedLog.severity}
                  </Badge>
                </div>
                <div>
                  <label className="text-sm text-gray-400">Usuario</label>
                  <p className="text-white">{selectedLog.user?.name}</p>
                  <p className="text-sm text-gray-500">{selectedLog.user?.email}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-400">Fecha/Hora</label>
                  <p className="text-white">
                    {format(new Date(selectedLog.timestamp), 'dd/MM/yyyy HH:mm:ss')}
                  </p>
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-400">Detalles</label>
                <pre className="mt-2 p-4 bg-gray-800 rounded-lg overflow-auto text-sm text-gray-300">
                  {JSON.stringify(selectedLog.details, null, 2)}
                </pre>
              </div>
              <div>
                <label className="text-sm text-gray-400">ID del Log</label>
                <p className="text-xs text-gray-500 font-mono">{selectedLog.id}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Clear Confirmation Dialog */}
      <Dialog open={isClearDialogOpen} onOpenChange={setIsClearDialogOpen}>
        <DialogContent className="bg-gray-900 border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              Confirmar Eliminación
            </DialogTitle>
          </DialogHeader>
          <p className="text-gray-400">
            ¿Estás seguro de que quieres eliminar todos los logs de auditoría? 
            Esta acción no se puede deshacer.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsClearDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleClearLogs}>
              Eliminar Todo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
