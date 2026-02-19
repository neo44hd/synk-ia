import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Brain, 
  Send, 
  Upload, 
  Loader2,
  MessageSquare,
  Zap,
  ExternalLink,
  Sparkles,
  BarChart3,
  TrendingUp
} from "lucide-react";
import { toast } from "sonner";
import MessageBubble from "../components/agents/MessageBubble";
import { CentralAgentService } from "@/services/agents/centralAgentService";

export default function CentralAgent() {
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
        agent_name: "central_coordinator",
        metadata: {
          name: "Chat con IA Central",
          description: "Coordinador Central"
        }
      });
      setConversation(newConversation);
      setMessages(newConversation.messages || []);

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
      // Enriquecer mensaje con contexto del sistema
      const enriched = await CentralAgentService.enrichMessageWithContext(userMessage);
      
      let messageContent = userMessage;
      if (enriched.enriched && enriched.context) {
        messageContent = `${userMessage}\n\n[Contexto del Sistema]\n${JSON.stringify(enriched.context, null, 2)}`;
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

    setUploadingFile(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      await base44.agents.addMessage(conversation, {
        role: "user",
        content: `He subido un archivo (${file.name}). Por favor, procésalo y toma las acciones necesarias.`,
        file_urls: [file_url]
      });

      toast.success('Archivo subido - La IA lo está procesando');
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Error al subir archivo');
    } finally {
      setUploadingFile(false);
    }
  };

  const quickActions = [
    {
      label: "🔍 Analizar todo el sistema",
      message: "Analiza el estado completo del negocio: facturas, proveedores, ahorros potenciales y dame un resumen ejecutivo"
    },
    {
      label: "💰 Buscar ahorros ahora",
      message: "Busca oportunidades de ahorro en todas las áreas: facturas, proveedores, comparaciones de precios"
    },
    {
      label: "⚡ Automatizar procesos",
      message: "¿Qué procesos puedes automatizar para ahorrarme tiempo?"
    }
  ];

  const whatsappURL = base44.agents.getWhatsAppConnectURL('central_coordinator');

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-purple-50 to-indigo-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-b border-purple-700 p-4 shadow-lg">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg border-2 border-white/30">
                <Brain className="w-8 h-8 text-white" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-400 rounded-full border-2 border-purple-600 animate-pulse"></div>
            </div>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                IA CENTRAL
                <Zap className="w-6 h-6 text-yellow-300" />
              </h1>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-300 rounded-full animate-pulse"></div>
                <p className="text-sm text-purple-100">Cerebro del sistema - Activo</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge className="bg-white/20 text-white border-white/30 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              Coordinador Central
            </Badge>
            <a 
              href={whatsappURL} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 rounded-lg transition-colors text-sm font-medium"
            >
              <MessageSquare className="w-4 h-4" />
              WhatsApp
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
            <Card className="border-none shadow-lg bg-gradient-to-r from-purple-500 to-indigo-600 text-white">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Brain className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-xl mb-2">🧠 Bienvenido al Cerebro de SYNK-IA</h3>
                    <p className="text-sm opacity-90 mb-4">
                      Soy tu IA Central. Coordino TODOS los procesos automáticos de tu negocio:
                    </p>
                    <ul className="space-y-2 text-sm">
                      <li>📧 Proceso emails automáticamente y creo facturas</li>
                      <li>🏢 Detecto y registro proveedores nuevos</li>
                      <li>💰 Comparo precios y te alerto de anomalías</li>
                      <li>📊 Genero análisis y reportes ejecutivos</li>
                      <li>⚡ Coordino a todos los agentes especializados</li>
                      <li>🔐 Todo con máxima seguridad y respetando permisos</li>
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
                  className="border-none shadow-lg hover:shadow-xl transition-all cursor-pointer bg-white"
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
              <div className="h-7 w-7 rounded-lg bg-purple-100 flex items-center justify-center">
                <Brain className="h-4 w-4 text-purple-600" />
              </div>
              <div className="bg-white border border-purple-200 rounded-2xl px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                  <span className="text-sm text-gray-600">Coordinando sistemas...</span>
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
                placeholder="Pregúntame cualquier cosa sobre tu negocio..."
                disabled={isLoading || !conversation}
                className="pr-12 py-6 text-base"
              />
            </div>
            <Button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isLoading || !conversation}
              className="bg-purple-600 hover:bg-purple-700 flex-shrink-0"
              size="icon"
            >
              <Send className="w-5 h-5" />
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-2 text-center">
            🧠 Pregúntame sobre análisis, automatizaciones, ahorros o lo que necesites
          </p>
        </div>
      </div>
    </div>
  );
}