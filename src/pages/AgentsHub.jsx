import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Send,
  Settings,
  MessageSquare,
  Play,
  Pause,
  RefreshCw,
  Zap,
  Code,
  FileText,
  Brain,
  Terminal,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Copy,
  Download,
} from "lucide-react";
import { toast } from "sonner";

const AGENTS = [
  {
    id: "claude-code",
    name: "Claude Code",
    description: "Agente de programación y análisis de código",
    icon: Code,
    color: "text-purple-500",
    status: "online",
    version: "1.0.0",
    prompt: "Eres un experto en programación. Ayuda con código, debugging y arquitectura.",
  },
  {
    id: "opencode",
    name: "OpenCode",
    description: "Generador y optimizador de código",
    icon: FileText,
    color: "text-blue-500",
    status: "online",
    version: "2.1.0",
    prompt: "Especialista en generar código limpio y optimizado.",
  },
  {
    id: "hermes",
    name: "Hermes",
    description: "Agente de automatización y orquestación",
    icon: Zap,
    color: "text-yellow-500",
    status: "online",
    version: "3.0.0",
    prompt: "Automatiza tareas y orquesta flujos de trabajo.",
  },
  {
    id: "openclaw",
    name: "OpenClaw",
    description: "Herramienta de análisis avanzado",
    icon: Brain,
    color: "text-green-500",
    status: "online",
    version: "1.5.0",
    prompt: "Realiza análisis profundo y proporciona insights.",
  },
  {
    id: "aider",
    name: "Aider",
    description: "Asistente de pair programming",
    icon: Terminal,
    color: "text-red-500",
    status: "offline",
    version: "4.0.0",
    prompt: "Tu compañero de programación en pair programming.",
  },
];

export default function AgentsHub() {
  const [selectedAgent, setSelectedAgent] = useState(AGENTS[0]);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("chat");
  const [systemPrompt, setSystemPrompt] = useState(selectedAgent.prompt);
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(2000);
  const scrollRef = useRef(null);

  // Auto-scroll al final cuando hay nuevos mensajes
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Actualizar prompt cuando cambia el agente
  useEffect(() => {
    setSystemPrompt(selectedAgent.prompt);
    setMessages([]);
  }, [selectedAgent]);

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    // Agregar mensaje del usuario
    const userMessage = {
      id: Date.now(),
      role: "user",
      content: inputValue,
      timestamp: new Date().toLocaleTimeString("es-ES"),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue("");
    setLoading(true);

    // Simular respuesta del agente
    setTimeout(() => {
      const agentMessage = {
        id: Date.now() + 1,
        role: "assistant",
        content: `Respuesta de ${selectedAgent.name}: He procesado tu solicitud. ${inputValue.substring(0, 50)}...`,
        timestamp: new Date().toLocaleTimeString("es-ES"),
      };
      setMessages(prev => [...prev, agentMessage]);
      setLoading(false);
      toast.success(`${selectedAgent.name} respondió`);
    }, 1000);
  };

  const handleCopyMessage = (content) => {
    navigator.clipboard.writeText(content);
    toast.success("Copiado al portapapeles");
  };

  const handleDownloadChat = () => {
    const chatText = messages
      .map(msg => `[${msg.role.toUpperCase()}] ${msg.timestamp}\n${msg.content}`)
      .join("\n\n");

    const blob = new Blob([chatText], { type: "text/plain" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chat-${selectedAgent.id}-${Date.now()}.txt`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">🤖 Agentes IA</h1>
          <p className="text-slate-600">Interactúa con tus agentes inteligentes</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar - Lista de Agentes */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Agentes Disponibles</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-96">
                  <div className="space-y-2">
                    {AGENTS.map(agent => {
                      const Icon = agent.icon;
                      const isSelected = selectedAgent.id === agent.id;
                      
                      return (
                        <button
                          key={agent.id}
                          onClick={() => setSelectedAgent(agent)}
                          className={`w-full p-3 rounded-lg text-left transition ${
                            isSelected
                              ? "bg-blue-100 border-2 border-blue-500"
                              : "bg-slate-100 hover:bg-slate-200"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Icon className={`${agent.color}`} size={18} />
                            <span className="font-semibold text-sm">{agent.name}</span>
                          </div>
                          <p className="text-xs text-slate-600 line-clamp-2">
                            {agent.description}
                          </p>
                          <div className="flex items-center gap-1 mt-2">
                            {agent.status === "online" ? (
                              <CheckCircle2 className="text-green-500" size={14} />
                            ) : (
                              <AlertCircle className="text-red-500" size={14} />
                            )}
                            <span className="text-xs text-slate-500">
                              {agent.status === "online" ? "Online" : "Offline"}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            <Card className="h-full flex flex-col">
              {/* Header del Agente */}
              <CardHeader className="border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {React.createElement(selectedAgent.icon, {
                      className: selectedAgent.color,
                      size: 28,
                    })}
                    <div>
                      <CardTitle>{selectedAgent.name}</CardTitle>
                      <p className="text-sm text-slate-600">{selectedAgent.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedAgent.status === "online" ? (
                      <CheckCircle2 className="text-green-500" size={24} />
                    ) : (
                      <AlertCircle className="text-red-500" size={24} />
                    )}
                  </div>
                </div>
              </CardHeader>

              {/* Tabs */}
              <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
                <TabsList className="w-full border-b rounded-none">
                  <TabsTrigger value="chat" className="flex-1">
                    <MessageSquare size={18} className="mr-2" />
                    Chat
                  </TabsTrigger>
                  <TabsTrigger value="config" className="flex-1">
                    <Settings size={18} className="mr-2" />
                    Configuración
                  </TabsTrigger>
                </TabsList>

                {/* Chat Tab */}
                <TabsContent value="chat" className="flex-1 flex flex-col">
                  <CardContent className="flex-1 flex flex-col p-4">
                    {/* Mensajes */}
                    <ScrollArea className="flex-1 mb-4 border border-slate-200 rounded-lg p-4 bg-slate-50">
                      <div className="space-y-4">
                        {messages.length === 0 ? (
                          <div className="flex flex-col items-center justify-center h-64 text-slate-500">
                            <MessageSquare size={40} className="mb-3 opacity-50" />
                            <p>Inicia una conversación con {selectedAgent.name}</p>
                          </div>
                        ) : (
                          <>
                            {messages.map(msg => (
                              <div
                                key={msg.id}
                                className={`flex ${
                                  msg.role === "user" ? "justify-end" : "justify-start"
                                }`}
                              >
                                <div
                                  className={`max-w-xs p-3 rounded-lg ${
                                    msg.role === "user"
                                      ? "bg-blue-500 text-white"
                                      : "bg-slate-200 text-slate-900"
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <p className="text-xs opacity-70 mb-1">{msg.timestamp}</p>
                                      <p className="text-sm">{msg.content}</p>
                                    </div>
                                    {msg.role === "assistant" && (
                                      <button
                                        onClick={() => handleCopyMessage(msg.content)}
                                        className="opacity-50 hover:opacity-100 transition flex-shrink-0"
                                      >
                                        <Copy size={14} />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                            {loading && (
                              <div className="flex justify-start">
                                <div className="bg-slate-200 p-3 rounded-lg">
                                  <Loader2 className="animate-spin" size={20} />
                                </div>
                              </div>
                            )}
                            <div ref={scrollRef} />
                          </>
                        )}
                      </div>
                    </ScrollArea>

                    {/* Input */}
                    <div className="flex gap-2">
                      <Input
                        placeholder={`Escribe un mensaje para ${selectedAgent.name}...`}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !loading) {
                            handleSendMessage();
                          }
                        }}
                        disabled={loading}
                        className="flex-1"
                      />
                      <Button
                        onClick={handleSendMessage}
                        disabled={loading || !inputValue.trim()}
                        className="bg-blue-500 hover:bg-blue-600"
                      >
                        {loading ? (
                          <Loader2 className="animate-spin" size={18} />
                        ) : (
                          <Send size={18} />
                        )}
                      </Button>
                      {messages.length > 0 && (
                        <Button
                          onClick={handleDownloadChat}
                          variant="outline"
                          title="Descargar chat"
                        >
                          <Download size={18} />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </TabsContent>

                {/* Config Tab */}
                <TabsContent value="config" className="flex-1 overflow-auto">
                  <CardContent className="p-6 space-y-6">
                    {/* Agent Info */}
                    <div className="bg-slate-100 p-4 rounded-lg">
                      <h3 className="font-bold mb-3">Información del Agente</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-600">ID:</span>
                          <span className="font-mono">{selectedAgent.id}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Versión:</span>
                          <span>{selectedAgent.version}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Estado:</span>
                          <span className="font-bold text-green-600">
                            {selectedAgent.status === "online" ? "✓ Online" : "✗ Offline"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* System Prompt */}
                    <div>
                      <label className="block text-sm font-semibold mb-2">System Prompt</label>
                      <textarea
                        value={systemPrompt}
                        onChange={(e) => setSystemPrompt(e.target.value)}
                        className="w-full h-32 p-3 border border-slate-300 rounded-lg text-sm font-mono"
                        placeholder="Instrucciones para el agente..."
                      />
                    </div>

                    {/* Parameters */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold mb-2">Temperatura</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min="0"
                            max="2"
                            step="0.1"
                            value={temperature}
                            onChange={(e) => setTemperature(parseFloat(e.target.value))}
                            className="flex-1"
                          />
                          <span className="text-sm font-mono w-12">{temperature.toFixed(1)}</span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1">0 = Determinístico, 2 = Creativo</p>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold mb-2">Max Tokens</label>
                        <Input
                          type="number"
                          value={maxTokens}
                          onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                          min="100"
                          max="10000"
                          step="100"
                        />
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-4 border-t">
                      <Button className="flex-1 bg-blue-500 hover:bg-blue-600">
                        <RefreshCw size={16} className="mr-2" />
                        Reiniciar Agente
                      </Button>
                      <Button variant="outline" className="flex-1">
                        <CheckCircle2 size={16} className="mr-2" />
                        Guardar Cambios
                      </Button>
                    </div>
                  </CardContent>
                </TabsContent>
              </Tabs>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
