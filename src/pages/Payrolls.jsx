import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  DollarSign, 
  Eye, 
  Download,
  TrendingUp,
  Calendar,
  AlertCircle
} from "lucide-react";
import { format } from "date-fns";

export default function Payrolls() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        console.error('Error loading user:', error);
      }
    };
    loadUser();
  }, []);

  const { data: payrolls = [], isLoading } = useQuery({
    queryKey: ['payrolls'],
    queryFn: async () => {
      const allPayrolls = await base44.entities.Payroll.list('-period');
      
      // Si no es admin, solo muestra sus nóminas
      if (user && user.permission_level !== 'super_admin' && user.permission_level !== 'admin' && !user.can_view_payrolls) {
        return allPayrolls.filter(p => p.employee_id === user.id || p.employee_name === user.full_name);
      }
      
      return allPayrolls;
    },
    initialData: [],
    enabled: !!user,
  });

  const statusColors = {
    pendiente: 'bg-yellow-100 text-yellow-800',
    pagada: 'bg-green-100 text-green-800',
    revisada: 'bg-blue-100 text-blue-800'
  };

  const myPayrolls = payrolls.filter(p => p.employee_id === user?.id || p.employee_name === user?.full_name);
  const totalPaid = myPayrolls.filter(p => p.status === 'pagada').reduce((sum, p) => sum + (p.net_salary || 0), 0);
  const lastPayroll = myPayrolls[0];

  return (
    <div className="p-4 md:p-8 min-h-screen bg-gradient-to-br from-zinc-950 via-neutral-900 to-zinc-950">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <DollarSign className="w-8 h-8 text-cyan-400" style={{ filter: 'drop-shadow(0 0 8px rgba(6, 182, 212, 0.8))' }} />
            <span className="text-cyan-400" style={{ textShadow: '0 0 15px rgba(6, 182, 212, 0.6)' }}>Nóminas</span>
          </h1>
          <p className="text-zinc-400 mt-1">
            {user?.permission_level === 'employee' 
              ? 'Consulta tus nóminas y pagos'
              : 'Gestión de nóminas del personal'}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="border-none shadow-lg bg-zinc-800/50 border border-zinc-800">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <Calendar className="w-5 h-5 text-cyan-400" />
                <p className="text-sm text-zinc-400">Total Nóminas</p>
              </div>
              <p className="text-3xl font-bold text-white">{myPayrolls.length}</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-lg bg-zinc-800/50 border border-zinc-800">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <DollarSign className="w-5 h-5 text-cyan-400" />
                <p className="text-sm text-zinc-400">Total Cobrado</p>
              </div>
              <p className="text-3xl font-bold text-white">{totalPaid.toLocaleString()}€</p>
            </CardContent>
          </Card>
          {lastPayroll && (
            <Card className="border-none shadow-lg bg-black border border-cyan-500/50" style={{ boxShadow: '0 0 20px rgba(6, 182, 212, 0.3)' }}>
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-2">
                  <TrendingUp className="w-5 h-5 text-cyan-400" />
                  <p className="text-sm text-cyan-400/80">Última Nómina</p>
                </div>
                <p className="text-3xl font-bold text-cyan-400">{lastPayroll.net_salary?.toLocaleString()}€</p>
                <p className="text-sm text-zinc-400 mt-1">{lastPayroll.period}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Payrolls List */}
        {isLoading ? (
          <Card className="border-none shadow-lg bg-zinc-800/50 border border-zinc-800">
            <CardContent className="p-12 text-center">
              <p className="text-zinc-400">Cargando nóminas...</p>
            </CardContent>
          </Card>
        ) : payrolls.length === 0 ? (
          <Card className="border-none shadow-lg bg-zinc-800/50 border border-zinc-800">
            <CardContent className="p-12 text-center">
              <DollarSign className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
              <p className="text-zinc-400 mb-4">No hay nóminas registradas</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {payrolls.map((payroll) => (
              <Card key={payroll.id} className="border-none shadow-lg bg-zinc-800/50 border border-zinc-800 hover:bg-zinc-800 transition-all">
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="w-12 h-12 bg-black border border-cyan-500/50 rounded-xl flex items-center justify-center flex-shrink-0" style={{ boxShadow: '0 0 15px rgba(6, 182, 212, 0.3)' }}>
                        <DollarSign className="w-6 h-6 text-cyan-400" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-bold text-white">{payroll.employee_name}</h3>
                          <Badge className={statusColors[payroll.status]}>
                            {payroll.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-zinc-400 mb-4">
                          Periodo: {payroll.period}
                          {payroll.payment_date && ` • Pagada: ${format(new Date(payroll.payment_date), 'dd/MM/yyyy')}`}
                        </p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-zinc-500">Bruto</p>
                            <p className="font-semibold text-white">{payroll.gross_salary?.toLocaleString()}€</p>
                          </div>
                          <div>
                            <p className="text-zinc-500">Seguridad Social</p>
                            <p className="font-semibold text-red-400">-{payroll.social_security?.toLocaleString()}€</p>
                          </div>
                          <div>
                            <p className="text-zinc-500">IRPF</p>
                            <p className="font-semibold text-red-400">-{payroll.irpf?.toLocaleString()}€</p>
                          </div>
                          <div>
                            <p className="text-zinc-500">Neto</p>
                            <p className="font-semibold text-cyan-400 text-lg">{payroll.net_salary?.toLocaleString()}€</p>
                          </div>
                        </div>
                        {(payroll.bonuses > 0 || payroll.deductions > 0) && (
                          <div className="flex gap-4 mt-3 text-sm">
                            {payroll.bonuses > 0 && (
                              <div className="flex items-center gap-1 text-green-600">
                                <TrendingUp className="w-4 h-4" />
                                <span>Bonus: +{payroll.bonuses}€</span>
                              </div>
                            )}
                            {payroll.deductions > 0 && (
                              <div className="flex items-center gap-1 text-red-600">
                                <AlertCircle className="w-4 h-4" />
                                <span>Deducciones: -{payroll.deductions}€</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {payroll.file_url && (
                      <div className="flex flex-col gap-2">
                        <Button
                          variant="outline"
                          onClick={() => window.open(payroll.file_url, '_blank')}
                          className="whitespace-nowrap"
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          Ver PDF
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Info Card */}
        <Card className="border-none shadow-lg mt-8 bg-cyan-900/20 border border-cyan-500/30">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <AlertCircle className="w-6 h-6 text-cyan-400 mt-1" />
              <div>
                <p className="font-medium text-cyan-300 mb-2">Información de Privacidad</p>
                <p className="text-sm text-cyan-100/70">
                  Las nóminas son documentos confidenciales. Los empleados solo pueden ver sus propias nóminas.
                  Para dudas sobre conceptos o discrepancias, consulta con el Asistente de RRHH.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}