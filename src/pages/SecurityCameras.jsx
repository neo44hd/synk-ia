import React, { useState, useEffect, useRef } from \"react\";
import { Card, CardContent, CardHeader, CardTitle } from \"@/components/ui/card\";
import { Button } from \"@/components/ui/button\";
import { Badge } from \"@/components/ui/badge\";
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
} from \"lucide-react\";
import { toast } from \"sonner\";
import Hls from \"hls.js\";

// Componente para el feed individual de la cámara
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
      // Para Safari nativo
      videoRef.current.src = streamUrl;
    }

    return () => {
      if (hls) hls.destroy();
    };
  }, [streamUrl]);

  return (
    <div className=\"relative w-full h-full bg-black\">
      <video
        ref={videoRef}
        className=\"w-full h-full object-cover\"
        autoPlay
        muted
        playsInline
      />
    </div>
  );
};

export default function SecurityCameras() {
  const [refreshKey, setRefreshKey] = useState(0);
  
  // Configuración del NVR
  const nvrInfo = {
    name: \"W-NVR\",
    model: \"NV-KIT830W-4CAM\",
    ip: \"192.168.1.41\",
    user: \"admin1245\",
    password: \"344472055\",
    cameras: 4,
    version: \"3.2.4.9M\"
  };

  // Definición de cámaras y sus rutas HLS (proxificadas por el servidor Oracle)
  // Las rutas apuntan al endpoint /streams/ que configuraremos en Nginx
  const cameras = [
    { id: 1, name: \"Entrada Principal\", location: \"Puerta\", path: \"cam1\" },
    { id: 2, name: \"Cocina\", location: \"Interior\", path: \"cam2\" },
    { id: 3, name: \"Mostrador\", location: \"Caja\", path: \"cam3\" },
    { id: 4, name: \"Almacén\", location: \"Trasero\", path: \"cam4\" }
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
    toast.success(`✅ ${label} copiado`);
  };

  return (
    <div className=\"p-4 md:p-6 min-h-screen bg-gradient-to-br from-zinc-950 via-neutral-900 to-zinc-950\">
      <div className=\"max-w-5xl mx-auto\">
        {/* Header */}
        <div className=\"flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6\">
          <div className=\"flex items-center gap-4\">
            <div className=\"w-14 h-14 bg-gradient-to-br from-red-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-2xl\">
              <Camera className=\"w-8 h-8 text-white\" />
            </div>
            <div>
              <h1 className=\"text-3xl font-black text-white uppercase\">Cámaras de Seguridad</h1>
              <p className=\"text-gray-400\">NVR {nvrInfo.model} - {nvrInfo.cameras} cámaras activas</p>
            </div>
          </div>
          
          <div className=\"flex items-center gap-3\">
            <Button onClick={refreshCameras} variant=\"outline\" className=\"border-gray-600 text-gray-300\">
              <RefreshCw className=\"w-4 h-4 mr-2\" /> Actualizar
            </Button>
            <Badge className=\"bg-green-600 text-white px-4 py-2\">
              <CheckCircle2 className=\"w-4 h-4 mr-2\" />
              Sistema Online
            </Badge>
          </div>
        </div>

        {/* Grid de Cámaras en Vivo */}
        <Card className=\"bg-zinc-800/50 border-zinc-800 mb-6\">
          <CardHeader className=\"bg-gradient-to-r from-red-900/50 to-orange-900/50 border-b border-zinc-800\">
            <div className=\"flex items-center justify-between\">
              <CardTitle className=\"text-white flex items-center gap-2\">
                <div className=\"w-3 h-3 bg-red-500 rounded-full animate-pulse\" />
                Vista en Vivo (Baja Latencia)
              </CardTitle>
              <Button onClick={openNvrPanel} className=\"bg-red-600 hover:bg-red-700\">
                <Maximize2 className=\"w-4 h-4 mr-2\" /> Abrir Panel NVR
              </Button>
            </div>
          </CardHeader>
          <CardContent className=\"p-4\">
            <div className=\"grid grid-cols-1 md:grid-cols-2 gap-4\">
              {cameras.map((cam) => (
                <div key={`${cam.id}-${refreshKey}`} className=\"group relative bg-black rounded-xl overflow-hidden border-2 border-zinc-700 hover:border-red-500 transition-all aspect-video\">
                  {/* Stream de Vídeo Real */}
                  <CameraStream 
                    camId={cam.id} 
                    streamUrl={`/streams/${cam.path}/index.m3u8`} 
                  />
                  
                  {/* Overlay con Info */}
                  <div className=\"absolute top-0 left-0 right-0 p-3 bg-gradient-to-b from-black/80 to-transparent\">
                    <div className=\"flex items-center justify-between\">
                      <span className=\"text-white font-bold text-sm shadow-black\">{cam.name}</span>
                      <Badge className=\"bg-red-600/90 text-white text-[10px]\">LIVE</Badge>
                    </div>
                  </div>

                  <div className=\"absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent\">
                    <span className=\"text-zinc-400 text-xs\">{cam.location}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ESEECLOUD & Credenciales */}
        <div className=\"grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6\">
          <Card className=\"lg:col-span-2 bg-gradient-to-br from-blue-600 to-blue-800 border-none shadow-xl\">
            <CardContent className=\"p-6\">
              <div className=\"flex items-center gap-6\">
                <div className=\"w-20 h-20 bg-white rounded-2xl flex items-center justify-center flex-shrink-0\">
                  <Smartphone className=\"w-12 h-12 text-blue-600\" />
                </div>
                <div>
                  <h2 className=\"text-2xl font-black text-white mb-1\">App ESEECLOUD</h2>
                  <p className=\"text-blue-100 text-sm mb-4\">Acceso remoto total desde tu smartphone</p>
                  <div className=\"flex gap-2\">
                    <Button size=\"sm\" className=\"bg-black text-white hover:bg-zinc-900\" onClick={() => window.open('https://apps.apple.com/app/eseecloud/id1043816786')}>iOS</Button>
                    <Button size=\"sm\" className=\"bg-green-600 text-white hover:bg-green-700\" onClick={() => window.open('https://play.google.com/store/apps/details?id=com.p2pcamera.eseecloud')}>Android</Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className=\"bg-zinc-900 border-zinc-800\">
            <CardContent className=\"p-6\">
              <div className=\"space-y-4\">
                <div>
                  <p className=\"text-zinc-500 text-xs uppercase mb-1\">Usuario App</p>
                  <div className=\"flex items-center justify-between bg-zinc-950 p-2 rounded border border-zinc-800\">
                    <code className=\"text-green-400 font-bold\">{nvrInfo.user}</code>
                    <Button variant=\"ghost\" size=\"sm\" onClick={() => copyToClipboard(nvrInfo.user, 'Usuario')}><Copy className=\"w-3 h-3 text-zinc-500\"/></Button>
                  </div>
                </div>
                <div>
                  <p className=\"text-zinc-500 text-xs uppercase mb-1\">Password</p>
                  <div className=\"flex items-center justify-between bg-zinc-950 p-2 rounded border border-zinc-800\">
                    <code className=\"text-yellow-400 font-bold\">{nvrInfo.password}</code>
                    <Button variant=\"ghost\" size=\"sm\" onClick={() => copyToClipboard(nvrInfo.password, 'Password')}><Copy className=\"w-3 h-3 text-zinc-500\"/></Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Footer info */}
        <div className=\"text-center text-zinc-600 text-[10px] uppercase tracking-widest pb-8\">
          SYNK-IA SECURITY MODULE • NVR IP: {nvrInfo.ip} • VER: {nvrInfo.version}
        </div>
      </div>
    </div>
  );
}
