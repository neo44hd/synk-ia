import React from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";

const features = [
  { icon: '📊', title: 'CEO Dashboard', desc: 'Vista ejecutiva con KPIs', link: '/ceodashboard' },
  { icon: '🛒', title: 'Tienda Online', desc: 'Sistema de e-commerce', link: '/store' },
  { icon: '💰', title: 'Finanzas', desc: 'Facturación y contabilidad', link: '/billing' },
  { icon: '👥', title: 'Recursos Humanos', desc: 'Gestión de equipos', link: '/staff' },
  { icon: '📧', title: 'Buzón Inteligente', desc: 'Email con IA', link: '/smartmailbox' },
  { icon: '🍽️', title: 'Cocina', desc: 'Display de pedidos', link: '/kitchendisplay' },
  { icon: '🧠', title: 'CEO Brain', desc: 'Asistente IA', link: '/ceobrain' },
  { icon: '⚙️', title: 'Control Center', desc: 'Sistema e infraestructura', link: '/controlcenter' }
];

export default function SynkiaMain() {
  const navigate = useNavigate();
  const [stats, setStats] = React.useState(null);

  React.useEffect(() => {
    // Load commerce stats
    fetch('/api/commerce/health')
      .then(r => r.json())
      .then(() => fetch('/api/commerce/dashboard/stats'))
      .then(r => r.json())
      .then(data => setStats(data.data))
      .catch(console.error);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <div className="text-center py-16 px-4">
        <h1 className="text-6xl font-black mb-4">
          <span className="text-6xl mr-4">🚀</span>
          <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            SynK-IA
          </span>
        </h1>
        <p className="text-xl text-slate-400 mb-2">Control Central — Inteligencia Integrada</p>
        <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
          <span className="w-2 h-2 rounded-full bg-green-500"></span>
          Sistema Online • v2.1.0
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 pb-16">
        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          {features.map((feature, i) => (
            <Card
              key={i}
              className="bg-slate-800/50 border-slate-700 hover:border-cyan-500 hover:bg-slate-800/70 cursor-pointer transition-all group"
              onClick={() => navigate(feature.link)}
            >
              <CardContent className="p-6">
                <div className="text-4xl mb-3">{feature.icon}</div>
                <h3 className="font-bold text-white mb-1">{feature.title}</h3>
                <p className="text-sm text-slate-400 mb-4">{feature.desc}</p>
                <div className="flex items-center text-cyan-400 text-sm font-medium group-hover:gap-2 transition-all">
                  Acceder <ChevronRight className="w-4 h-4 ml-1 opacity-0 group-hover:opacity-100" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Stats Section */}
        {stats && (
          <Card className="bg-slate-800/50 border-slate-700 mb-8">
            <CardContent className="p-8">
              <h2 className="text-xl font-bold text-white mb-6">📈 Estado del Sistema</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-cyan-400">{stats.dashboard?.orders_today || 0}</div>
                  <div className="text-xs text-slate-400 uppercase tracking-wider">Pedidos Hoy</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-400">€{stats.sales?.today || 0}</div>
                  <div className="text-xs text-slate-400 uppercase tracking-wider">Ingresos</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-400">{stats.catalog?.products || 0}</div>
                  <div className="text-xs text-slate-400 uppercase tracking-wider">Productos</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-400">{stats.system?.uptimeHuman || '—'}</div>
                  <div className="text-xs text-slate-400 uppercase tracking-wider">Uptime</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
