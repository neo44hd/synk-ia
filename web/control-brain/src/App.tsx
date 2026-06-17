import { useState } from 'react';
import { Dashboard } from './pages/Dashboard';
import './styles/globals.css';

type Page = 'dashboard' | 'agents' | 'gateway' | 'tasks' | 'metrics';

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'agents':
        return <div className="text-center text-gray-600">Página de Agentes (próximamente)</div>;
      case 'gateway':
        return <div className="text-center text-gray-600">Consola del Gateway (próximamente)</div>;
      case 'tasks':
        return <div className="text-center text-gray-600">Gestor de Tareas (próximamente)</div>;
      case 'metrics':
        return <div className="text-center text-gray-600">Métricas (próximamente)</div>;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🧠</span>
            <h1 className="text-xl font-bold text-gray-900">Sinkia Control Brain</h1>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => setCurrentPage('dashboard')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                currentPage === 'dashboard'
                  ? 'bg-brand-100 text-brand-700 font-semibold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setCurrentPage('agents')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                currentPage === 'agents'
                  ? 'bg-brand-100 text-brand-700 font-semibold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Agentes
            </button>
            <button
              onClick={() => setCurrentPage('gateway')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                currentPage === 'gateway'
                  ? 'bg-brand-100 text-brand-700 font-semibold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Gateway
            </button>
            <button
              onClick={() => setCurrentPage('tasks')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                currentPage === 'tasks'
                  ? 'bg-brand-100 text-brand-700 font-semibold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Tareas
            </button>
            <button
              onClick={() => setCurrentPage('metrics')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                currentPage === 'metrics'
                  ? 'bg-brand-100 text-brand-700 font-semibold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Métricas
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container py-8">
        {renderPage()}
      </main>

      {/* Footer */}
      <footer className="bg-gray-100 border-t border-gray-200 mt-12">
        <div className="container py-6 text-center text-gray-600 text-sm">
          <p>Sinkia Control Brain MVP — Orquestación centralizada de agentes IA</p>
        </div>
      </footer>
    </div>
  );
}
