import React, { useState, useEffect } from 'react';
import { apiMonitorService } from '@/services/apiMonitorService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Activity,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  XCircle,
  Zap,
  Cloud,
  Database,
  Server,
  Clock
} from 'lucide-react';

const getStatusIcon = (status) => {
  switch (status) {
    case 'healthy':
      return <CheckCircle className="w-5 h-5 text-emerald-400" />;
    case 'degraded':
      return <AlertCircle className="w-5 h-5 text-amber-400" />;
    case 'unhealthy':
      return <XCircle className="w-5 h-5 text-red-400" />;
    case 'rate-limited':
      return <Zap className="w-5 h-5 text-orange-400" />;
    default:
      return <Activity className="w-5 h-5 text-zinc-400" />;
  }
};

const getStatusColor = (status) => {
  switch (status) {
    case 'healthy':
      return 'bg-emerald-900/20 border-emerald-700/50';
    case 'degraded':
      return 'bg-amber-900/20 border-amber-700/50';
    case 'unhealthy':
      return 'bg-red-900/20 border-red-700/50';
    case 'rate-limited':
      return 'bg-orange-900/20 border-orange-700/50';
    default:
      return 'bg-zinc-800/50 border-zinc-700/50';
  }
};

const getStatusBadge = (status) => {
  switch (status) {
    case 'healthy':
      return { label: 'En línea', color: 'bg-emerald-500/20 text-emerald-400 border-0' };
    case 'degraded':
      return { label: 'Degradado', color: 'bg-amber-500/20 text-amber-400 border-0' };
    case 'unhealthy':
      return { label: 'Offline', color: 'bg-red-500/20 text-red-400 border-0' };
    case 'rate-limited':
      return { label: 'Rate Limit', color: 'bg-orange-500/20 text-orange-400 border-0' };
    default:
      return { label: 'Desconocido', color: 'bg-zinc-500/20 text-zinc-400 border-0' };
  }
};

const getProviderIcon = (provider) => {
  switch (provider) {
    case 'Ollama':
      return <Database className="w-5 h-5" />;
    case 'Google Gemini':
      return <Cloud className="w-5 h-5" />;
    case 'OpenRouter':
      return <Cloud className="w-5 h-5" />;
    case 'Anthropic Claude':
      return <Cloud className="w-5 h-5" />;
    case 'NVIDIA':
      return <Cloud className="w-5 h-5" />;
    case 'SynK-IA Backend':
      return <Server className="w-5 h-5" />;
    default:
      return <Activity className="w-5 h-5" />;
  }
};

export default function APIMonitor() {
  const [monitoring, setMonitoring] = useState(false);
  const [results, setResults] = useState(null);
  const [summary, setSummary] = useState(null);
  const [lastCheck, setLastCheck] = useState(null);

  const performCheck = async () => {
    setMonitoring(true);
    try {
      const apiResults = await apiMonitorService.checkAllApis();
      setResults(apiResults);
      const summaryData = apiMonitorService.getSummary(apiResults);
      setSummary(summaryData);
      setLastCheck(new Date());
    } catch (error) {
      console.error('Error checking APIs:', error);
    } finally {
      setMonitoring(false);
    }
  };

  useEffect(() => {
    performCheck();
    const interval = setInterval(performCheck, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (!results || !summary) {
    return (
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-cyan-400" />
            Monitor de APIs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 text-cyan-400 animate-spin" />
            <span className="text-zinc-400 ml-2">Verificando APIs...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-zinc-900/50 border-zinc-800">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-cyan-400" />
            Monitor de APIs
          </CardTitle>
          <p className="text-sm text-zinc-400 mt-1">
            {lastCheck && (
              <>
                Última verificación: {lastCheck.toLocaleTimeString('es-ES')}
              </>
            )}
          </p>
        </div>
        <Button
          onClick={performCheck}
          disabled={monitoring}
          size="sm"
          className="bg-cyan-600 hover:bg-cyan-700 text-white"
        >
          {monitoring ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Verificando...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4 mr-2" />
              Actualizar
            </>
          )}
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-emerald-900/20 border border-emerald-700/50 rounded-lg p-3">
            <p className="text-emerald-400/80 text-xs font-medium">Operativos</p>
            <p className="text-2xl font-bold text-emerald-400 mt-1">
              {summary.healthy}/{summary.healthy + summary.unhealthy + summary.degraded}
            </p>
          </div>
          
          <div className="bg-amber-900/20 border border-amber-700/50 rounded-lg p-3">
            <p className="text-amber-400/80 text-xs font-medium">Degradados</p>
            <p className="text-2xl font-bold text-amber-400 mt-1">{summary.degraded}</p>
          </div>
          
          <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-3">
            <p className="text-red-400/80 text-xs font-medium">Offline</p>
            <p className="text-2xl font-bold text-red-400 mt-1">{summary.unhealthy}</p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-zinc-400 text-sm">Salud General del Sistema</p>
            <span className="text-cyan-400 font-semibold">{summary.percentage}%</span>
          </div>
          <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
            <div
              className={summary.percentage >= 80 ? 'bg-emerald-500' : summary.percentage >= 50 ? 'bg-amber-500' : 'bg-red-500'}
              style={{ width: `${summary.percentage}%`, height: '100%', transition: 'all 0.3s' }}
            />
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="text-zinc-400 text-sm font-medium">Estado de Proveedores</h4>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {results.apis.map((api, idx) => {
              const badge = getStatusBadge(api.status);
              return (
                <div
                  key={idx}
                  className={`p-3 rounded-lg border ${getStatusColor(api.status)}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="text-cyan-400">
                        {getProviderIcon(api.provider)}
                      </div>
                      <div className="flex-1">
                        <p className="text-white font-medium text-sm">
                          {api.provider}
                        </p>
                        <p className="text-zinc-400 text-xs">
                          {api.message}
                          {api.latency !== undefined && api.latency > 0 && (
                            <>
                              {' • '}
                              <Clock className="w-3 h-3 inline mr-1" />
                              {api.latency}ms
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(api.status)}
                      <Badge className={badge.color}>
                        {badge.label}
                      </Badge>
                    </div>
                  </div>

                  {api.status === 'healthy' && (
                    <div className="mt-2 text-xs text-zinc-500 space-y-1">
                      {api.models && (
                        <p>📦 {api.models} modelos disponibles</p>
                      )}
                      {api.usage !== undefined && (
                        <p>💰 Uso: ${api.usage.toFixed(2)}</p>
                      )}
                      {api.uptime && (
                        <p>⏱️ Uptime: {api.uptime}s</p>
                      )}
                      {api.aiEngine && (
                        <p>🧠 Engine: {api.aiEngine}</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-zinc-700/50">
          <p className="text-zinc-500 text-xs">
            ℹ️ El monitor se actualiza automáticamente cada 5 minutos. Puedes hacer clic en "Actualizar" para una verificación inmediata.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
