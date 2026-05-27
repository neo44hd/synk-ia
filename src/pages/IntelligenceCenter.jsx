/**
 * ═══════════════════════════════════════════════════════════════════════════
 * INTELLIGENCE CENTER — Dashboard de Aprendizaje Continuo
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Componente principal que muestra:
 * - Métricas de precisión global y por tipo
 * - Historial de correcciones
 * - Insights y recomendaciones
 * - Interfaz para registrar feedback
 */

import { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertCircle, TrendingUp, TrendingDown, Zap } from 'lucide-react';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
const API_BASE = '/api';

export default function IntelligenceCenter() {
  const [metrics, setMetrics] = useState(null);
  const [insights, setInsights] = useState(null);
  const [recommendations, setRecommendations] = useState(null);
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  // Feedback form state
  const [feedbackId, setFeedbackId] = useState('');
  const [feedbackType, setFeedbackType] = useState('quality');
  const [feedbackValue, setFeedbackValue] = useState(3);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackEmail, setFeedbackEmail] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  // Load data
  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [metricsRes, insightsRes, recsRes, historyRes] = await Promise.all([
        fetch(`${API_BASE}/learning/metrics`),
        fetch(`${API_BASE}/learning/insights`),
        fetch(`${API_BASE}/learning/recommendations`),
        fetch(`${API_BASE}/learning/history?limit=20`),
      ]);

      const metricsData = await metricsRes.json();
      const insightsData = await insightsRes.json();
      const recsData = await recsRes.json();
      const historyData = await historyRes.json();

      if (metricsData.success) setMetrics(metricsData.data);
      if (insightsData.success) setInsights(insightsData.data);
      if (recsData.success) setRecommendations(recsData.data);
      if (historyData.success) setHistory(historyData.data);
    } catch (err) {
      setError(err.message);
      console.error('[Intelligence Center] Load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFeedbackSubmit = async (e) => {
    e.preventDefault();

    if (!feedbackId) {
      alert('Se requiere ID de predicción');
      return;
    }

    setSubmittingFeedback(true);
    try {
      let payload = { predictionId: feedbackId, userEmail: feedbackEmail || 'anonymous' };

      if (feedbackType === 'quality') {
        payload.quality = parseInt(feedbackValue, 10);
      } else if (feedbackType === 'usefulness') {
        payload.usefulness = parseInt(feedbackValue, 10);
      } else if (feedbackType === 'correction') {
        payload.correction = feedbackText;
        payload.reason = 'Corrección manual del usuario';
      }

      if (feedbackText && feedbackType !== 'correction') {
        payload.suggestion = feedbackText;
      }

      const res = await fetch(`${API_BASE}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await res.json();

      if (result.success) {
        alert('Feedback registrado exitosamente');
        setFeedbackId('');
        setFeedbackText('');
        setFeedbackEmail('');
        await loadData();
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (err) {
      alert(`Error al enviar feedback: ${err.message}`);
    } finally {
      setSubmittingFeedback(false);
    }
  };

  if (loading && !metrics) {
    return (
      <div className="w-full h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin mb-4">⚙️</div>
          <p className="text-lg text-gray-600">Cargando Intelligence Center...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Intelligence Center</h1>
          <p className="text-lg text-slate-600">Aprendizaje Continuo e Inteligencia Adaptativa</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-400 rounded-lg flex items-start gap-3">
            <AlertCircle className="text-red-600 mt-1" />
            <div>
              <h3 className="font-semibold text-red-900">Error</h3>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* Quick Stats */}
        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-600">Precisión Global</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">{metrics.globalAccuracy}%</div>
                <p className="text-xs text-slate-500 mt-1">
                  {metrics.correctedPredictions} de {metrics.totalPredictions} corregidas
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-600">Confianza Promedio</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">{metrics.averageConfidence.toFixed(2)}</div>
                <p className="text-xs text-slate-500 mt-1">Escala 0-1</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-600">Calidad Feedback</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-amber-600">{metrics.averageQuality.toFixed(1)}/5</div>
                <p className="text-xs text-slate-500 mt-1">Evaluación del usuario</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-600">Tendencia 7 días</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <div className="text-3xl font-bold text-purple-600">
                    {metrics.recentTrend.last7Days}%
                  </div>
                  {metrics.recentTrend.last7Days >= metrics.recentTrend.last30Days ? (
                    <TrendingUp className="text-green-600" />
                  ) : (
                    <TrendingDown className="text-red-600" />
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Main Content Tabs */}
        <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="overview">Resumen</TabsTrigger>
            <TabsTrigger value="analysis">Análisis</TabsTrigger>
            <TabsTrigger value="history">Historial</TabsTrigger>
            <TabsTrigger value="feedback">Feedback</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {metrics && (
              <>
                {/* Accuracy by Type */}
                <Card>
                  <CardHeader>
                    <CardTitle>Precisión por Tipo de Predicción</CardTitle>
                    <CardDescription>Métricas desagregadas por categoría</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart
                        data={Object.entries(metrics.byType).map(([type, stats]) => ({
                          type: type.substring(0, 15),
                          accuracy: Math.round(stats.accuracy),
                          samples: stats.corrected,
                        }))}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="type" angle={-45} textAnchor="end" height={80} />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="accuracy" fill="#3b82f6" name="Accuracy %" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Trend Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle>Tendencia de Desempeño</CardTitle>
                    <CardDescription>Evolución en los últimos 30 días</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-blue-50 rounded-lg">
                        <p className="text-sm font-medium text-slate-600 mb-1">Últimos 7 días</p>
                        <p className="text-2xl font-bold text-blue-600">{metrics.recentTrend.last7Days}%</p>
                      </div>
                      <div className="p-4 bg-purple-50 rounded-lg">
                        <p className="text-sm font-medium text-slate-600 mb-1">Últimos 30 días</p>
                        <p className="text-2xl font-bold text-purple-600">{metrics.recentTrend.last30Days}%</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Anomalies */}
                {metrics.anomalies.length > 0 && (
                  <Card className="border-red-200 bg-red-50">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-red-900">
                        <AlertCircle className="w-5 h-5" />
                        Anomalías Detectadas
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {metrics.anomalies.map((anomaly, idx) => (
                          <div key={idx} className="p-3 bg-white rounded border border-red-200">
                            <p className="font-semibold text-sm">
                              <span className={`px-2 py-1 rounded text-xs font-bold text-white ${
                                anomaly.severity === 'critical' ? 'bg-red-600' :
                                anomaly.severity === 'high' ? 'bg-orange-600' :
                                'bg-yellow-600'
                              }`}>
                                {anomaly.severity.toUpperCase()}
                              </span>
                              {' '}
                              {anomaly.message}
                            </p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>

          {/* Analysis Tab */}
          <TabsContent value="analysis" className="space-y-6">
            {insights && (
              <Card>
                <CardHeader>
                  <CardTitle>Insights Generados</CardTitle>
                  <CardDescription>Análisis automático del comportamiento del sistema</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {insights.insights.length === 0 ? (
                      <p className="text-slate-500 italic">No hay suficientes datos para generar insights</p>
                    ) : (
                      insights.insights.map((insight, idx) => (
                        <div key={idx} className="p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg border border-blue-200">
                          <h4 className="font-semibold text-blue-900 mb-1">{insight.title}</h4>
                          <p className="text-sm text-blue-800">{insight.message}</p>
                          <p className="text-xs text-blue-600 mt-2 italic">Tipo: {insight.type}</p>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {recommendations && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-amber-500" />
                    Recomendaciones de Optimización
                  </CardTitle>
                  <CardDescription>Acciones sugeridas para mejorar el desempeño</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {recommendations.recommendations.length === 0 ? (
                      <p className="text-slate-500 italic">No hay recomendaciones en este momento</p>
                    ) : (
                      recommendations.recommendations.map((rec, idx) => (
                        <div key={idx} className="p-4 border rounded-lg">
                          <div className="flex items-start justify-between mb-2">
                            <h4 className="font-semibold text-slate-900">{rec.title}</h4>
                            <span className={`px-2 py-1 rounded text-xs font-bold ${
                              rec.priority === 'high' ? 'bg-red-100 text-red-800' :
                              rec.priority === 'medium' ? 'bg-amber-100 text-amber-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {rec.priority.toUpperCase()}
                            </span>
                          </div>
                          <p className="text-sm text-slate-700 mb-2">{rec.action}</p>
                          <p className="text-xs text-slate-500 italic">
                            Impacto estimado: {rec.estimatedImpact}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-6">
            {history && (
              <Card>
                <CardHeader>
                  <CardTitle>Historial de Correcciones</CardTitle>
                  <CardDescription>Últimas {history.length} correcciones registradas</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-3">Tipo</th>
                          <th className="text-left py-2 px-3">Agente</th>
                          <th className="text-left py-2 px-3">Resultado</th>
                          <th className="text-left py-2 px-3">Fecha</th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.map((record, idx) => (
                          <tr key={idx} className="border-b hover:bg-slate-50">
                            <td className="py-2 px-3 text-xs font-mono">{record.type}</td>
                            <td className="py-2 px-3 text-xs">{record.agentName}</td>
                            <td className="py-2 px-3">
                              <span className={`px-2 py-1 rounded text-xs font-bold ${
                                record.isCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                              }`}>
                                {record.isCorrect ? '✓ Correcto' : '✗ Incorrecto'}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-xs text-slate-500">
                              {new Date(record.correctionTimestamp).toLocaleDateString('es-ES')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Feedback Tab */}
          <TabsContent value="feedback" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Registrar Feedback</CardTitle>
                <CardDescription>Ayudanos a mejorar registrando correcciones y evaluaciones</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleFeedbackSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">ID de Predicción</label>
                    <Input
                      placeholder="learn_1234567890_abc123"
                      value={feedbackId}
                      onChange={(e) => setFeedbackId(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Tipo de Feedback</label>
                    <Select value={feedbackType} onValueChange={setFeedbackType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="quality">Calidad (1-5)</SelectItem>
                        <SelectItem value="usefulness">Utilidad (1-5)</SelectItem>
                        <SelectItem value="correction">Corrección</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {feedbackType !== 'correction' ? (
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Puntuación (1-5)
                      </label>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((value) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setFeedbackValue(value)}
                            className={`w-10 h-10 rounded-lg font-bold text-sm ${
                              feedbackValue === value
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                            }`}
                          >
                            {value}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      {feedbackType === 'correction' ? 'Valor Correcto' : 'Comentario o Sugerencia (opcional)'}
                    </label>
                    <Textarea
                      placeholder={feedbackType === 'correction' ? 'Ej: documento_recibido' : 'Tu feedback aquí...'}
                      value={feedbackText}
                      onChange={(e) => setFeedbackText(e.target.value)}
                      rows={3}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Tu Email (opcional)</label>
                    <Input
                      type="email"
                      placeholder="tu@email.com"
                      value={feedbackEmail}
                      onChange={(e) => setFeedbackEmail(e.target.value)}
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={submittingFeedback || !feedbackId}
                    className="w-full"
                  >
                    {submittingFeedback ? 'Enviando...' : 'Enviar Feedback'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-slate-500">
          <p>Intelligence Center • SynK-IA Enterprise</p>
          <p>Última actualización: {new Date().toLocaleTimeString('es-ES')}</p>
        </div>
      </div>
    </div>
  );
}
