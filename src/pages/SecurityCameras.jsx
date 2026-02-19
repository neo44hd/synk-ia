import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Camera, 
  Smartphone,
  Monitor,
  Copy,
  ExternalLink,
  Wifi,
  CheckCircle2,
  AlertTriangle,
  Play,
  RefreshCw,
  Maximize2,
  Grid3X3
} from "lucide-react";
import { toast } from "sonner";

export default function SecurityCameras() {
  const NVR_URL = "http://192.168.1.41";
  const [viewMode, setViewMode] = useState('grid'); // grid, single
  const [selectedCam, setSelectedCam] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  
  const nvrInfo = {
    name: "W-NVR",
    model: "NV-KIT830W-4CAM",
    ip: "192.168.1.41",
    user: "admin1245",
    password: "344472055",
    cameras: 4,
    version: "3.2.4.9M"
  };

  // Cámaras con sus streams RTSP
  const cameras = [
    { id: 1, name: "Entrada Principal", location: "Puerta", status: "online" },
    { id: 2, name: "Cocina", location: "Interior", status: "online" },
    { id: 3, name: "Mostrador", location: "Caja", status: "online" },
    { id: 4, name: "Almacén", location: "Trasero", status: "online" }
  ];

  const refreshCameras = () => {
    setRefreshKey(Date.now());
    toast.success('Actualizando cámaras...');
  };

  // Abrir NVR en nueva ventana (evita bloqueo mixed content)
  const openNvrPanel = () => {
    window.open(NVR_URL, '_blank', 'width=1280,height=720');
  };

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    toast.success(`✅ ${label} copiado`);
  };

  return (
    <div className="p-4 md:p-6 min-h-screen bg-gradient-to-br from-zinc-950 via-neutral-900 to-zinc-950">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-red-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-2xl">
              <Camera className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-white">CÁMARAS DE SEGURIDAD</h1>
              <p className="text-gray-400">NVR {nvrInfo.model} - {nvrInfo.cameras} cámaras</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Button onClick={refreshCameras} variant="outline" className="border-gray-600 text-gray-300">
              <RefreshCw className="w-4 h-4 mr-2" /> Actualizar
            </Button>
            <Badge className="bg-green-600 text-white px-4 py-2">
              <CheckCircle2 className="w-4 h-4 mr-2" />
              NVR Conectado
            </Badge>
          </div>
        </div>

        {/* Vista de Cámaras en Vivo */}
        <Card className="bg-zinc-800/50 border-zinc-800 mb-6">
          <CardHeader className="bg-gradient-to-r from-red-900/50 to-orange-900/50 border-b border-zinc-800">
            <div className="flex items-center justify-between">
              <CardTitle className="text-white flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                Vista en Vivo
              </CardTitle>
              <Button 
                onClick={openNvrPanel}
                className="bg-red-600 hover:bg-red-700"
              >
                <Maximize2 className="w-4 h-4 mr-2" />
                Abrir Panel NVR
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            {/* Grid de cámaras - Vista previa */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              {cameras.map((cam) => (
                <div 
                  key={cam.id} 
                  className="relative bg-gradient-to-br from-zinc-900 to-zinc-800 rounded-xl overflow-hidden border-2 border-zinc-700 hover:border-red-500 transition-all cursor-pointer aspect-video"
                  onClick={openNvrPanel}
                >
                  {/* Placeholder visual */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <Camera className="w-12 h-12 text-zinc-600 mb-2" />
                    <p className="text-zinc-400 text-sm font-medium">{cam.name}</p>
                    <p className="text-zinc-500 text-xs">{cam.location}</p>
                  </div>
                  
                  {/* Overlay info */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                        <span className="text-green-400 text-xs">ONLINE</span>
                      </div>
                      <Badge className="bg-red-600/80 text-white text-xs">CAM {cam.id}</Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Botón principal para abrir NVR */}
            <div className="bg-gradient-to-r from-red-900/30 to-orange-900/30 border border-red-700/50 rounded-xl p-6 text-center mt-4">
              <Camera className="w-16 h-16 text-red-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">Ver Cámaras en Directo</h3>
              <p className="text-gray-400 text-sm mb-4">
                Haz clic para abrir el panel del NVR en una nueva ventana.<br/>
                <span className="text-yellow-400">Requiere estar conectado a la red local (192.168.1.x)</span>
              </p>
              <Button 
                onClick={openNvrPanel}
                size="lg"
                className="bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700"
              >
                <ExternalLink className="w-5 h-5 mr-2" />
                Abrir Panel Web del NVR
              </Button>
            </div>
            
            {/* Nota importante */}
            <div className="mt-4 bg-blue-900/30 border border-blue-700/50 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <Smartphone className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-blue-200 font-semibold text-sm">📱 Acceso Remoto</p>
                  <p className="text-blue-100/70 text-xs mt-1">
                    Para ver las cámaras desde cualquier lugar (fuera de la red local), 
                    usa la <strong>app ESEECLOUD</strong> en tu móvil. Los datos de acceso están más abajo.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* App ESEECLOUD - Principal */}
        <Card className="bg-gradient-to-br from-blue-600 to-blue-800 border-none shadow-2xl mb-6">
          <CardContent className="p-8">
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="w-24 h-24 bg-white rounded-3xl flex items-center justify-center shadow-xl">
                <Smartphone className="w-14 h-14 text-blue-600" />
              </div>
              <div className="flex-1 text-center md:text-left">
                <h2 className="text-3xl font-black text-white mb-2">📱 App ESEECLOUD</h2>
                <p className="text-blue-100 text-lg mb-4">
                  Usa la app en tu móvil para ver las cámaras en directo desde cualquier lugar
                </p>
                <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                  <a 
                    href="https://apps.apple.com/app/eseecloud/id1043816786" 
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-6 py-3 bg-black text-white rounded-xl font-bold flex items-center gap-2 hover:bg-gray-900 transition-colors"
                  >
                    🍎 App Store
                  </a>
                  <a 
                    href="https://play.google.com/store/apps/details?id=com.p2pcamera.eseecloud" 
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-6 py-3 bg-green-600 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-green-700 transition-colors"
                  >
                    <Play className="w-5 h-5" /> Google Play
                  </a>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Credenciales para la App */}
        <Card className="bg-slate-800 border-slate-700 mb-6">
          <CardHeader className="bg-gradient-to-r from-slate-700 to-slate-800 border-b border-slate-700">
            <CardTitle className="text-white">🔐 Datos para añadir el NVR en la App</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Usuario */}
              <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-700">
                <p className="text-gray-400 text-sm mb-1">Usuario</p>
                <div className="flex items-center justify-between">
                  <p className="text-2xl font-mono font-bold text-green-400">{nvrInfo.user}</p>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="text-gray-400 hover:text-white"
                    onClick={() => copyToClipboard(nvrInfo.user, 'Usuario')}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              
              {/* Contraseña */}
              <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-700">
                <p className="text-gray-400 text-sm mb-1">Contraseña</p>
                <div className="flex items-center justify-between">
                  <p className="text-2xl font-mono font-bold text-yellow-400">{nvrInfo.password}</p>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="text-gray-400 hover:text-white"
                    onClick={() => copyToClipboard(nvrInfo.password, 'Contraseña')}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Instrucciones */}
            <div className="mt-6 bg-blue-900/30 border border-blue-700 rounded-xl p-4">
              <h4 className="text-blue-300 font-bold mb-3">📋 Cómo añadir el NVR en ESEECLOUD:</h4>
              <ol className="text-blue-100 space-y-2 text-sm">
                <li><span className="font-bold text-white">1.</span> Abre la app ESEECLOUD</li>
                <li><span className="font-bold text-white">2.</span> Pulsa <strong>"+"</strong> para añadir dispositivo</li>
                <li><span className="font-bold text-white">3.</span> Selecciona <strong>"Añadir por IP/Dominio"</strong> (red local)</li>
                <li><span className="font-bold text-white">4.</span> IP: <strong className="text-cyan-300">{nvrInfo.ip}</strong></li>
                <li><span className="font-bold text-white">5.</span> Usuario: <strong className="text-green-300">{nvrInfo.user}</strong></li>
                <li><span className="font-bold text-white">6.</span> Contraseña: <strong className="text-yellow-300">{nvrInfo.password}</strong></li>
                <li><span className="font-bold text-white">7.</span> ¡Listo! Verás las 4 cámaras en directo</li>
              </ol>
            </div>
          </CardContent>
        </Card>

        {/* Info del NVR */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="bg-zinc-800/50 border-zinc-800">
            <CardContent className="p-4 text-center">
              <Monitor className="w-8 h-8 text-blue-400 mx-auto mb-2" />
              <p className="text-gray-400 text-xs">Modelo</p>
              <p className="text-white font-bold text-sm">{nvrInfo.model}</p>
            </CardContent>
          </Card>
          
          <Card className="bg-zinc-800/50 border-zinc-800">
            <CardContent className="p-4 text-center">
              <Camera className="w-8 h-8 text-green-400 mx-auto mb-2" />
              <p className="text-gray-400 text-xs">Cámaras</p>
              <p className="text-white font-bold text-sm">{nvrInfo.cameras} activas</p>
            </CardContent>
          </Card>
          
          <Card className="bg-zinc-800/50 border-zinc-800">
            <CardContent className="p-4 text-center">
              <Wifi className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
              <p className="text-gray-400 text-xs">IP Local</p>
              <p className="text-white font-bold text-sm">{nvrInfo.ip}</p>
            </CardContent>
          </Card>
          
          <Card className="bg-zinc-800/50 border-zinc-800">
            <CardContent className="p-4 text-center">
              <Monitor className="w-8 h-8 text-purple-400 mx-auto mb-2" />
              <p className="text-gray-400 text-xs">Versión</p>
              <p className="text-white font-bold text-sm">{nvrInfo.version}</p>
            </CardContent>
          </Card>
        </div>

        {/* Acceso Web Local */}
        <Card className="bg-zinc-800/50 border-zinc-800">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <AlertTriangle className="w-6 h-6 text-yellow-400 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h3 className="text-white font-bold mb-2">Acceso Web (solo configuración)</h3>
                <p className="text-gray-400 text-sm mb-4">
                  El panel web del NVR sirve para configuración. Para ver vídeo en directo, usa la app ESEECLOUD.
                </p>
                <Button 
                  variant="outline"
                  className="border-gray-600 text-gray-300 hover:bg-gray-700"
                  onClick={() => window.open(NVR_URL, '_blank')}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Abrir Panel NVR (red local)
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}