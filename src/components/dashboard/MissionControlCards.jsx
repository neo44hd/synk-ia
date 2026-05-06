import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Activity, CheckCircle, AlertTriangle, XCircle, Zap } from 'lucide-react';
import { toast } from 'sonner';

const statusIcons = {
  healthy: <CheckCircle className="w-4 h-4" />,
  optimized: <Zap className="w-4 h-4" />,
  completed: <Activity className="w-4 h-4" />,
  warning: <AlertTriangle className="w-4 h-4" />,
  error: <XCircle className="w-4 h-4" />
};

const statusColors = {
  healthy: 'bg-green-500/20 text-green-400 border-green-500/30',
  optimized: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  completed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  warning: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  error: 'bg-red-500/20 text-red-400 border-red-500/30'
};

const priorityColors = {
  high: 'bg-orange-500/20 text-orange-400',
  critical: 'bg-red-500/20 text-red-400',
  normal: 'bg-gray-500/20 text-gray-400'
};

export default function MissionControlCards() {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);

  const loadCards = async () => {
    try {
      const response = await fetch('/api/admin/mission-control/cards', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setCards(data.cards || []);
        setLastUpdate(new Date(data.timestamp));
      } else {
        throw new Error('Error loading cards');
      }
    } catch (error) {
      console.error('Error loading Mission Control cards:', error);
      toast.error('Error al cargar tarjetas de Mission Control');
    } finally {
      setLoading(false);
    }
  };

  const executeAction = async (cardId, action) => {
    try {
      const response = await fetch('/api/admin/mission-control/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ cardId, action })
      });
      
      if (response.ok) {
        toast.success('Acción ejecutada correctamente');
        loadCards();
      } else {
        throw new Error('Error executing action');
      }
    } catch (error) {
      console.error('Error executing action:', error);
      toast.error('Error al ejecutar acción');
    }
  };

  useEffect(() => {
    loadCards();
    const interval = setInterval(loadCards, 60000); // Actualizar cada minuto
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="p-6 text-center text-slate-400">
          Cargando Mission Control...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          🎯 Mission Control
        </h2>
        <div className="flex items-center gap-3">
          {lastUpdate && (
            <span className="text-sm text-slate-400">
              Última actualización: {lastUpdate.toLocaleTimeString('es-ES')}
            </span>
          )}
          <Button 
            onClick={loadCards}
            variant="outline" 
            size="sm"
            className="border-slate-600 text-slate-300"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Actualizar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) => (
          <Card 
            key={card.id}
            className="bg-slate-800/50 border-slate-700 hover:border-cyan-500/50 transition-all cursor-pointer"
          >
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <CardTitle className="text-lg font-semibold text-white">
                  {card.title}
                </CardTitle>
                <div className="flex gap-2">
                  <Badge className={priorityColors[card.priority] || priorityColors.normal}>
                    {card.priority}
                  </Badge>
                  <Badge className={statusColors[card.status] || statusColors.normal}>
                    {statusIcons[card.status]}
                    <span className="ml-1">{card.status}</span>
                  </Badge>
                </div>
              </div>
              {card.description && (
                <p className="text-sm text-slate-400 mt-2">{card.description}</p>
              )}
            </CardHeader>
            
            <CardContent className="space-y-4">
              <div className="bg-slate-900/50 rounded-lg p-3 space-y-2">
                {Object.entries(card.data).map(([key, value]) => (
                  <div key={key} className="flex justify-between text-sm">
                    <span className="text-slate-400 capitalize">
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                    <span className="font-semibold text-white">{value}</span>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                {card.actions.map((action, index) => (
                  <Button
                    key={index}
                    onClick={() => executeAction(card.id, action.action)}
                    variant="outline"
                    size="sm"
                    className="flex-1 min-w-[80px] border-slate-600 text-slate-300 hover:bg-slate-700"
                  >
                    {action.label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
