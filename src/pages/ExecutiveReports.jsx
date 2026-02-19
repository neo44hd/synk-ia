import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Download,
  Sparkles,
  Calendar,
  TrendingUp,
  DollarSign,
  Target,
  Loader2,
  Eye,
  Trash
} from "lucide-react";
import { format } from 'date-fns';
import { toast } from "sonner";

export default function ExecutiveReports() {
  const [generating, setGenerating] = useState(false);
  const queryClient = useQueryClient();

  const { data: reports = [] } = useQuery({
    queryKey: ['reports'],
    queryFn: () => base44.entities.Report.list('-created_date'),
    initialData: [],
  });

  const deleteReportMutation = useMutation({
    mutationFn: (id) => base44.entities.Report.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      toast.success('Reporte eliminado');
    },
  });

  const generateReport = async () => {
    setGenerating(true);
    try {
      await base44.functions.invoke('generateExecutiveReport');
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      toast.success('Reporte generado correctamente');
    } catch (error) {
      toast.error('Error generando reporte');
      console.error(error);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-5xl font-black text-white mb-3 flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-2xl">
              <FileText className="w-8 h-8 text-white" />
            </div>
            REPORTES EJECUTIVOS
          </h1>
          <p className="text-xl text-gray-400">
            Análisis automático con IA • Insights accionables • Exportación profesional
          </p>
        </div>

        {/* Header Actions */}
        <Card className="border-none shadow-2xl bg-gradient-to-r from-purple-600 to-pink-600 text-white mb-8">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Sparkles className="w-8 h-8 animate-pulse" />
                <div>
                  <p className="text-2xl font-bold">Generar Nuevo Reporte</p>
                  <p className="text-sm opacity-90">IA analizará todos tus datos en tiempo real</p>
                </div>
              </div>
              <Button 
                onClick={generateReport}
                disabled={generating}
                size="lg"
                className="bg-white text-purple-600 hover:bg-gray-100 font-bold"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Generando...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 mr-2" />
                    Generar Ahora
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Reports Grid */}
        <div className="grid grid-cols-1 gap-6">
          {reports.length === 0 ? (
            <Card className="border-none shadow-xl bg-slate-800">
              <CardContent className="p-12 text-center">
                <FileText className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 text-lg mb-4">No hay reportes generados</p>
                <Button onClick={generateReport} className="bg-purple-600 hover:bg-purple-700">
                  Generar Primer Reporte
                </Button>
              </CardContent>
            </Card>
          ) : (
            reports.map((report) => (
              <Card key={report.id} className="border-none shadow-2xl bg-gradient-to-br from-slate-800 to-slate-900 hover:scale-[1.01] transition-all">
                <CardHeader className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-t-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-2xl mb-2">{report.title}</CardTitle>
                      <div className="flex items-center gap-3 text-sm opacity-90">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {format(new Date(report.created_date), 'dd/MM/yyyy HH:mm')}
                        </span>
                        <Badge className="bg-white/20">{report.type}</Badge>
                        <Badge className="bg-white/20">{report.period}</Badge>
                      </div>
                    </div>
                    <Badge className={
                      report.status === 'completado' ? 'bg-green-600' : 'bg-yellow-600'
                    }>
                      {report.status}
                    </Badge>
                  </div>
                </CardHeader>
                
                <CardContent className="p-6 space-y-6">
                  {/* KPIs del Reporte */}
                  {report.data?.summary && (
                    <div className="grid grid-cols-4 gap-4">
                      <div className="bg-gradient-to-br from-blue-900/30 to-cyan-900/30 p-4 rounded-xl border border-blue-700">
                        <DollarSign className="w-6 h-6 text-blue-400 mb-2" />
                        <p className="text-gray-400 text-xs mb-1">Gastos</p>
                        <p className="text-2xl font-black text-white">
                          {Math.round(report.data.summary.total_spending)}€
                        </p>
                      </div>
                      
                      <div className="bg-gradient-to-br from-green-900/30 to-emerald-900/30 p-4 rounded-xl border border-green-700">
                        <TrendingUp className="w-6 h-6 text-green-400 mb-2" />
                        <p className="text-gray-400 text-xs mb-1">Ingresos</p>
                        <p className="text-2xl font-black text-white">
                          {Math.round(report.data.summary.total_revenue)}€
                        </p>
                      </div>
                      
                      <div className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 p-4 rounded-xl border border-purple-700">
                        <Target className="w-6 h-6 text-purple-400 mb-2" />
                        <p className="text-gray-400 text-xs mb-1">Margen</p>
                        <p className="text-2xl font-black text-white">
                          {report.data.summary.profit_margin?.toFixed(1)}%
                        </p>
                      </div>
                      
                      <div className="bg-gradient-to-br from-orange-900/30 to-red-900/30 p-4 rounded-xl border border-orange-700">
                        <FileText className="w-6 h-6 text-orange-400 mb-2" />
                        <p className="text-gray-400 text-xs mb-1">Facturas</p>
                        <p className="text-2xl font-black text-white">
                          {report.data.summary.total_invoices}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* AI Insights */}
                  {report.insights && report.insights.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-white font-bold flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-yellow-400" />
                        Insights IA
                      </h3>
                      {report.insights.map((insight, idx) => (
                        <div 
                          key={idx}
                          className="bg-gradient-to-r from-indigo-900/30 to-purple-900/30 p-4 rounded-xl border border-indigo-700"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <p className="font-bold text-white">{insight.title}</p>
                            <Badge className={
                              insight.priority === 'alta' ? 'bg-red-600' :
                              insight.priority === 'media' ? 'bg-yellow-600' :
                              'bg-green-600'
                            }>
                              {insight.priority}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-300 mb-2">{insight.description}</p>
                          <p className="text-xs text-blue-400">💡 {insight.recommendation}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Top Providers */}
                  {report.data?.top_providers && (
                    <div>
                      <h3 className="text-white font-bold mb-3">Top Proveedores</h3>
                      <div className="space-y-2">
                        {report.data.top_providers.map((provider, idx) => (
                          <div key={idx} className="flex justify-between items-center p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                            <span className="text-white">{idx + 1}. {provider.name}</span>
                            <div className="text-right">
                              <p className="font-bold text-white">{provider.amount}€</p>
                              <p className="text-xs text-gray-400">{provider.percentage}%</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3 pt-4 border-t border-slate-700">
                    <Button className="flex-1 bg-blue-600 hover:bg-blue-700">
                      <Download className="w-4 h-4 mr-2" />
                      Descargar PDF
                    </Button>
                    <Button className="flex-1 bg-green-600 hover:bg-green-700">
                      <Download className="w-4 h-4 mr-2" />
                      Exportar Excel
                    </Button>
                    <Button 
                      variant="outline" 
                      className="border-red-600 text-red-400 hover:bg-red-600 hover:text-white"
                      onClick={() => deleteReportMutation.mutate(report.id)}
                    >
                      <Trash className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}