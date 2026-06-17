import React from 'react';

interface SystemHealth {
  gateway_alive: boolean;
  sinkia_online: boolean;
  gateway_online: boolean;
}

interface Props {
  health: SystemHealth | null;
  loading: boolean;
}

export const SystemHealthCard: React.FC<Props> = ({ health, loading }) => {
  if (loading) {
    return (
      <div className="card">
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        </div>
      </div>
    );
  }

  if (!health) {
    return <div className="card text-red-600">Error cargando estado del sistema</div>;
  }

  const getStatusColor = (status: boolean) => status ? 'text-green-600' : 'text-red-600';
  const getStatusText = (status: boolean) => status ? '✓ En línea' : '✗ Desconectado';

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="text-xl font-bold">Estado del Sistema</h2>
      </div>
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-gray-700">Gateway LiteLLM:</span>
          <span className={`font-semibold ${getStatusColor(health.gateway_alive)}`}>
            {getStatusText(health.gateway_alive)}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-700">Sinkia API:</span>
          <span className={`font-semibold ${getStatusColor(health.sinkia_online)}`}>
            {getStatusText(health.sinkia_online)}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-700">Gateway Online:</span>
          <span className={`font-semibold ${getStatusColor(health.gateway_online)}`}>
            {getStatusText(health.gateway_online)}
          </span>
        </div>
      </div>
    </div>
  );
};
