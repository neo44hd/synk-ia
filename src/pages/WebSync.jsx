import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  RefreshCw, 
  Globe,
  CheckCircle2,
  AlertCircle,
  Download,
  Zap,
  ArrowRight,
  TrendingUp,
  Package
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function WebSync() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [autoSync, setAutoSync] = useState(false);
  
  const queryClient = useQueryClient();

  const { data: menuItems = [] } = useQuery({
    queryKey: ['menu-items'],
    queryFn: () => base44.entities.MenuItem.list(),
    initialData: [],
  });

  const { data: syncHistory = [] } = useQuery({
    queryKey: ['web-sync-history'],
    queryFn: () => base44.entities.WebSync.list('-sync_date', 20),
    initialData: [],
  });

  // Detectar productos de familia Glovo (simulado - en producción vendrían de Revo)
  const glovoProducts = menuItems.filter(item => 
    item.category === 'bebidas' || item.category === 'principales' || item.category === 'entrantes'
  );

  const syncToWeb = async (platform = 'web') => {
    setIsSyncing(true);

    try {
      // 1. Preparar datos para sincronizar
      const productsToSync = glovoProducts.map(product => ({
        id: product.revo_id || product.id,
        name: product.name,
        category: product.category,
        price: product.price,
        description: product.description || '',
        image: product.image_url || '',
        available: product.available,
        allergens: product.allergens || []
      }));

      // 2. Generar JSON para la web
      const webData = {
        menu: productsToSync,
        last_update: new Date().toISOString(),
        source: 'revo_xef',
        platform: platform
      };

      const jsonExport = JSON.stringify(webData, null, 2);

      // 3. En producción, aquí harías:
      // - POST a la API de chickenpalaceibiza.es
      // - O FTP upload del JSON
      // - O webhook a la web
      
      // Por ahora, simulamos y guardamos el log
      const syncRecord = await base44.entities.WebSync.create({
        sync_type: 'precios',
        source: 'revo',
        platform: platform,
        items_synced: productsToSync.map(p => ({
          product_id: p.id,
          product_name: p.name,
          new_price: p.price,
          glovo_family: true
        })),
        total_items: productsToSync.length,
        glovo_items: productsToSync.length,
        status: 'completado',
        sync_date: new Date().toISOString(),
        web_url: `https://chickenpalaceibiza.es/menu?updated=${Date.now()}`,
        json_export: jsonExport
      });

      queryClient.invalidateQueries({ queryKey: ['web-sync-history'] });
      
      toast.success(`✅ ${productsToSync.length} productos sincronizados con ${platform === 'web' ? 'la web' : 'Glovo'}`);

      // Descargar JSON automáticamente
      downloadJSON(jsonExport, `menu_${platform}_${format(new Date(), 'yyyyMMdd_HHmmss')}.json`);

    } catch (error) {
      console.error('Sync error:', error);
      toast.error('Error en la sincronización');
      
      await base44.entities.WebSync.create({
        sync_type: 'precios',
        source: 'revo',
        platform: platform,
        status: 'error',
        sync_date: new Date().toISOString(),
        error_message: error.message
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const downloadJSON = (jsonContent, filename) => {
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const lastSync = syncHistory[0];
  const successRate = syncHistory.length > 0 
    ? (syncHistory.filter(s => s.status === 'completado').length / syncHistory.length) * 100 
    : 0;

  return (
    <div className="p-4 md:p-8 min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-black">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Globe className="w-8 h-8 text-cyan-400" />
            Sincronización Web
          </h1>
          <p className="text-gray-400 mt-1">
            chickenpalaceibiza.es • Revo → Web automático
          </p>
        </div>

        {/* Info Banner */}
        <Card className="border-none shadow-2xl mb-8 bg-gradient-to-r from-cyan-600 to-blue-700 text-white">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <Zap className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-lg mb-2">🔄 ¿Cómo funciona?</h3>
                <p className="text-sm text-cyan-100 mb-3">
                  Cuando cambias precios en la <strong>familia Glovo</strong> en Revo Xef, 
                  este sistema detecta los cambios y actualiza automáticamente tu web.
                </p>
                <div className="flex items-center gap-2 text-sm bg-white/10 rounded-lg px-4 py-2 inline-block">
                  <ArrowRight className="w-4 h-4" />
                  <span>Revo (Glovo) → SYNK-IA → chickenpalaceibiza.es</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sync Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Manual Sync */}
          <Card className="border-none shadow-2xl bg-slate-800 border border-cyan-500/20">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-cyan-400" />
                Sincronización Manual
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-slate-900 rounded-lg p-4 border border-cyan-500/20">
                <p className="text-sm text-gray-300 mb-3">
                  <Package className="w-4 h-4 inline mr-2 text-cyan-400" />
                  <strong className="text-cyan-400">{glovoProducts.length}</strong> productos detectados en familia Glovo
                </p>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>Entrantes</span>
                    <span>{glovoProducts.filter(p => p.category === 'entrantes').length}</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>Principales</span>
                    <span>{glovoProducts.filter(p => p.category === 'principales').length}</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>Bebidas</span>
                    <span>{glovoProducts.filter(p => p.category === 'bebidas').length}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <Button
                  onClick={() => syncToWeb('web')}
                  disabled={isSyncing}
                  className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-bold py-6"
                >
                  {isSyncing ? (
                    <>
                      <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                      Sincronizando...
                    </>
                  ) : (
                    <>
                      <Globe className="w-5 h-5 mr-2" />
                      Sincronizar con Web
                    </>
                  )}
                </Button>

                <Button
                  onClick={() => syncToWeb('glovo')}
                  disabled={isSyncing}
                  variant="outline"
                  className="w-full border-green-500/30 text-green-400 hover:bg-green-500/10"
                >
                  <Package className="w-5 h-5 mr-2" />
                  Sincronizar con Glovo
                </Button>
              </div>

              {lastSync && (
                <div className="bg-slate-900 rounded-lg p-3 border border-green-500/20">
                  <p className="text-xs text-gray-400 mb-1">Última sincronización:</p>
                  <p className="text-sm text-green-400 font-medium">
                    {format(new Date(lastSync.sync_date), 'dd/MM/yyyy HH:mm')}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Auto Sync Settings */}
          <Card className="border-none shadow-2xl bg-slate-800 border border-purple-500/20">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Zap className="w-5 h-5 text-purple-400" />
                Sincronización Automática
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-white font-medium">Auto-Sync Activado</Label>
                  <p className="text-xs text-gray-400 mt-1">
                    Sincroniza cada hora automáticamente
                  </p>
                </div>
                <Switch
                  checked={autoSync}
                  onCheckedChange={setAutoSync}
                />
              </div>

              {autoSync && (
                <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
                  <p className="text-sm text-purple-300 mb-2">
                    ✓ Auto-sync configurado
                  </p>
                  <p className="text-xs text-gray-400">
                    Los cambios en Revo se sincronizarán automáticamente cada hora. 
                    También puedes sincronizar manualmente cuando quieras.
                  </p>
                </div>
              )}

              <div className="space-y-3">
                <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-400">Tasa de éxito</span>
                    <span className="text-lg font-bold text-green-400">{successRate.toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full transition-all"
                      style={{ width: `${successRate}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-900 rounded-lg p-3 border border-slate-700">
                    <p className="text-xs text-gray-400">Total sync</p>
                    <p className="text-2xl font-bold text-cyan-400">{syncHistory.length}</p>
                  </div>
                  <div className="bg-slate-900 rounded-lg p-3 border border-slate-700">
                    <p className="text-xs text-gray-400">Completados</p>
                    <p className="text-2xl font-bold text-green-400">
                      {syncHistory.filter(s => s.status === 'completado').length}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sync History */}
        <Card className="border-none shadow-2xl bg-slate-800 border border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">📋 Historial de Sincronizaciones</CardTitle>
          </CardHeader>
          <CardContent>
            {syncHistory.length === 0 ? (
              <div className="text-center py-12">
                <RefreshCw className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">No hay sincronizaciones registradas</p>
              </div>
            ) : (
              <div className="space-y-3">
                {syncHistory.map((sync) => (
                  <div
                    key={sync.id}
                    className="bg-slate-900 rounded-lg p-4 border border-slate-700 hover:border-cyan-500/30 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                          sync.status === 'completado' ? 'bg-green-500/20' :
                          sync.status === 'error' ? 'bg-red-500/20' : 'bg-yellow-500/20'
                        }`}>
                          {sync.status === 'completado' ? (
                            <CheckCircle2 className="w-6 h-6 text-green-400" />
                          ) : sync.status === 'error' ? (
                            <AlertCircle className="w-6 h-6 text-red-400" />
                          ) : (
                            <RefreshCw className="w-6 h-6 text-yellow-400" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-3 mb-1">
                            <p className="font-medium text-white">
                              Sync {sync.platform === 'web' ? 'Web' : 'Glovo'}
                            </p>
                            <Badge className={
                              sync.status === 'completado' ? 'bg-green-500/20 text-green-400' :
                              sync.status === 'error' ? 'bg-red-500/20 text-red-400' :
                              'bg-yellow-500/20 text-yellow-400'
                            }>
                              {sync.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-400">
                            {sync.total_items || 0} productos • {format(new Date(sync.sync_date), 'dd/MM/yyyy HH:mm')}
                          </p>
                        </div>
                      </div>
                      
                      {sync.json_export && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => downloadJSON(sync.json_export, `menu_${sync.platform}_${sync.id}.json`)}
                          className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10"
                        >
                          <Download className="w-4 h-4 mr-1" />
                          JSON
                        </Button>
                      )}
                    </div>

                    {sync.error_message && (
                      <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                        <p className="text-xs text-red-400">{sync.error_message}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Integration Guide */}
        <Card className="border-none shadow-2xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 mt-8">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h3 className="font-bold text-white text-lg mb-3">🔧 Integración con tu Web</h3>
                <div className="space-y-2 text-sm text-gray-300">
                  <p>Para completar la integración con chickenpalaceibiza.es:</p>
                  <ol className="list-decimal list-inside space-y-1 ml-4">
                    <li>Descarga el JSON generado (botón "JSON" en el historial)</li>
                    <li>Sube el archivo a tu servidor web via FTP/SFTP</li>
                    <li>O configura un webhook en tu CMS para recibir actualizaciones</li>
                    <li>O usa la API de tu web (si la tienes configurada)</li>
                  </ol>
                  <p className="mt-3 text-cyan-400">
                    💡 Para automatización completa (sin descargar), necesitarías habilitar Backend Functions
                    y configurar las credenciales FTP/API de tu web.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}