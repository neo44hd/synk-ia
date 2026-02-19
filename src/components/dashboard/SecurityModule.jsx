import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Shield,
  Camera,
  Users,
  AlertTriangle,
  Eye,
  Activity,
  Lock,
  CheckCircle2
} from "lucide-react";

export default function SecurityModule() {
  const [events] = useState([
    {
      type: 'facial_check',
      user: 'María García',
      camera: 'Entrada Principal',
      time: '08:45',
      status: 'success',
      confidence: 98
    },
    {
      type: 'access_denied',
      camera: 'Almacén',
      time: '09:12',
      status: 'alert',
      reason: 'Persona no reconocida'
    },
    {
      type: 'facial_check',
      user: 'Juan Martínez',
      camera: 'Cocina',
      time: '09:30',
      status: 'success',
      confidence: 95
    },
    {
      type: 'motion_detected',
      camera: 'Mostrador',
      time: '10:05',
      status: 'info'
    }
  ]);

  const cameras = [
    { id: 1, name: 'Entrada Principal', status: 'online', fps: 30, resolution: '1080p' },
    { id: 2, name: 'Cocina', status: 'online', fps: 30, resolution: '1080p' },
    { id: 3, name: 'Mostrador', status: 'online', fps: 25, resolution: '720p' },
    { id: 4, name: 'Almacén', status: 'online', fps: 30, resolution: '1080p' }
  ];

  const statusColors = {
    success: 'bg-green-600',
    alert: 'bg-red-600',
    info: 'bg-blue-600',
    warning: 'bg-yellow-600'
  };

  const eventIcons = {
    facial_check: Users,
    access_denied: Lock,
    motion_detected: Activity
  };

  return (
    <Card className="border-none shadow-2xl bg-gradient-to-br from-slate-800 to-slate-900">
      <CardHeader className="bg-gradient-to-r from-red-600 to-orange-600 text-white rounded-t-xl">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3">
            <Shield className="w-7 h-7" />
            🛡️ SEGURIDAD & CONTROL
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse" />
            <span className="text-sm font-bold">ACTIVO</span>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-6 space-y-6">
        {/* Estado Cámaras */}
        <div>
          <h3 className="text-white font-bold mb-3 flex items-center gap-2">
            <Camera className="w-5 h-5 text-red-400" />
            Estado Cámaras ESEECLOUD
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {cameras.map((cam) => (
              <div 
                key={cam.id}
                className="bg-slate-900/50 p-4 rounded-xl border border-slate-700 hover:border-red-500 transition-all group cursor-pointer"
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="text-white font-bold text-sm">{cam.name}</p>
                  <Badge className={cam.status === 'online' ? 'bg-green-600' : 'bg-red-600'}>
                    {cam.status === 'online' ? '● LIVE' : '○ OFF'}
                  </Badge>
                </div>
                <div className="flex gap-3 text-xs text-gray-400">
                  <span>📹 {cam.resolution}</span>
                  <span>⚡ {cam.fps}fps</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Eventos Recientes */}
        <div>
          <h3 className="text-white font-bold mb-3 flex items-center gap-2">
            <Activity className="w-5 h-5 text-yellow-400" />
            Eventos de Seguridad (Últimos)
          </h3>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {events.map((event, idx) => {
              const Icon = eventIcons[event.type] || Activity;
              return (
                <div 
                  key={idx}
                  className="bg-slate-900/50 p-3 rounded-lg border border-slate-700 hover:border-slate-600 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${statusColors[event.status]}`}>
                        <Icon className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <p className="text-white font-medium text-sm">
                          {event.type === 'facial_check' && `Fichaje: ${event.user}`}
                          {event.type === 'access_denied' && 'Acceso Denegado'}
                          {event.type === 'motion_detected' && 'Movimiento Detectado'}
                        </p>
                        <p className="text-xs text-gray-400">
                          📍 {event.camera} • 🕐 {event.time}
                        </p>
                      </div>
                    </div>
                    {event.confidence && (
                      <Badge className="bg-green-900 text-green-300">
                        {event.confidence}%
                      </Badge>
                    )}
                  </div>
                  {event.reason && (
                    <p className="text-xs text-red-400 mt-2 ml-12">⚠️ {event.reason}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Stats Rápidas */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gradient-to-br from-green-900/30 to-emerald-900/30 p-4 rounded-xl border border-green-700">
            <p className="text-gray-400 text-xs mb-1">Fichajes Hoy</p>
            <p className="text-3xl font-black text-white">24</p>
            <p className="text-xs text-green-400 mt-1">
              <CheckCircle2 className="w-3 h-3 inline mr-1" />
              100% facial
            </p>
          </div>
          <div className="bg-gradient-to-br from-blue-900/30 to-cyan-900/30 p-4 rounded-xl border border-blue-700">
            <p className="text-gray-400 text-xs mb-1">Alertas</p>
            <p className="text-3xl font-black text-white">2</p>
            <p className="text-xs text-blue-400 mt-1">
              <AlertTriangle className="w-3 h-3 inline mr-1" />
              No críticas
            </p>
          </div>
          <div className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 p-4 rounded-xl border border-purple-700">
            <p className="text-gray-400 text-xs mb-1">Uptime</p>
            <p className="text-3xl font-black text-white">99.8%</p>
            <p className="text-xs text-purple-400 mt-1">
              <Activity className="w-3 h-3 inline mr-1" />
              Óptimo
            </p>
          </div>
        </div>

        <Link to={createPageUrl("SecurityCameras")}>
          <Button className="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700">
            <Eye className="w-4 h-4 mr-2" />
            Ver Panel Completo de Seguridad
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}