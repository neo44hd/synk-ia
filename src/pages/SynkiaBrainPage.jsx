import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Brain, 
  Send, 
  Mic, 
  MicOff, 
  Trash2, 
  Download,
  Sparkles,
  Loader2,
  MessageSquare,
  ChevronRight,
  Volume2,
  VolumeX,
  FileText,
  Users,
  DollarSign,
  Building,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  Zap
} from 'lucide-react';
import { SynkiaBrainService } from '@/services/synkiaBrainService';
import { base44 } from '@/api/base44Client';

export default function SynkiaBrainPage() {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);
  const synthRef = useRef(null);

  // Cargar historial y stats al montar
  useEffect(() => {
    const history = SynkiaBrainService.loadChatHistory();
    if (history.length > 0) {
      setMessages(history);
    } else {
      setMessages([{
        role: 'assistant',
        content: `🧠 **¡Bienvenido a SYNK-IA BRAIN!**

Soy tu asistente de inteligencia empresarial unificado. Tengo acceso completo a todos los datos de tu negocio:

📊 **Análisis estratégico** - KPIs, métricas y tendencias
👥 **Recursos Humanos** - Empleados, nóminas, vacaciones
📄 **Documentos** - Facturas, contratos, archivos
🏢 **Proveedores** - Gestión y comparativas

**Comandos rápidos disponibles:** \`/facturas\`, \`/empleados\`, \`/ventas\`, \`/proveedores\`, \`/gastos\`, \`/ayuda\`

¿En qué puedo ayudarte hoy?`,
        timestamp: new Date().toISOString(),
        type: 'welcome'
      }]);
    }
    
    loadStats();
  }, []);

  // Cargar estadísticas
  const loadStats = async () => {
    setLoadingStats(true);
    try {
      const overview = await SynkiaBrainService.generateSystemOverview();
      setStats(overview);
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Inicializar Web Speech API
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'es-ES';

      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInputValue(transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = () => setIsListening(false);
      recognitionRef.current.onend = () => setIsListening(false);
    }

    if ('speechSynthesis' in window) {
      synthRef.current = window.speechSynthesis;
    }
  }, []);

  // Función para hablar
  const speak = (text) => {
    if (!voiceEnabled || !synthRef.current) return;
    
    const cleanText = text
      .replace(/\*\*/g, '')
      .replace(/`/g, '')
      .replace(/•/g, '')
      .replace(/📊|📈|👥|💸|🏢|🧠|📋|⏳|✅|💰|⚠️|❌|💡|📅|📆|🎯|⚙️/g, '')
      .substring(0, 500);

    synthRef.current.cancel();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'es-ES';
    utterance.rate = 1.0;
    synthRef.current.speak(utterance);
  };

  // Toggle micrófono
  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert('Tu navegador no soporta reconocimiento de voz');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  // Enviar mensaje
  const sendMessage = async () => {
    const message = inputValue.trim();
    if (!message || isLoading) return;

    setInputValue('');
    setIsLoading(true);

    const userMessage = {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, userMessage]);

    try {
      const result = await SynkiaBrainService.processMessage(message);

      let assistantContent = '';
      
      if (result.type === 'system' || result.type === 'help' || result.type === 'data' || result.type === 'error') {
        assistantContent = result.content;
      } else if (result.type === 'chat') {
        try {
          const response = await base44.integrations.AI.GetChatResponse({
            system_prompt: SynkiaBrainService.systemPrompt,
            messages: messages.map(m => ({
              role: m.role,
              content: m.content
            })).concat([{ role: 'user', content: message }]),
            context: result.enrichedContext?.context ? JSON.stringify(result.enrichedContext.context) : undefined
          });
          assistantContent = response.response || response.message || 'Entendido. ¿En qué más puedo ayudarte?';
        } catch (aiError) {
          console.error('AI Error:', aiError);
          if (result.enrichedContext?.enriched) {
            const ctx = result.enrichedContext.context;
            assistantContent = `📊 He analizado tu consulta. Aquí tienes información relevante:\n\n`;
            if (ctx.invoices) {
              assistantContent += `**Facturas:** ${ctx.invoices.invoices?.total || 0} total, ${ctx.invoices.invoices?.pending || 0} pendientes\n`;
            }
            if (ctx.sales) {
              assistantContent += `**Ventas:** €${ctx.sales.monthTotal?.toFixed(2) || '0.00'} en los últimos 30 días\n`;
            }
            assistantContent += `\n¿Necesitas más detalles?`;
          } else {
            assistantContent = `Entendido. Puedo ayudarte con información sobre facturas, ventas, empleados, proveedores y gastos. ¿Qué te gustaría saber?`;
          }
        }
      }

      const assistantMessage = {
        role: 'assistant',
        content: assistantContent,
        timestamp: new Date().toISOString()
      };

      setMessages(prev => [...prev, assistantMessage]);
      SynkiaBrainService.saveChatMessage(assistantMessage);
      speak(assistantContent);

    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '❌ Ha ocurrido un error. Por favor, inténtalo de nuevo.',
        timestamp: new Date().toISOString(),
        type: 'error'
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Limpiar chat
  const clearChat = () => {
    if (window.confirm('¿Estás seguro de que quieres limpiar el historial?')) {
      SynkiaBrainService.clearChatHistory();
      setMessages([{
        role: 'assistant',
        content: '🧹 Historial limpiado. ¿En qué puedo ayudarte?',
        timestamp: new Date().toISOString()
      }]);
    }
  };

  // Ejecutar comando rápido
  const executeQuickCommand = (command) => {
    setInputValue(command);
    setTimeout(() => {
      inputRef.current?.focus();
      sendMessage();
    }, 100);
  };

  // Renderizar mensaje
  const renderMessage = (content) => {
    let html = content
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`(.+?)`/g, '<code class="bg-zinc-800 px-1.5 py-0.5 rounded text-cyan-400 text-sm">$1</code>')
      .replace(/\n/g, '<br/>');
    
    return <div dangerouslySetInnerHTML={{ __html: html }} />;
  };

  // Quick actions
  const quickActions = [
    { label: 'Facturas', command: '/facturas', icon: FileText, color: 'text-blue-400' },
    { label: 'Ventas', command: '/ventas', icon: TrendingUp, color: 'text-green-400' },
    { label: 'Empleados', command: '/empleados', icon: Users, color: 'text-purple-400' },
    { label: 'Proveedores', command: '/proveedores', icon: Building, color: 'text-orange-400' },
    { label: 'Gastos', command: '/gastos', icon: DollarSign, color: 'text-red-400' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-neutral-900 to-zinc-950 p-4 lg:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-14 h-14 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center"
              style={{ boxShadow: '0 0 30px rgba(6, 182, 212, 0.4)' }}
            >
              <Brain className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                SYNK-IA Brain
                <span className="text-xs bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded-full">v2.0</span>
              </h1>
              <p className="text-zinc-400 text-sm">Inteligencia empresarial unificada</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Panel izquierdo - Stats */}
          <div className="lg:col-span-1 space-y-4">
            {/* Quick Stats */}
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4">
              <h3 className="text-sm font-semibold text-zinc-400 mb-4 flex items-center gap-2">
                <Zap className="w-4 h-4 text-cyan-400" />
                Resumen Rápido
              </h3>
              
              {loadingStats ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
                </div>
              ) : stats ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-xl">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-400" />
                      <span className="text-sm text-zinc-300">Facturas</span>
                    </div>
                    <span className="text-white font-semibold">{stats.invoices?.total || 0}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-xl">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-yellow-400" />
                      <span className="text-sm text-zinc-300">Pendientes</span>
                    </div>
                    <span className="text-yellow-400 font-semibold">{stats.invoices?.pending || 0}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-xl">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-purple-400" />
                      <span className="text-sm text-zinc-300">Clientes</span>
                    </div>
                    <span className="text-white font-semibold">{stats.clients?.total || 0}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-xl">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-green-400" />
                      <span className="text-sm text-zinc-300">Total facturado</span>
                    </div>
                    <span className="text-green-400 font-semibold">€{(stats.invoices?.totalAmount || 0).toFixed(0)}</span>
                  </div>
                </div>
              ) : (
                <p className="text-zinc-500 text-sm">No hay datos disponibles</p>
              )}
            </div>

            {/* Quick Actions */}
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4">
              <h3 className="text-sm font-semibold text-zinc-400 mb-4 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                Acciones Rápidas
              </h3>
              <div className="space-y-2">
                {quickActions.map((action) => (
                  <button
                    key={action.command}
                    onClick={() => executeQuickCommand(action.command)}
                    className="w-full flex items-center gap-3 p-3 bg-zinc-800/50 hover:bg-zinc-800 rounded-xl transition-colors group"
                  >
                    <action.icon className={`w-4 h-4 ${action.color}`} />
                    <span className="text-sm text-zinc-300 group-hover:text-white">{action.label}</span>
                    <ChevronRight className="w-4 h-4 text-zinc-600 ml-auto group-hover:text-zinc-400" />
                  </button>
                ))}
              </div>
            </div>

            {/* Voice Settings */}
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4">
              <h3 className="text-sm font-semibold text-zinc-400 mb-4">Configuración</h3>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-zinc-300">Respuestas por voz</span>
                <button
                  onClick={() => setVoiceEnabled(!voiceEnabled)}
                  className={`w-12 h-6 rounded-full transition-colors ${voiceEnabled ? 'bg-cyan-500' : 'bg-zinc-700'}`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full transition-transform ${voiceEnabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
                </button>
              </label>
            </div>
          </div>

          {/* Panel central - Chat */}
          <div className="lg:col-span-2">
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl overflow-hidden h-[calc(100vh-200px)] flex flex-col">
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((message, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[80%] rounded-2xl px-5 py-4 ${
                      message.role === 'user'
                        ? 'bg-gradient-to-br from-cyan-600/30 to-blue-600/30 text-cyan-50 border border-cyan-500/30'
                        : 'bg-zinc-800/80 text-zinc-200 border border-zinc-700/50'
                    }`}>
                      {message.role === 'assistant' && (
                        <div className="flex items-center gap-2 mb-2">
                          <Brain className="w-4 h-4 text-cyan-400" />
                          <span className="text-xs text-cyan-400 font-medium">SYNK-IA Brain</span>
                        </div>
                      )}
                      <div className="text-sm leading-relaxed">
                        {renderMessage(message.content)}
                      </div>
                      <div className="text-[10px] text-zinc-500 mt-3 text-right">
                        {new Date(message.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </motion.div>
                ))}
                
                {isLoading && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                    <div className="bg-zinc-800/80 rounded-2xl px-5 py-4 border border-zinc-700/50">
                      <div className="flex items-center gap-3 text-cyan-400">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span className="text-sm">Analizando...</span>
                      </div>
                    </div>
                  </motion.div>
                )}
                
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-4 border-t border-zinc-800 bg-zinc-900/50">
                <div className="flex items-center gap-3">
                  <button
                    onClick={toggleListening}
                    className={`p-3 rounded-xl transition-all ${
                      isListening 
                        ? 'bg-red-500 text-white animate-pulse' 
                        : 'bg-zinc-800 text-zinc-400 hover:text-cyan-400 hover:bg-zinc-700'
                    }`}
                  >
                    {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  </button>

                  <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                    placeholder="Escribe un mensaje o usa /comando..."
                    className="flex-1 bg-zinc-800/50 border border-zinc-700/50 rounded-xl px-5 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20"
                    disabled={isLoading}
                  />

                  <button
                    onClick={sendMessage}
                    disabled={!inputValue.trim() || isLoading}
                    className="p-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
                    style={{ boxShadow: '0 0 20px rgba(6, 182, 212, 0.3)' }}
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex items-center justify-between mt-3 px-1">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={clearChat}
                      className="text-xs text-zinc-500 hover:text-red-400 transition-colors flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Limpiar historial
                    </button>
                    <button
                      onClick={() => SynkiaBrainService.exportChatHistory()}
                      className="text-xs text-zinc-500 hover:text-cyan-400 transition-colors flex items-center gap-1"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Exportar
                    </button>
                  </div>
                  <span className="text-xs text-zinc-600">
                    {messages.length} mensajes • Ctrl+K para acceso rápido
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
