import { useState, useEffect } from 'react';
import { Activity, Database, Radio, Settings, Terminal, RefreshCw, Server, Zap, Mail } from 'lucide-react';
import systemMonitorService from '../services/systemMonitorService';

const ControlPanel = () => {
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
  }, []); // Solo al montar el componente

  useEffect(() => {
    if (!autoRefresh) return; // Si no está activado, salir
    const interval = setInterval(refreshData, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh]); // Solo depende de autoRefresh

  useEffect(() => {
    if (activeTab === 'logs') {
      refreshData(); // Refrescar logs cuando cambia el tipo
    }
  }, [logsType, activeTab]);

  const handleSearchLogs = async () => {
    if (!searchQuery) return;
    const result = await systemMonitorService.executeAction('search_logs', '', searchQuery);
    if (result && Array.isArray(result)) {
      const text = result.map(r => `[${r.source}]\n${r.matches.join('\n')}`).join('\n---\n');
      setLogs(text);
    }
  };

  const handleRestartService = async (service) => {
    if (!confirm(`¿Reiniciar ${service}?`)) return;
    const result = await systemMonitorService.executeAction('restart_service', service);
    if (result.success) {
      alert(`${service} reiniciado exitosamente`);
      refreshData();
    } else {
      alert(`Error: ${result.error}`);
    }
  };

  const tabs = [
    { id: 'overview', label: '📊 Overview' },
    { id: 'logs', label: '📝 Logs' },
    { id: 'agents', label: '🤖 Agents' },
    { id: 'models', label: '🧠 Models' },
    { id: 'network', label: '🌐 Network' },
    { id: 'email', label: '📧 Email' },
    { id: 'config', label: '⚙️ Config' }
  ];

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
      <div className="bg-slate-800 border-b border-slate-700 p-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Server size={24} className="text-blue-400" />
          <h1 className="text-2xl font-bold">Control Panel</h1>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="w-4 h-4"
            />
            <span>Auto-refresh (5s)</span>
          </label>
          <button onClick={refreshData} className="p-2 hover:bg-slate-700 rounded transition">
            <RefreshCw size={20} />
          </button>
        </div>
      </div>

      <div className="flex border-b border-slate-700 bg-slate-800">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 font-medium transition ${
              activeTab === tab.id
                ? 'border-b-2 border-blue-500 text-blue-400'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="p-6">
        {activeTab === 'overview' && dashboard && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                <p className="text-slate-400 text-sm">Services Online</p>
                <p className="text-3xl font-bold text-green-400 mt-2">
                  {dashboard.overview?.services_online}/{dashboard.overview?.services_total}
                </p>
              </div>
              <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                <p className="text-slate-400 text-sm">CPU Usage</p>
                <p className="text-3xl font-bold text-blue-400 mt-2">
                  {dashboard.overview?.cpu_usage}%
                </p>
              </div>
              <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                <p className="text-slate-400 text-sm">Memory</p>
                <p className="text-3xl font-bold text-yellow-400 mt-2">
                  {dashboard.overview?.memory_used_mb}MB
                </p>
              </div>
              <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                <p className="text-slate-400 text-sm">Uptime</p>
                <p className="text-3xl font-bold text-purple-400 mt-2">
                  {dashboard.overview?.uptime_hours}h
                </p>
              </div>
            </div>

            <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Activity size={20} /> Top Processes
              </h2>
              <div className="space-y-2">
                {dashboard.processes?.map((p, i) => (
                  <div key={i} className="flex justify-between text-sm p-2 bg-slate-700 rounded">
                    <span className="font-mono">{p.name}</span>
                    <span className="text-green-400">{p.status}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Zap size={18} /> IA Models
                </h2>
                {dashboard.models ? (
                  <div className="space-y-2 text-sm">
                    <p>Installed: <span className="text-green-400">{dashboard.models.installed ? 'Yes' : 'No'}</span></p>
                    <p>Models: <span className="text-blue-400">{dashboard.models.count}</span></p>
                    <p>Running: <span className="text-yellow-400">{dashboard.models.running ? 'Yes' : 'No'}</span></p>
                  </div>
                ) : (
                  <p className="text-slate-400">No data</p>
                )}
              </div>
              <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Database size={18} /> Network
                </h2>
                {dashboard.top_ports ? (
                  <div className="space-y-2 text-sm">
                    <p>Active Ports: <span className="text-blue-400">{dashboard.ports_active}</span></p>
                    {dashboard.top_ports.slice(0, 3).map((port, i) => (
                      <p key={i} className="text-slate-300">
                        Port <span className="text-green-400">{port.port}</span>
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400">No data</p>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              {['pm2', 'app', 'error', 'system'].map(type => (
                <button
                  key={type}
                  onClick={() => setLogsType(type)}
                  className={`px-4 py-2 rounded transition ${
                    logsType === type ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {type.toUpperCase()}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search logs..."
                className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                onKeyDown={(e) => e.key === 'Enter' && handleSearchLogs()}
              />
              <button
                onClick={handleSearchLogs}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
              >
                Search
              </button>
            </div>
            <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 h-96 overflow-y-auto font-mono text-sm text-slate-300">
              {logs ? (
                logs.split('\n').map((line, i) => (
                  <div key={i} className="text-xs">{line}</div>
                ))
              ) : (
                <p className="text-slate-500">No logs available</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'agents' && agents && (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-4 mb-4">
              <div className="bg-slate-800 p-3 rounded border border-slate-700 text-center">
                <p className="text-slate-400 text-sm">Total</p>
                <p className="text-2xl font-bold text-white">{agents.total}</p>
              </div>
              <div className="bg-green-900 p-3 rounded border border-green-700 text-center">
                <p className="text-green-300 text-sm">Online</p>
                <p className="text-2xl font-bold text-green-400">{agents.online}</p>
              </div>
              <div className="bg-yellow-900 p-3 rounded border border-yellow-700 text-center">
                <p className="text-yellow-300 text-sm">Stopped</p>
                <p className="text-2xl font-bold text-yellow-400">{agents.stopped}</p>
              </div>
              <div className="bg-red-900 p-3 rounded border border-red-700 text-center">
                <p className="text-red-300 text-sm">Errored</p>
                <p className="text-2xl font-bold text-red-400">{agents.errored}</p>
              </div>
            </div>
            <div className="space-y-2">
              {agents.agents?.map((agent, i) => (
                <div key={i} className="bg-slate-800 p-3 rounded border border-slate-700 flex justify-between items-center">
                  <div>
                    <p className="font-bold">{agent.name}</p>
                    <p className="text-sm text-slate-400">
                      PID: {agent.pid} | CPU: {agent.cpu}% | Memory: {(agent.memory / 1024 / 1024).toFixed(2)}MB
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded text-sm font-medium ${
                      agent.status === 'online' ? 'bg-green-900 text-green-300' :
                      agent.status === 'stopped' ? 'bg-yellow-900 text-yellow-300' :
                      'bg-red-900 text-red-300'
                    }`}>
                      {agent.status}
                    </span>
                    {agent.status !== 'online' && (
                      <button
                        onClick={() => handleRestartService(agent.name)}
                        className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition"
                      >
                        Restart
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'models' && models && (
          <div className="space-y-4">
            {models.providers?.ollama && (
              <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                <h2 className="text-xl font-bold mb-4">Ollama</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-slate-400 text-sm">Installed</p>
                    <p className="text-lg font-bold text-green-400">
                      {models.providers.ollama.installed ? 'Yes' : 'No'}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm">Running</p>
                    <p className="text-lg font-bold text-blue-400">
                      {models.providers.ollama.running ? 'Yes' : 'No'}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm">Models</p>
                    <p className="text-lg font-bold text-yellow-400">
                      {models.providers.ollama.total_models}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm">Size</p>
                    <p className="text-lg font-bold text-purple-400">
                      {models.providers.ollama.models_size}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'network' && ports && (
          <div className="space-y-4">
            <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
              <h2 className="text-lg font-bold mb-4">Active Ports</h2>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {ports.ports?.map((port, i) => (
                  <div key={i} className="flex justify-between bg-slate-700 p-2 rounded text-sm">
                    <span className="font-mono font-bold text-green-400">:{port.port}</span>
                    <span className="text-slate-300">{port.process}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
              <h2 className="text-lg font-bold mb-4">Network Interfaces</h2>
              <div className="space-y-2">
                {ports.networks?.map((net, i) => (
                  <div key={i} className="bg-slate-700 p-2 rounded text-sm">
                    <p className="font-mono font-bold text-blue-400">{net.interface}</p>
                    <p className="text-slate-300">{net.ip}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'email' && emailStats && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  setSyncingEmail(true);
                  const result = await systemMonitorService.syncEmails(true);
                  if (result.success) {
                    alert('Email sync completed');
                    refreshData();
                  } else {
                    alert(`Sync error: ${result.error}`);
                  }
                  setSyncingEmail(false);
                }}
                disabled={syncingEmail}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition disabled:opacity-50"
              >
                {syncingEmail ? 'Syncing...' : 'Sync Emails Now'}
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                <p className="text-slate-400 text-sm">Total Documents</p>
                <p className="text-3xl font-bold text-purple-400 mt-2">{emailStats.total_documentos}</p>
              </div>
            </div>
            {emailStats.documentos_por_tipo && (
              <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                <h3 className="font-bold mb-4">Documents by Type</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(emailStats.documentos_por_tipo).map(([type, count]) => (
                    <div key={type} className="bg-slate-700 p-3 rounded">
                      <p className="text-slate-400 text-sm capitalize">{type}</p>
                      <p className="text-2xl font-bold text-blue-400">{count}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {emailStats.last_sync && (
              <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                <p className="text-slate-400 text-sm">Last Sync</p>
                <p className="font-mono text-green-400">{new Date(emailStats.last_sync).toLocaleString()}</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'config' && config && (
          <div className="space-y-4">
            <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
              <h2 className="text-lg font-bold mb-4">System Info</h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-400">Platform</p>
                  <p className="font-mono text-green-400">{config.system?.platform}</p>
                </div>
                <div>
                  <p className="text-slate-400">Architecture</p>
                  <p className="font-mono text-blue-400">{config.system?.arch}</p>
                </div>
                <div>
                  <p className="text-slate-400">Hostname</p>
                  <p className="font-mono text-yellow-400">{config.system?.hostname}</p>
                </div>
                <div>
                  <p className="text-slate-400">CPUs</p>
                  <p className="font-mono text-purple-400">{config.system?.cpus}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ControlPanel;
