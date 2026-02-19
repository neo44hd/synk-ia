import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Brain, 
  Send, 
  Loader2, 
  Plus,
  Trash2,
  MessageSquare,
  Shield,
  Zap,
  ChevronLeft,
  Settings,
  Sparkles,
  Mic,
  MicOff,
  FileText,
  Users,
  TrendingUp,
  DollarSign,
  AlertTriangle,
  BarChart3
} from "lucide-react";
import { toast } from "sonner";
import MessageBubble from "@/components/agents/MessageBubble";
import { CEOBrainService } from "@/services/agents/ceoBrainService";

const CEO_EMAILS = ["ruben@loffresco.com", "ruben@lofrfresco.com"]; // Emails del CEO

export default function CEOBrain() {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showSidebar, setShowSidebar] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [currentPage, setCurrentPage] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);

  // Detectar página actual
  useEffect(() => {
    const path = window.location.pathname;
    const pageName = path.split('/').pop() || 'Dashboard';
    setCurrentPage(pageName);
  }, []);

  // Configurar reconocimiento de voz
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'es-ES';

      recognitionRef.current.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map(result => result[0].transcript)
          .join('');
        setInputMessage(transcript);
        
        if (event.results[0].isFinal) {
          setIsListening(false);
        }
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        if (event.error === 'not-allowed') {
          toast.error('Activa el micrófono en tu navegador');
        }
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  const toggleVoice = () => {
    if (!recognitionRef.current) {
      toast.error('Tu navegador no soporta reconocimiento de voz');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setInputMessage('');
      recognitionRef.current.start();
      setIsListening(true);
      toast.info('🎤 Escuchando...', { duration: 2000 });
    }
  };

  // Verificar si el usuario es el CEO
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = await base44.auth.me();
        // Permitir acceso solo al CEO
        if (CEO_EMAILS.includes(user.email) || user.role === 'admin') {
          setIsAuthorized(true);
          loadConversations();
          loadMetrics(); // Cargar métricas al iniciar
        } else {
          setIsAuthorized(false);
        }
      } catch (error) {
        console.error("Error checking auth:", error);
        setIsAuthorized(false);
      } finally {
        setIsLoading(false);
      }
    };
    checkAuth();
  }, []);

  // Cargar métricas empresariales
  const loadMetrics = async () => {
    setLoadingMetrics(true);
    try {
      const businessMetrics = await CEOBrainService.getBusinessMetrics();
      setMetrics(businessMetrics);
    } catch (error) {
      console.error("Error loading metrics:", error);
    } finally {
      setLoadingMetrics(false);
    }
  };

  const loadConversations = async () => {
    try {
      const convs = await base44.agents.listConversations({ agent_name: "ceo_brain" });
      setConversations(convs || []);
      
      // Si hay conversaciones, cargar la más reciente
      if (convs && convs.length > 0) {
        loadConversation(convs[0].id);
      }
    } catch (error) {
      console.error("Error loading conversations:", error);
    }
  };

  const loadConversation = async (conversationId) => {
    try {
      const conv = await base44.agents.getConversation(conversationId);
      setActiveConversation(conv);
      setMessages(conv.messages || []);
      
      // Suscribirse a actualizaciones
      const unsubscribe = base44.agents.subscribeToConversation(conversationId, (data) => {
        setMessages(data.messages || []);
      });
      
      return () => unsubscribe();
    } catch (error) {
      console.error("Error loading conversation:", error);
    }
  };

  const createNewConversation = async () => {
    try {
      const conv = await base44.agents.createConversation({
        agent_name: "ceo_brain",
        metadata: {
          name: `Sesión ${new Date().toLocaleDateString('es-ES')}`,
          description: "Conversación con el cerebro de SYNK-IA"
        }
      });
      
      setConversations(prev => [conv, ...prev]);
      setActiveConversation(conv);
      setMessages([]);
      
      // Suscribirse a la nueva conversación
      base44.agents.subscribeToConversation(conv.id, (data) => {
        setMessages(data.messages || []);
      });
      
      toast.success("Nueva sesión iniciada");
    } catch (error) {
      console.error("Error creating conversation:", error);
      toast.error("Error al crear sesión");
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isSending) return;
    if (!activeConversation) {
      await createNewConversation();
      return;
    }

    const messageText = inputMessage;
    setInputMessage("");
    setIsSending(true);

    try {
      // Enriquecer mensaje con contexto de métricas si es necesario
      const enriched = await CEOBrainService.enrichMessageWithContext(messageText);
      
      let messageContent = messageText;
      if (enriched.enriched && enriched.context) {
        // Añadir contexto al mensaje
        messageContent = `${messageText}\n\n[Contexto del Sistema]\n${JSON.stringify(enriched.context, null, 2)}`;
      }

      await base44.agents.addMessage(activeConversation, {
        role: "user",
        content: messageContent
      });
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Error al enviar mensaje");
      setInputMessage(messageText);
    } finally {
      setIsSending(false);
    }
  };

  const deleteConversation = async (convId) => {
    try {
      // Por ahora solo lo quitamos de la lista local
      setConversations(prev => prev.filter(c => c.id !== convId));
      if (activeConversation?.id === convId) {
        setActiveConversation(null);
        setMessages([]);
      }
      toast.success("Sesión eliminada");
    } catch (error) {
      toast.error("Error al eliminar");
    }
  };

  // Auto-scroll al último mensaje
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Pantalla de carga
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-zinc-950 via-neutral-900 to-zinc-950">
        <div className="text-center">
          <Loader2 
            className="w-16 h-16 text-cyan-400 animate-spin mx-auto mb-4" 
            style={{ filter: 'drop-shadow(0 0 15px rgba(6, 182, 212, 0.8))' }}
          />
          <p className="text-gray-400">Verificando acceso...</p>
        </div>
      </div>
    );
  }

  // Acceso denegado
  if (!isAuthorized) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-zinc-950 via-neutral-900 to-zinc-950">
        <div className="text-center max-w-md">
          <div 
            className="w-24 h-24 bg-black rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-red-500/50"
            style={{ boxShadow: '0 0 30px rgba(239, 68, 68, 0.4)' }}
          >
            <Shield className="w-12 h-12 text-red-500" style={{ filter: 'drop-shadow(0 0 10px rgba(239, 68, 68, 0.8))' }} />
          </div>
          <h1 className="text-3xl font-bold text-white mb-4">Acceso Restringido</h1>
          <p className="text-gray-400 mb-6">
            Esta sección está reservada exclusivamente para el CEO del sistema.
          </p>
          <Button 
            onClick={() => window.history.back()}
            variant="outline"
            className="border-zinc-700 text-gray-300 hover:border-cyan-500/50 hover:text-cyan-400"
          >
            Volver
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-gradient-to-br from-zinc-950 via-neutral-900 to-zinc-950">
      {/* Sidebar - Conversaciones */}
      {showSidebar && (
        <div className="w-72 bg-black/80 border-r border-cyan-500/20 flex flex-col">
          <div className="p-4 border-b border-cyan-500/20">
            <div className="flex items-center gap-3 mb-4">
              <div 
                className="w-10 h-10 bg-black rounded-xl flex items-center justify-center border border-cyan-500/50"
                style={{ boxShadow: '0 0 20px rgba(6, 182, 212, 0.4), inset 0 0 10px rgba(6, 182, 212, 0.1)' }}
              >
                <Brain className="w-6 h-6 text-cyan-400" style={{ filter: 'drop-shadow(0 0 8px rgba(6, 182, 212, 0.8))' }} />
              </div>
              <div>
                <h2 className="font-bold text-cyan-400" style={{ textShadow: '0 0 10px rgba(6, 182, 212, 0.6)' }}>CEO Brain</h2>
                <p className="text-xs text-zinc-500">Modo Exclusivo</p>
              </div>
            </div>
            <Button
              onClick={createNewConversation}
              className="w-full bg-black border border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10 hover:border-cyan-400"
              style={{ boxShadow: '0 0 15px rgba(6, 182, 212, 0.3)' }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Nueva Sesión
            </Button>
          </div>

          <ScrollArea className="flex-1 p-2">
            {conversations.length === 0 ? (
              <div className="text-center py-8 px-4">
                <MessageSquare className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
                <p className="text-sm text-zinc-500">No hay conversaciones</p>
                <p className="text-xs text-zinc-600 mt-1">Crea una nueva sesión para empezar</p>
              </div>
            ) : (
              <div className="space-y-1">
                {conversations.map((conv) => (
                  <div
                    key={conv.id}
                    className={`group flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-all ${
                      activeConversation?.id === conv.id
                        ? "bg-cyan-500/10 border border-cyan-500/50"
                        : "hover:bg-zinc-800/50"
                    }`}
                    style={activeConversation?.id === conv.id ? { boxShadow: '0 0 10px rgba(6, 182, 212, 0.2)' } : {}}
                    onClick={() => loadConversation(conv.id)}
                  >
                    <MessageSquare className={`w-4 h-4 flex-shrink-0 ${
                      activeConversation?.id === conv.id ? "text-cyan-400" : "text-zinc-500"
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${
                        activeConversation?.id === conv.id ? "text-cyan-400" : "text-zinc-300"
                      }`}>
                        {conv.metadata?.name || "Sesión"}
                      </p>
                      <p className="text-xs text-zinc-500 truncate">
                        {conv.messages?.length || 0} mensajes
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteConversation(conv.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-600/20 rounded transition-all"
                    >
                      <Trash2 className="w-3 h-3 text-red-400" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          <div className="p-4 border-t border-cyan-500/20">
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" style={{ boxShadow: '0 0 8px rgba(6, 182, 212, 0.8)' }} />
              <span>Sistema activo</span>
            </div>
          </div>
        </div>
      )}

      {/* Chat Principal */}
      <div className="flex-1 flex flex-col">
        {/* Header del chat */}
        <div className="p-4 border-b border-cyan-500/20 bg-black/50 backdrop-blur flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="p-2 hover:bg-zinc-800 rounded-lg transition-colors lg:hidden"
            >
              <ChevronLeft className={`w-5 h-5 text-zinc-400 transition-transform ${!showSidebar ? 'rotate-180' : ''}`} />
            </button>
            <div 
              className="w-10 h-10 bg-black rounded-xl flex items-center justify-center border border-cyan-500/50"
              style={{ boxShadow: '0 0 15px rgba(6, 182, 212, 0.4)' }}
            >
              <Brain className="w-5 h-5 text-cyan-400" style={{ filter: 'drop-shadow(0 0 6px rgba(6, 182, 212, 0.8))' }} />
            </div>
            <div>
              <h1 className="font-bold text-cyan-400 flex items-center gap-2" style={{ textShadow: '0 0 10px rgba(6, 182, 212, 0.6)' }}>
                SYNK-IA Brain
                <Sparkles className="w-4 h-4 text-cyan-300" style={{ filter: 'drop-shadow(0 0 5px rgba(6, 182, 212, 0.8))' }} />
              </h1>
              <p className="text-xs text-zinc-500">Tu asistente ejecutivo con acceso total</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div 
              className="px-3 py-1 bg-black border border-cyan-500/50 rounded-full"
              style={{ boxShadow: '0 0 10px rgba(6, 182, 212, 0.3)' }}
            >
              <span className="text-xs font-medium text-cyan-400">👑 CEO Mode</span>
            </div>
          </div>
        </div>

        {/* Área de mensajes */}
        <ScrollArea className="flex-1 p-4">
          {!activeConversation ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center max-w-4xl w-full px-4">
                <div 
                  className="w-24 h-24 bg-black rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-cyan-500/50"
                  style={{ boxShadow: '0 0 40px rgba(6, 182, 212, 0.4), inset 0 0 20px rgba(6, 182, 212, 0.1)' }}
                >
                  <Brain className="w-12 h-12 text-cyan-400" style={{ filter: 'drop-shadow(0 0 15px rgba(6, 182, 212, 0.8))' }} />
                </div>
                <h2 className="text-2xl font-bold text-cyan-400 mb-3" style={{ textShadow: '0 0 15px rgba(6, 182, 212, 0.6)' }}>
                  Bienvenido, CEO
                </h2>
                <p className="text-zinc-400 mb-6">
                  Soy tu cerebro omnipotente con control total del sistema:
                </p>

                {/* Métricas empresariales */}
                {metrics && (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <Card className="bg-black/50 border-cyan-500/30 hover:border-cyan-500/50 transition-all">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-cyan-500/20 rounded-lg flex items-center justify-center">
                            <FileText className="w-5 h-5 text-cyan-400" />
                          </div>
                          <div className="text-left">
                            <p className="text-xs text-zinc-500">Facturas</p>
                            <p className="text-xl font-bold text-cyan-400">{metrics.invoices?.total || 0}</p>
                            <p className="text-xs text-zinc-600">{metrics.invoices?.pending || 0} pendientes</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-black/50 border-cyan-500/30 hover:border-cyan-500/50 transition-all">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                            <DollarSign className="w-5 h-5 text-green-400" />
                          </div>
                          <div className="text-left">
                            <p className="text-xs text-zinc-500">Facturación</p>
                            <p className="text-xl font-bold text-green-400">
                              €{metrics.sales?.monthlyRevenue?.toFixed(0) || 0}
                            </p>
                            <p className="text-xs text-zinc-600">Este mes</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-black/50 border-cyan-500/30 hover:border-cyan-500/50 transition-all">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                            <Users className="w-5 h-5 text-purple-400" />
                          </div>
                          <div className="text-left">
                            <p className="text-xs text-zinc-500">Clientes</p>
                            <p className="text-xl font-bold text-purple-400">{metrics.clients?.total || 0}</p>
                            <p className="text-xs text-zinc-600">{metrics.clients?.active || 0} activos</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-black/50 border-cyan-500/30 hover:border-cyan-500/50 transition-all">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                            <TrendingUp className="w-5 h-5 text-orange-400" />
                          </div>
                          <div className="text-left">
                            <p className="text-xs text-zinc-500">Ticket Medio</p>
                            <p className="text-xl font-bold text-orange-400">
                              €{metrics.sales?.averageTicket?.toFixed(0) || 0}
                            </p>
                            <p className="text-xs text-zinc-600">Promedio</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {loadingMetrics && (
                  <div className="flex items-center justify-center gap-2 mb-6 text-zinc-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Cargando métricas...</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 text-left mb-6">
                  <div 
                    className="p-3 bg-black/50 rounded-lg border border-cyan-500/30 hover:border-cyan-500/50 transition-all cursor-pointer"
                    onClick={() => navigate(createPageUrl("BiloopImport"))}
                  >
                    <Zap className="w-5 h-5 text-cyan-400 mb-2" style={{ filter: 'drop-shadow(0 0 5px rgba(6, 182, 212, 0.8))' }} />
                    <p className="text-sm text-white font-medium">Control Total de Datos</p>
                    <p className="text-xs text-zinc-500">Facturas, ventas, RRHH, emails...</p>
                  </div>
                  <div 
                    className="p-3 bg-black/50 rounded-lg border border-cyan-500/30 hover:border-cyan-500/50 transition-all cursor-pointer"
                    onClick={() => navigate(createPageUrl("AutomationHub"))}
                  >
                    <Settings className="w-5 h-5 text-cyan-400 mb-2" style={{ filter: 'drop-shadow(0 0 5px rgba(6, 182, 212, 0.8))' }} />
                    <p className="text-sm text-white font-medium">Acciones Directas</p>
                    <p className="text-xs text-zinc-500">Crear, modificar, eliminar, masivo</p>
                  </div>
                  <div 
                    className="p-3 bg-black/50 rounded-lg border border-cyan-500/30 hover:border-cyan-500/50 transition-all cursor-pointer"
                    onClick={() => navigate(createPageUrl("ApiDiagnostics"))}
                  >
                    <Shield className="w-5 h-5 text-cyan-400 mb-2" style={{ filter: 'drop-shadow(0 0 5px rgba(6, 182, 212, 0.8))' }} />
                    <p className="text-sm text-white font-medium">Diagnóstico Sistema</p>
                    <p className="text-xs text-zinc-500">APIs, errores, estado general</p>
                  </div>
                  <div 
                    className="p-3 bg-black/50 rounded-lg border border-cyan-500/30 hover:border-cyan-500/50 transition-all cursor-pointer"
                    onClick={() => navigate(createPageUrl("SystemOverview"))}
                  >
                    <Brain className="w-5 h-5 text-cyan-400 mb-2" style={{ filter: 'drop-shadow(0 0 5px rgba(6, 182, 212, 0.8))' }} />
                    <p className="text-sm text-white font-medium">Búsqueda Web</p>
                    <p className="text-xs text-zinc-500">Info externa cuando la necesites</p>
                  </div>
                </div>
                <Button
                  onClick={createNewConversation}
                  size="lg"
                  className="bg-black border border-cyan-500/50 text-cyan-400 font-bold hover:bg-cyan-500/10 hover:border-cyan-400"
                  style={{ boxShadow: '0 0 20px rgba(6, 182, 212, 0.4)' }}
                >
                  <MessageSquare className="w-5 h-5 mr-2" />
                  Iniciar Conversación
                </Button>
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <Brain className="w-16 h-16 text-cyan-500/50 mx-auto mb-4" style={{ filter: 'drop-shadow(0 0 10px rgba(6, 182, 212, 0.5))' }} />
                <p className="text-zinc-400">Escribe tu primera pregunta o instrucción</p>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {[
                    "Hazme una factura para...",
                    "Crea un presupuesto para...",
                    "¿Qué clientes tengo registrados?",
                    "Facturas pendientes de cobro",
                    "Resumen de facturación del mes"
                  ].map((suggestion, i) => (
                    <button
                      key={i}
                      onClick={() => setInputMessage(suggestion)}
                      className="px-3 py-2 bg-black hover:bg-cyan-500/10 border border-zinc-800 hover:border-cyan-500/50 rounded-lg text-sm text-zinc-300 hover:text-cyan-400 transition-all"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 max-w-4xl mx-auto">
              {messages.map((message, idx) => (
                <MessageBubble key={idx} message={message} />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>

        {/* Input de mensaje */}
        {activeConversation && (
          <div className="p-4 border-t border-cyan-500/20 bg-black/50 backdrop-blur">
            <div className="max-w-4xl mx-auto">
              {/* Contexto actual */}
              {currentPage && (
                <div className="flex items-center gap-2 mb-3 text-xs text-zinc-500">
                  <span>📍 Contexto:</span>
                  <span className="px-2 py-1 bg-black border border-cyan-500/30 rounded text-cyan-400">{currentPage}</span>
                </div>
              )}
              <div className="flex gap-3">
                <Button
                  onClick={toggleVoice}
                  variant="outline"
                  className={`border-zinc-700 ${isListening ? 'bg-red-600 border-red-500 text-white animate-pulse' : 'text-zinc-400 hover:text-cyan-400 hover:border-cyan-500/50 hover:bg-black'}`}
                >
                  {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </Button>
                <Input
                  ref={inputRef}
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                  placeholder={isListening ? "Escuchando..." : "Escribe o habla tu instrucción..."}
                  disabled={isSending}
                  className={`flex-1 bg-black border-zinc-700 text-white placeholder:text-zinc-500 focus:border-cyan-500 focus:ring-cyan-500/20 ${isListening ? 'border-red-500' : ''}`}
                />
                <Button
                  onClick={sendMessage}
                  disabled={isSending || !inputMessage.trim()}
                  className="bg-black border border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10 px-6"
                  style={{ boxShadow: '0 0 15px rgba(6, 182, 212, 0.3)' }}
                >
                  {isSending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </Button>
              </div>
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-zinc-500">
                  🎤 Voz activada • 📄 Facturas y presupuestos • 👥 Memoria de clientes
                </p>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setInputMessage("Hazme una factura para ")}
                    className="text-xs px-2 py-1 bg-black hover:bg-cyan-500/10 border border-zinc-800 hover:border-cyan-500/50 rounded text-cyan-400 transition-all"
                  >
                    <FileText className="w-3 h-3 inline mr-1" />
                    Factura
                  </button>
                  <button 
                    onClick={() => setInputMessage("Hazme un presupuesto para ")}
                    className="text-xs px-2 py-1 bg-black hover:bg-cyan-500/10 border border-zinc-800 hover:border-cyan-500/50 rounded text-cyan-400 transition-all"
                  >
                    <FileText className="w-3 h-3 inline mr-1" />
                    Presupuesto
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}