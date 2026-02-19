import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Clock, 
  Copy, 
  CheckCircle2,
  ExternalLink,
  Zap,
  AlertCircle,
  Settings,
  Play
} from "lucide-react";
import { toast } from "sonner";

export default function CronSetup() {
  const [copiedItem, setCopiedItem] = useState(null);

  const copyToClipboard = (text, item) => {
    navigator.clipboard.writeText(text);
    setCopiedItem(item);
    toast.success('Copiado al portapapeles');
    setTimeout(() => setCopiedItem(null), 2000);
  };

  const cronConfigs = [
    {
      id: 'biloop',
      name: 'biloopAutoSync',
      description: 'Sincroniza facturas de Biloop cada hora',
      cron: '0 * * * *',
      frequency: 'Cada hora (a las :00)',
      color: 'from-green-500 to-emerald-600',
      icon: '🔄',
      example: '09:00, 10:00, 11:00...'
    },
    {
      id: 'revo',
      name: 'revoAutoSync',
      description: 'Sincroniza ventas de Revo cada hora',
      cron: '0 * * * *',
      frequency: 'Cada hora (a las :00)',
      color: 'from-cyan-500 to-blue-600',
      icon: '🍗',
      example: '09:00, 10:00, 11:00...'
    },
    {
      id: 'email',
      name: 'emailAutoProcessor',
      description: 'Procesa emails cada 30 minutos',
      cron: '*/30 * * * *',
      frequency: 'Cada 30 minutos',
      color: 'from-purple-500 to-pink-600',
      icon: '📧',
      example: '09:00, 09:30, 10:00, 10:30...'
    }
  ];

  return (
    <div className="p-4 md:p-8 min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-black">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white flex items-center gap-3 mb-2">
            <Clock className="w-10 h-10 text-yellow-400" />
            Configuración de CRON Jobs
          </h1>
          <p className="text-gray-400">
            Configura la ejecución automática de tus funciones - Solo 5 minutos
          </p>
        </div>

        {/* Step by Step Guide */}
        <Card className="border-none shadow-2xl mb-8 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
          <CardContent className="p-8">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center flex-shrink-0">
                <Settings className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold mb-4">📋 Guía Paso a Paso</h2>
                <div className="space-y-4">
                  <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center font-bold">
                        1
                      </div>
                      <p className="font-bold text-lg">Accede al Dashboard de Base44</p>
                    </div>
                    <p className="text-sm text-blue-100 ml-11">
                      Ve a: <a href="https://app.base44.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-white">app.base44.com</a>
                    </p>
                  </div>

                  <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center font-bold">
                        2
                      </div>
                      <p className="font-bold text-lg">Navega a la sección de Funciones</p>
                    </div>
                    <p className="text-sm text-blue-100 ml-11">
                      Dashboard → <strong>Functions</strong> → <strong>Schedule</strong>
                    </p>
                  </div>

                  <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center font-bold">
                        3
                      </div>
                      <p className="font-bold text-lg">Configura cada función (ver abajo)</p>
                    </div>
                    <p className="text-sm text-blue-100 ml-11">
                      Copia y pega los comandos CRON de las tarjetas de abajo
                    </p>
                  </div>

                  <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center font-bold">
                        4
                      </div>
                      <p className="font-bold text-lg">¡Listo! Todo automático</p>
                    </div>
                    <p className="text-sm text-blue-100 ml-11">
                      Las funciones se ejecutarán automáticamente según la programación
                    </p>
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-white/20">
                  <p className="text-sm text-blue-100 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    <strong>Importante:</strong> Después de configurar, vuelve a la página <strong>"⚡ AUTOMATIZACIÓN"</strong> para verificar que todo funciona
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* CRON Configurations */}
        <div className="space-y-6 mb-8">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Zap className="w-6 h-6 text-yellow-400" />
            Configuraciones CRON (Copia y Pega)
          </h2>

          {cronConfigs.map((config) => (
            <Card key={config.id} className="border-none shadow-2xl bg-slate-800 border border-gray-700 hover:border-cyan-500/50 transition-all">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-16 h-16 bg-gradient-to-br ${config.color} rounded-xl flex items-center justify-center text-3xl shadow-lg`}>
                      {config.icon}
                    </div>
                    <div>
                      <CardTitle className="text-white text-xl mb-1">
                        {config.name}
                      </CardTitle>
                      <p className="text-gray-400 text-sm">{config.description}</p>
                    </div>
                  </div>
                  <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30">
                    {config.frequency}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Function Name */}
                  <div className="bg-slate-900/50 rounded-lg p-4 border border-gray-700">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-gray-400 font-semibold uppercase">Function Name</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(config.name, `${config.id}-name`)}
                        className="h-6 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10"
                      >
                        {copiedItem === `${config.id}-name` ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </Button>
                    </div>
                    <code className="text-white font-mono text-sm">{config.name}</code>
                  </div>

                  {/* CRON Expression */}
                  <div className="bg-slate-900/50 rounded-lg p-4 border border-cyan-500/30">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-gray-400 font-semibold uppercase">CRON Expression</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(config.cron, `${config.id}-cron`)}
                        className="h-6 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10"
                      >
                        {copiedItem === `${config.id}-cron` ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </Button>
                    </div>
                    <code className="text-cyan-400 font-mono text-lg font-bold">{config.cron}</code>
                  </div>
                </div>

                {/* Example Times */}
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                  <p className="text-xs text-gray-400 mb-1">Ejemplo de Ejecución:</p>
                  <p className="text-green-400 text-sm font-medium">{config.example}</p>
                </div>

                {/* Quick Copy Both */}
                <Button
                  onClick={() => {
                    const fullConfig = `Function: ${config.name}\nCRON: ${config.cron}`;
                    copyToClipboard(fullConfig, `${config.id}-all`);
                  }}
                  className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700"
                >
                  {copiedItem === `${config.id}-all` ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      ¡Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-2" />
                      Copiar Todo
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* CRON Syntax Help */}
        <Card className="border-none shadow-2xl bg-slate-800 border border-gray-700 mb-8">
          <CardHeader>
            <CardTitle className="text-white">📚 Entender CRON (Opcional)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-gray-300">
                CRON usa 5 campos: <code className="bg-slate-900 px-2 py-1 rounded text-cyan-400">minuto hora día mes día_semana</code>
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-900/50 rounded-lg p-4 border border-gray-700">
                  <p className="text-cyan-400 font-mono mb-2">0 * * * *</p>
                  <p className="text-sm text-gray-400">
                    Cada hora (minuto 0)
                  </p>
                </div>

                <div className="bg-slate-900/50 rounded-lg p-4 border border-gray-700">
                  <p className="text-cyan-400 font-mono mb-2">*/30 * * * *</p>
                  <p className="text-sm text-gray-400">
                    Cada 30 minutos
                  </p>
                </div>

                <div className="bg-slate-900/50 rounded-lg p-4 border border-gray-700">
                  <p className="text-cyan-400 font-mono mb-2">0 9 * * *</p>
                  <p className="text-sm text-gray-400">
                    Todos los días a las 9:00
                  </p>
                </div>

                <div className="bg-slate-900/50 rounded-lg p-4 border border-gray-700">
                  <p className="text-cyan-400 font-mono mb-2">0 0 * * 0</p>
                  <p className="text-sm text-gray-400">
                    Cada domingo a medianoche
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Links */}
        <Card className="border-none shadow-2xl bg-gradient-to-r from-green-600 to-emerald-700 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg mb-2">✅ ¿Ya configuraste CRON?</h3>
                <p className="text-sm text-green-100">
                  Prueba las funciones manualmente para verificar que todo funciona
                </p>
              </div>
              <Button
                onClick={() => window.location.href = '/AutomationHub'}
                className="bg-white text-green-700 hover:bg-gray-100 shadow-lg"
              >
                <Play className="w-4 h-4 mr-2" />
                Ir a Automatización
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Need Help */}
        <Card className="border-none shadow-2xl bg-slate-800 border border-gray-700 mt-8">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-yellow-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-6 h-6 text-yellow-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-lg text-white mb-2">¿Necesitas Ayuda?</h3>
                <div className="space-y-2 text-gray-300 text-sm">
                  <p>
                    <strong>No encuentras la opción Schedule:</strong> Contacta con soporte de Base44 en{' '}
                    <a href="mailto:support@base44.com" className="text-cyan-400 underline">support@base44.com</a>
                  </p>
                  <p>
                    <strong>Las funciones no se ejecutan:</strong> Verifica en Dashboard → Functions → Logs
                  </p>
                  <p>
                    <strong>Errores en las funciones:</strong> Ve a "⚡ AUTOMATIZACIÓN" y prueba manualmente primero
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