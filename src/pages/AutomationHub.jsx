import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  Play, 
  Loader2, 
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Zap,
  Database,
  Mail,
  ShoppingCart,
  Clock,
  TrendingUp,
  Power,
  Wifi,
  Trash2,
  AlertTriangle
} from "lucide-react";
import { toast } from "sonner";
import { format, isValid } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function AutomationHub() {
  const [isSyncing, setIsSyncing] = useState({
    biloop: false,
    revo: false,
    email: false,
    reset: false
  });

  const [results, setResults] = useState({
    biloop: null,
    revo: null,
    email: null,
    reset: null
  });

  const [useRealApis, setUseRealApis] = useState(true);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
  const [nextSyncIn, setNextSyncIn] = useState(3600);
  const [showResetDialog, setShowResetDialog] = useState(false);

  useEffect(() => {
    let interval;
    let countdown;

    if (autoSyncEnabled) {
      runAllSync();
      
      interval = setInterval(() => {
        runAllSync();
        setNextSyncIn(3600);
      }, 3600000);

      countdown = setInterval(() => {
        setNextSyncIn(prev => Math.max(0, prev - 1));
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
      if (countdown) clearInterval(countdown);
    };
  }, [autoSyncEnabled, useRealApis]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return isValid(date) ? format(date, 'HH:mm:ss') : '';
  };

  const runBiloopSync = async () => {
    setIsSyncing({ ...isSyncing, biloop: true });
    try {
      const functionName = useRealApis ? 'biloopRealSync' : 'biloopAutoSync';
      const response = await base44.functions.invoke(functionName);
      setResults({ ...results, biloop: response.data });
      
      const source = response.data?.source || 'unknown';
      if (source === 'biloop_api') {
        toast.success('✅ Datos REALES desde Biloop');
      } else if (source === 'ai_fallback') {
        toast.warning('⚠️ Biloop API no disponible - usando IA');
      } else {
        toast.success('✅ Sincronización completada');
      }
    } catch (error) {
      console.error('Biloop sync error:', error);
      toast.error('❌ Error en sincronización: ' + error.message);
    } finally {
      setIsSyncing({ ...isSyncing, biloop: false });
    }
  };

  const runRevoSync = async () => {
    setIsSyncing({ ...isSyncing, revo: true });
    try {
      const functionName = useRealApis ? 'revoRealSync' : 'revoAutoSync';
      const response = await base44.functions.invoke(functionName);
      setResults({ ...results, revo: response.data });
      
      const source = response.data?.source || 'unknown';
      if (source === 'revo_api') {
        toast.success('✅ Datos REALES desde Revo');
      } else if (source === 'ai_fallback') {
        toast.warning('⚠️ Revo API no disponible - usando IA');
      } else {
        toast.success('✅ Sincronización completada');
      }
    } catch (error) {
      console.error('Revo sync error:', error);
      toast.error('❌ Error en sincronización: ' + error.message);
    } finally {
      setIsSyncing({ ...isSyncing, revo: false });
    }
  };

  const runEmailProcessor = async () => {
    setIsSyncing({ ...isSyncing, email: true });
    try {
      const response = await base44.functions.invoke('emailAutoProcessor');
      setResults({ ...results, email: response.data });
      
      if (response.data?.success) {
        const processed = response.data?.results?.emails_processed || 0;
        const invoices = response.data?.results?.invoices_created || 0;
        toast.success(`✅ ${processed} emails procesados desde Gmail (${invoices} facturas)`);
      } else {
        toast.error(response.data?.error || '❌ Error procesando emails');
      }
    } catch (error) {
      console.error('Email processor error:', error);
      toast.error('❌ Error en procesamiento emails: ' + error.message);
    } finally {
      setIsSyncing({ ...isSyncing, email: false });
    }
  };

  const runResetAndSync = async () => {
    setShowResetDialog(false);
    setIsSyncing({ ...isSyncing, reset: true });
    
    toast.info('🗑️ Eliminando datos de prueba...', { duration: 3000 });
    
    try {
      const response = await base44.functions.invoke('resetAndSyncReal');
      setResults({ ...results, reset: response.data });
      
      const summary = response.data?.summary;
      if (summary) {
        toast.success(
          `✅ Reset completado!\n\n` +
          `🗑️ Eliminados: ${summary.deleted?.total || 0} registros\n` +
          `📦 Biloop: ${summary.biloop_sync?.invoices_created || 0} facturas\n` +
          `🍗 Revo: ${summary.revo_sync?.sales_created || 0} ventas`,
          { duration: 8000 }
        );
        
        // Actualizar resultados individuales
        setResults({
          biloop: {
            timestamp: response.data.timestamp,
            source: summary.biloop_sync?.source,
            results: {
              invoices_created: summary.biloop_sync?.invoices_created,
              providers_created: summary.biloop_sync?.providers_created
            }
          },
          revo: {
            timestamp: response.data.timestamp,
            source: summary.revo_sync?.source,
            results: {
              sales_created: summary.revo_sync?.sales_created
            }
          },
          email: null,
          reset: response.data
        });
      }
    } catch (error) {
      console.error('Reset error:', error);
      toast.error('❌ Error en reset: ' + error.message);
    } finally {
      setIsSyncing({ ...isSyncing, reset: false });
    }
  };

  const runAllSync = async () => {
    toast.info('🔄 Iniciando sincronización completa...');
    await runBiloopSync();
    await runRevoSync();
    await runEmailProcessor();
    toast.success('🎉 ¡Sincronización completa finalizada!');
    setNextSyncIn(3600);
  };

  const toggleAutoSync = () => {
    const newState = !autoSyncEnabled;
    setAutoSyncEnabled(newState);
    if (newState) {
      toast.success('🚀 Auto-Sync activado - Sincronizará cada hora');
      setNextSyncIn(3600);
    } else {
      toast.info('⏸️ Auto-Sync pausado');
    }
  };

  return (
    <div className="p-4 md:p-8 min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-3 h-3 rounded-full animate-pulse ${autoSyncEnabled ? 'bg-green-500' : 'bg-yellow-500'}`} />
            <span className={`text-sm font-medium ${autoSyncEnabled ? 'text-green-600' : 'text-yellow-600'}`}>
              {autoSyncEnabled ? 'Auto-Sync Activo' : 'Modo Manual'}
            </span>
          </div>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 flex items-center gap-3">
                <Zap className="w-10 h-10 text-yellow-500" />
                Centro de Automatización
              </h1>
              <p className="text-gray-600 mt-1">
                Control total de sincronizaciones • APIs reales + IA fallback
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={() => setShowResetDialog(true)}
                disabled={isSyncing.reset}
                variant="destructive"
                size="lg"
                className="bg-red-600 hover:bg-red-700"
              >
                <Trash2 className="w-5 h-5 mr-2" />
                Reset + Sync Real
              </Button>
              <Button
                onClick={runAllSync}
                disabled={Object.values(isSyncing).some(v => v)}
                size="lg"
                className="bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 hover:from-yellow-600 hover:via-orange-600 hover:to-red-600 text-white font-bold shadow-lg shadow-orange-500/50"
              >
                <RefreshCw className="w-5 h-5 mr-2" />
                Sincronizar Todo
              </Button>
            </div>
          </div>
        </div>

        <Card className="border-none shadow-xl mb-8 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center flex-shrink-0">
                  <Wifi className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-xl mb-2">🌐 Modo de Conexión</h3>
                  <p className="text-sm text-blue-100">
                    {useRealApis 
                      ? '✅ Intentará conectar con APIs REALES (Biloop + Revo). Si fallan, usa IA automáticamente.'
                      : '🤖 Modo IA puro - genera datos realistas sin APIs externas'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Label htmlFor="api-mode" className="text-white font-medium cursor-pointer">
                  {useRealApis ? 'APIs Reales' : 'Solo IA'}
                </Label>
                <Switch
                  id="api-mode"
                  checked={useRealApis}
                  onCheckedChange={setUseRealApis}
                  className="data-[state=checked]:bg-white data-[state=unchecked]:bg-white/30"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl mb-8 bg-gradient-to-r from-green-600 to-emerald-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center flex-shrink-0">
                  <Power className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-xl mb-2">🤖 Auto-Sync Inteligente</h3>
                  <p className="text-sm text-green-100 mb-2">
                    {autoSyncEnabled 
                      ? `✅ Sincronización automática cada hora mientras esta página esté abierta`
                      : '⏸️ Activa para sincronizar automáticamente cada hora'}
                  </p>
                  {autoSyncEnabled && (
                    <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg px-3 py-2 mt-3 border border-white/20">
                      <Clock className="w-4 h-4" />
                      <span className="text-sm font-medium">
                        Próxima sincronización en: <strong>{formatTime(nextSyncIn)}</strong>
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Label htmlFor="auto-sync" className="text-white font-medium cursor-pointer">
                  {autoSyncEnabled ? 'Activado' : 'Desactivado'}
                </Label>
                <Switch
                  id="auto-sync"
                  checked={autoSyncEnabled}
                  onCheckedChange={toggleAutoSync}
                  className="data-[state=checked]:bg-white data-[state=unchecked]:bg-white/30"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="border-none shadow-xl hover:shadow-2xl transition-all">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
                    <Database className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Biloop Sync</CardTitle>
                    <p className="text-xs text-gray-600">Facturas + Proveedores</p>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Estado:</span>
                  {isSyncing.biloop ? (
                    <Badge className="bg-blue-100 text-blue-800">
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      Sincronizando...
                    </Badge>
                  ) : results.biloop ? (
                    <Badge className="bg-green-100 text-green-800">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Completado
                    </Badge>
                  ) : (
                    <Badge className="bg-gray-100 text-gray-800">Listo</Badge>
                  )}
                </div>
                {results.biloop && (
                  <>
                    {results.biloop.source && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Fuente:</span>
                        <Badge className={results.biloop.source === 'biloop_api' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}>
                          {results.biloop.source === 'biloop_api' ? '🌐 API Real' : '🤖 IA'}
                        </Badge>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Facturas:</span>
                      <span className="font-bold text-green-600">{results.biloop.results?.invoices_created || 0}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Proveedores:</span>
                      <span className="font-bold text-blue-600">{results.biloop.results?.providers_created || 0}</span>
                    </div>
                    {formatTimestamp(results.biloop.timestamp) && (
                      <div className="flex justify-between text-xs text-gray-500 pt-2 border-t">
                        <span>Última ejecución:</span>
                        <span>{formatTimestamp(results.biloop.timestamp)}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
              <Button
                onClick={runBiloopSync}
                disabled={isSyncing.biloop}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
              >
                {isSyncing.biloop ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sincronizando...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Ejecutar
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-none shadow-xl hover:shadow-2xl transition-all">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center">
                    <ShoppingCart className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Revo Sync</CardTitle>
                    <p className="text-xs text-gray-600">Ventas + Productos</p>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Estado:</span>
                  {isSyncing.revo ? (
                    <Badge className="bg-blue-100 text-blue-800">
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      Sincronizando...
                    </Badge>
                  ) : results.revo ? (
                    <Badge className="bg-green-100 text-green-800">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Completado
                    </Badge>
                  ) : (
                    <Badge className="bg-gray-100 text-gray-800">Listo</Badge>
                  )}
                </div>
                {results.revo && (
                  <>
                    {results.revo.source && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Fuente:</span>
                        <Badge className={results.revo.source === 'revo_api' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}>
                          {results.revo.source === 'revo_api' ? '🌐 API Real' : '🤖 IA'}
                        </Badge>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Ventas:</span>
                      <span className="font-bold text-cyan-600">{results.revo.results?.sales_created || 0}</span>
                    </div>
                    {results.revo.analytics && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Beneficio:</span>
                        <span className={`font-bold ${results.revo.analytics.net_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {results.revo.analytics.net_profit?.toFixed(2)}€
                        </span>
                      </div>
                    )}
                    {formatTimestamp(results.revo.timestamp) && (
                      <div className="flex justify-between text-xs text-gray-500 pt-2 border-t">
                        <span>Última ejecución:</span>
                        <span>{formatTimestamp(results.revo.timestamp)}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
              <Button
                onClick={runRevoSync}
                disabled={isSyncing.revo}
                className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700"
              >
                {isSyncing.revo ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sincronizando...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Ejecutar
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-none shadow-xl hover:shadow-2xl transition-all">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center">
                    <Mail className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Email Processor</CardTitle>
                    <p className="text-xs text-gray-600">Facturas automáticas</p>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Estado:</span>
                  {isSyncing.email ? (
                    <Badge className="bg-blue-100 text-blue-800">
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      Procesando...
                    </Badge>
                  ) : results.email ? (
                    <Badge className="bg-green-100 text-green-800">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Completado
                    </Badge>
                  ) : (
                    <Badge className="bg-gray-100 text-gray-800">Listo</Badge>
                  )}
                </div>
                {results.email && (
                  <>
                    {results.email.success !== undefined && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Fuente:</span>
                        <Badge className={results.email.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                          {results.email.success ? '📧 Gmail Real' : '❌ Error'}
                        </Badge>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Emails:</span>
                      <span className="font-bold text-purple-600">{results.email.results?.emails_processed || 0}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Facturas:</span>
                      <span className="font-bold text-green-600">{results.email.results?.invoices_created || 0}</span>
                    </div>
                    {results.email.results?.providers_created > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Proveedores:</span>
                        <span className="font-bold text-blue-600">{results.email.results.providers_created}</span>
                      </div>
                    )}
                    {formatTimestamp(results.email.timestamp) && (
                      <div className="flex justify-between text-xs text-gray-500 pt-2 border-t">
                        <span>Última ejecución:</span>
                        <span>{formatTimestamp(results.email.timestamp)}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
              <Button
                onClick={runEmailProcessor}
                disabled={isSyncing.email}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700"
              >
                {isSyncing.email ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Ejecutar
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                ¿Reset Completo + Sincronización Real?
              </DialogTitle>
              <DialogDescription className="space-y-3 pt-4">
                <p className="font-medium text-gray-900">Esta acción:</p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-red-600">🗑️</span>
                    <span><strong>Eliminará TODOS</strong> los datos actuales (facturas, proveedores, ventas, productos, empleados, etc.)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600">🔄</span>
                    <span><strong>Sincronizará desde cero</strong> con tus APIs reales de Biloop y Revo</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600">💾</span>
                    <span>Solo mantendrá tus configuraciones y usuarios</span>
                  </li>
                </ul>
                <p className="text-red-600 font-medium pt-2">⚠️ Esta acción NO se puede deshacer</p>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowResetDialog(false)}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={runResetAndSync}
                className="bg-red-600 hover:bg-red-700"
              >
                Sí, Reset y Sincronizar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}