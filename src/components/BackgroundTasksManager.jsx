import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { toast } from "sonner";

// Estado global de tareas en segundo plano
const STORAGE_KEY = 'synk_background_tasks';

const BackgroundTasksContext = createContext(null);

export function useBackgroundTasks() {
  const context = useContext(BackgroundTasksContext);
  if (!context) {
    throw new Error('useBackgroundTasks must be used within BackgroundTasksProvider');
  }
  return context;
}

function getStoredTasks() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch (e) {}
  return {};
}

function setStoredTasks(tasks) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch (e) {}
}

export function BackgroundTasksProvider({ children }) {
  const [tasks, setTasks] = useState(getStoredTasks);

  // Guardar en localStorage cuando cambian las tareas
  useEffect(() => {
    setStoredTasks(tasks);
  }, [tasks]);

  // Crear una nueva tarea
  const startTask = useCallback((taskId, metadata = {}) => {
    setTasks(prev => ({
      ...prev,
      [taskId]: {
        id: taskId,
        status: 'running',
        startedAt: new Date().toISOString(),
        progress: 0,
        steps: [],
        metadata,
        result: null,
        error: null
      }
    }));
    
    toast.info(`🔄 ${metadata.name || taskId} iniciado - Puedes navegar libremente`, {
      duration: 3000
    });
  }, []);

  // Actualizar progreso de una tarea
  const updateTask = useCallback((taskId, updates) => {
    setTasks(prev => {
      if (!prev[taskId]) return prev;
      return {
        ...prev,
        [taskId]: {
          ...prev[taskId],
          ...updates
        }
      };
    });
  }, []);

  // Añadir paso a una tarea
  const addStep = useCallback((taskId, step) => {
    setTasks(prev => {
      if (!prev[taskId]) return prev;
      return {
        ...prev,
        [taskId]: {
          ...prev[taskId],
          steps: [...(prev[taskId].steps || []), { ...step, timestamp: new Date().toISOString() }]
        }
      };
    });
  }, []);

  // Completar tarea exitosamente
  const completeTask = useCallback((taskId, result) => {
    setTasks(prev => {
      if (!prev[taskId]) return prev;
      return {
        ...prev,
        [taskId]: {
          ...prev[taskId],
          status: 'completed',
          completedAt: new Date().toISOString(),
          result,
          progress: 100
        }
      };
    });
    
    const task = tasks[taskId];
    toast.success(`✅ ${task?.metadata?.name || taskId} completado`, {
      duration: 8000
    });
  }, [tasks]);

  // Marcar tarea como fallida
  const failTask = useCallback((taskId, error) => {
    setTasks(prev => {
      if (!prev[taskId]) return prev;
      return {
        ...prev,
        [taskId]: {
          ...prev[taskId],
          status: 'failed',
          completedAt: new Date().toISOString(),
          error: error?.message || error
        }
      };
    });
    
    const task = tasks[taskId];
    toast.error(`❌ ${task?.metadata?.name || taskId} falló: ${error?.message || error}`, {
      duration: 8000
    });
  }, [tasks]);

  // Limpiar una tarea
  const clearTask = useCallback((taskId) => {
    setTasks(prev => {
      const { [taskId]: removed, ...rest } = prev;
      return rest;
    });
  }, []);

  // Limpiar todas las tareas completadas
  const clearCompletedTasks = useCallback(() => {
    setTasks(prev => {
      const filtered = {};
      Object.entries(prev).forEach(([id, task]) => {
        if (task.status === 'running') {
          filtered[id] = task;
        }
      });
      return filtered;
    });
  }, []);

  // Obtener una tarea específica
  const getTask = useCallback((taskId) => {
    return tasks[taskId] || null;
  }, [tasks]);

  // Obtener tareas en ejecución
  const getRunningTasks = useCallback(() => {
    return Object.values(tasks).filter(t => t.status === 'running');
  }, [tasks]);

  // Obtener todas las tareas
  const getAllTasks = useCallback(() => {
    return Object.values(tasks);
  }, [tasks]);

  const value = {
    tasks,
    startTask,
    updateTask,
    addStep,
    completeTask,
    failTask,
    clearTask,
    clearCompletedTasks,
    getTask,
    getRunningTasks,
    getAllTasks
  };

  return (
    <BackgroundTasksContext.Provider value={value}>
      {children}
    </BackgroundTasksContext.Provider>
  );
}

// Componente indicador flotante de tareas en segundo plano
export function BackgroundTasksIndicator() {
  const { getRunningTasks, getAllTasks, clearCompletedTasks, clearTask } = useBackgroundTasks();
  const [expanded, setExpanded] = useState(false);
  
  const runningTasks = getRunningTasks();
  const allTasks = getAllTasks();
  const completedTasks = allTasks.filter(t => t.status === 'completed');
  const failedTasks = allTasks.filter(t => t.status === 'failed');

  if (allTasks.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Botón flotante */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={`flex items-center gap-2 px-4 py-3 rounded-full shadow-2xl transition-all ${
          runningTasks.length > 0 
            ? 'bg-blue-600 hover:bg-blue-700 text-white animate-pulse' 
            : completedTasks.length > 0
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : 'bg-red-600 hover:bg-red-700 text-white'
        }`}
      >
        {runningTasks.length > 0 ? (
          <>
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            <span className="font-medium">{runningTasks.length} en proceso</span>
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="font-medium">{completedTasks.length} completados</span>
          </>
        )}
      </button>

      {/* Panel expandido */}
      {expanded && (
        <div className="absolute bottom-16 right-0 w-80 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
          <div className="p-3 bg-gray-50 border-b flex items-center justify-between">
            <h3 className="font-bold text-gray-800">Tareas en segundo plano</h3>
            {completedTasks.length > 0 && (
              <button
                onClick={clearCompletedTasks}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Limpiar
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {allTasks.length === 0 ? (
              <p className="p-4 text-center text-gray-500 text-sm">No hay tareas</p>
            ) : (
              <div className="divide-y">
                {allTasks.map((task) => (
                  <div key={task.id} className="p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm text-gray-800">
                        {task.metadata?.name || task.id}
                      </span>
                      <div className="flex items-center gap-2">
                        {task.status === 'running' && (
                          <span className="flex items-center gap-1 text-xs text-blue-600">
                            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                            </svg>
                            En proceso
                          </span>
                        )}
                        {task.status === 'completed' && (
                          <span className="text-xs text-green-600 flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Completado
                          </span>
                        )}
                        {task.status === 'failed' && (
                          <span className="text-xs text-red-600">❌ Error</span>
                        )}
                        <button
                          onClick={() => clearTask(task.id)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    
                    {/* Barra de progreso para tareas en ejecución */}
                    {task.status === 'running' && (
                      <div className="mt-2">
                        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-blue-500 transition-all duration-300"
                            style={{ width: `${task.progress || 10}%` }}
                          />
                        </div>
                        {task.steps?.length > 0 && (
                          <p className="text-xs text-gray-500 mt-1">
                            {task.steps[task.steps.length - 1]?.step}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Resultado para tareas completadas */}
                    {task.status === 'completed' && task.result && (
                      <p className="text-xs text-gray-600 mt-1">
                        {typeof task.result === 'string' 
                          ? task.result 
                          : task.result.message || 'Completado correctamente'}
                      </p>
                    )}

                    {/* Error para tareas fallidas */}
                    {task.status === 'failed' && task.error && (
                      <p className="text-xs text-red-600 mt-1">{task.error}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}