import { useState, useEffect } from 'react';
import { Activity, Database, Radio, Settings, Terminal, RefreshCw, Server, Zap, Mail, Play, Pause, Trash2, Download, Loader, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import systemMonitorService from '../services/systemMonitorService';

const ControlPanelPro = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [dashboard, setDashboard] = useState(null);
  const [logs, setLogs] = useState('');
  const [agents, setAgents] = useState(null);
  const [models, setModels] = useState(null);
  const [ports, setPorts] = useState(null);
  const [config, setConfig] = useState(null);
  const [emailStats, setEmailStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [logsType, setLogsType] = useState('pm2');
  const [searchQuery, setSearchQuery] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [syncingEmail, setSyncingEmail] = useState(false);
  const [actionInProgress, setActionInProgress] = useState({});
  const [systemInfo, setSystemInfo] = useState(null);

  // Cargar datos
  const refreshData = async () => {
    try {
      setLoading(true);
      const [dash, log, ag, mod, p, cfg, email] = await Promise.all([
        systemMonitorService.getDashboard(),
        systemMonitorService.getLogs(logsType, '', 50),
        systemMonitorService.getAgents(),
        systemMonitorService.getModels(),
        systemMonitorService.getPorts(),
        systemMonitorService.getConfig(),
        systemMonitorService.getEmailStats()
      ]);
      setDashboard(dash);
      setLogs(log?.logs || '');
      setAgents(ag);
      setModels(mod);
      setPorts(p);
      setConfig(cfg);
      setEmailStats(email);
    } catch (err) {
      console.error('Error refreshing data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(refreshData, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  // ═══════════════════════════════════════════════════════════════════════════════
  // ACCIONES INTERACTIVAS
  // ═══════════════════════════════════════════════════════════════════════════════

  // Modelos mock cuando Ollama no está disponible
  const getMockModels = () => [
    { name: 'harmonic-hermes-9b:latest', details: 'Modelo general ágil', running: true, status: 'loaded' },
    { name: 'qwen3.5:latest', details: 'Modelo Qwen actualizado', running: false, status: 'available' },
    { name: 'qwen2.5-coder:14b', details: 'Especializado en código', running: false, status: 'available' },
    { name: 'mistral:latest', details: 'Modelo de propósito general', running: false, status: 'available' },
  ];

  const executeAction = async (action, params = {}) => {
    setActionInProgress({ ...actionInProgress, [action]: true });
    try {
      const result = await systemMonitorService.executeAction(action, params.service || '', params.query || '');
      if (result?.success || result?.message) {
        console.log(`✅ ${action}:`, result);
      } else {
        console.error(`❌ ${action}:`, result);
      }
      // Refrescar después de 1 segundo
      setTimeout(refreshData, 1000);
    } catch (err) {
      console.error(`Error en ${action}:`, err);
    } finally {
      setActionInProgress({ ...actionInProgress, [action]: false });
    }
  };

  const handleRestartAgent = async (agent) => {
    if (!confirm(`¿Reiniciar ${agent}?`)) return;
    await executeAction('restart_agent', { service: agent });
  };

  const handleStopAgent = async (agent) => {
    if (!confirm(`¿Detener ${agent}?`)) return;
    await executeAction('stop_service', { service: agent });
  };

  const handleStartAgent = async (agent) => {
    await executeAction('start_service', { service: agent });
  };

  const handleLoadModel = async (model) => {
    if (!confirm(`¿Cargar modelo ${model}?`)) return;
    await executeAction('load_model', { service: model });
  };

  const handleUnloadModel = async (model) => {
    if (!confirm(`¿Descargar ${model} de memoria?`)) return;
    await executeAction('unload_model', { service: model });
  };

  const handleClearCache = async () => {
    if (!confirm('¿Limpiar caché del sistema?')) return;
    await executeAction('clear_cache');
  };

  const handleOptimizeMemory = async () => {
    if (!confirm('¿Optimizar memoria? Esto puede detener procesos temporales')) return;
    await executeAction('optimize_memory');
  };

  const handleSyncEmail = async () => {
    setSyncingEmail(true);
    try {
      const result = await systemMonitorService.syncEmails();
      if (result?.success) {
        alert('✅ Sincronización de emails completada');
        setTimeout(refreshData, 1000);
      }
    } catch (err) {
      console.error('Error syncing emails:', err);
    } finally {
      setSyncingEmail(false);
    }
  };

  const handleSearchLogs = async () => {
    if (!searchQuery) return;
    const result = await systemMonitorService.executeAction('search_logs', '', searchQuery);
    if (result && Array.isArray(result)) {
      const text = result.map(r => `[${r.source}]\n${r.matches.join('\n')}`).join('\n---\n');
      setLogs(text);
    }
  };

  const tabs = [
    { id: 'overview', label: '📊 Overview' },
    { id: 'agents', label: '🤖 Agents' },
    { id: 'models', label: '🧠 Models' },
    { id: 'logs', label: '📝 Logs' },
    { id: 'network', label: '🌐 Network' },
    { id: 'email', label: '📧 Email' },
    { id: 'config', label: '⚙️ Config' }
  ];

  // Agent status helpers
  const getAgentStatus = (agent) => {
    if (!agents?.processes) return 'unknown';
    const proc = agents.processes.find(p => p.name.toLowerCase().includes(agent.toLowerCase()));
    return proc?.status || 'offline';
  };

  const getStatusColor = (status) => {
    const statusLower = status?.toLowerCase() || '';
    if (statusLower === 'online' || statusLower === 'running') return 'text-green-400';
    if (statusLower === 'stopped') return 'text-red-400';
    return 'text-yellow-400';
  };

  if (loading && !dashboard) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900 text-white">
        <div className="text-center">
          <RefreshCw className="animate-spin mx-auto mb-4" size={40} />
          <p>Cargando panel de control...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 p-4 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Server size={24} className="text-blue-400" />
          <h1 className="text-2xl font-bold">🚀 Control Panel Pro</h1>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm">Auto-refresh (5s)</span>
          </label>
          <button 
            onClick={refreshData} 
            className="p-2 hover:bg-slate-700 rounded transition"
            disabled={loading}
          >
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-700 bg-slate-800 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 font-medium transition whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-b-2 border-blue-500 text-blue-400'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        {/* ═══════════════════════════════════════════════════════════════════════════════ */}
        {/* OVERVIEW */}
        {/* ═══════════════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'overview' && dashboard && (
          <div className="space-y-6">
            {/* Métricas principales */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-slate-800 to-slate-700 p-6 rounded-lg border border-slate-700 hover:border-blue-500 transition">
                <p className="text-slate-400 text-sm">CPU Usage</p>
                <p className="text-4xl font-bold text-blue-400 mt-2">
                  {dashboard.overview?.cpu_usage || 0}%
                </p>
                <div className="mt-3 h-2 bg-slate-600 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-500 to-blue-400"
                    style={{ width: `${dashboard.overview?.cpu_usage || 0}%` }}
                  />
                </div>
              </div>

              <div className="bg-gradient-to-br from-slate-800 to-slate-700 p-6 rounded-lg border border-slate-700 hover:border-yellow-500 transition">
                <p className="text-slate-400 text-sm">Memory</p>
                <p className="text-4xl font-bold text-yellow-400 mt-2">
                  {dashboard.overview?.memory_used_mb || 0}MB
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  / {dashboard.overview?.memory_total_mb || 0}MB
                </p>
                <button
                  onClick={handleOptimizeMemory}
                  disabled={actionInProgress['optimize_memory']}
                  className="mt-3 px-3 py-1 bg-yellow-600 hover:bg-yellow-500 rounded text-xs font-medium transition disabled:opacity-50"
                >
                  {actionInProgress['optimize_memory'] ? '⏳ Optimizando...' : '🧹 Optimizar'}
                </button>
              </div>

              <div className="bg-gradient-to-br from-slate-800 to-slate-700 p-6 rounded-lg border border-slate-700 hover:border-green-500 transition">
                <p className="text-slate-400 text-sm">Services</p>
                <p className="text-4xl font-bold text-green-400 mt-2">
                  {dashboard.overview?.services_online || 0}/{dashboard.overview?.services_total || 0}
                </p>
                <p className="text-xs text-slate-400 mt-1">Online</p>
              </div>

              <div className="bg-gradient-to-br from-slate-800 to-slate-700 p-6 rounded-lg border border-slate-700 hover:border-purple-500 transition">
                <p className="text-slate-400 text-sm">Uptime</p>
                <p className="text-4xl font-bold text-purple-400 mt-2">
                  {dashboard.overview?.uptime_hours || 0}h
                </p>
                <p className="text-xs text-slate-400 mt-1">Online</p>
              </div>
            </div>

            {/* Top Processes */}
            <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Activity size={20} className="text-green-400" /> Top Processes
              </h2>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {dashboard.processes?.map((p, i) => (
                  <div key={i} className="flex justify-between items-center p-3 bg-slate-700 rounded hover:bg-slate-600 transition">
                    <div>
                      <p className="font-mono text-sm font-bold">{p.name}</p>
                      <p className="text-xs text-slate-400">{p.pid ? `PID: ${p.pid}` : ''}</p>
                    </div>
                    <span className={`font-bold text-sm ${getStatusColor(p.status)}`}>
                      {p.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════════════ */}
        {/* AGENTS TAB - INTERACTIVO */}
        {/* ═══════════════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'agents' && (
          <div className="space-y-6">
            <div className="bg-blue-900/30 border border-blue-700 p-4 rounded-lg flex items-start gap-3">
              <AlertCircle className="text-blue-400 flex-shrink-0 mt-1" size={20} />
              <div className="text-sm">
                <p className="font-bold">Agentes Disponibles</p>
                <p className="text-slate-400">Controla, reinicia o detén agentes IA</p>
              </div>
            </div>

            {/* Lista de agentes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {['claude-code', 'opencode', 'hermes', 'openclaw', 'aider', 'ollama'].map(agent => {
                const isRunning = getAgentStatus(agent) === 'online';
                const isLoading = actionInProgress[`agent_${agent}`];
                
                return (
                  <div key={agent} className="bg-slate-800 p-4 rounded-lg border border-slate-700 hover:border-slate-600 transition">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <p className="font-bold text-lg capitalize">{agent}</p>
                        <p className={`text-sm font-bold mt-1 ${isRunning ? 'text-green-400' : 'text-red-400'}`}>
                          {isRunning ? '● Online' : '● Offline'}
                        </p>
                      </div>
                      {isRunning && <CheckCircle className="text-green-400" size={20} />}
                      {!isRunning && <XCircle className="text-red-400" size={20} />}
                    </div>

                    <div className="flex gap-2">
                      {isRunning ? (
                        <>
                          <button
                            onClick={() => handleRestartAgent(agent)}
                            disabled={isLoading}
                            className="flex-1 px-3 py-2 bg-orange-600 hover:bg-orange-500 rounded text-sm font-medium transition disabled:opacity-50 flex items-center justify-center gap-1"
                          >
                            {isLoading ? <Loader size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                            Reiniciar
                          </button>
                          <button
                            onClick={() => handleStopAgent(agent)}
                            disabled={isLoading}
                            className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-500 rounded text-sm font-medium transition disabled:opacity-50 flex items-center justify-center gap-1"
                          >
                            {isLoading ? <Loader size={14} className="animate-spin" /> : <Pause size={14} />}
                            Detener
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleStartAgent(agent)}
                          disabled={isLoading}
                          className="w-full px-3 py-2 bg-green-600 hover:bg-green-500 rounded text-sm font-medium transition disabled:opacity-50 flex items-center justify-center gap-1"
                        >
                          {isLoading ? <Loader size={14} className="animate-spin" /> : <Play size={14} />}
                          Iniciar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Debug info */}
            {agents?.processes && (
              <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                <h3 className="font-bold mb-3">Procesos Detectados</h3>
                <div className="space-y-1 text-sm font-mono">
                  {agents.processes.map((p, i) => (
                    <p key={i} className="text-slate-400">
                      {p.name} <span className="text-green-400">({p.status})</span>
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════════════ */}
        {/* MODELS TAB - INTERACTIVO */}
        {/* ═══════════════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'models' && (
          <div className="space-y-6">
            <div className="bg-purple-900/30 border border-purple-700 p-4 rounded-lg flex items-start gap-3">
              <AlertCircle className="text-purple-400 flex-shrink-0 mt-1" size={20} />
              <div className="text-sm">
                <p className="font-bold">Modelos IA Disponibles</p>
                <p className="text-slate-400">Carga/descarga modelos para optimizar memoria</p>
              </div>
            </div>

            {(() => {
              // Usar modelos del API si están disponibles, sino usar mock
              const modelsToDisplay = (models?.models && models.models.length > 0) 
                ? models.models 
                : getMockModels();
              
              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {modelsToDisplay.map((model, idx) => {
                    const isLoaded = model.running || model.status === 'loaded';
                    const isLoading = actionInProgress[`model_${model.name}`];
                    
                    return (
                      <div key={idx} className="bg-slate-800 p-4 rounded-lg border border-slate-700 hover:border-slate-600 transition">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <p className="font-bold text-sm">{model.name}</p>
                            <p className="text-xs text-slate-400 mt-1">{model.details || 'Ollama Model'}</p>
                          </div>
                          {isLoaded && <CheckCircle className="text-green-400" size={18} />}
                        </div>

                        <div className="mb-3">
                          <p className={`text-xs font-bold ${isLoaded ? 'text-green-400' : 'text-yellow-400'}`}>
                            {isLoaded ? '✓ Cargado' : '○ Descargado'}
                          </p>
                        </div>

                        {isLoaded ? (
                          <button
                            onClick={() => handleUnloadModel(model.name)}
                            disabled={isLoading}
                            className="w-full px-3 py-2 bg-red-600 hover:bg-red-500 rounded text-xs font-medium transition disabled:opacity-50 flex items-center justify-center gap-1"
                          >
                            {isLoading ? <Loader size={12} className="animate-spin" /> : <Trash2 size={12} />}
                            Descargar
                          </button>
                        ) : (
                          <button
                            onClick={() => handleLoadModel(model.name)}
                            disabled={isLoading}
                            className="w-full px-3 py-2 bg-green-600 hover:bg-green-500 rounded text-xs font-medium transition disabled:opacity-50 flex items-center justify-center gap-1"
                          >
                            {isLoading ? <Loader size={12} className="animate-spin" /> : <Download size={12} />}
                            Cargar
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════════════ */}
        {/* LOGS TAB */}
        {/* ═══════════════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'logs' && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Buscar en logs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchLogs()}
                className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded text-sm text-white placeholder-slate-400"
              />
              <select
                value={logsType}
                onChange={(e) => setLogsType(e.target.value)}
                className="px-3 py-2 bg-slate-700 border border-slate-600 rounded text-sm text-white"
              >
                <option value="pm2">PM2</option>
                <option value="system">System</option>
                <option value="app">App</option>
                <option value="all">All</option>
              </select>
              <button
                onClick={handleSearchLogs}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm font-medium transition"
              >
                Search
              </button>
            </div>

            <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 h-96 overflow-y-auto font-mono text-xs">
              {logs ? (
                <pre className="text-slate-300 whitespace-pre-wrap break-words">{logs}</pre>
              ) : (
                <p className="text-slate-500">No hay logs disponibles</p>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════════════ */}
        {/* EMAIL TAB */}
        {/* ═══════════════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'email' && emailStats && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                <p className="text-slate-400 text-sm">Total Emails</p>
                <p className="text-3xl font-bold text-blue-400 mt-2">{emailStats.total_emails}</p>
              </div>
              <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                <p className="text-slate-400 text-sm">With Documents</p>
                <p className="text-3xl font-bold text-green-400 mt-2">{emailStats.emails_con_docs}</p>
              </div>
              <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                <p className="text-slate-400 text-sm">Processed</p>
                <p className="text-3xl font-bold text-yellow-400 mt-2">{emailStats.emails_procesados}</p>
              </div>
              <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                <p className="text-slate-400 text-sm">Documents</p>
                <p className="text-3xl font-bold text-purple-400 mt-2">{emailStats.total_documentos}</p>
              </div>
            </div>

            <button
              onClick={handleSyncEmail}
              disabled={syncingEmail}
              className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 rounded-lg font-bold transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {syncingEmail ? <Loader size={18} className="animate-spin" /> : <Mail size={18} />}
              {syncingEmail ? 'Sincronizando...' : 'Sincronizar Emails Ahora'}
            </button>
          </div>
        )}

        {/* NETWORK & CONFIG (similar a original) */}
        {activeTab === 'network' && ports && (
          <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
            <h2 className="text-xl font-bold mb-4">Network Ports</h2>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {ports.ports?.map((p, i) => (
                <div key={i} className="p-3 bg-slate-700 rounded text-sm">
                  <p><span className="font-mono text-blue-400">{p.port}</span> - {p.service}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'config' && config && (
          <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
            <h2 className="text-xl font-bold mb-4">System Configuration</h2>
            <div className="space-y-2 max-h-96 overflow-y-auto font-mono text-sm">
              {Object.entries(config).map(([key, value]) => (
                <div key={key} className="p-2 bg-slate-700 rounded">
                  <span className="text-blue-400">{key}:</span> {String(value).substring(0, 50)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ControlPanelPro;
