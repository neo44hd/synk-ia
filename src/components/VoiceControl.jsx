import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Mic, 
  MicOff, 
  Volume2,
  Loader2,
  Zap,
  CheckCircle2
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function VoiceControl() {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [recognition, setRecognition] = useState(null);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Load user
    const loadUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        console.error('Error loading user:', error);
      }
    };
    loadUser();

    // Initialize Web Speech API
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognitionInstance = new SpeechRecognition();
      
      recognitionInstance.continuous = false;
      recognitionInstance.interimResults = false;
      recognitionInstance.lang = 'es-ES';

      recognitionInstance.onresult = (event) => {
        const text = event.results[0][0].transcript;
        setTranscript(text);
        handleVoiceCommand(text);
      };

      recognitionInstance.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        toast.error('Error al escuchar. Intenta de nuevo.');
      };

      recognitionInstance.onend = () => {
        setIsListening(false);
      };

      setRecognition(recognitionInstance);
    }
  }, []);

  const startListening = () => {
    if (recognition) {
      setIsListening(true);
      setTranscript('');
      recognition.start();
      toast.info('🎤 Escuchando...', { duration: 2000 });
    } else {
      toast.error('Tu navegador no soporta reconocimiento de voz');
    }
  };

  const stopListening = () => {
    if (recognition) {
      recognition.stop();
      setIsListening(false);
    }
  };

  const handleVoiceCommand = async (command) => {
    setIsProcessing(true);
    
    try {
      // Usar IA para interpretar el comando
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `
Eres el asistente de voz de SYNK-IA. Interpreta este comando y responde en JSON:

Comando del usuario: "${command}"

Identifica:
1. La ACCIÓN principal (crear_factura, crear_albaran, ver_proveedores, buscar, navegar, consultar_gastos)
2. Los DATOS extraídos (proveedor, cliente, productos, cantidades, precios)
3. La PÁGINA a la que navegar (si aplica)

Si es crear factura/albarán:
- Extrae proveedor/cliente
- Extrae productos con cantidades y precios
- Calcula totales

Si es navegación:
- Identifica la página destino

Responde siempre en español.
        `,
        response_json_schema: {
          type: "object",
          properties: {
            action: { 
              type: "string",
              enum: ["crear_factura", "crear_albaran", "navegar", "buscar", "consultar", "error"]
            },
            page: { type: "string" },
            data: {
              type: "object",
              properties: {
                proveedor: { type: "string" },
                cliente: { type: "string" },
                items: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      descripcion: { type: "string" },
                      cantidad: { type: "number" },
                      precio: { type: "number" }
                    }
                  }
                },
                total: { type: "number" }
              }
            },
            response_text: { type: "string" }
          }
        }
      });

      // Ejecutar la acción
      await executeAction(result);
      
      // Feedback de voz (opcional, usando Web Speech API)
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(result.response_text);
        utterance.lang = 'es-ES';
        utterance.rate = 1.1;
        window.speechSynthesis.speak(utterance);
      }

      toast.success(result.response_text);

    } catch (error) {
      console.error('Error processing voice command:', error);
      toast.error('No pude procesar el comando');
    } finally {
      setIsProcessing(false);
    }
  };

  const executeAction = async (actionData) => {
    const { action, page, data } = actionData;

    switch (action) {
      case 'crear_factura':
        if (data.proveedor && data.items) {
          // Navegar a página de facturas con datos pre-cargados
          navigate(createPageUrl('Invoices'), { 
            state: { voiceData: data }
          });
        }
        break;

      case 'crear_albaran':
        if (data.items) {
          // Navegar a página de albaranes con datos
          navigate(createPageUrl('Albaranes'), {
            state: { voiceData: data }
          });
        }
        break;

      case 'navegar':
        if (page) {
          const pageMap = {
            'dashboard': 'Dashboard',
            'facturas': 'Invoices',
            'albaranes': 'Albaranes',
            'proveedores': 'Providers',
            'comparador': 'Comparator',
            'revo': 'RevoDashboard',
            'nominas': 'Payrolls',
            'vacaciones': 'VacationRequests',
            'comandos de voz': 'VoiceCommands'
          };
          const targetPage = pageMap[page.toLowerCase()] || 'Dashboard';
          navigate(createPageUrl(targetPage));
        }
        break;

      case 'consultar':
        // Navegar al dashboard o página relevante
        navigate(createPageUrl('Dashboard'));
        break;

      default:
        break;
    }
  };

  if (!recognition) {
    return null; // No mostrar si no hay soporte
  }

  return (
    <div className="fixed bottom-8 right-8 z-50">
      <div className="relative">
        {/* Rings de animación cuando está escuchando */}
        {isListening && (
          <>
            <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-75"></div>
            <div className="absolute inset-2 bg-red-400 rounded-full animate-ping opacity-50" style={{ animationDelay: '0.5s' }}></div>
          </>
        )}
        
        {/* Botón principal */}
        <Button
          onClick={isListening ? stopListening : startListening}
          disabled={isProcessing}
          className={`relative w-20 h-20 rounded-full shadow-2xl transition-all duration-300 ${
            isListening 
              ? 'bg-red-600 hover:bg-red-700 scale-110' 
              : isProcessing
              ? 'bg-purple-600'
              : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700'
          }`}
          style={{
            boxShadow: isListening 
              ? '0 0 40px rgba(239, 68, 68, 0.6)' 
              : '0 0 30px rgba(6, 182, 212, 0.4)'
          }}
        >
          {isProcessing ? (
            <Loader2 className="w-10 h-10 text-white animate-spin" />
          ) : isListening ? (
            <>
              <Volume2 className="w-10 h-10 text-white animate-pulse" />
            </>
          ) : (
            <Mic className="w-10 h-10 text-white" />
          )}
        </Button>

        {/* Badge de estado */}
        {(isListening || isProcessing) && (
          <Badge 
            className="absolute -top-3 -right-3 bg-white text-gray-900 shadow-lg animate-bounce"
          >
            {isListening ? (
              <>
                <Mic className="w-3 h-3 mr-1" />
                Escuchando
              </>
            ) : (
              <>
                <Zap className="w-3 h-3 mr-1 animate-spin" />
                Procesando
              </>
            )}
          </Badge>
        )}

        {/* Transcript display */}
        {transcript && (
          <div className="absolute bottom-24 right-0 bg-white rounded-xl shadow-2xl p-4 max-w-sm border-2 border-cyan-500">
            <p className="text-sm text-gray-600 mb-1">Comando detectado:</p>
            <p className="text-sm font-medium text-gray-900">{transcript}</p>
          </div>
        )}
      </div>
    </div>
  );
}