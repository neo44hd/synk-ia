import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Dashboard } from './pages/Dashboard';
import './styles/globals.css';
export default function App() {
    const [currentPage, setCurrentPage] = useState('dashboard');
    const renderPage = () => {
        switch (currentPage) {
            case 'dashboard':
                return _jsx(Dashboard, {});
            case 'agents':
                return _jsx("div", { className: "text-center text-gray-600", children: "P\u00E1gina de Agentes (pr\u00F3ximamente)" });
            case 'gateway':
                return _jsx("div", { className: "text-center text-gray-600", children: "Consola del Gateway (pr\u00F3ximamente)" });
            case 'tasks':
                return _jsx("div", { className: "text-center text-gray-600", children: "Gestor de Tareas (pr\u00F3ximamente)" });
            case 'metrics':
                return _jsx("div", { className: "text-center text-gray-600", children: "M\u00E9tricas (pr\u00F3ximamente)" });
            default:
                return _jsx(Dashboard, {});
        }
    };
    return (_jsxs("div", { className: "min-h-screen bg-gray-50", children: [_jsx("nav", { className: "bg-white shadow-sm", children: _jsxs("div", { className: "container flex items-center justify-between h-16", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-2xl", children: "\uD83E\uDDE0" }), _jsx("h1", { className: "text-xl font-bold text-gray-900", children: "Sinkia Control Brain" })] }), _jsxs("div", { className: "flex gap-1", children: [_jsx("button", { onClick: () => setCurrentPage('dashboard'), className: `px-4 py-2 rounded-lg transition-colors ${currentPage === 'dashboard'
                                        ? 'bg-brand-100 text-brand-700 font-semibold'
                                        : 'text-gray-600 hover:text-gray-900'}`, children: "Dashboard" }), _jsx("button", { onClick: () => setCurrentPage('agents'), className: `px-4 py-2 rounded-lg transition-colors ${currentPage === 'agents'
                                        ? 'bg-brand-100 text-brand-700 font-semibold'
                                        : 'text-gray-600 hover:text-gray-900'}`, children: "Agentes" }), _jsx("button", { onClick: () => setCurrentPage('gateway'), className: `px-4 py-2 rounded-lg transition-colors ${currentPage === 'gateway'
                                        ? 'bg-brand-100 text-brand-700 font-semibold'
                                        : 'text-gray-600 hover:text-gray-900'}`, children: "Gateway" }), _jsx("button", { onClick: () => setCurrentPage('tasks'), className: `px-4 py-2 rounded-lg transition-colors ${currentPage === 'tasks'
                                        ? 'bg-brand-100 text-brand-700 font-semibold'
                                        : 'text-gray-600 hover:text-gray-900'}`, children: "Tareas" }), _jsx("button", { onClick: () => setCurrentPage('metrics'), className: `px-4 py-2 rounded-lg transition-colors ${currentPage === 'metrics'
                                        ? 'bg-brand-100 text-brand-700 font-semibold'
                                        : 'text-gray-600 hover:text-gray-900'}`, children: "M\u00E9tricas" })] })] }) }), _jsx("main", { className: "container py-8", children: renderPage() }), _jsx("footer", { className: "bg-gray-100 border-t border-gray-200 mt-12", children: _jsx("div", { className: "container py-6 text-center text-gray-600 text-sm", children: _jsx("p", { children: "Sinkia Control Brain MVP \u2014 Orquestaci\u00F3n centralizada de agentes IA" }) }) })] }));
}
