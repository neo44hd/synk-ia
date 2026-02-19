import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Brain, 
  X, 
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
  Minimize2,
  Maximize2
} from 'lucide-react';
import { SynkiaBrainService } from '@/services/synkiaBrainService';
import { base44 } from '@/api/base44Client';

// Componente principal SYNK-IA BRAIN
export default function SynkiaBrain({ isOpen, onClose, onToggle }) {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [suggestedActions, setSuggestedActions] = useState([]);
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);
  const synthRef = useRef(null);

  // Cargar historial al montar
  useEffect(() => {
    const history = SynkiaBrainService.loadChatHistory();
    if (history.length > 0) {
      setMessages(history);
    } else {
      // Mensaje de bienvenida
      setMessages([{
        role: 'assistant',
        content: `🧠 **¡Hola! Soy SYNK-IA BRAIN**

Tu asistente de inteligencia empresarial unificado. Tengo acceso a toda la información de tu negocio:

• 📊 Facturas y ventas
• 👥 Empleados y nóminas
• 🏢 Proveedores
• 💸 Gastos y análisis

**Escribe un mensaje o usa un comando rápido** (escribe \`/ayuda\` para ver todos los comandos).`,
        timestamp: new Date().toISOString(),
        type: 'welcome'
      }]);
    }
    
    // Acciones sugeridas iniciales
    setSuggestedActions(SynkiaBrainService.getSuggestedActions());
  }, []);

  // Scroll automático al final
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus en input cuando se abre
  useEffect(() => {
    if (isOpen && !isMinimized) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, isMinimized]);

  // Keyboard shortcut (Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        onToggle?.();
      }
      if (e.key === 'Escape' && isOpen) {
        onClose?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onToggle, onClose]);

  // Inicializar Web Speech API
  useEffect(() => {
    // Speech Recognition
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

      recognitionRef.current.onerror = () => {
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }

    // Speech Synthesis
    if ('speechSynthesis' in window) {
      synthRef.current = window.speechSynthesis;
    }
  }, []);

  // Función para hablar
  const speak = useCallback((text) => {
    if (!voiceEnabled || !synthRef.current) return;
    
    // Limpiar markdown y emojis para voz
    const cleanText = text
      .replace(/\*\*/g, '')
      .replace(/`/g, '')
      .replace(/•/g, '')
      .replace(/📊|📈|👥|💸|🏢|🧠|📋|⏳|✅|💰|⚠️|❌|💡|📅|📆|🎯|⚙️/g, '')
      .substring(0, 500); // Limitar longitud

    synthRef.current.cancel();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'es-ES';
    utterance.rate = 1.0;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    synthRef.current.speak(utterance);
  }, [voiceEnabled]);

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

    // Añadir mensaje del usuario
    const userMessage = {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, userMessage]);

    try {
      // Procesar mensaje
      const result = await SynkiaBrainService.processMessage(message);

      let assistantContent = '';
      
      if (result.type === 'system' || result.type === 'help' || result.type === 'data' || result.type === 'error') {
        assistantContent = result.content;
      } else if (result.type === 'chat') {
        // Para mensajes de chat, usar el agente de Base44
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
          // Fallback si la IA no está disponible
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
            if (ctx.overview) {
              assistantContent += `**Clientes:** ${ctx.overview.clients?.total || 0} total\n`;
            }
            assistantContent += `\n¿Necesitas más detalles sobre algo específico?`;
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
      
      // Hablar respuesta si está habilitado
      speak(assistantContent);

    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage = {
        role: 'assistant',
        content: '❌ Ha ocurrido un error procesando tu mensaje. Por favor, inténtalo de nuevo.',
        timestamp: new Date().toISOString(),
        type: 'error'
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Limpiar chat
  const clearChat = () => {
    if (window.confirm('¿Estás seguro de que quieres limpiar el historial de chat?')) {
      SynkiaBrainService.clearChatHistory();
      setMessages([{
        role: 'assistant',
        content: '🧹 Historial limpiado. ¿En qué puedo ayudarte?',
        timestamp: new Date().toISOString()
      }]);
    }
  };

  // Exportar historial
  const exportHistory = () => {
    SynkiaBrainService.exportChatHistory();
  };

  // Ejecutar acción sugerida
  const executeAction = (command) => {
    setInputValue(command);
    setTimeout(() => sendMessage(), 100);
  };

  // Renderizar mensaje con formato markdown básico
  const renderMessage = (content) => {
    // Convertir markdown básico a HTML
    let html = content
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`(.+?)`/g, '<code class="bg-zinc-800 px-1 rounded">$1</code>')
      .replace(/\n/g, '<br/>');
    
    return <div dangerouslySetInnerHTML={{ __html: html }} />;
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.2 }}
        className={`fixed z-50 ${isMinimized ? 'bottom-20 right-4 w-72' : 'bottom-4 right-4 w-96 sm:w-[420px]'}`}
      >
        <div className="bg-zinc-900/95 backdrop-blur-xl border border-cyan-500/30 rounded-2xl shadow-2xl overflow-hidden"
          style={{
            boxShadow: '0 0 40px rgba(6, 182, 212, 0.15), 0 0 80px rgba(6, 182, 212, 0.05)'
          }}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 px-4 py-3 border-b border-zinc-700/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center"
                  style={{ boxShadow: '0 0 20px rgba(6, 182, 212, 0.5)' }}
                >
                  <Brain className="w-5 h-5 text-white" />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-zinc-900" />
              </div>
              <div>
                <h3 className="text-white font-semibold text-sm">SYNK-IA Brain</h3>
                <p className="text-cyan-400/70 text-xs">Inteligencia Empresarial</p>
              </div>
            </div>
            
            <div className="flex items-center gap-1">
              {/* Toggle voz */}
              <button
                onClick={() => setVoiceEnabled(!voiceEnabled)}
                className={`p-2 rounded-lg transition-colors ${voiceEnabled ? 'bg-cyan-500/20 text-cyan-400' : 'text-zinc-500 hover:text-zinc-300'}`}
                title={voiceEnabled ? 'Desactivar voz' : 'Activar voz'}
              >
                {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>
              
              {/* Minimizar */}
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="p-2 text-zinc-500 hover:text-zinc-300 transition-colors rounded-lg"
              >
                {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
              </button>
              
              {/* Cerrar */}
              <button
                onClick={onClose}
                className="p-2 text-zinc-500 hover:text-red-400 transition-colors rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* Messages Area */}
              <div className="h-80 overflow-y-auto p-4 space-y-4 bg-zinc-950/50">
                {messages.map((message, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                      message.role === 'user'
                        ? 'bg-cyan-600/20 text-cyan-50 border border-cyan-500/30'
                        : 'bg-zinc-800/80 text-zinc-200 border border-zinc-700/50'
                    }`}>
                      <div className="text-sm leading-relaxed">
                        {renderMessage(message.content)}
                      </div>
                      <div className="text-[10px] text-zinc-500 mt-2 text-right">
                        {new Date(message.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </motion.div>
                ))}
                
                {/* Loading indicator */}
                {isLoading && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex justify-start"
                  >
                    <div className="bg-zinc-800/80 rounded-2xl px-4 py-3 border border-zinc-700/50">
                      <div className="flex items-center gap-2 text-cyan-400">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm">Pensando...</span>
                      </div>
                    </div>
                  </motion.div>
                )}
                
                <div ref={messagesEndRef} />
              </div>

              {/* Suggested Actions */}
              {suggestedActions.length > 0 && messages.length <= 2 && (
                <div className="px-4 py-2 border-t border-zinc-800/50 bg-zinc-900/50">
                  <p className="text-xs text-zinc-500 mb-2">Acciones rápidas:</p>
                  <div className="flex flex-wrap gap-2">
                    {suggestedActions.map((action, index) => (
                      <button
                        key={index}
                        onClick={() => executeAction(action.command)}
                        className="text-xs px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-full border border-zinc-700/50 transition-colors flex items-center gap-1"
                      >
                        {action.label}
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Input Area */}
              <div className="p-3 border-t border-zinc-800/50 bg-zinc-900/80">
                <div className="flex items-center gap-2">
                  {/* Micrófono */}
                  <button
                    onClick={toggleListening}
                    className={`p-2.5 rounded-xl transition-all ${
                      isListening 
                        ? 'bg-red-500 text-white animate-pulse' 
                        : 'bg-zinc-800 text-zinc-400 hover:text-cyan-400 hover:bg-zinc-700'
                    }`}
                    title={isListening ? 'Detener' : 'Hablar'}
                  >
                    {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>

                  {/* Input */}
                  <div className="flex-1 relative">
                    <input
                      ref={inputRef}
                      type="text"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                      placeholder="Escribe un mensaje o /comando..."
                      className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20"
                      disabled={isLoading}
                    />
                  </div>

                  {/* Send */}
                  <button
                    onClick={sendMessage}
                    disabled={!inputValue.trim() || isLoading}
                    className="p-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
                    style={{ boxShadow: '0 0 15px rgba(6, 182, 212, 0.3)' }}
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>

                {/* Footer actions */}
                <div className="flex items-center justify-between mt-2 px-1">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={clearChat}
                      className="text-xs text-zinc-500 hover:text-red-400 transition-colors flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      Limpiar
                    </button>
                    <button
                      onClick={exportHistory}
                      className="text-xs text-zinc-500 hover:text-cyan-400 transition-colors flex items-center gap-1"
                    >
                      <Download className="w-3 h-3" />
                      Exportar
                    </button>
                  </div>
                  <span className="text-[10px] text-zinc-600">Ctrl+K para abrir/cerrar</span>
                </div>
              </div>
            </>
          )}

          {/* Minimized state */}
          {isMinimized && (
            <div className="px-4 py-2 text-center">
              <p className="text-xs text-zinc-400">Click para expandir</p>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// Componente del botón flotante
export function SynkiaBrainButton({ onClick, isOpen }) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={`fixed bottom-4 right-4 z-40 w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 ${
        isOpen 
          ? 'bg-zinc-800 scale-0 opacity-0' 
          : 'bg-gradient-to-br from-cyan-500 to-blue-600'
      }`}
      style={{
        boxShadow: isOpen ? 'none' : '0 0 30px rgba(6, 182, 212, 0.5), 0 0 60px rgba(6, 182, 212, 0.2)'
      }}
    >
      <Brain className="w-6 h-6 text-white" />
      
      {/* Pulse animation */}
      {!isOpen && (
        <motion.div
          animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute inset-0 rounded-2xl bg-cyan-500"
        />
      )}
    </motion.button>
  );
}
