import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  Cpu,
  Database,
  Wifi,
  HardDrive,
  Zap,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function SystemHealth() {
  const [metrics, setMetrics] = useState({
    cpu: 45,
    memory: 62,
    storage: 38,
    network: 95,
    uptime: 99.9
  });

  const [history, setHistory] = useState([]);

  useEffect(() => {
    const interval = setInterval(() => {
      // Simulación de métricas en tiempo real
      setMetrics({
        cpu: 40 + Math.random() * 20,
        memory: 55 + Math.random() * 15,
        storage: 35 + Math.random() * 10,
        network: 90 + Math.random() * 10,
        uptime: 99.5 + Math.random() * 0.5
      });

      setHistory(prev => {
        const newHistory = [...prev, {
          time: new Date().toLocaleTimeString(),
          cpu: 40 + Math.random() * 20,
          memory: 55 + Math.random() * 15
        }];
        return newHistory.slice(-10);
      });
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (value, inverse = false) => {
    if (inverse) {
      if (value < 50) return 'text-green-400';
      if (value < 75) return 'text-yellow-400';
      return 'text-red-400';
    }
    if (value > 90) return 'text-green-400';
    if (value > 70) return 'text-yellow-400';
    return 'text-red-400';
  };

  const services = [
    { name: 'API Gateway', status: 'online', latency: '45ms' },
    { name: 'Database', status: 'online', latency: '12ms' },
    { name: 'Revo Sync', status: 'online', latency: '230ms' },
    { name: 'ESEECLOUD', status: 'online', latency: '180ms' },
    { name: 'Email Service', status: 'online', latency: '95ms' },
    { name: 'IA Engine', status: 'online', latency: '520ms' }
  ];

  return (
    <Card className="border-none shadow-2xl bg-gradient-to-br from-slate-800 to-slate-900">
      <CardHeader className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-t-xl">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3">
            <Activity className="w-7 h-7 animate-pulse" />
            ⚡ SALUD DEL SISTEMA
          </CardTitle>
          <Badge className="bg-green-500 text-white flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            ALL SYSTEMS GO
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="p-6 space-y-6">
        {/* Métricas en Tiempo Real */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="bg-slate-900/50 p-4 rounded-xl border border-cyan-700/50">
            <div className="flex items-center justify-between mb-2">
              <Cpu className="w-5 h-5 text-cyan-400" />
              <span className={`text-2xl font-black ${getStatusColor(metrics.cpu, true)}`}>
                {metrics.cpu.toFixed(0)}%
              </span>
            </div>
            <p className="text-xs text-gray-400">CPU</p>
          </div>

          <div className="bg-slate-900/50 p-4 rounded-xl border border-purple-700/50">
            <div className="flex items-center justify-between mb-2">
              <Database className="w-5 h-5 text-purple-400" />
              <span className={`text-2xl font-black ${getStatusColor(metrics.memory, true)}`}>
                {metrics.memory.toFixed(0)}%
              </span>
            </div>
            <p className="text-xs text-gray-400">RAM</p>
          </div>

          <div className="bg-slate-900/50 p-4 rounded-xl border border-blue-700/50">
            <div className="flex items-center justify-between mb-2">
              <HardDrive className="w-5 h-5 text-blue-400" />
              <span className={`text-2xl font-black ${getStatusColor(metrics.storage, true)}`}>
                {metrics.storage.toFixed(0)}%
              </span>
            </div>
            <p className="text-xs text-gray-400">Storage</p>
          </div>

          <div className="bg-slate-900/50 p-4 rounded-xl border border-green-700/50">
            <div className="flex items-center justify-between mb-2">
              <Wifi className="w-5 h-5 text-green-400" />
              <span className={`text-2xl font-black ${getStatusColor(metrics.network)}`}>
                {metrics.network.toFixed(0)}%
              </span>
            </div>
            <p className="text-xs text-gray-400">Network</p>
          </div>

          <div className="bg-slate-900/50 p-4 rounded-xl border border-yellow-700/50">
            <div className="flex items-center justify-between mb-2">
              <Zap className="w-5 h-5 text-yellow-400" />
              <span className="text-2xl font-black text-green-400">
                {metrics.uptime.toFixed(1)}%
              </span>
            </div>
            <p className="text-xs text-gray-400">Uptime</p>
          </div>
        </div>

        {/* Gráfico Histórico */}
        {history.length > 0 && (
          <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700">
            <h3 className="text-white font-bold mb-3 text-sm">Histórico (Últimos 30s)</h3>
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                <XAxis dataKey="time" stroke="#888" tick={{ fontSize: 10 }} />
                <YAxis stroke="#888" tick={{ fontSize: 10 }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1e293b', 
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                />
                <Line type="monotone" dataKey="cpu" stroke="#06b6d4" strokeWidth={2} dot={false} name="CPU %" />
                <Line type="monotone" dataKey="memory" stroke="#a855f7" strokeWidth={2} dot={false} name="RAM %" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Estado de Servicios */}
        <div>
          <h3 className="text-white font-bold mb-3 text-sm flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            Servicios Activos
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {services.map((service, idx) => (
              <div 
                key={idx}
                className="bg-slate-900/50 p-3 rounded-lg border border-slate-700 flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  <span className="text-white text-xs font-medium">{service.name}</span>
                </div>
                <span className="text-xs text-gray-400">{service.latency}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}