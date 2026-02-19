import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Loader2,
  Database,
  Mail,
  ShoppingCart,
  Camera,
  Copy,
  ExternalLink
} from "lucide-react";
import { toast } from "sonner";

export default function ApiDiagnostics() {
  const [testing, setTesting] = useState({});
  const [results, setResults] = useState({});
  const [secretsStatus, setSecretsStatus] = useState(null);
  const [credentials, setCredentials] = useState({
    biloop: { url: '', token: '', username: '', password: '' },
    revo: { api_key: '', store_id: '' },
    email: { address: '', app_password: '' },
    eseecloud: { username: '', password: '', cloud_id: '' }
  });

  // Cargar estado de secrets al montar
  React.useEffect(() => {
    checkSecretsStatus();
  }, []);

  const checkSecretsStatus = async () => {
    try {
      const response = await base44.functions.invoke('checkSecretsStatus');
      setSecretsStatus(response.data);
    } catch (error) {
      console.error('Error checking secrets:', error);
    }
  };

  const testBiloop = async () => {
    setTesting({ ...testing, biloop: true });
    try {
      const response = await base44.functions.invoke('testBiloopConnection');
      setResults({ ...results, biloop: response.data });
      if (response.data?.success) {
        toast.success(`✅ BILOOP CONECTADO - ${response.data.working_endpoints?.length || 0} endpoints OK`);
      } else {
        toast.error(`❌ ${response.data?.error || 'Error de conexión'}`);
      }
    } catch (error) {
      toast.error('❌ Error: ' + error.message);
      setResults({ ...results, biloop: { error: error.message } });
    } finally {
      setTesting({ ...testing, biloop: false });
    }
  };

  const testRevo = async () => {
    setTesting({ ...testing, revo: true });
    try {
      const response = await base44.functions.invoke('testRevoConnection');
      setResults({ ...results, revo: response.data });
      if (response.data?.success) {
        toast.success(`✅ REVO CONECTADO - ${response.data.working_endpoint || 'OK'}`);
      } else {
        toast.error(`❌ ${response.data?.error || 'Error de conexión'}`);
      }
    } catch (error) {
      toast.error('❌ Error: ' + error.message);
      setResults({ ...results, revo: { error: error.message } });
    } finally {
      setTesting({ ...testing, revo: false });
    }
  };

  const testEmail = async () => {
    setTesting({ ...testing, email: true });
    try {
      const response = await base44.functions.invoke('testGmailConnection');
      setResults({ ...results, email: response.data });
      
      if (response.data?.success) {
        toast.success('✅ GMAIL CONFIGURADO CORRECTAMENTE');
      } else {
        toast.error(`❌ ${response.data?.error || 'Error'} - ${response.data?.solution || ''}`);
      }
    } catch (error) {
      toast.error('❌ Error: ' + error.message);
      setResults({ ...results, email: { error: error.message } });
    } finally {
      setTesting({ ...testing, email: false });
    }
  };

  const testEseecloud = async () => {
    setTesting({ ...testing, eseecloud: true });
    try {
      const response = await base44.functions.invoke('eseeCloudSync', { action: 'status' });
      setResults({ ...results, eseecloud: response.data });
      if (response.data?.connected) {
        toast.success('✅ ESEECLOUD CONECTADO');
      } else {
        toast.error('❌ ESEECLOUD no conectado');
      }
    } catch (error) {
      toast.error('❌ Error: ' + error.message);
      setResults({ ...results, eseecloud: { error: error.message } });
    } finally {
      setTesting({ ...testing, eseecloud: false });
    }
  };

  const apis = [
    {
      name: '📦 Biloop (Facturas)',
      key: 'biloop',
      test: testBiloop,
      icon: Database,
      secretName: 'ASSEMPSA_BILOOP_API_KEY + CIF',
      docs: 'https://assempsa.biloop.es/api-v2',
      instructions: `
        BILOOP API - CONFIGURACIÓN:

        SECRET PRINCIPAL:
        ✓ ASSEMPSA_BILOOP_API_KEY (cc7581a3-...)

        URL Base: https://assempsa.biloop.es/api-global/v1
        Auth: Header "Ocp-Apim-Subscription-Key"

        Endpoints disponibles:
        - /getCompanies
        - /getExpensesInvoices  
        - /getERPProviders
        - /getWorkers
        - /getDocuments
        - /getStatistics
        `,
              currentConfig: 'API_KEY configurado ✓'
    },
    {
        name: '🍗 Revo XEF (Ventas)',
        key: 'revo',
        test: testRevo,
        icon: ShoppingCart,
        secretName: 'REVO_TOKEN_CORTO + REVO_TOKEN_LARGO',
        docs: 'https://revoxef.works',
        instructions: `
    REVO XEF - CONFIGURACIÓN:

    1. REVO_TOKEN_CORTO (16 caracteres):
    - Token API de cuenta
    - Ej: DUWtc4TNRgyKoFnk

    2. REVO_TOKEN_LARGO (JWT):
    - Token OAuth2 largo
    - Empieza con "eyJ..."

    3. REVO_ADMIN_USER:
    - Tu nombre de usuario/tenant de Revo

    PASOS:
    1. Ve a Dashboard → Settings → Secrets
    2. Configura los 3 secrets
    3. Vuelve aquí y haz clic en "Test Connection"

    El sistema probará automáticamente múltiples 
    combinaciones de autenticación.
    `,
        currentConfig: 'REVO_TOKEN_CORTO y REVO_TOKEN_LARGO configurados ✓'
      },
    {
      name: '📧 Gmail (Facturas Email)',
      key: 'email',
      test: testEmail,
      icon: Mail,
      secretName: 'EMAIL_APP_PASSWORD',
      docs: 'https://support.google.com/accounts/answer/185833',
      instructions: `
GMAIL - CONFIGURACIÓN:

Necesitas 2 secrets:

1. info@chickenpalace.es
   - Tu dirección de Gmail
   - Formato: "tu-email@gmail.com"

2. EMAIL_APP_PASSWORD
   - Contraseña de aplicación (NO tu password normal)
   - Formato: "abcd efgh ijkl mnop"

PASOS PARA OBTENER APP PASSWORD:
1. Ve a https://myaccount.google.com/security
2. Activa "Verificación en 2 pasos" (obligatorio)
3. Ve a "Contraseñas de aplicaciones"
4. Genera una nueva contraseña para "Mail"
5. Copia la contraseña de 16 caracteres
6. Ve a Dashboard → Settings → Secrets
7. Crea "info@chickenpalace.es" con tu email
8. Crea "EMAIL_APP_PASSWORD" con la app password
9. Vuelve aquí y haz clic en "Test Connection"

IMPORTANTE: No uses tu contraseña normal de Gmail.
Debe ser una "Contraseña de aplicación".
`,
      currentConfig: 'info@chickenpalace.es y EMAIL_APP_PASSWORD configurados ✓'
    },
    {
      name: '📹 ESEECLOUD (Cámaras)',
      key: 'eseecloud',
      test: testEseecloud,
      icon: Camera,
      secretName: 'ESEECLOUD_USERNAME',
      docs: 'https://www.eseecloud.com',
      instructions: `
ESEECLOUD - CONFIGURACIÓN:

Necesitas 3 secrets:

1. ESEECLOUD_USERNAME
   - Tu usuario de ESEECLOUD
   
2. ESEECLOUD_PASSWORD
   - Tu contraseña de ESEECLOUD

3. ESEECLOUD_CLOUD_ID
   - Cloud ID de tu DVR/NVR
   - Ej: "5637955927"

PASOS:
1. Encuentra el Cloud ID:
   - Abre la app ESEECLOUD en tu móvil
   - Ve a tus dispositivos
   - El Cloud ID aparece debajo del nombre del DVR
   - Ej: "Cloud ID: 5637955927"

2. Ve a Dashboard → Settings → Secrets
3. Crea los 3 secrets con tus datos
4. Vuelve aquí y haz clic en "Test Connection"

NOTA: El DVR debe estar conectado a internet y
registrado en ESEECLOUD Cloud Service.
`,
      currentConfig: 'ESEECLOUD_USERNAME, PASSWORD y CLOUD_ID configurados ✓'
    }
  ];

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('✅ Copiado al portapapeles');
  };

  return (
    <div className="p-4 md:p-8 min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-5xl font-black text-white mb-3 flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-red-500 to-orange-500 rounded-2xl flex items-center justify-center shadow-2xl">
              <AlertTriangle className="w-8 h-8 text-white" />
            </div>
            DIAGNÓSTICO DE APIs
          </h1>
          <p className="text-xl text-gray-400">
            🔧 Configuración y Testing de Conexiones Reales
          </p>
        </div>

        {/* Estado de Secrets */}
        {secretsStatus && (
          <Card className="border-none shadow-2xl bg-slate-800 mb-6">
            <CardHeader className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white">
              <CardTitle>🔐 Estado de Secrets Configurados</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {Object.entries(secretsStatus.secrets).map(([key, status]) => (
                  <div key={key} className={`p-3 rounded-lg border ${
                    status.configured ? 'bg-green-900/20 border-green-700' : 'bg-red-900/20 border-red-700'
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      {status.configured ? (
                        <CheckCircle2 className="w-4 h-4 text-green-400" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-400" />
                      )}
                      <span className="text-white text-sm font-bold">{key}</span>
                    </div>
                    <p className="text-xs text-gray-400 font-mono">
                      {status.configured ? `${status.length} chars: ${status.preview}` : 'NO CONFIGURADO'}
                    </p>
                  </div>
                ))}
              </div>
              <Button 
                className="mt-4 bg-blue-600 hover:bg-blue-700"
                onClick={checkSecretsStatus}
              >
                🔄 Recargar Estado
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Info compacta */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 mb-6 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0" />
          <p className="text-sm text-gray-400">
            Configura tus secrets en <strong className="text-white">Settings → Environment Variables</strong> y luego testea cada API.
          </p>
        </div>

        {/* API Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {apis.map((api) => {
            const result = results[api.key];
            const isLoading = testing[api.key];
            
            return (
              <Card key={api.key} className="border-none shadow-2xl bg-slate-800">
                <CardHeader className="bg-gradient-to-r from-slate-700 to-slate-800 border-b border-slate-700">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
                        <api.icon className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-white text-xl">{api.name}</CardTitle>
                        <p className="text-sm text-gray-400 mt-1">{api.secretName}</p>
                      </div>
                    </div>
                    {result?.source === `${api.key}_api` || result?.connected ? (
                      <Badge className="bg-green-600 text-white text-sm">
                        <CheckCircle2 className="w-4 h-4 mr-1" />
                        CONECTADO
                      </Badge>
                    ) : result?.error ? (
                      <Badge className="bg-red-600 text-white text-sm">
                        <XCircle className="w-4 h-4 mr-1" />
                        ERROR
                      </Badge>
                    ) : (
                      <Badge className="bg-gray-600 text-white text-sm">
                        NO TESTEADO
                      </Badge>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="p-6 space-y-6">
                  {/* Status Actual */}
                  <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
                    <p className="text-sm text-gray-400 mb-2">Estado Actual:</p>
                    <p className="text-white font-medium">{api.currentConfig}</p>
                  </div>

                  {/* Resultado del Test */}
                  {result && (
                    <div className={`rounded-lg p-4 border ${
                      result.success
                        ? 'bg-green-900/20 border-green-700'
                        : result.error
                        ? 'bg-red-900/20 border-red-700'
                        : 'bg-yellow-900/20 border-yellow-700'
                    }`}>
                      <p className="text-white font-bold mb-2">
                        {result.success
                          ? '✅ Conexión Exitosa'
                          : result.error
                          ? '❌ Error de Conexión'
                          : '⚠️ Revisar configuración'}
                      </p>
                      {result.summary && (
                        <p className="text-sm text-gray-300 mb-2">{result.summary}</p>
                      )}
                      {result.error && (
                        <p className="text-sm text-red-400 mb-2">Error: {result.error}</p>
                      )}
                      {result.solution && (
                        <p className="text-sm text-yellow-400 mb-2">Solución: {result.solution}</p>
                      )}
                      {result.results?.recommendations && (
                        <div className="mt-3 space-y-2">
                          {result.results.recommendations.map((rec, i) => (
                            <div key={i} className={`p-2 rounded text-xs ${
                              rec.priority?.includes('ÉXITO') ? 'bg-green-900/30 text-green-300' :
                              rec.priority?.includes('CRÍTICO') ? 'bg-red-900/30 text-red-300' :
                              'bg-yellow-900/30 text-yellow-300'
                            }`}>
                              <strong>{rec.priority}:</strong> {rec.message || rec.issue}
                              {rec.solution && <p className="mt-1 text-gray-400">{rec.solution}</p>}
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {/* MOSTRAR INTENTOS DE LOGIN DE REVO */}
                          {result.results?.login_attempts && result.results.login_attempts.length > 0 && (
                            <div className="mt-4 bg-slate-950 rounded-lg p-3 border border-blue-700">
                              <p className="text-blue-400 font-bold text-sm mb-2">🔐 Intentos de LOGIN en Revo:</p>
                              <div className="space-y-2 max-h-60 overflow-auto">
                                {result.results.login_attempts.map((attempt, i) => (
                                  <div key={i} className="bg-black/50 p-2 rounded text-xs">
                                    <p className="text-white font-bold">{attempt.method}</p>
                                    <p className="text-gray-500 text-xs truncate">{attempt.url}</p>
                                    <p className="text-gray-400">Status: <span className={attempt.status === 200 ? 'text-green-400' : 'text-red-400'}>{attempt.status}</span></p>
                                    {attempt.response && <pre className="text-blue-300 whitespace-pre-wrap text-xs mt-1">{attempt.response}</pre>}
                                    {attempt.error && <p className="text-red-400 mt-1">{attempt.error}</p>}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                      {/* MOSTRAR INTENTOS DE AUTH DE BILOOP */}
                          {result.results?.login_test?.attempts && (
                        <div className="mt-4 bg-slate-950 rounded-lg p-3 border border-orange-700">
                          <p className="text-orange-400 font-bold text-sm mb-2">🔐 Intentos de autenticación:</p>
                          <div className="space-y-2 max-h-60 overflow-auto">
                            {result.results.login_test.attempts.map((attempt, i) => (
                              <div key={i} className="bg-black/50 p-2 rounded text-xs">
                                <p className="text-white font-bold">{attempt.method}</p>
                                <p className="text-gray-500 text-xs truncate">{attempt.url}</p>
                                <p className="text-gray-400">Status: <span className={attempt.status === 200 ? 'text-green-400' : 'text-red-400'}>{attempt.status}</span></p>
                                <pre className="text-orange-300 whitespace-pre-wrap text-xs mt-1">{attempt.response}</pre>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* MOSTRAR RESPUESTA RAW DE BILOOP */}
                      {result.results?.token_test?.biloop_raw_response && (
                        <div className="mt-4 bg-slate-950 rounded-lg p-3 border border-cyan-700">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-cyan-400 font-bold text-sm">📥 RESPUESTA RAW DE BILOOP:</p>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-cyan-400 hover:text-cyan-300 h-6 px-2"
                              onClick={() => copyToClipboard(result.results.token_test.biloop_raw_response)}
                            >
                              <Copy className="w-3 h-3 mr-1" />
                              Copiar
                            </Button>
                          </div>
                          <p className="text-xs text-gray-500 mb-2">URL: {result.results.token_test.url_used}</p>
                          <pre className="text-xs text-cyan-300 whitespace-pre-wrap font-mono max-h-60 overflow-auto bg-black/50 p-2 rounded">
                            {result.results.token_test.biloop_raw_response}
                          </pre>
                          <div className="mt-2 text-xs text-gray-400">
                            <p>Keys encontradas: {result.results.token_test.raw_keys?.join(', ') || 'ninguna'}</p>
                            <p>Keys en .data: {result.results.token_test.data_keys?.join(', ') || 'ninguna'}</p>
                          </div>
                        </div>
                      )}
                      
                      {result.results?.tests && (
                        <div className="text-xs text-gray-400 mt-3">
                          <p className="text-white font-bold mb-1">Tests ejecutados:</p>
                          <div className="space-y-1">
                            {result.results.tests.map((test, i) => (
                              <div key={i} className="bg-slate-950 p-2 rounded">
                                <span className="text-white">{test.name || test.endpoint}:</span>{' '}
                                <span className={test.ok || test.status === 'success' ? 'text-green-400' : 'text-red-400'}>
                                  {test.verdict || test.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Instrucciones */}
                  <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-white font-bold">📋 Instrucciones de Configuración</p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-slate-600 text-gray-300 hover:bg-slate-700"
                        onClick={() => copyToClipboard(api.instructions)}
                      >
                        <Copy className="w-4 h-4 mr-1" />
                        Copiar
                      </Button>
                    </div>
                    <pre className="text-xs text-gray-400 whitespace-pre-wrap font-mono">
                      {api.instructions}
                    </pre>
                  </div>

                  {/* Botones de Acción */}
                  <div className="flex gap-3">
                    <Button
                      onClick={api.test}
                      disabled={isLoading}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Testeando...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          Test Connection
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      className="border-slate-600 text-gray-300 hover:bg-slate-700"
                      onClick={() => window.open(api.docs, '_blank')}
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Docs
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Test All */}
        <Card className="border-none shadow-2xl bg-gradient-to-r from-purple-600 to-pink-600 text-white mt-8">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold mb-2">🚀 Test Completo de Todas las APIs</h3>
                <p className="text-sm opacity-90">
                  Ejecuta todas las pruebas de conexión simultáneamente
                </p>
              </div>
              <Button
                size="lg"
                className="bg-white text-purple-600 hover:bg-gray-100 font-bold"
                onClick={() => {
                  testBiloop();
                  testRevo();
                  testEmail();
                  testEseecloud();
                }}
                disabled={Object.values(testing).some(v => v)}
              >
                {Object.values(testing).some(v => v) ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Testeando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5 mr-2" />
                    Testear Todo
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}