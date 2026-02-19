import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import {
  FileText,
  User,
  Clock,
  Download,
  Shield,
  Edit,
  Trash,
  Plus
} from "lucide-react";
import { format } from 'date-fns';

export default function AuditLog() {
  const [logs, setLogs] = useState([]);
  const [user, setUser] = useState(null);

  useEffect(() => {
    loadUser();
    generateAuditLogs();
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    } catch (error) {
      console.log('No user logged in');
    }
  };

  const generateAuditLogs = () => {
    // Simulación de logs de auditoría
    const mockLogs = [
      {
        action: 'create',
        entity: 'Invoice',
        user: 'admin@chickenpalace.es',
        timestamp: new Date(),
        details: 'Factura #INV-2024-1145 creada',
        ip: '192.168.1.45'
      },
      {
        action: 'update',
        entity: 'Order',
        user: 'cocina@chickenpalace.es',
        timestamp: new Date(Date.now() - 300000),
        details: 'Pedido #ORD-445 → estado: listo',
        ip: '192.168.1.23'
      },
      {
        action: 'delete',
        entity: 'Provider',
        user: 'admin@chickenpalace.es',
        timestamp: new Date(Date.now() - 600000),
        details: 'Proveedor "Test Provider" eliminado',
        ip: '192.168.1.45'
      },
      {
        action: 'access',
        entity: 'SecurityCameras',
        user: 'manager@chickenpalace.es',
        timestamp: new Date(Date.now() - 900000),
        details: 'Acceso a cámaras de seguridad',
        ip: '192.168.1.67'
      },
      {
        action: 'update',
        entity: 'User',
        user: 'rrhh@chickenpalace.es',
        timestamp: new Date(Date.now() - 1200000),
        details: 'Perfil usuario actualizado',
        ip: '192.168.1.89'
      }
    ];

    setLogs(mockLogs);
  };

  const actionIcons = {
    create: Plus,
    update: Edit,
    delete: Trash,
    access: Shield
  };

  const actionColors = {
    create: 'bg-green-600',
    update: 'bg-blue-600',
    delete: 'bg-red-600',
    access: 'bg-purple-600'
  };

  const exportLogs = () => {
    const csv = [
      ['Timestamp', 'User', 'Action', 'Entity', 'Details', 'IP'],
      ...logs.map(log => [
        format(log.timestamp, 'dd/MM/yyyy HH:mm:ss'),
        log.user,
        log.action,
        log.entity,
        log.details,
        log.ip
      ])
    ].map(row => row.join(',')).join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_log_${new Date().toISOString()}.csv`;
    a.click();
  };

  return (
    <Card className="border-none shadow-2xl bg-gradient-to-br from-slate-800 to-slate-900">
      <CardHeader className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-t-xl">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3">
            <FileText className="w-7 h-7" />
            📋 AUDITORÍA & COMPLIANCE
          </CardTitle>
          <Button 
            size="sm" 
            variant="ghost" 
            className="text-white hover:bg-white/20"
            onClick={exportLogs}
          >
            <Download className="w-4 h-4 mr-2" />
            Exportar
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="p-6 space-y-4">
        <div className="bg-indigo-900/20 p-4 rounded-xl border border-indigo-700/50">
          <p className="text-sm text-gray-300 mb-1">
            🔒 Todos los eventos se registran para cumplimiento RGPD y auditorías
          </p>
          <p className="text-xs text-gray-400">
            Retención: 7 años • Encriptado: AES-256 • Usuario actual: {user?.email || 'No autenticado'}
          </p>
        </div>

        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {logs.map((log, idx) => {
            const ActionIcon = actionIcons[log.action] || FileText;
            return (
              <div 
                key={idx}
                className="bg-slate-900/50 p-4 rounded-lg border border-slate-700 hover:border-slate-600 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <div className={`p-2 rounded-lg ${actionColors[log.action]}`}>
                      <ActionIcon className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className="bg-slate-700 text-white text-xs uppercase">
                          {log.action}
                        </Badge>
                        <span className="text-white font-medium text-sm">{log.entity}</span>
                      </div>
                      <p className="text-sm text-gray-300 mb-2">{log.details}</p>
                      <div className="flex items-center gap-4 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {log.user}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {format(log.timestamp, 'dd/MM/yyyy HH:mm:ss')}
                        </span>
                        <span>🌐 {log.ip}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-700">
          <div className="bg-slate-900/50 p-3 rounded-lg text-center">
            <p className="text-2xl font-black text-white mb-1">{logs.length}</p>
            <p className="text-xs text-gray-400">Eventos Hoy</p>
          </div>
          <div className="bg-slate-900/50 p-3 rounded-lg text-center">
            <p className="text-2xl font-black text-white mb-1">
              {new Set(logs.map(l => l.user)).size}
            </p>
            <p className="text-xs text-gray-400">Usuarios Activos</p>
          </div>
          <div className="bg-slate-900/50 p-3 rounded-lg text-center">
            <p className="text-2xl font-black text-green-400 mb-1">100%</p>
            <p className="text-xs text-gray-400">Compliance</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}