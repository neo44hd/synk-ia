/**
 * SYNK-IA — Integration Manager
 * ============================
 * UI para gestionar integraciones: Google Drive, Dropbox, Zapier, Slack
 */

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Link2,
  LogOut,
  RefreshCw,
  TestTube,
  Upload,
} from 'lucide-react';
import integrationService from '@/services/integrationService';

export default function IntegrationManager() {
  const [integrations, setIntegrations] = useState({
    googleDrive: [],
    dropbox: [],
    zapier: [],
    slack: [],
  });
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState({});
  const [activeTab, setActiveTab] = useState('google-drive');
  const [testing, setTesting] = useState(null);
  const [zapierUrl, setZapierUrl] = useState('');
  const [slackChannel, setSlackChannel] = useState(null);
  const [slackChannels, setSlackChannels] = useState([]);

  useEffect(() => {
    loadIntegrations();
  }, []);

  async function loadIntegrations() {
    try {
      setLoading(true);
      const [gdrive, db, zap, slk, stat] = await Promise.all([
        integrationService.googleDrive.list().catch(() => ({ integrations: [] })),
        integrationService.dropbox.list().catch(() => ({ integrations: [] })),
        integrationService.zapier.list().catch(() => ({ integrations: [] })),
        integrationService.slack.list().catch(() => ({ integrations: [] })),
        integrationService.getIntegrationStatus().catch(() => ({})),
      ]);

      setIntegrations({
        googleDrive: gdrive.integrations || [],
        dropbox: db.integrations || [],
        zapier: zap.integrations || [],
        slack: slk.integrations || [],
      });
      setStatus(stat);
    } catch (err) {
      console.error('Error loading integrations:', err);
    } finally {
      setLoading(false);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Google Drive
  // ─────────────────────────────────────────────────────────────────────────

  async function handleGoogleDriveAuth() {
    try {
      const { authUrl } = await integrationService.googleDrive.getAuthUrl();
      window.location.href = authUrl;
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }

  async function testGoogleDrive(id) {
    try {
      setTesting(id);
      const result = await integrationService.googleDrive.test(id);
      alert(`✓ Conectado. ${result.files} archivos encontrados.`);
    } catch (err) {
      alert('✗ Error: ' + err.message);
    } finally {
      setTesting(null);
    }
  }

  async function syncGoogleDrive(id) {
    try {
      setTesting(id);
      const result = await integrationService.googleDrive.sync(id);
      alert(
        `✓ Sincronizado. ${result.processableFiles}/${result.totalFiles} archivos procesables.`
      );
      loadIntegrations();
    } catch (err) {
      alert('✗ Error: ' + err.message);
    } finally {
      setTesting(null);
    }
  }

  async function disconnectGoogleDrive(id) {
    if (!confirm('¿Desconectar Google Drive?')) return;
    try {
      await integrationService.googleDrive.disconnect(id);
      loadIntegrations();
    } catch (err) {
      alert('✗ Error: ' + err.message);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Dropbox
  // ─────────────────────────────────────────────────────────────────────────

  async function handleDropboxAuth() {
    try {
      const { authUrl } = await integrationService.dropbox.getAuthUrl();
      window.location.href = authUrl;
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }

  async function testDropbox(id) {
    try {
      setTesting(id);
      const result = await integrationService.dropbox.test(id);
      alert(`✓ Conectado. ${result.files} archivos encontrados.`);
    } catch (err) {
      alert('✗ Error: ' + err.message);
    } finally {
      setTesting(null);
    }
  }

  async function syncDropbox(id) {
    try {
      setTesting(id);
      const result = await integrationService.dropbox.sync(id);
      alert(
        `✓ Sincronizado. ${result.processableFiles}/${result.totalFiles} archivos procesables.`
      );
      loadIntegrations();
    } catch (err) {
      alert('✗ Error: ' + err.message);
    } finally {
      setTesting(null);
    }
  }

  async function disconnectDropbox(id) {
    if (!confirm('¿Desconectar Dropbox?')) return;
    try {
      await integrationService.dropbox.disconnect(id);
      loadIntegrations();
    } catch (err) {
      alert('✗ Error: ' + err.message);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Zapier
  // ─────────────────────────────────────────────────────────────────────────

  async function createZapierIntegration() {
    if (!zapierUrl) {
      alert('Ingresa la URL del webhook de Zapier');
      return;
    }
    try {
      const result = await integrationService.zapier.create(zapierUrl, [
        'document_processed',
        'extraction_complete',
      ]);
      setZapierUrl('');
      loadIntegrations();
      alert('✓ Integración Zapier creada.');
    } catch (err) {
      alert('✗ Error: ' + err.message);
    }
  }

  async function testZapier(id) {
    try {
      setTesting(id);
      const result = await integrationService.zapier.test(id);
      if (result.success) {
        alert('✓ Webhook funcionando correctamente.');
      } else {
        alert('✗ Webhook no responde: ' + result.error);
      }
    } catch (err) {
      alert('✗ Error: ' + err.message);
    } finally {
      setTesting(null);
    }
  }

  async function disconnectZapier(id) {
    if (!confirm('¿Desconectar Zapier?')) return;
    try {
      await integrationService.zapier.disconnect(id);
      loadIntegrations();
    } catch (err) {
      alert('✗ Error: ' + err.message);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Slack
  // ─────────────────────────────────────────────────────────────────────────

  async function handleSlackAuth() {
    try {
      const { authUrl } = await integrationService.slack.getAuthUrl();
      window.location.href = authUrl;
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }

  async function loadSlackChannels(id) {
    try {
      const result = await integrationService.slack.getChannels(id);
      setSlackChannels(result.channels || []);
    } catch (err) {
      alert('✗ Error cargando canales: ' + err.message);
    }
  }

  async function testSlack(id) {
    try {
      setTesting(id);
      const result = await integrationService.slack.test(id);
      if (result.success) {
        alert(`✓ Conectado. ${result.channels} canales encontrados.`);
      } else {
        alert('✗ Error: ' + result.error);
      }
    } catch (err) {
      alert('✗ Error: ' + err.message);
    } finally {
      setTesting(null);
    }
  }

  async function updateSlackNotifications(id, integration) {
    try {
      await integrationService.slack.update(id, {
        notificationChannel: slackChannel,
        autoNotify: true,
      });
      alert('✓ Notificaciones configuradas.');
      loadIntegrations();
    } catch (err) {
      alert('✗ Error: ' + err.message);
    }
  }

  async function disconnectSlack(id) {
    if (!confirm('¿Desconectar Slack?')) return;
    try {
      await integrationService.slack.disconnect(id);
      loadIntegrations();
    } catch (err) {
      alert('✗ Error: ' + err.message);
    }
  }

  return (
    <div className="w-full max-w-6xl mx-auto p-4 space-y-6">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold">Gestor de Integraciones</h1>
        <p className="text-gray-600">
          Conecta Google Drive, Dropbox, Zapier y Slack para automatizar tu flujo de trabajo
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <p className="text-gray-600">Cargando integraciones...</p>
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="google-drive">Google Drive</TabsTrigger>
            <TabsTrigger value="dropbox">Dropbox</TabsTrigger>
            <TabsTrigger value="zapier">Zapier</TabsTrigger>
            <TabsTrigger value="slack">Slack</TabsTrigger>
          </TabsList>

          {/* ─────────────────────────────────────────────────────────────── */}
          {/* GOOGLE DRIVE */}
          {/* ─────────────────────────────────────────────────────────────── */}
          <TabsContent value="google-drive" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  Google Drive
                </CardTitle>
                <CardDescription>
                  Sincroniza y procesa archivos automáticamente desde Google Drive
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {integrations.googleDrive.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-600 mb-4">
                      No hay integraciones de Google Drive conectadas
                    </p>
                    <Button
                      onClick={handleGoogleDriveAuth}
                      disabled={!status.googleDrive}
                    >
                      {status.googleDrive ? 'Conectar Google Drive' : 'No configurado'}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {integrations.googleDrive.map((int) => (
                      <Card key={int.id} className="p-4 bg-gray-50">
                        <div className="space-y-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-semibold flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-green-600" />
                                Integración activa
                              </h4>
                              <p className="text-sm text-gray-600 mt-1">
                                Conectado desde {new Date(int.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => testGoogleDrive(int.id)}
                                disabled={testing === int.id}
                              >
                                <TestTube className="w-4 h-4" />
                                {testing === int.id ? 'Probando...' : 'Probar'}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => syncGoogleDrive(int.id)}
                                disabled={testing === int.id}
                              >
                                <RefreshCw className="w-4 h-4" />
                                {testing === int.id ? 'Sincronizando...' : 'Sincronizar'}
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => disconnectGoogleDrive(int.id)}
                              >
                                <LogOut className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="flex items-center gap-2">
                                <Checkbox defaultChecked={int.autoProcess} />
                                <span className="text-sm">
                                  Procesamiento automático
                                </span>
                              </label>
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                    <Button
                      onClick={handleGoogleDriveAuth}
                      variant="outline"
                      className="w-full"
                    >
                      <Link2 className="w-4 h-4 mr-2" />
                      Agregar otra cuenta
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─────────────────────────────────────────────────────────────── */}
          {/* DROPBOX */}
          {/* ─────────────────────────────────────────────────────────────── */}
          <TabsContent value="dropbox" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="w-5 h-5" />
                  Dropbox
                </CardTitle>
                <CardDescription>
                  Sincroniza y procesa archivos automáticamente desde Dropbox
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {integrations.dropbox.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-600 mb-4">
                      No hay integraciones de Dropbox conectadas
                    </p>
                    <Button
                      onClick={handleDropboxAuth}
                      disabled={!status.dropbox}
                    >
                      {status.dropbox ? 'Conectar Dropbox' : 'No configurado'}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {integrations.dropbox.map((int) => (
                      <Card key={int.id} className="p-4 bg-gray-50">
                        <div className="space-y-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-semibold flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-green-600" />
                                Integración activa
                              </h4>
                              <p className="text-sm text-gray-600 mt-1">
                                Conectado desde {new Date(int.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => testDropbox(int.id)}
                                disabled={testing === int.id}
                              >
                                <TestTube className="w-4 h-4" />
                                {testing === int.id ? 'Probando...' : 'Probar'}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => syncDropbox(int.id)}
                                disabled={testing === int.id}
                              >
                                <RefreshCw className="w-4 h-4" />
                                {testing === int.id ? 'Sincronizando...' : 'Sincronizar'}
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => disconnectDropbox(int.id)}
                              >
                                <LogOut className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                          <label className="flex items-center gap-2">
                            <Checkbox defaultChecked={int.autoProcess} />
                            <span className="text-sm">
                              Procesamiento automático
                            </span>
                          </label>
                        </div>
                      </Card>
                    ))}
                    <Button
                      onClick={handleDropboxAuth}
                      variant="outline"
                      className="w-full"
                    >
                      <Link2 className="w-4 h-4 mr-2" />
                      Agregar otra cuenta
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─────────────────────────────────────────────────────────────── */}
          {/* ZAPIER */}
          {/* ─────────────────────────────────────────────────────────────── */}
          <TabsContent value="zapier" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Zapier</CardTitle>
                <CardDescription>
                  Automatiza tu flujo de trabajo con webhooks de Zapier
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {integrations.zapier.length === 0 ? (
                  <div className="space-y-4">
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <p className="text-sm text-blue-800 mb-2">
                        <AlertCircle className="w-4 h-4 inline mr-2" />
                        Zapier está siempre disponible. Ingresa la URL de tu webhook para
                        conectar.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="zapier-url">URL del Webhook de Zapier</Label>
                      <Input
                        id="zapier-url"
                        placeholder="https://hooks.zapier.com/hooks/catch/..."
                        value={zapierUrl}
                        onChange={(e) => setZapierUrl(e.target.value)}
                      />
                    </div>
                    <Button onClick={createZapierIntegration} className="w-full">
                      Crear Integración
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {integrations.zapier.map((int) => (
                      <Card key={int.id} className="p-4 bg-gray-50">
                        <div className="space-y-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-semibold flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-green-600" />
                                Webhook activo
                              </h4>
                              <p className="text-xs text-gray-600 font-mono mt-2">
                                {int.webhookUrl}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => testZapier(int.id)}
                                disabled={testing === int.id}
                              >
                                <TestTube className="w-4 h-4" />
                                {testing === int.id ? 'Probando...' : 'Probar'}
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => disconnectZapier(int.id)}
                              >
                                <LogOut className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─────────────────────────────────────────────────────────────── */}
          {/* SLACK */}
          {/* ─────────────────────────────────────────────────────────────── */}
          <TabsContent value="slack" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Slack</CardTitle>
                <CardDescription>
                  Recibe notificaciones en Slack cuando se procesen documentos
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {integrations.slack.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-600 mb-4">
                      No hay integraciones de Slack conectadas
                    </p>
                    <Button
                      onClick={handleSlackAuth}
                      disabled={!status.slack}
                    >
                      {status.slack ? 'Conectar Slack' : 'No configurado'}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {integrations.slack.map((int) => (
                      <Card key={int.id} className="p-4 bg-gray-50">
                        <div className="space-y-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-semibold flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-green-600" />
                                {int.teamName || 'Workspace Slack'}
                              </h4>
                              <p className="text-sm text-gray-600 mt-1">
                                Conectado desde {new Date(int.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => testSlack(int.id)}
                                disabled={testing === int.id}
                              >
                                <TestTube className="w-4 h-4" />
                                {testing === int.id ? 'Probando...' : 'Probar'}
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => disconnectSlack(int.id)}
                              >
                                <LogOut className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                          <div className="space-y-3 pt-2 border-t">
                            <div>
                              <Label className="text-sm">Canal de notificaciones</Label>
                              <select
                                className="w-full mt-2 px-3 py-2 border rounded-md text-sm"
                                onClick={() => loadSlackChannels(int.id)}
                                onChange={(e) => setSlackChannel(e.target.value)}
                                defaultValue={int.notificationChannel || ''}
                              >
                                <option value="">Selecciona un canal...</option>
                                {slackChannels.map((ch) => (
                                  <option key={ch.id} value={ch.id}>
                                    #{ch.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <Button
                              size="sm"
                              onClick={() => updateSlackNotifications(int.id, int)}
                              className="w-full"
                            >
                              Guardar configuración
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                    <Button
                      onClick={handleSlackAuth}
                      variant="outline"
                      className="w-full"
                    >
                      <Link2 className="w-4 h-4 mr-2" />
                      Agregar otro workspace
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
