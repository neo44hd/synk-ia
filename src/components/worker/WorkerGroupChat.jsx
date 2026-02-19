import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Users, Send } from "lucide-react";

export default function WorkerGroupChat({ onClose, user }) {
  const [messages, setMessages] = useState([
    { id: 1, from: 'Juan', text: '¿Quién cubre el turno de tarde?', time: '09:15' },
    { id: 2, from: 'María', text: 'Yo puedo cubrirlo', time: '09:17' },
    { id: 3, from: 'Admin', text: '✅ Confirmado. Gracias María', time: '09:18' },
  ]);
  const [inputMessage, setInputMessage] = useState('');

  const handleSend = () => {
    if (!inputMessage.trim()) return;
    
    setMessages([...messages, {
      id: messages.length + 1,
      from: user?.full_name || 'Yo',
      text: inputMessage,
      time: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    }]);
    setInputMessage('');
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl w-full max-w-2xl h-[80vh] flex flex-col border-2 border-orange-500/30 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-orange-700 rounded-2xl flex items-center justify-center">
              <Users className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Chat del Equipo</h2>
              <p className="text-orange-400 text-sm">12 miembros • 3 en línea</p>
            </div>
          </div>
          <Button
            onClick={onClose}
            variant="ghost"
            size="icon"
            className="text-slate-400 hover:text-white hover:bg-slate-700 rounded-full"
          >
            <X className="w-6 h-6" />
          </Button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((msg) => {
            const isMe = msg.from === user?.full_name || msg.from === 'Yo';
            return (
              <div
                key={msg.id}
                className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[70%] ${
                  isMe
                    ? 'bg-orange-600 text-white'
                    : 'bg-slate-700 text-white'
                } rounded-2xl px-4 py-3`}>
                  {!isMe && <p className="text-xs text-orange-300 font-semibold mb-1">{msg.from}</p>}
                  <p className="text-sm">{msg.text}</p>
                  <p className="text-xs opacity-70 mt-1">{msg.time}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Input */}
        <div className="p-6 border-t border-slate-700">
          <div className="flex gap-3">
            <Input
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Escribe al equipo..."
              className="flex-1 bg-slate-800 border-slate-600 text-white"
            />
            <Button onClick={handleSend} className="bg-orange-600 hover:bg-orange-700">
              <Send className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}