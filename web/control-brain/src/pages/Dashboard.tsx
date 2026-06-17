import React from 'react';
import { useApi } from '../hooks/useApi';
import { SystemHealthCard } from '../components/SystemHealthCard';

interface StatusResponse {
  success: boolean;
  timestamp: number;
  system: {
    gateway_alive: boolean;
    sinkia_online: boolean;
    gateway_online: boolean;
  };
  metrics: {
    total_tasks: number;
    total_cost: number;
    avg_latency_ms: number;
    provider_stats: any[];
  };
  recent_tasks: any[];
  active_alerts: number;
}

export const Dashboard: React.FC = () => {
  const { data: status, loading: statusLoading } = useApi<StatusResponse>(
    '/api/control/status',
    { refetchInterval: 5000 }
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">🧠 Control Brain</h1>
        <p className="text-gray-600">Dashboard centralizado de Sinkia</p>
      </div>

      {/* Grid principal */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* System Health */}
        <div className="md:col-span-1">
          <SystemHealthCard 
            health={status?.system || null}
            loading={statusLoading}
          />
        </div>

        {/* Quick Stats */}
        <div className="md:col-span-2">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Total Tasks */}
            <div className="card">
              <div className="text-sm text-gray-600">Total de Tareas</div>
              <div className="text-3xl font-bold text-brand-600">
                {statusLoading ? '...' : status?.metrics.total_tasks || 0}
              </div>
            </div>

            {/* Total Cost */}
            <div className="card">
              <div className="text-sm text-gray-600">Costo Total</div>
              <div className="text-3xl font-bold text-green-600">
                ${statusLoading ? '...' : (status?.metrics.total_cost || 0).toFixed(2)}
              </div>
            </div>

            {/* Avg Latency */}
            <div className="card">
              <div className="text-sm text-gray-600">Latencia Promedio</div>
              <div className="text-3xl font-bold text-blue-600">
                {statusLoading ? '...' : (status?.metrics.avg_latency_ms || 0).toFixed(0)}ms
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {!statusLoading && status && status.active_alerts > 0 && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
          <div className="flex">
            <div className="flex-shrink-0">
              <span className="text-2xl">⚠️</span>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                {status.active_alerts} alerta{status.active_alerts !== 1 ? 's' : ''} activa{status.active_alerts !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Recent Tasks */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-xl font-bold">Tareas Recientes</h2>
        </div>
        {statusLoading ? (
          <div className="animate-pulse space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-200 rounded"></div>
            ))}
          </div>
        ) : status?.recent_tasks.length ? (
          <div className="space-y-3">
            {status.recent_tasks.map((task: any) => (
              <div key={task.id} className="border-b pb-3 last:border-b-0">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-gray-900">{task.agent}</p>
                    <p className="text-sm text-gray-600 truncate">{task.prompt.substring(0, 50)}...</p>
                  </div>
                  <span className={`status-badge ${task.status === 'completed' ? 'status-online' : task.status === 'failed' ? 'status-offline' : 'status-unknown'}`}>
                    {task.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-600">Sin tareas recientes</p>
        )}
      </div>
    </div>
  );
};
