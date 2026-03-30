import React, { useState, useEffect, useRef } from "react";
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
import Hls from "hls.js";

// Componente para el feed individual de la camara
const CameraStream = ({ camId, streamUrl }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    let hls;
    if (Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 0
      });
      hls.loadSource(streamUrl);
      hls.attachMedia(videoRef.current);
      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
              break;
          }
        }
      });
    } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
      videoRef.current.src = streamUrl;
    }
    return () => {
      if (hls) hls.destroy();
    };
  }, [streamUrl]);

  return (
    <video
      ref={videoRef}
      autoPlay
      muted
      playsInline
      className="w-full h-full object-cover rounded-lg bg-black"
    />
  );
};

export default function SecurityCameras() {
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

  const cameras = [
    { id: 1, name: "Entrada Principal", location: "Puerta", path: "cam1" },
    { id: 2, name: "Cocina", location: "Interior", path: "cam2" },
    { id: 3, name: "Mostrador", location: "Caja", path: "cam3" },
    { id: 4, name: "Almacen", location: "Trasero", path: "cam4" }
  ];

  const refreshCameras = () => {
    setRefreshKey(Date.now());
    toast.success('Reiniciando streams...');
  };

  const openNvrPanel = () => {
    window.open(`http://${nvrInfo.ip}`, '_blank', 'width=1280,height=720');
  };

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado`);
  };

  return (
    <div className="space-y-6 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Camaras de Seguridad</h1>
          <p className="text-zinc-400 text-sm">NVR {nvrInfo.model} - {nvrInfo.cameras} camaras activas</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={refreshCameras} variant="outline" className="border-zinc-700">
            <RefreshCw className="w-4 h-4 mr-2" /> Actualizar
          </Button>
          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
            <Wifi className="w-3 h-3 mr-1" /> Sistema Online
          </Badge>
        </div>
      </div>

      {/* Grid de Camaras en Vivo */}
      <Card className="bg-zinc-950 border-zinc-800">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <Grid3X3 className="w-5 h-5 text-cyan-400" />
            Vista en Vivo (Baja Latencia)
          </CardTitle>
          <Button onClick={openNvrPanel} variant="outline" size="sm" className="border-zinc-700">
            <ExternalLink className="w-4 h-4 mr-2" /> Abrir Panel NVR
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {cameras.map((cam) => (
              <div key={`${cam.id}-${refreshKey}`} className="relative aspect-video bg-black rounded-lg overflow-hidden border border-zinc-800">
                <CameraStream camId={cam.id} streamUrl={`/streams/${cam.path}/index.m3u8`} />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-white text-sm font-medium">{cam.name}</span>
                    <Badge className="bg-red-500/80 text-white text-xs">LIVE</Badge>
                  </div>
                  <span className="text-zinc-400 text-xs">{cam.location}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ESEECLOUD & Credenciales */}
      <Card className="bg-zinc-950 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white">App ESEECLOUD</CardTitle>
          <p className="text-zinc-400 text-sm">Acceso remoto total desde tu smartphone</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button onClick={() => window.open('https://apps.apple.com/app/eseecloud/id1043816786')} variant="outline" className="border-zinc-700">
              <Smartphone className="w-4 h-4 mr-2" /> iOS
            </Button>
            <Button onClick={() => window.open('https://play.google.com/store/apps/details?id=com.p2pcamera.eseecloud')} variant="outline" className="border-zinc-700">
              <Monitor className="w-4 h-4 mr-2" /> Android
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-zinc-900 rounded-lg p-3">
              <p className="text-zinc-500 text-xs mb-1">Usuario App</p>
              <div className="flex items-center justify-between">
                <code className="text-cyan-400">{nvrInfo.user}</code>
                <Button onClick={() => copyToClipboard(nvrInfo.user, 'Usuario')} variant="ghost" size="sm">
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
            </div>
            <div className="bg-zinc-900 rounded-lg p-3">
              <p className="text-zinc-500 text-xs mb-1">Password</p>
              <div className="flex items-center justify-between">
                <code className="text-cyan-400">{nvrInfo.password}</code>
                <Button onClick={() => copyToClipboard(nvrInfo.password, 'Password')} variant="ghost" size="sm">
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Footer info */}
      <div className="text-center text-zinc-600 text-xs">
        SYNK-IA SECURITY MODULE &bull; NVR IP: {nvrInfo.ip} &bull; VER: {nvrInfo.version}
      </div>
    </div>
  );
}
