import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  Send, 
  Upload, 
  Loader2,
  MessageSquare,
  Heart,
  ExternalLink,
  Sparkles,
  DollarSign,
  Calendar,
  AlertCircle,
  TrendingUp
} from "lucide-react";
import { toast } from "sonner";
import MessageBubble from "../components/agents/MessageBubble";
import { HRAgentService } from "@/services/agents/hrAgentService";

export default function HRAgent() {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [payrollData, setPayrollData] = useState(null);
  const [loadingPayroll, setLoadingPayroll] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    initConversation();
    loadUserData();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadUserData = async () => {
    try {
      const user = await base44.auth.me();
      setCurrentUser(user);
      
      // Cargar datos de nómina del usuario
      setLoadingPayroll(true);
      const payroll = await HRAgentService.analyzeLatestPayroll(user.email);
      setPayrollData(payroll);
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoadingPayroll(false);
    }
  };

  const initConversation = async () => {
    try {
      const newConversation = await base44.agents.createConversation({
        agent_name: "hr_assistant",
        metadata: {
          name: "Chat con RRHH",
          description: "Asistente de Recursos Humanos"
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
      // Enriquecer mensaje con contexto de RRHH
      let messageContent = userMessage;
      if (currentUser) {
        const enriched = await HRAgentService.enrichMessageWithContext(userMessage, currentUser.email);
        if (enriched.enriched && enriched.context) {
          messageContent = `${userMessage}\n\n[Contexto del Empleado]\n${JSON.stringify(enriched.context, null, 2)}`;
        }
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

  const quickActions = [
    {
      label: "💰 Ver mi nómina",
      message: "Muéstrame mi última nómina y explícame los conceptos"
    },
    {
      label: "🏖️ Solicitar vacaciones",
      message: "Quiero solicitar vacaciones. ¿Cuántos días tengo disponibles?"
    },
    {
      label: "📄 Consultar mi contrato",
      message: "Necesito información sobre mi contrato actual"
    }
  ];

  const whatsappURL = base44.agents.getWhatsAppConnectURL('hr_assistant');

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-pink-50 to-purple-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-pink-500 to-purple-600 text-white border-b border-pink-600 p-4 shadow-lg">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-pink-600"></div>
            </div>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                Asistente RRHH
                <Heart className="w-5 h-5 text-pink-200" />
              </h1>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-300 rounded-full animate-pulse"></div>
                <p className="text-sm text-pink-100">Disponible 24/7</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge className="bg-white/20 text-white border-white/30 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              Recursos Humanos
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
            <>
              <Card className="border-none shadow-lg bg-gradient-to-r from-pink-500 to-purple-600 text-white">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Users className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-lg mb-2">
                        👋 ¡Hola{currentUser ? ` ${currentUser.name || currentUser.email.split('@')[0]}` : ''}! Soy tu Asistente de RRHH
                      </h3>
                      <p className="text-sm opacity-90 mb-4">
                        Estoy aquí para ayudarte con todo lo relacionado con tu empleo:
                      </p>
                      <ul className="space-y-2 text-sm">
                        <li>💰 Consultar tus nóminas y entender conceptos</li>
                        <li>🏖️ Solicitar vacaciones y permisos</li>
                        <li>📄 Ver tu contrato y condiciones</li>
                        <li>⏰ Revisar tus fichajes y horas trabajadas</li>
                        <li>❓ Resolver dudas laborales</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Resumen de Nómina */}
              {payrollData && (
                <Card className="border-none shadow-lg">
                  <CardContent className="p-6">
                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-pink-600" />
                      Tu Última Nómina
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-4 bg-green-50 rounded-lg">
                        <p className="text-sm text-gray-600 mb-1">Salario Bruto</p>
                        <p className="text-2xl font-bold text-green-700">
                          €{payrollData.grossSalary?.toFixed(2) || 0}
                        </p>
                      </div>
                      <div className="p-4 bg-blue-50 rounded-lg">
                        <p className="text-sm text-gray-600 mb-1">Salario Neto</p>
                        <p className="text-2xl font-bold text-blue-700">
                          €{payrollData.netSalary?.toFixed(2) || 0}
                        </p>
                      </div>
                      <div className="p-4 bg-purple-50 rounded-lg">
                        <p className="text-sm text-gray-600 mb-1">Deducciones</p>
                        <p className="text-2xl font-bold text-purple-700">
                          €{payrollData.deductions?.toFixed(2) || 0}
                        </p>
                      </div>
                    </div>
                    {payrollData.period && (
                      <p className="text-sm text-gray-500 mt-4 flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Periodo: {payrollData.period}
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              {loadingPayroll && (
                <Card className="border-none shadow-lg">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-center gap-3">
                      <Loader2 className="w-5 h-5 animate-spin text-pink-600" />
                      <span className="text-gray-600">Cargando tu información laboral...</span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
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
              <div className="h-7 w-7 rounded-lg bg-pink-100 flex items-center justify-center">
                <Users className="h-4 w-4 text-pink-600" />
              </div>
              <div className="bg-white border border-pink-200 rounded-2xl px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-pink-600" />
                  <span className="text-sm text-gray-600">Consultando...</span>
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
            <div className="flex-1 relative">
              <Input
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                placeholder="Pregúntame sobre nóminas, vacaciones, contrato..."
                disabled={isLoading || !conversation}
                className="pr-12 py-6 text-base"
              />
            </div>
            <Button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isLoading || !conversation}
              className="bg-pink-600 hover:bg-pink-700 flex-shrink-0"
              size="icon"
            >
              <Send className="w-5 h-5" />
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-2 text-center">
            💬 Pregúntame lo que necesites sobre tu situación laboral
          </p>
        </div>
      </div>
    </div>
  );
}