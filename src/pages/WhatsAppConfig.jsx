import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  MessageSquare,
  Phone,
  Settings,
  Save,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Send,
  Key,
  Building2,
  ChefHat,
  User,
  Bell,
  BellOff,
  Edit,
  Eye,
  EyeOff,
  ExternalLink,
  Info,
  Zap,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import whatsappService from '@/services/whatsappService';

export default function WhatsAppConfig() {
  const [config, setConfig] = useState({});
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testNumber, setTestNumber] = useState('');
  const [testResult, setTestResult] = useState(null);
  const [showSecrets, setShowSecrets] = useState({});
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState('');
  const [stats, setStats] = useState({});

  useEffect(() => {
    loadConfig();
    loadStats();
  }, []);

  const loadConfig = () => {
    const currentConfig = whatsappService.getConfig();
    setConfig(currentConfig);
  };

  const loadStats = () => {
    const statistics = whatsappService.getStatistics(30);
    setStats(statistics);
  };

  const handleSave = () => {
    setLoading(true);
    setTimeout(() => {
      whatsappService.saveConfig(config);
      setSaved(true);
      setLoading(false);
      setTimeout(() => setSaved(false), 3000);
    }, 500);
  };

  const handleTestMessage = async () => {
    if (!testNumber) {
      setTestResult({ success: false, error: 'Introduce un número de teléfono' });
      return;
    }

    setLoading(true);
    const result = await whatsappService.sendMessage(
      testNumber,
      `🧪 *Mensaje de prueba SYNK-IA*\n\nEste es un mensaje de prueba de WhatsApp Business.\n\n✅ La integración funciona correctamente.\n\nFecha: ${new Date().toLocaleString('es-ES')}`,
      { type: 'test' }
    );
    setTestResult(result);
    setLoading(false);
  };

  const toggleSecret = (key) => {
    setShowSecrets(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const previewTemplateMessage = (templateKey, templateName) => {
    setPreviewTemplate(templateName);
    setPreviewOpen(true);
  };

  const getPreviewData = () => {
    return {
      businessName: config.businessName || 'Chicken Palace',
      customerName: 'Juan García',
      orderNumber: '20260220123456',
      products: '• 1x Pollo Entero Asado - 12.50€\n• 2x Patatas Fritas - 6.00€\n• 1x Coca-Cola - 2.50€',
      total: '21.00',
      orderType: '🏪 Recogida en local',
      pickupTime: '20:30',
      deliveryAddress: '',
      customerPhone: '+34 600 123 456',
      orderLink: 'https://synk-ia.app/OrdersDashboard?order=20260220123456',
    };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <MessageSquare className="w-6 h-6 text-green-400" />
            </div>
            Configuración WhatsApp Business
          </h1>
          <p className="text-zinc-400 mt-1">
            Configura la integración de WhatsApp para notificaciones automáticas
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={loading}
          className={`${saved ? 'bg-green-600 hover:bg-green-700' : 'bg-green-500 hover:bg-green-600'} text-white`}
        >
          {loading ? (
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
          ) : saved ? (
            <CheckCircle className="w-4 h-4 mr-2" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          {saved ? 'Guardado' : 'Guardar Cambios'}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-zinc-400 text-sm">Mensajes Enviados</p>
                <p className="text-2xl font-bold text-white">{stats.sentMessages || 0}</p>
              </div>
              <div className="p-3 bg-green-500/20 rounded-lg">
                <Send className="w-6 h-6 text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-zinc-400 text-sm">Mensajes Fallidos</p>
                <p className="text-2xl font-bold text-white">{stats.failedMessages || 0}</p>
              </div>
              <div className="p-3 bg-red-500/20 rounded-lg">
                <AlertCircle className="w-6 h-6 text-red-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-zinc-400 text-sm">Pedidos WhatsApp</p>
                <p className="text-2xl font-bold text-white">{stats.totalOrders || 0}</p>
              </div>
              <div className="p-3 bg-blue-500/20 rounded-lg">
                <MessageSquare className="w-6 h-6 text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-zinc-400 text-sm">Facturación (30d)</p>
                <p className="text-2xl font-bold text-white">{(stats.totalRevenue || 0).toFixed(2)}€</p>
              </div>
              <div className="p-3 bg-yellow-500/20 rounded-lg">
                <Zap className="w-6 h-6 text-yellow-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="bg-zinc-800 border border-zinc-700">
          <TabsTrigger value="general" className="data-[state=active]:bg-zinc-700">
            <Settings className="w-4 h-4 mr-2" />
            General
          </TabsTrigger>
          <TabsTrigger value="notifications" className="data-[state=active]:bg-zinc-700">
            <Bell className="w-4 h-4 mr-2" />
            Notificaciones
          </TabsTrigger>
          <TabsTrigger value="templates" className="data-[state=active]:bg-zinc-700">
            <Edit className="w-4 h-4 mr-2" />
            Plantillas
          </TabsTrigger>
          <TabsTrigger value="api" className="data-[state=active]:bg-zinc-700">
            <Key className="w-4 h-4 mr-2" />
            Credenciales API
          </TabsTrigger>
          <TabsTrigger value="test" className="data-[state=active]:bg-zinc-700">
            <Send className="w-4 h-4 mr-2" />
            Pruebas
          </TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general">
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-green-400" />
                Información del Negocio
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-300">Nombre del Negocio</label>
                  <Input
                    value={config.businessName || ''}
                    onChange={(e) => setConfig({ ...config, businessName: e.target.value })}
                    placeholder="Chicken Palace"
                    className="bg-zinc-800 border-zinc-700 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-300">WhatsApp Business</label>
                  <Input
                    value={config.businessPhone || ''}
                    onChange={(e) => setConfig({ ...config, businessPhone: e.target.value })}
                    placeholder="+34 600 000 000"
                    className="bg-zinc-800 border-zinc-700 text-white"
                  />
                  <p className="text-xs text-zinc-500">Este es el número que verán los clientes</p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300">Proveedor de API</label>
                <Select
                  value={config.apiProvider || 'whatsapp-web'}
                  onValueChange={(value) => setConfig({ ...config, apiProvider: value })}
                >
                  <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700">
                    <SelectItem value="whatsapp-web" className="text-white hover:bg-zinc-700">
                      WhatsApp Web (Demo/Testing)
                    </SelectItem>
                    <SelectItem value="twilio" className="text-white hover:bg-zinc-700">
                      Twilio WhatsApp API
                    </SelectItem>
                    <SelectItem value="meta-api" className="text-white hover:bg-zinc-700">
                      Meta Business API (Oficial)
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-zinc-500">
                  WhatsApp Web es solo para pruebas. Para producción usa Twilio o Meta API.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Settings */}
        <TabsContent value="notifications">
          <div className="space-y-6">
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <User className="w-5 h-5 text-blue-400" />
                  Notificaciones al Cliente
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Bell className="w-5 h-5 text-green-400" />
                    <div>
                      <p className="font-medium text-white">Confirmación automática</p>
                      <p className="text-sm text-zinc-400">
                        Enviar confirmación de pedido por WhatsApp al cliente
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={config.autoNotifyCustomer}
                    onCheckedChange={(checked) =>
                      setConfig({ ...config, autoNotifyCustomer: checked })
                    }
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-yellow-400" />
                  Notificaciones al CEO/Administrador
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Bell className="w-5 h-5 text-yellow-400" />
                    <div>
                      <p className="font-medium text-white">Alerta de nuevos pedidos</p>
                      <p className="text-sm text-zinc-400">
                        Notificar al CEO cuando llegue un nuevo pedido
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={config.autoNotifyCeo}
                    onCheckedChange={(checked) =>
                      setConfig({ ...config, autoNotifyCeo: checked })
                    }
                  />
                </div>
                {config.autoNotifyCeo && (
                  <div className="space-y-2 pl-4">
                    <label className="text-sm font-medium text-zinc-300">Teléfono del CEO</label>
                    <Input
                      value={config.ceoPhone || ''}
                      onChange={(e) => setConfig({ ...config, ceoPhone: e.target.value })}
                      placeholder="+34 600 000 000"
                      className="bg-zinc-800 border-zinc-700 text-white"
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <ChefHat className="w-5 h-5 text-orange-400" />
                  Notificaciones a Cocina
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Bell className="w-5 h-5 text-orange-400" />
                    <div>
                      <p className="font-medium text-white">Alerta de pedidos a cocina</p>
                      <p className="text-sm text-zinc-400">
                        Enviar pedido directamente al WhatsApp de cocina
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={config.autoNotifyKitchen}
                    onCheckedChange={(checked) =>
                      setConfig({ ...config, autoNotifyKitchen: checked })
                    }
                  />
                </div>
                {config.autoNotifyKitchen && (
                  <div className="space-y-2 pl-4">
                    <label className="text-sm font-medium text-zinc-300">Teléfono de Cocina</label>
                    <Input
                      value={config.kitchenPhone || ''}
                      onChange={(e) => setConfig({ ...config, kitchenPhone: e.target.value })}
                      placeholder="+34 600 000 000"
                      className="bg-zinc-800 border-zinc-700 text-white"
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Templates Settings */}
        <TabsContent value="templates">
          <div className="space-y-6">
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                    Confirmación de Pedido (Cliente)
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => previewTemplateMessage('orderConfirmTemplate', 'Confirmación de Pedido')}
                    className="border-zinc-700 hover:bg-zinc-800"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Vista Previa
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={config.orderConfirmTemplate || ''}
                  onChange={(e) => setConfig({ ...config, orderConfirmTemplate: e.target.value })}
                  placeholder="Plantilla de confirmación..."
                  className="bg-zinc-800 border-zinc-700 text-white min-h-[200px] font-mono text-sm"
                />
                <div className="mt-3 p-3 bg-zinc-800/50 rounded-lg">
                  <p className="text-xs text-zinc-400 mb-2">Variables disponibles:</p>
                  <div className="flex flex-wrap gap-2">
                    {['{businessName}', '{customerName}', '{orderNumber}', '{products}', '{total}', '{orderType}', '{pickupTime}', '{deliveryAddress}'].map(v => (
                      <Badge key={v} variant="secondary" className="bg-zinc-700 text-zinc-300 font-mono text-xs">
                        {v}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-yellow-400" />
                    Alerta CEO (Nuevo Pedido)
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => previewTemplateMessage('ceoAlertTemplate', 'Alerta CEO')}
                    className="border-zinc-700 hover:bg-zinc-800"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Vista Previa
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={config.ceoAlertTemplate || ''}
                  onChange={(e) => setConfig({ ...config, ceoAlertTemplate: e.target.value })}
                  placeholder="Plantilla de alerta CEO..."
                  className="bg-zinc-800 border-zinc-700 text-white min-h-[200px] font-mono text-sm"
                />
              </CardContent>
            </Card>

            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <ChefHat className="w-5 h-5 text-orange-400" />
                    Alerta Cocina
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => previewTemplateMessage('kitchenAlertTemplate', 'Alerta Cocina')}
                    className="border-zinc-700 hover:bg-zinc-800"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Vista Previa
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={config.kitchenAlertTemplate || ''}
                  onChange={(e) => setConfig({ ...config, kitchenAlertTemplate: e.target.value })}
                  placeholder="Plantilla de alerta cocina..."
                  className="bg-zinc-800 border-zinc-700 text-white min-h-[150px] font-mono text-sm"
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* API Credentials */}
        <TabsContent value="api">
          <div className="space-y-6">
            {config.apiProvider === 'twilio' && (
              <Card className="bg-zinc-900/50 border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <img src="https://www.twilio.com/assets/icons/twilio-icon.svg" className="w-5 h-5" alt="Twilio" />
                    Credenciales Twilio
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-300">Account SID</label>
                    <div className="relative">
                      <Input
                        type={showSecrets.twilioSid ? 'text' : 'password'}
                        value={config.twilioAccountSid || ''}
                        onChange={(e) => setConfig({ ...config, twilioAccountSid: e.target.value })}
                        placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                        className="bg-zinc-800 border-zinc-700 text-white pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => toggleSecret('twilioSid')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                      >
                        {showSecrets.twilioSid ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-300">Auth Token</label>
                    <div className="relative">
                      <Input
                        type={showSecrets.twilioToken ? 'text' : 'password'}
                        value={config.twilioAuthToken || ''}
                        onChange={(e) => setConfig({ ...config, twilioAuthToken: e.target.value })}
                        placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                        className="bg-zinc-800 border-zinc-700 text-white pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => toggleSecret('twilioToken')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                      >
                        {showSecrets.twilioToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <a
                    href="https://console.twilio.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Abrir Twilio Console
                  </a>
                </CardContent>
              </Card>
            )}

            {config.apiProvider === 'meta-api' && (
              <Card className="bg-zinc-900/50 border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-blue-500" />
                    Credenciales Meta Business API
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-300">Access Token</label>
                    <div className="relative">
                      <Input
                        type={showSecrets.metaToken ? 'text' : 'password'}
                        value={config.metaAccessToken || ''}
                        onChange={(e) => setConfig({ ...config, metaAccessToken: e.target.value })}
                        placeholder="EAAxxxxxxx..."
                        className="bg-zinc-800 border-zinc-700 text-white pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => toggleSecret('metaToken')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                      >
                        {showSecrets.metaToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-300">Phone Number ID</label>
                    <Input
                      value={config.metaPhoneNumberId || ''}
                      onChange={(e) => setConfig({ ...config, metaPhoneNumberId: e.target.value })}
                      placeholder="1234567890123456"
                      className="bg-zinc-800 border-zinc-700 text-white"
                    />
                  </div>
                  <a
                    href="https://developers.facebook.com/apps"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Meta for Developers
                  </a>
                </CardContent>
              </Card>
            )}

            {config.apiProvider === 'whatsapp-web' && (
              <Card className="bg-zinc-900/50 border-zinc-800">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4 p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                    <Info className="w-6 h-6 text-yellow-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-yellow-400">Modo Demo / Testing</p>
                      <p className="text-sm text-zinc-400 mt-1">
                        El modo WhatsApp Web genera enlaces wa.me que puedes usar para pruebas.
                        Para envío automático de mensajes en producción, configura Twilio o Meta API.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Test Tab */}
        <TabsContent value="test">
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Send className="w-5 h-5 text-green-400" />
                Enviar Mensaje de Prueba
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300">Número de teléfono</label>
                <Input
                  value={testNumber}
                  onChange={(e) => setTestNumber(e.target.value)}
                  placeholder="+34 600 000 000"
                  className="bg-zinc-800 border-zinc-700 text-white"
                />
              </div>
              <Button
                onClick={handleTestMessage}
                disabled={loading}
                className="bg-green-500 hover:bg-green-600 text-white"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Enviar Mensaje de Prueba
              </Button>

              {testResult && (
                <div
                  className={`p-4 rounded-lg border ${
                    testResult.status === 'sent'
                      ? 'bg-green-500/10 border-green-500/20'
                      : 'bg-red-500/10 border-red-500/20'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {testResult.status === 'sent' ? (
                      <CheckCircle className="w-5 h-5 text-green-400" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-400" />
                    )}
                    <span className={testResult.status === 'sent' ? 'text-green-400' : 'text-red-400'}>
                      {testResult.status === 'sent' ? 'Mensaje enviado correctamente' : 'Error al enviar'}
                    </span>
                  </div>
                  {testResult.error && (
                    <p className="text-sm text-zinc-400 mt-2">{testResult.error}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">Vista Previa: {previewTemplate}</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Así se verá el mensaje con datos de ejemplo
            </DialogDescription>
          </DialogHeader>
          <div className="p-4 bg-zinc-800 rounded-lg">
            <div className="bg-green-600 text-white px-3 py-1 rounded-t-lg text-sm font-medium">
              WhatsApp Message
            </div>
            <div className="bg-zinc-700 p-4 rounded-b-lg">
              <pre className="text-white text-sm whitespace-pre-wrap font-sans">
                {whatsappService.formatMessage(
                  config[previewTemplate === 'Confirmación de Pedido' ? 'orderConfirmTemplate' :
                         previewTemplate === 'Alerta CEO' ? 'ceoAlertTemplate' : 'kitchenAlertTemplate'] || '',
                  getPreviewData()
                )}
              </pre>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)} className="border-zinc-700">
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
