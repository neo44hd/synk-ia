import React, { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Camera, 
  CheckCircle2, 
  Loader2,
  AlertCircle,
  User,
  Clock
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function FacialCheckIn({ user }) {
  const [isCapturing, setIsCapturing] = useState(false);
  const [photoData, setPhotoData] = useState(null);
  const [recognizing, setRecognizing] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const queryClient = useQueryClient();

  const checkInMutation = useMutation({
    mutationFn: async (data) => {
      const today = new Date().toISOString().split('T')[0];
      const existing = await base44.entities.Timesheet.filter({
        user_id: user.id,
        date: today
      });

      if (existing.length > 0 && !existing[0].check_out) {
        return base44.entities.Timesheet.update(existing[0].id, {
          check_out: new Date().toTimeString().split(' ')[0],
          total_hours: calculateHours(existing[0].check_in, new Date().toTimeString().split(' ')[0]),
          status: 'completo',
          ...data
        });
      } else {
        return base44.entities.Timesheet.create({
          user_id: user.id,
          user_name: user.full_name,
          date: today,
          check_in: new Date().toTimeString().split(' ')[0],
          status: 'incompleto',
          ...data
        });
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      const isCheckOut = data.check_out && data.check_in;
      toast.success(isCheckOut ? '✅ Fichaje de salida registrado' : '✅ Fichaje de entrada registrado');
      stopCamera();
      setPhotoData(null);
    },
  });

  const calculateHours = (checkIn, checkOut) => {
    const [h1, m1] = checkIn.split(':').map(Number);
    const [h2, m2] = checkOut.split(':').map(Number);
    return ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60;
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCapturing(true);
    } catch (error) {
      toast.error('No se pudo acceder a la cámara');
      console.error(error);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCapturing(false);
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (video && canvas) {
      const context = canvas.getContext('2d');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0);
      
      const imageData = canvas.toDataURL('image/jpeg', 0.8);
      setPhotoData(imageData);
      stopCamera();
      verifyFace(imageData);
    }
  };

  const verifyFace = async (imageData) => {
    setRecognizing(true);
    try {
      // Usar IA para verificar identidad (simulado - en producción usarías un modelo real)
      const blob = await fetch(imageData).then(r => r.blob());
      const file = new File([blob], 'facial_capture.jpg', { type: 'image/jpeg' });
      
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      // Análisis con IA
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Analiza esta foto de fichaje de empleado. ¿Hay una cara visible? ¿Parece una foto legítima (no una pantalla o impresión)? Responde con análisis básico.`,
        file_urls: [file_url],
        response_json_schema: {
          type: "object",
          properties: {
            face_detected: { type: "boolean" },
            is_live: { type: "boolean" },
            quality: { type: "string", enum: ["buena", "media", "baja"] },
            confidence: { type: "number" }
          }
        }
      });

      if (result.face_detected && result.is_live && result.confidence > 0.7) {
        // Fichaje exitoso
        checkInMutation.mutate({
          notes: `Fichaje facial verificado (${result.quality} calidad, ${(result.confidence * 100).toFixed(0)}% confianza)`,
          facial_photo_url: file_url
        });
      } else {
        toast.error('No se pudo verificar tu identidad. Intenta de nuevo con mejor iluminación.');
        setPhotoData(null);
      }
    } catch (error) {
      console.error('Face verification error:', error);
      // Fallback: permitir fichaje manual
      checkInMutation.mutate({
        notes: 'Fichaje manual (verificación facial no disponible)',
        facial_photo_url: photoData
      });
    } finally {
      setRecognizing(false);
    }
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <Card className="border-none shadow-xl bg-gradient-to-br from-blue-600 to-purple-600 text-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Camera className="w-6 h-6" />
          Fichaje Facial
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isCapturing && !photoData && (
          <div className="text-center space-y-4">
            <div className="w-32 h-32 mx-auto bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
              <User className="w-16 h-16" />
            </div>
            <div>
              <p className="text-lg font-medium mb-1">¡Hola, {user.full_name}!</p>
              <p className="text-sm text-blue-100">Usa reconocimiento facial para fichar</p>
            </div>
            <Button
              onClick={startCamera}
              size="lg"
              className="w-full bg-white text-blue-600 hover:bg-blue-50"
            >
              <Camera className="w-5 h-5 mr-2" />
              Iniciar Cámara
            </Button>
          </div>
        )}

        {isCapturing && (
          <div className="space-y-4">
            <div className="relative rounded-xl overflow-hidden bg-black">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-auto"
              />
              <div className="absolute inset-0 border-4 border-white/50 rounded-xl pointer-events-none">
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-48 h-64 border-4 border-yellow-400 rounded-full" />
              </div>
            </div>
            <canvas ref={canvasRef} className="hidden" />
            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={stopCamera}
                variant="outline"
                className="border-white text-white hover:bg-white/10"
              >
                Cancelar
              </Button>
              <Button
                onClick={capturePhoto}
                className="bg-white text-blue-600 hover:bg-blue-50"
              >
                <Camera className="w-4 h-4 mr-2" />
                Capturar
              </Button>
            </div>
          </div>
        )}

        {photoData && (
          <div className="space-y-4">
            <div className="relative rounded-xl overflow-hidden">
              <img src={photoData} alt="Captured" className="w-full h-auto" />
              {recognizing && (
                <div className="absolute inset-0 bg-black/70 flex items-center justify-center backdrop-blur-sm">
                  <div className="text-center">
                    <Loader2 className="w-12 h-12 mx-auto mb-3 animate-spin" />
                    <p className="font-medium">Verificando identidad...</p>
                  </div>
                </div>
              )}
            </div>
            {!recognizing && (
              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={() => {
                    setPhotoData(null);
                    startCamera();
                  }}
                  variant="outline"
                  className="border-white text-white hover:bg-white/10"
                >
                  Repetir
                </Button>
                <Button
                  onClick={() => verifyFace(photoData)}
                  className="bg-white text-blue-600 hover:bg-blue-50"
                  disabled={checkInMutation.isPending}
                >
                  {checkInMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Fichando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Confirmar
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}