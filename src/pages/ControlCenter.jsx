import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import {
  Activity,
  Database,
  RefreshCw,
  Zap,
  TriangleAlert,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileText,
  Settings,
  Terminal,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { synkia } from '@/api/synkiaClient';

export default function ControlCenter() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [showRebuildDialog, setShowRebuildDialog] = useState(false);
  const [rebuildConfirm, setRebuildConfirm] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Check permissions (CEO/Admin only)
  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await synkia.auth.me();
        setUser(currentUser);
        if (currentUser && 
            currentUser.permission_level !== 'super_admin' && 
            currentUser.permission_level !== 'admin' && 
            currentUser.role !== 'ceo') {
          toast.error('Acceso restringido a CEO/Admin');
          navigate('/');
        }
      } catch (error) {
        console.error('Error loading user:', error);
      }
    };
    loadUser();
  }, [navigate]);

  // Fetch control status with auto-refresh
  const { data: status, isLoading, refetch } = useQuery({
    queryKey: ['control-status'],
    queryFn: async () => {
      const res = await fetch('/api/control/status');
      if (!res.ok) throw new Error('Failed to fetch status');
      return res.json();
    },
    refetchInterval: 2000, // Auto-refresh every 2s
    staleTime: 1000,
  });

  // Helper function to call control endpoints
  const callControlEndpoint = async (endpoint, method = 'POST', body = null) => {
    setIsProcessing(true);
    try {
      const opts = { method };
      if (body) opts.body = JSON.stringify(body);
      opts.headers = { 'Content-Type': 'application/json' };
      
      const res = await fetch(`/api/control/${endpoint}`, opts);
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Operation failed');
      }
      
      toast.success(`${endpoint} iniciado exitosamente`);
      setTimeout(() => refetch(), 1000);
      return data;
    } catch (err) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Action handlers
  const handleSyncEmails = () => {
    callControlEndpoint('sync-emails');
  };

  const handleReprocessFailed = () => {
    if (window.confirm('¿Reprocesar solo los documentos fallidos? Esta operación puede tardar varios minutos.')) {
      callControlEndpoint('reprocess-failed');
    }
  };

  const handleReprocessAll = () => {
    if (window.confirm('⚠️ Reprocesar TODOS los documentos. Esta operación es pesada y puede tardar 30+ minutos. ¿Continuar?')) {
      callControlEndpoint('reprocess-all');
    }
  };

  const handleRebuild = async () => {
    if (rebuildConfirm !== 'RECONSTRUIR') {
      toast.error('Confirmación incorrecta');
      return;
    }
    setShowRebuildDialog(false);
    setRebuildConfirm("");
    await callControlEndpoint('rebuild', 'POST', { confirm: 'RECONSTRUIR' });
  };

  const handleVerify = () => {
    if (window.confirm('¿Verificar integridad de datos? Esta operación puede tardar algunos minutos.')) {
      callControlEndpoint('verify');
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">Cargando autenticación...</div>
      </div>
    );
  }

  const busy = status?.busy || isProcessing;
  const data = status?.data || {};
  const currentJob = status?.currentJob;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Settings className="w-8 h-8 text-blue-400" />
            <h1 className="text-4xl font-bold text-white">Centro de Control</h1>
          </div>
          <p className="text-gray-400">Gestión centralizada de trabajos, sincronización y mantenimiento del sistema</p>
        </div>

        {/* Status Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Busy Status */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Estado del Sistema
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white mb-2">
                {busy ? (
                  <Badge variant="destructive" className="bg-red-600">Procesando</Badge>
                ) : (
                  <Badge variant="default" className="bg-green-600">Disponible</Badge>
                )}
              </div>
              {currentJob && (
                <p className="text-xs text-gray-400">{currentJob}</p>
              )}
            </CardContent>
          </Card>

          {/* Documents */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-300">Documentos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{data.documents || 0}</div>
              <p className="text-xs text-green-400">
                ✓ {data.processed || 0} procesados
              </p>
              <p className="text-xs text-red-400">
                ✗ {data.failed || 0} errores
              </p>
            </CardContent>
          </Card>

          {/* Invoices */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-300">Facturas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{data.invoices || 0}</div>
              <p className="text-xs text-gray-400">documentos procesados</p>
            </CardContent>
          </Card>

          {/* Providers */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-300">Proveedores</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{data.providers || 0}</div>
              <p className="text-xs text-gray-400">identificados</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Control Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Email Management */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-blue-400" />
                Sincronización de Correos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-400">
                Sincroniza manualmente los correos IMAP desde las cuentas configuradas.
              </p>
              <p className="text-xs text-gray-500">
                El worker automático ya sincroniza cada 5 minutos. Use esto para una sincronización manual urgente.
              </p>
              <Button 
                onClick={handleSyncEmails}
                disabled={busy}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
              >
                <Zap className="w-4 h-4 mr-2" />
                Sincronizar Ahora
              </Button>
              <p className="text-xs text-gray-500">Correos: {data.emails || 0}</p>
            </CardContent>
          </Card>

          {/* Reprocessing */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5 text-amber-400" />
                Reprocesamiento de Documentos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Button 
                  onClick={handleReprocessFailed}
                  disabled={busy}
                  className="w-full bg-amber-600 hover:bg-amber-700 disabled:opacity-50"
                >
                  Reprocesar Fallidos
                </Button>
                <p className="text-xs text-gray-500">Solo documentos con estado 'error'</p>
              </div>
              
              <div className="border-t border-slate-700 pt-4">
                <Button 
                  onClick={handleReprocessAll}
                  disabled={busy}
                  className="w-full bg-orange-600 hover:bg-orange-700 disabled:opacity-50"
                >
                  Reprocesar TODO
                </Button>
                <p className="text-xs text-gray-500">Todos los documentos (lento, 30+ min)</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Advanced Operations */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Verification */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
                Verificación de Integridad
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-400">
                Verifica que todos los archivos JSON de datos sean válidos y consistentes.
              </p>
              <Button 
                onClick={handleVerify}
                disabled={busy}
                className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Verificar Ahora
              </Button>
            </CardContent>
          </Card>

          {/* Rebuild (Destructive) */}
          <Card className="bg-slate-800/50 border-red-900/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TriangleAlert className="w-5 h-5 text-red-400" />
                Reconstruir desde Cero
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-400">
                ⚠️ Operación destructiva: hace backup automático, limpia todo y reprocesa desde archivos subidos.
              </p>
              <Button 
                onClick={() => setShowRebuildDialog(true)}
                disabled={busy}
                className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Reconstruir
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Busy Indicator */}
        {busy && (
          <Card className="bg-slate-800/50 border-slate-700 mb-8">
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="animate-spin">
                    <Activity className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-white">Proceso en Curso</p>
                    <p className="text-sm text-gray-400">{currentJob || 'Procesando...'}</p>
                  </div>
                </div>
                <Progress value={45} className="h-2" />
                <p className="text-xs text-gray-500">
                  Por favor espere. No cierre esta página ni reinicie el servidor.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center text-gray-500 text-sm">
          <p>Centro de Control v1.0 | Auto-refresh cada 2 segundos</p>
        </div>
      </div>

      {/* Rebuild Confirmation Dialog */}
      <AlertDialog open={showRebuildDialog} onOpenChange={setShowRebuildDialog}>
        <AlertDialogContent className="bg-slate-800 border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-400 flex items-center gap-2">
              <TriangleAlert className="w-5 h-5" />
              Confirmar Reconstrucción
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-300">
              Esta operación es DESTRUCTIVA y no se puede deshacer fácilmente:
              <ul className="mt-3 space-y-2 text-sm">
                <li>✓ Se hace un backup automático en data_backup_[timestamp]/</li>
                <li>✓ Se limpian todas las tiendas JSON (documents, invoices, etc.)</li>
                <li>✓ Se reprocesará todo desde los archivos subidos</li>
                <li>⚠ Esto puede tardar 30-60+ minutos</li>
              </ul>
              <div className="mt-4">
                <p className="font-semibold mb-2">Escribe "RECONSTRUIR" para confirmar:</p>
                <input 
                  type="text" 
                  value={rebuildConfirm}
                  onChange={(e) => setRebuildConfirm(e.target.value)}
                  placeholder="RECONSTRUIR"
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-3 justify-end">
            <AlertDialogCancel className="bg-slate-700 text-white hover:bg-slate-600">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleRebuild}
              disabled={rebuildConfirm !== 'RECONSTRUIR' || isProcessing}
              className="bg-red-600 hover:bg-red-700 disabled:opacity-50"
            >
              Reconstruir
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
