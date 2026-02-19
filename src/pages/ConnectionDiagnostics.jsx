import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Play, 
  Loader2, 
  CheckCircle2,
  AlertCircle,
  XCircle,
  AlertTriangle,
  Info
} from "lucide-react";

export default function ConnectionDiagnostics() {
  const [testing, setTesting] = useState({
    gmail: false,
    revo: false,
    biloop: false
  });

  const [results, setResults] = useState({
    gmail: null,
    revo: null,
    biloop: null
  });

  const runTest = async (service) => {
    setTesting({ ...testing, [service]: true });
    try {
      const functionName = `test${service.charAt(0).toUpperCase() + service.slice(1)}Connection`;
      const response = await base44.functions.invoke(functionName);
      setResults({ ...results, [service]: response.data });
    } catch (error) {
      setResults({ 
        ...results, 
        [service]: { 
          error: error.message,
          success: false 
        } 
      });
    } finally {
      setTesting({ ...testing, [service]: false });
    }
  };

  const runAllTests = async () => {
    await runTest('gmail');
    await runTest('revo');
    await runTest('biloop');
  };

  const getPriorityIcon = (priority) => {
    switch (priority) {
      case 'CRÍTICO': return <XCircle className="w-4 h-4 text-red-600" />;
      case 'ADVERTENCIA': return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      case 'INFO': return <Info className="w-4 h-4 text-blue-600" />;
      case 'ÉXITO': return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      default: return <Info className="w-4 h-4 text-gray-600" />;
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'CRÍTICO': return 'bg-red-50 border-red-200';
      case 'ADVERTENCIA': return 'bg-yellow-50 border-yellow-200';
      case 'INFO': return 'bg-blue-50 border-blue-200';
      case 'ÉXITO': return 'bg-green-50 border-green-200';
      default: return 'bg-gray-50 border-gray-200';
    }
  };

  const ServiceCard = ({ service, name, icon, description }) => {
    const result = results[service];
    const isLoading = testing[service];

    return (
      <Card className="border-none shadow-xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 ${icon.bg} rounded-xl flex items-center justify-center`}>
                {icon.component}
              </div>
              <div>
                <CardTitle className="text-lg">{name}</CardTitle>
                <p className="text-xs text-gray-600">{description}</p>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!result && !isLoading && (
            <p className="text-sm text-gray-600">Ejecuta el test para diagnosticar la conexión</p>
          )}

          {isLoading && (
            <div className="flex items-center gap-2 text-blue-600">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Ejecutando diagnóstico...</span>
            </div>
          )}

          {result && (
            <div className="space-y-4">
              {/* Summary */}
              {result.results?.summary && (
                <div className="flex items-center gap-2">
                  {result.success ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-600" />
                  )}
                  <span className="font-medium">{result.results.summary}</span>
                </div>
              )}

              {/* Tests */}
              {result.results?.tests && result.results.tests.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">Resultados de Tests:</p>
                  {result.results.tests.map((test, idx) => (
                    <div key={idx} className="bg-gray-50 rounded-lg p-3 text-sm">
                      <div className="flex items-start gap-2">
                        {test.status === 'success' && <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5" />}
                        {test.status === 'error' && <XCircle className="w-4 h-4 text-red-600 mt-0.5" />}
                        {test.status === 'warning' && <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5" />}
                        {test.status === 'info' && <Info className="w-4 h-4 text-blue-600 mt-0.5" />}
                        <div className="flex-1">
                          {test.name && <p className="font-medium">{test.name}</p>}
                          {test.endpoint && <p className="text-xs text-gray-600 mt-1">Endpoint: {test.endpoint}</p>}
                          {test.verdict && <p className="mt-1">{test.verdict}</p>}
                          {test.message && <p className="mt-1 text-gray-700">{test.message}</p>}
                          {test.error && <p className="mt-1 text-red-600">{test.error}</p>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Recommendations */}
              {result.results?.recommendations && result.results.recommendations.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-bold text-gray-900">🔧 Recomendaciones:</p>
                  {result.results.recommendations.map((rec, idx) => (
                    <div key={idx} className={`border rounded-lg p-4 ${getPriorityColor(rec.priority)}`}>
                      <div className="flex items-start gap-3">
                        {getPriorityIcon(rec.priority)}
                        <div className="flex-1">
                          <p className="font-bold text-sm mb-2">{rec.priority}: {rec.issue}</p>
                          <p className="text-sm whitespace-pre-line text-gray-700">{rec.solution}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Secrets Info */}
              {result.results?.secrets_found && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs font-medium text-gray-700 mb-2">Secrets Configurados:</p>
                  <div className="space-y-1">
                    {Object.entries(result.results.secrets_found).map(([key, value]) => (
                      <div key={key} className="flex items-center gap-2 text-xs">
                        {value ? (
                          <CheckCircle2 className="w-3 h-3 text-green-600" />
                        ) : (
                          <XCircle className="w-3 h-3 text-red-600" />
                        )}
                        <span className="font-mono">{key}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Error */}
              {result.error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-red-900">Error:</p>
                      <p className="text-sm text-red-700 mt-1">{result.error}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <Button
            onClick={() => runTest(service)}
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Diagnosticando...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Ejecutar Test
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="p-4 md:p-8 min-h-screen bg-gradient-to-br from-slate-50 to-gray-100">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            🔧 Diagnóstico de Conexiones
          </h1>
          <p className="text-gray-600">
            Tests detallados para diagnosticar problemas de conexión con APIs externas
          </p>
        </div>

        <div className="mb-6">
          <Button
            onClick={runAllTests}
            disabled={Object.values(testing).some(v => v)}
            size="lg"
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
          >
            <Play className="w-5 h-5 mr-2" />
            Ejecutar Todos los Tests
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <ServiceCard
            service="gmail"
            name="Gmail IMAP"
            description="Procesador de emails"
            icon={{
              component: <span className="text-2xl">📧</span>,
              bg: "bg-gradient-to-br from-red-500 to-pink-500"
            }}
          />

          <ServiceCard
            service="revo"
            name="Revo XEF"
            description="Sistema de ventas"
            icon={{
              component: <span className="text-2xl">🍗</span>,
              bg: "bg-gradient-to-br from-cyan-500 to-blue-600"
            }}
          />

          <ServiceCard
            service="biloop"
            name="Biloop Assempsa"
            description="Gestión de facturas"
            icon={{
              component: <span className="text-2xl">📄</span>,
              bg: "bg-gradient-to-br from-green-500 to-emerald-600"
            }}
          />
        </div>
      </div>
    </div>
  );
}