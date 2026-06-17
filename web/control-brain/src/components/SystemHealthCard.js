import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export const SystemHealthCard = ({ health, loading }) => {
    if (loading) {
        return (_jsx("div", { className: "card", children: _jsxs("div", { className: "animate-pulse space-y-2", children: [_jsx("div", { className: "h-4 bg-gray-200 rounded w-1/2" }), _jsx("div", { className: "h-4 bg-gray-200 rounded w-3/4" })] }) }));
    }
    if (!health) {
        return _jsx("div", { className: "card text-red-600", children: "Error cargando estado del sistema" });
    }
    const getStatusColor = (status) => status ? 'text-green-600' : 'text-red-600';
    const getStatusText = (status) => status ? '✓ En línea' : '✗ Desconectado';
    return (_jsxs("div", { className: "card", children: [_jsx("div", { className: "card-header", children: _jsx("h2", { className: "text-xl font-bold", children: "Estado del Sistema" }) }), _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "flex justify-between items-center", children: [_jsx("span", { className: "text-gray-700", children: "Gateway LiteLLM:" }), _jsx("span", { className: `font-semibold ${getStatusColor(health.gateway_alive)}`, children: getStatusText(health.gateway_alive) })] }), _jsxs("div", { className: "flex justify-between items-center", children: [_jsx("span", { className: "text-gray-700", children: "Sinkia API:" }), _jsx("span", { className: `font-semibold ${getStatusColor(health.sinkia_online)}`, children: getStatusText(health.sinkia_online) })] }), _jsxs("div", { className: "flex justify-between items-center", children: [_jsx("span", { className: "text-gray-700", children: "Gateway Online:" }), _jsx("span", { className: `font-semibold ${getStatusColor(health.gateway_online)}`, children: getStatusText(health.gateway_online) })] })] })] }));
};
