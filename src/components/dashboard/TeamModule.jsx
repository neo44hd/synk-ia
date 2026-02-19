import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users,
  Clock,
  Calendar,
  DollarSign,
  TrendingUp,
  Settings,
  Code,
  Eye,
  Award,
  Target
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function TeamModule({ payrolls, vacationRequests, timesheets }) {
  const [showDetail, setShowDetail] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [showAPI, setShowAPI] = useState(false);

  const totalPayrollCost = payrolls.reduce((sum, p) => sum + (p.net_salary || 0), 0);
  const pendingVacations = vacationRequests.filter(r => r.status === 'pendiente').length;
  const todayTimesheets = timesheets.filter(t => t.date === new Date().toISOString().split('T')[0]);
  const activeEmployees = new Set(timesheets.map(t => t.user_name)).size;

  const performanceData = [
    { name: 'Juan', ventas: 4500, pedidos: 45, rating: 4.8 },
    { name: 'María', ventas: 3800, pedidos: 38, rating: 4.6 },
    { name: 'Pedro', ventas: 4200, pedidos: 42, rating: 4.9 },
    { name: 'Ana', ventas: 3500, pedidos: 35, rating: 4.5 }
  ];

  return (
    <>
      <Card className="border-none shadow-2xl bg-gradient-to-br from-slate-800 to-slate-900">
        <CardHeader className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-t-xl">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-3">
              <Users className="w-7 h-7" />
              👥 EQUIPO & RRHH
            </CardTitle>
            <div className="flex gap-2">
              <Button 
                size="sm" 
                variant="ghost" 
                className="text-white hover:bg-white/20"
                onClick={() => setShowAPI(true)}
              >
                <Code className="w-4 h-4" />
              </Button>
              <Button 
                size="sm" 
                variant="ghost" 
                className="text-white hover:bg-white/20"
                onClick={() => setShowConfig(true)}
              >
                <Settings className="w-4 h-4" />
              </Button>
              <Button 
                size="sm" 
                className="bg-white/20 hover:bg-white/30"
                onClick={() => setShowDetail(true)}
              >
                <Eye className="w-4 h-4 mr-2" />
                Panel Completo
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-blue-900/30 to-cyan-900/30 p-5 rounded-xl border border-blue-700">
              <p className="text-gray-400 text-sm mb-2">Empleados Activos</p>
              <p className="text-4xl font-black text-white mb-1">{activeEmployees}</p>
              <p className="text-xs text-blue-400">
                <Clock className="w-3 h-3 inline mr-1" />
                Fichados hoy: {todayTimesheets.length}
              </p>
            </div>

            <div className="bg-gradient-to-br from-green-900/30 to-emerald-900/30 p-5 rounded-xl border border-green-700">
              <p className="text-gray-400 text-sm mb-2">Coste Nóminas</p>
              <p className="text-4xl font-black text-white mb-1">{Math.round(totalPayrollCost/1000)}k€</p>
              <p className="text-xs text-green-400">
                <TrendingUp className="w-3 h-3 inline mr-1" />
                Mensual
              </p>
            </div>

            <div className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 p-5 rounded-xl border border-purple-700">
              <p className="text-gray-400 text-sm mb-2">Vacaciones</p>
              <p className="text-4xl font-black text-white mb-1">{pendingVacations}</p>
              <p className="text-xs text-purple-400">
                <Calendar className="w-3 h-3 inline mr-1" />
                Pendientes
              </p>
            </div>

            <div className="bg-gradient-to-br from-orange-900/30 to-red-900/30 p-5 rounded-xl border border-orange-700">
              <p className="text-gray-400 text-sm mb-2">Productividad</p>
              <p className="text-4xl font-black text-white mb-1">94%</p>
              <p className="text-xs text-orange-400">
                <Award className="w-3 h-3 inline mr-1" />
                Óptimo
              </p>
            </div>
          </div>

          <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700">
            <h3 className="text-white font-bold mb-4 text-sm">Rendimiento del Equipo</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                <XAxis dataKey="name" stroke="#888" />
                <YAxis stroke="#888" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
                />
                <Bar dataKey="ventas" fill="#3b82f6" name="Ventas (€)" />
                <Bar dataKey="pedidos" fill="#10b981" name="Pedidos" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* MODAL DETALLE */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto bg-slate-900 text-white">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center gap-3">
              <Users className="w-8 h-8 text-blue-400" />
              Panel RRHH Completo
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="team" className="w-full">
            <TabsList className="grid w-full grid-cols-4 bg-slate-800">
              <TabsTrigger value="team">👥 Equipo</TabsTrigger>
              <TabsTrigger value="attendance">🕐 Fichajes</TabsTrigger>
              <TabsTrigger value="payroll">💰 Nóminas</TabsTrigger>
              <TabsTrigger value="performance">📊 Rendimiento</TabsTrigger>
            </TabsList>

            <TabsContent value="team" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {performanceData.map((emp, idx) => (
                  <Card key={idx} className="bg-slate-800 border-slate-700">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                            {emp.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold">{emp.name}</p>
                            <Badge className="bg-blue-600 text-xs">Activo</Badge>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-1">
                            <Award className="w-4 h-4 text-yellow-400" />
                            <span className="text-xl font-black text-yellow-400">{emp.rating}</span>
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="bg-slate-700 p-2 rounded">
                          <p className="text-gray-400 text-xs">Ventas</p>
                          <p className="font-bold">{emp.ventas}€</p>
                        </div>
                        <div className="bg-slate-700 p-2 rounded">
                          <p className="text-gray-400 text-xs">Pedidos</p>
                          <p className="font-bold">{emp.pedidos}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="attendance" className="space-y-4">
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle>Fichajes de Hoy</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {todayTimesheets.map((ts, idx) => (
                      <div key={idx} className="flex justify-between items-center p-3 bg-slate-700 rounded">
                        <span>{ts.user_name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-400">{ts.check_in}</span>
                          <Badge className={ts.status === 'completo' ? 'bg-green-600' : 'bg-yellow-600'}>
                            {ts.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="payroll">
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle>Resumen Nóminas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="p-4 bg-gradient-to-r from-green-900/30 to-emerald-900/30 rounded-xl border border-green-700">
                    <p className="text-sm text-gray-400 mb-1">Coste Total Mensual</p>
                    <p className="text-4xl font-black text-white">{Math.round(totalPayrollCost)}€</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-700 p-3 rounded">
                      <p className="text-xs text-gray-400">Nóminas Pagadas</p>
                      <p className="text-2xl font-bold text-green-400">
                        {payrolls.filter(p => p.status === 'pagada').length}
                      </p>
                    </div>
                    <div className="bg-slate-700 p-3 rounded">
                      <p className="text-xs text-gray-400">Pendientes</p>
                      <p className="text-2xl font-bold text-yellow-400">
                        {payrolls.filter(p => p.status === 'pendiente').length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="performance">
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle>KPIs del Equipo</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={performanceData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                      <XAxis dataKey="name" stroke="#888" />
                      <YAxis stroke="#888" />
                      <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} />
                      <Bar dataKey="ventas" fill="#3b82f6" name="Ventas (€)" />
                      <Bar dataKey="pedidos" fill="#10b981" name="Pedidos" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* MODAL CONFIG */}
      <Dialog open={showConfig} onOpenChange={setShowConfig}>
        <DialogContent className="bg-slate-900 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-6 h-6" />
              Configuración RRHH
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="font-bold mb-2">Alertas Automáticas</p>
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input type="checkbox" defaultChecked />
                  <span className="text-sm">Alertar fichajes incompletos</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" defaultChecked />
                  <span className="text-sm">Notificar vacaciones pendientes</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" />
                  <span className="text-sm">Recordar cumpleaños empleados</span>
                </label>
              </div>
            </div>
            <Button className="w-full bg-blue-600 hover:bg-blue-700">
              Guardar Configuración
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL API */}
      <Dialog open={showAPI} onOpenChange={setShowAPI}>
        <DialogContent className="max-w-4xl bg-slate-900 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Code className="w-6 h-6 text-blue-400" />
              API Endpoints - RRHH
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-slate-800 p-4 rounded-lg">
              <p className="text-sm text-gray-400 mb-2">GET /api/hr/timesheets/today</p>
              <pre className="bg-slate-950 p-3 rounded text-xs overflow-x-auto">
{`fetch('/api/hr/timesheets/today')
  .then(res => res.json())
  .then(data => console.log(data));

// Respuesta:
{
  "total": 24,
  "complete": 18,
  "incomplete": 6,
  "timesheets": [...]
}`}
              </pre>
            </div>
            <div className="bg-slate-800 p-4 rounded-lg">
              <p className="text-sm text-gray-400 mb-2">GET /api/hr/performance</p>
              <pre className="bg-slate-950 p-3 rounded text-xs overflow-x-auto">
{`fetch('/api/hr/performance?period=month')
  .then(res => res.json());

// Respuesta:
{
  "employees": [{
    "name": "Juan",
    "sales": 4500,
    "orders": 45,
    "rating": 4.8
  }]
}`}
              </pre>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}