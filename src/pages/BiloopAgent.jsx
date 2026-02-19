
import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Bot, 
  Send, 
  Upload, 
  Loader2,
  MessageSquare,
  Sparkles,
  FileText,
  CheckCircle2,
  ExternalLink,
  TrendingUp,
  DollarSign
} from "lucide-react";
import { toast } from "sonner";
import MessageBubble from "../components/agents/MessageBubble";
import { BiloopAgentService } from "@/services/agents/biloopAgentService";

export default function BiloopAgent() {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    initConversation();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const initConversation = async () => {
    try {
      const newConversation = await base44.agents.createConversation({
        agent_name: "biloop_assistant",
        metadata: {
          name: "Chat con SYNK-IA",
          description: "Asistente de Biloop"
        }
      });
      setConversation(newConversation);
      setMessages(newConversation.messages || []);

      // Suscribirse a actualizaciones
      base44.agents.subscribeToConversation(newConversation.id, (data) => {
        setMessages(data.messages || []);
      });
    } catch (error) {
      console.error('Error creating conversation:', error);
      toast.error('Error al iniciar el chat');
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !conversation || isLoading) return;

    const userMessage = inputMessage;
    setInputMessage('');
    setIsLoading(true);

    try {
      // Enriquecer mensaje con contexto de facturas
      const enriched = await BiloopAgentService.enrichMessageWithContext(userMessage);
      
      let messageContent = userMessage;
      if (enriched.enriched && enriched.context) {
        messageContent = `${userMessage}\n\n[Contexto de Facturas]\n${JSON.stringify(enriched.context, null, 2)}`;
      }

      await base44.agents.addMessage(conversation, {
        role: "user",
        content: messageContent
      });
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Error al enviar mensaje');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !conversation) return;

    // Validar tipo de archivo
    const validTypes = ['.csv', '.xlsx', '.xls', '.pdf', '.zip', '.jpg', '.jpeg', '.png'];
    const fileExt = '.' + file.name.split('.').pop().toLowerCase();
    if (!validTypes.includes(fileExt)) {
      toast.error('Tipo de archivo no válido. Use CSV, Excel, PDF, imágenes o ZIP');
      return;
    }

    // Validar tamaño (máx 20MB)
    if (file.size > 20 * 1024 * 1024) {
      toast.error('El archivo es demasiado grande. Máximo 20MB');
      return;
    }

    setUploadingFile(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      // Procesar archivo con el servicio
      const processingResult = await BiloopAgentService.processBiloopFile(file_url, file.name);
      
      let message = `He subido un archivo de Biloop (${file.name}).`;
      if (processingResult.processed) {
        message += `\n\nArchivo procesado exitosamente:\n- Tipo: ${processingResult.fileType}\n- Facturas detectadas: ${processingResult.invoices?.length || 0}`;
      }
      
      await base44.agents.addMessage(conversation, {
        role: "user",
        content: message,
        file_urls: [file_url]
      });

      toast.success('Archivo subido y procesado - Revisando contenido');
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Error al subir archivo: ' + error.message);
    } finally {
      setUploadingFile(false);
      // Limpiar el input de archivo
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const quickActions = [
    {
      label: "📊 Analizar últimas facturas",
      message: "Analiza las últimas 10 facturas y dime si hay algo importante que deba saber"
    },
    {
      label: "💰 Buscar ahorros",
      message: "Busca oportunidades de ahorro comparando precios entre proveedores"
    },
    {
      label: "📈 Resumen del mes",
      message: "Dame un resumen de gastos de este mes: total, IVA, facturas pendientes"
    }
  ];

  const whatsappURL = base44.agents.getWhatsAppConnectURL('biloop_assistant');

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-blue-50 to-indigo-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4 shadow-sm">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white"></div>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">SYNK-IA Assistant</h1>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <p className="text-sm text-gray-600">Conectado y listo</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge className="bg-blue-100 text-blue-800 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              Procesador de Biloop
            </Badge>
            <a 
              href={whatsappURL} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors text-sm font-medium"
            >
              <MessageSquare className="w-4 h-4" />
              Conectar WhatsApp
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-4 space-y-4">
          {/* Welcome Card */}
          {messages.length === 0 && (
            <Card className="border-none shadow-lg bg-gradient-to-r from-blue-500 to-purple-600 text-white">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-lg mb-2">¡Hola David! 👋</h3>
                    <p className="text-sm opacity-90 mb-4">
                      Soy tu asistente inteligente para gestionar Biloop. Puedo ayudarte a:
                    </p>
                    <ul className="space-y-2 text-sm">
                      <li>📄 Importar facturas desde archivos CSV/Excel de Biloop</li>
                      <li>💰 Analizar gastos y encontrar ahorros potenciales</li>
                      <li>📊 Comparar precios entre proveedores</li>
                      <li>🔍 Consultar y buscar facturas específicas</li>
                      <li>📈 Generar reportes y resúmenes</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick Actions */}
          {messages.length === 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {quickActions.map((action, idx) => (
                <Card 
                  key={idx}
                  className="border-none shadow-lg hover:shadow-xl transition-all cursor-pointer"
                  onClick={() => {
                    setInputMessage(action.message);
                    handleSendMessage();
                  }}
                >
                  <CardContent className="p-4">
                    <p className="text-sm font-medium text-gray-700">{action.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Messages */}
          {messages.map((message, idx) => (
            <MessageBubble key={idx} message={message} />
          ))}

          {isLoading && messages[messages.length - 1]?.role === 'user' && (
            <div className="flex gap-3 justify-start">
              <div className="h-7 w-7 rounded-lg bg-gray-100 flex items-center justify-center">
                <div className="h-1.5 w-1.5 rounded-full bg-gray-400" />
              </div>
              <div className="bg-white border border-gray-200 rounded-2xl px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  <span className="text-sm text-gray-600">Pensando...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="bg-white border-t border-gray-200 p-4 shadow-lg">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-end gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls,.pdf,.zip"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingFile || !conversation}
              className="flex-shrink-0"
            >
              {uploadingFile ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Upload className="w-5 h-5" />
              )}
            </Button>
            <div className="flex-1 relative">
              <Input
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                placeholder="Escribe tu mensaje o sube un archivo de Biloop..."
                disabled={isLoading || !conversation}
                className="pr-12 py-6 text-base"
              />
            </div>
            <Button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isLoading || !conversation}
              className="bg-blue-600 hover:bg-blue-700 flex-shrink-0"
              size="icon"
            >
              <Send className="w-5 h-5" />
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-2 text-center">
            💡 Sube CSV, Excel, PDF o ZIP de Biloop o pregúntame sobre tus facturas
          </p>
        </div>
      </div>
    </div>
  );
}
