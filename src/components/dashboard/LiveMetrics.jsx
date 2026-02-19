import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Activity, Zap, TrendingUp, Users } from "lucide-react";

export default function LiveMetrics() {
  const [metrics, setMetrics] = useState({
    activeUsers: 8,
    requestsPerMin: 145,
    avgResponseTime: 234,
    successRate: 99.7
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics({
        activeUsers: 8 + Math.floor(Math.random() * 4),
        requestsPerMin: 140 + Math.floor(Math.random() * 20),
        avgResponseTime: 220 + Math.floor(Math.random() * 40),
        successRate: 99.5 + Math.random() * 0.5
      });
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Card className="border-none shadow-xl bg-gradient-to-br from-blue-600 to-blue-700">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <Users className="w-8 h-8 text-white/80" />
            <Activity className="w-5 h-5 text-white animate-pulse" />
          </div>
          <p className="text-3xl font-black text-white mb-1">{metrics.activeUsers}</p>
          <p className="text-xs text-blue-200">Usuarios Activos</p>
        </CardContent>
      </Card>

      <Card className="border-none shadow-xl bg-gradient-to-br from-green-600 to-green-700">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <Zap className="w-8 h-8 text-white/80" />
            <Activity className="w-5 h-5 text-white animate-pulse" />
          </div>
          <p className="text-3xl font-black text-white mb-1">{metrics.requestsPerMin}</p>
          <p className="text-xs text-green-200">Req/min</p>
        </CardContent>
      </Card>

      <Card className="border-none shadow-xl bg-gradient-to-br from-purple-600 to-purple-700">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <Activity className="w-8 h-8 text-white/80" />
            <Activity className="w-5 h-5 text-white animate-pulse" />
          </div>
          <p className="text-3xl font-black text-white mb-1">{metrics.avgResponseTime}ms</p>
          <p className="text-xs text-purple-200">Latencia Media</p>
        </CardContent>
      </Card>

      <Card className="border-none shadow-xl bg-gradient-to-br from-emerald-600 to-emerald-700">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="w-8 h-8 text-white/80" />
            <Activity className="w-5 h-5 text-white animate-pulse" />
          </div>
          <p className="text-3xl font-black text-white mb-1">{metrics.successRate.toFixed(1)}%</p>
          <p className="text-xs text-emerald-200">Success Rate</p>
        </CardContent>
      </Card>
    </div>
  );
}