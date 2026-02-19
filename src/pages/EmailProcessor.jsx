import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Mail, 
  Upload, 
  Loader2, 
  CheckCircle2,
  AlertCircle,
  FileText,
  Building2,
  Zap,
  Filter,
  Inbox,
  Star,
  Users,
  Briefcase,
  DollarSign,
  Archive,
  Copy
} from "lucide-react";
import { toast } from "sonner";
import { format, isValid } from "date-fns";

export default function EmailProcessor() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [emailText, setEmailText] = useState('');
  const [attachmentFile, setAttachmentFile] = useState(null);
  const [results, setResults] = useState(null);
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterImportance, setFilterImportance] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const queryClient = useQueryClient();

  const { data: processedEmails = [], isLoading: isLoadingEmails } = useQuery({
    queryKey: ['emails', filterCategory],
    queryFn: async () => {
      try {
        const emails = await base44.entities.EmailIntegration.list('-received_date', 100);
        if (filterCategory === 'all') return emails;
        return emails.filter(e => e.category === filterCategory);
      } catch (error) {
        console.error('Error loading emails:', error);
        return [];
      }
    },
    initialData: [],
  });

  const markAsReviewedMutation = useMutation({
    mutationFn: ({ id, reviewed }) => base44.entities.EmailIntegration.update(id, { 
      extracted_data: { 
        ...processedEmails.find(e => e.id === id)?.extracted_data,
        reviewed 
      }
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emails'] });
      toast.success('Estado actualizado');
    },
  });

  const processEmail = async () => {
    if (!emailText.trim() && !attachmentFile) {
      toast.error('Debes proporcionar el texto del email o un archivo adjunto');
      return;
    }

    setIsProcessing(true);
    setResults(null);

    try {
      let fileUrl = null;
      
      // 1. Si hay archivo, subirlo
      if (attachmentFile) {
        const uploadResult = await base44.integrations.Core.UploadFile({ file: attachmentFile });
        fileUrl = uploadResult.file_url;
      }

      // 2. Usar IA para analizar el email
      const prompt = `
Analiza este email y extrae la información relevante:

${emailText}

${fileUrl ? `Archivo adjunto: ${fileUrl}` : ''}

Identifica:
1. ¿Es una factura? Si es así, extrae: proveedor, número, fecha, importe total, IVA
2. ¿Es información de un proveedor nuevo? Extrae: nombre, CIF, email, teléfono, dirección
3. ¿Es un documento legal/fiscal? Especifica el tipo
4. ¿Es sobre RRHH? (nóminas, contratos, etc.)

Responde en formato JSON estructurado.
`;

      const analysisResult = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            category: { 
              type: "string",
              enum: ["factura", "proveedor", "gestoria", "rrhh", "otros"]
            },
            importance: {
              type: "string",
              enum: ["alta", "media", "baja"]
            },
            sender_type: {
              type: "string",
              enum: ["proveedor", "cliente", "empleado", "gestoria", "administracion", "otros"]
            },
            is_new_sender: { type: "boolean" },
            requires_action: { type: "boolean" },
            keywords: {
              type: "array",
              items: { type: "string" }
            },
            is_invoice: { type: "boolean" },
            invoice_data: {
              type: "object",
              properties: {
                provider_name: { type: "string" },
                invoice_number: { type: "string" },
                invoice_date: { type: "string" },
                total: { type: "number" },
                iva: { type: "number" }
              }
            },
            is_new_provider: { type: "boolean" },
            provider_data: {
              type: "object",
              properties: {
                name: { type: "string" },
                cif: { type: "string" },
                email: { type: "string" },
                phone: { type: "string" },
                address: { type: "string" },
                category: { type: "string" }
              }
            },
            summary: { type: "string" }
          }
        }
      });

      let createdInvoice = null;
      let createdProvider = null;
      let savedEmail = null;

      // 3. Guardar el email procesado
      savedEmail = await base44.entities.EmailIntegration.create({
        subject: "Email procesado manualmente",
        sender: "procesamiento_manual@synk-ia.com",
        received_date: new Date().toISOString(),
        body: emailText,
        processed: true,
        category: analysisResult.category,
        extracted_data: analysisResult,
        action_taken: ""
      });

      // 4. Crear factura si es una factura
      if (analysisResult.is_invoice && analysisResult.invoice_data) {
        createdInvoice = await base44.entities.Invoice.create({
          ...analysisResult.invoice_data,
          file_url: fileUrl,
          status: 'pendiente'
        });
        
        await base44.entities.EmailIntegration.update(savedEmail.id, {
          action_taken: `Factura creada: ${analysisResult.invoice_data.provider_name}`
        });

        queryClient.invalidateQueries({ queryKey: ['invoices'] });
      }

      // 5. Crear proveedor si es nuevo
      if (analysisResult.is_new_provider && analysisResult.provider_data) {
        createdProvider = await base44.entities.Provider.create({
          ...analysisResult.provider_data,
          status: 'pendiente',
          rating: 3
        });

        await base44.entities.EmailIntegration.update(savedEmail.id, {
          action_taken: (savedEmail.action_taken || '') + ` | Proveedor creado: ${analysisResult.provider_data.name}`
        });

        queryClient.invalidateQueries({ queryKey: ['providers'] });
      }

      setResults({
        success: true,
        analysis: analysisResult,
        createdInvoice,
        createdProvider,
        savedEmail,
        invoiceData: analysisResult.invoice_data,
        fileUrl
      });

      toast.success('Email procesado correctamente');
      
      // Limpiar formulario
      setEmailText('');
      setAttachmentFile(null);

    } catch (error) {
      console.error('Error processing email:', error);
      toast.error('Error al procesar el email');
      setResults({
        success: false,
        error: error.message
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredEmails = processedEmails.filter(email => {
    const matchesSearch = !searchQuery || 
      email.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.sender?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesImportance = filterImportance === 'all' || 
      email.extracted_data?.importance === filterImportance;
    return matchesSearch && matchesImportance;
  });

  const emailsByCategory = {
    factura: filteredEmails.filter(e => e.category === 'factura'),
    proveedor: filteredEmails.filter(e => e.category === 'proveedor'),
    rrhh: filteredEmails.filter(e => e.category === 'rrhh'),
    gestoria: filteredEmails.filter(e => e.category === 'gestoria'),
    otros: filteredEmails.filter(e => e.category === 'otros')
  };

  const categoryIcons = {
    factura: { icon: FileText, color: 'text-green-600', bg: 'bg-green-50' },
    proveedor: { icon: Building2, color: 'text-blue-600', bg: 'bg-blue-50' },
    rrhh: { icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
    gestoria: { icon: Briefcase, color: 'text-orange-600', bg: 'bg-orange-50' },
    otros: { icon: Mail, color: 'text-gray-600', bg: 'bg-gray-50' }
  };

  const importanceColors = {
    alta: 'bg-red-100 text-red-800 border-red-300',
    media: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    baja: 'bg-green-100 text-green-800 border-green-300'
  };

  if (isLoadingEmails) {
    return (
      <div className="p-4 md:p-8 min-h-screen bg-gradient-to-br from-teal-50 to-cyan-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-teal-600 mx-auto mb-4" />
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 min-h-screen bg-gradient-to-br from-teal-50 to-cyan-50">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Inbox className="w-8 h-8 text-teal-600" />
            Centro de Entrenamiento de Emails
          </h1>
          <p className="text-gray-600 mt-1">
            Organiza y clasifica emails para entrenar la IA - Sin descarte, todo se conserva
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          {Object.entries(emailsByCategory).map(([cat, emails]) => {
            const config = categoryIcons[cat];
            const Icon = config.icon;
            return (
              <Card 
                key={cat} 
                className={`border-none shadow-lg cursor-pointer transition-all ${filterCategory === cat ? 'ring-2 ring-teal-500' : ''}`}
                onClick={() => setFilterCategory(filterCategory === cat ? 'all' : cat)}
              >
                <CardContent className="p-4">
                  <div className={`w-10 h-10 ${config.bg} rounded-lg flex items-center justify-center mb-2`}>
                    <Icon className={`w-5 h-5 ${config.color}`} />
                  </div>
                  <p className="text-xs text-gray-600 capitalize mb-1">{cat}</p>
                  <p className="text-2xl font-bold">{emails.length}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Tabs defaultValue="results" className="mb-8">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="results">📊 Resultados</TabsTrigger>
            <TabsTrigger value="inbox">📧 Bandeja ({processedEmails.length})</TabsTrigger>
            <TabsTrigger value="process">➕ Procesar Nuevo</TabsTrigger>
          </TabsList>

          <TabsContent value="results" className="space-y-6 mt-6">
            <Card className="border-none shadow-lg">
              <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-6 h-6 text-green-600" />
                  Facturas Extraídas para Biloop
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {(() => {
                  const invoiceEmails = processedEmails.filter(e => e.category === 'factura' && e.extracted_data?.invoice_data);
                  
                  if (invoiceEmails.length === 0) {
                    return (
                      <div className="text-center py-8">
                        <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-600">No hay facturas extraídas todavía</p>
                      </div>
                    );
                  }

                  const byProvider = invoiceEmails.reduce((acc, email) => {
                    const provider = email.extracted_data.invoice_data.provider_name || 'Sin proveedor';
                    if (!acc[provider]) acc[provider] = [];
                    acc[provider].push(email);
                    return acc;
                  }, {});

                  return (
                    <div className="space-y-4">
                      {Object.entries(byProvider).map(([provider, emails]) => (
                        <Card key={provider} className="bg-blue-50 border-blue-200">
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <Building2 className="w-5 h-5 text-blue-600" />
                                <span className="font-bold text-lg">{provider}</span>
                              </div>
                              <Badge className="bg-blue-600 text-white">{emails.length} facturas</Badge>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2">
                              {emails.map((email, idx) => {
                                const inv = email.extracted_data.invoice_data;
                                return (
                                  <div key={idx} className="bg-white p-4 rounded-lg shadow border-l-4 border-green-500">
                                    <div className="flex items-start justify-between">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                          <FileText className="w-4 h-4 text-green-600" />
                                          <span className="font-medium">{inv.invoice_number || 'Factura'}</span>
                                          <Badge className="bg-green-100 text-green-800">
                                            {inv.total ? `${inv.total}€` : 'Sin total'}
                                          </Badge>
                                        </div>
                                        <div className="text-sm text-gray-600 space-y-1">
                                          <p>📅 Fecha factura: {inv.invoice_date || 'No especificada'}</p>
                                          <p>⏰ Procesado: {email.received_date ? format(new Date(email.received_date), 'dd/MM/yyyy HH:mm') : '-'}</p>
                                          <p>📧 De: <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">{email.sender}</code></p>
                                          <p>📁 Ubicación: <code className="bg-gray-100 px-2 py-1 rounded text-xs">{provider}/{inv.invoice_date || 'sin_fecha'}/</code></p>
                                          <p>📎 Estado: <span className="text-green-600 font-medium">{email.action_taken || 'Procesada'}</span></p>
                                        </div>
                                      </div>
                                      {email.attachments && email.attachments.length > 0 && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => window.open(email.attachments[0].url, '_blank')}
                                        >
                                          Ver PDF
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>

            <Card className="border-none shadow-lg">
              <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50">
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-6 h-6 text-purple-600" />
                  Proveedores Nuevos Detectados
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {(() => {
                  const newProviders = processedEmails.filter(e => 
                    e.extracted_data?.is_new_provider || e.extracted_data?.provider_data
                  );

                  if (newProviders.length === 0) {
                    return (
                      <div className="text-center py-8">
                        <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-600">No hay proveedores nuevos detectados</p>
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {newProviders.map((email, idx) => {
                        const prov = email.extracted_data.provider_data || {};
                        return (
                          <Card key={idx} className="bg-purple-50 border-purple-200">
                            <CardContent className="p-4">
                              <div className="flex items-start gap-3 mb-3">
                                <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                                  <Building2 className="w-5 h-5 text-white" />
                                </div>
                                <div className="flex-1">
                                  <p className="font-bold text-lg mb-1">{prov.name || 'Proveedor nuevo'}</p>
                                  <Badge className="bg-purple-600 text-white text-xs">Nuevo</Badge>
                                </div>
                              </div>
                              <div className="space-y-1 text-sm">
                                <p><strong>📧 Remitente:</strong> {email.sender}</p>
                                <p><strong>⏰ Detectado:</strong> {format(new Date(email.received_date), 'dd/MM/yyyy HH:mm')}</p>
                                {prov.cif && <p><strong>CIF:</strong> {prov.cif}</p>}
                                {prov.email && <p><strong>Email:</strong> {prov.email}</p>}
                                {prov.phone && <p><strong>Tel:</strong> {prov.phone}</p>}
                                {prov.category && <p><strong>Categoría:</strong> {prov.category}</p>}
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>

            <Card className="border-none shadow-lg">
              <CardHeader className="bg-gradient-to-r from-orange-50 to-yellow-50">
                <CardTitle className="flex items-center gap-2">
                  <Star className="w-6 h-6 text-orange-600" />
                  Resumen por Familias
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {Object.entries(emailsByCategory).map(([cat, emails]) => {
                    if (emails.length === 0) return null;
                    const config = categoryIcons[cat];
                    const Icon = config.icon;
                    return (
                      <Card key={cat} className={`${config.bg} border-2`}>
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3 mb-2">
                            <Icon className={`w-6 h-6 ${config.color}`} />
                            <span className="font-bold capitalize">{cat}</span>
                          </div>
                          <p className="text-3xl font-bold mb-2">{emails.length}</p>
                          <div className="space-y-1 text-xs">
                            <p>🔴 Alta: {emails.filter(e => e.extracted_data?.importance === 'alta').length}</p>
                            <p>🟡 Media: {emails.filter(e => e.extracted_data?.importance === 'media').length}</p>
                            <p>🟢 Baja: {emails.filter(e => e.extracted_data?.importance === 'baja').length}</p>
                            <p className="pt-1 border-t">✨ Nuevos: {emails.filter(e => e.extracted_data?.is_new_sender).length}</p>
                            <p>⚡ Acción: {emails.filter(e => e.extracted_data?.requires_action).length}</p>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="process" className="space-y-6 mt-6">

            <Card className="border-none shadow-lg bg-gradient-to-r from-yellow-500 to-orange-500 text-white">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <AlertCircle className="w-6 h-6 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="font-bold text-lg mb-2">🎓 Modo Entrenamiento</h3>
                    <p className="text-sm opacity-90">
                      Procesa emails para entrenar la IA. Todo se conserva para análisis y automatización futura.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-lg">
          <CardHeader>
            <CardTitle>Procesar Email</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="email-text">Contenido del Email</Label>
              <Textarea
                id="email-text"
                value={emailText}
                onChange={(e) => setEmailText(e.target.value)}
                placeholder="Pega aquí el contenido del email que quieres procesar..."
                rows={8}
                disabled={isProcessing}
              />
            </div>

            <div>
              <Label htmlFor="attachment">Archivo Adjunto (opcional)</Label>
              <div className="mt-2">
                <Input
                  id="attachment"
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.zip"
                  onChange={(e) => setAttachmentFile(e.target.files[0])}
                  disabled={isProcessing}
                />
                {attachmentFile && (
                  <p className="text-sm text-gray-600 mt-2">
                    📎 {attachmentFile.name} ({(attachmentFile.size / 1024).toFixed(2)} KB)
                  </p>
                )}
              </div>
            </div>

            <Button
              onClick={processEmail}
              disabled={isProcessing || (!emailText.trim() && !attachmentFile)}
              className="w-full bg-teal-600 hover:bg-teal-700"
              size="lg"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Procesando con IA...
                </>
              ) : (
                <>
                  <Zap className="w-5 h-5 mr-2" />
                  Procesar Email
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Results */}
        {results && (
          <Card className="border-none shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {results.success ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    Procesamiento Completado
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-5 h-5 text-red-600" />
                    Error en Procesamiento
                  </>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {results.success ? (
                <div className="space-y-6">
                  {/* Datos Extraídos */}
                  {results.invoiceData && (
                    <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-300">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-blue-900">
                          <FileText className="w-6 h-6" />
                          📄 Datos de Factura Extraídos
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-white p-4 rounded-lg shadow">
                            <p className="text-xs text-gray-600 mb-1">Proveedor</p>
                            <p className="font-bold text-lg">{results.invoiceData.provider_name || '-'}</p>
                          </div>
                          <div className="bg-white p-4 rounded-lg shadow">
                            <p className="text-xs text-gray-600 mb-1">Número de Factura</p>
                            <p className="font-bold text-lg">{results.invoiceData.invoice_number || '-'}</p>
                          </div>
                          <div className="bg-white p-4 rounded-lg shadow">
                            <p className="text-xs text-gray-600 mb-1">Fecha</p>
                            <p className="font-bold text-lg">{results.invoiceData.invoice_date || '-'}</p>
                          </div>
                          <div className="bg-white p-4 rounded-lg shadow">
                            <p className="text-xs text-gray-600 mb-1">Total</p>
                            <p className="font-bold text-2xl text-green-600">{results.invoiceData.total ? `${results.invoiceData.total}€` : '-'}</p>
                          </div>
                          <div className="bg-white p-4 rounded-lg shadow">
                            <p className="text-xs text-gray-600 mb-1">IVA</p>
                            <p className="font-bold text-lg">{results.invoiceData.iva ? `${results.invoiceData.iva}€` : '-'}</p>
                          </div>
                          <div className="bg-white p-4 rounded-lg shadow">
                            <p className="text-xs text-gray-600 mb-1">Estado</p>
                            <Badge className="bg-yellow-500 text-white">Pendiente</Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Almacenamiento para Biloop */}
                  {results.createdInvoice && results.fileUrl && (
                    <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-green-900">
                          <CheckCircle2 className="w-6 h-6" />
                          ✅ Factura Lista para Biloop
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="bg-white p-4 rounded-lg shadow">
                          <p className="text-sm text-gray-600 mb-2">Ubicación de almacenamiento:</p>
                          <p className="font-mono text-sm bg-gray-100 p-3 rounded border">
                            📁 {results.invoiceData.provider_name}/{results.invoiceData.invoice_date || 'sin_fecha'}/
                          </p>
                        </div>
                        <div className="bg-white p-4 rounded-lg shadow">
                          <p className="text-sm text-gray-600 mb-2">Archivo PDF:</p>
                          <div className="flex items-center gap-3">
                            <FileText className="w-8 h-8 text-red-600" />
                            <div>
                              <p className="font-medium">{results.invoiceData.invoice_number || 'factura'}.pdf</p>
                              <a 
                                href={results.fileUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline text-sm"
                              >
                                Ver PDF →
                              </a>
                            </div>
                          </div>
                        </div>
                        <div className="bg-green-100 p-4 rounded-lg border-2 border-green-400">
                          <p className="text-sm font-medium text-green-900">
                            🎯 Esta factura está lista para subirse a Biloop. Organizada por proveedor y fecha.
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Created Provider */}
                  {results.createdProvider && (
                    <div className="bg-purple-50 border-2 border-purple-300 rounded-lg p-4">
                      <div className="flex items-center gap-3 mb-2">
                        <Building2 className="w-5 h-5 text-purple-600" />
                        <p className="font-medium text-purple-900">✅ Proveedor Creado</p>
                      </div>
                      <div className="text-sm text-purple-700 space-y-1">
                        <p><strong>Nombre:</strong> {results.createdProvider.name}</p>
                        {results.createdProvider.cif && (
                          <p><strong>CIF:</strong> {results.createdProvider.cif}</p>
                        )}
                        {results.createdProvider.email && (
                          <p><strong>Email:</strong> {results.createdProvider.email}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {!results.createdInvoice && !results.createdProvider && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <p className="text-sm text-gray-700">
                        ℹ️ Email procesado y guardado, pero no se detectaron facturas ni proveedores nuevos.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm text-red-700">{results.error}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
          </TabsContent>

          <TabsContent value="inbox" className="space-y-6 mt-6">
            {/* Filtros */}
            <Card className="border-none shadow-lg">
              <CardContent className="p-4">
                <div className="flex flex-wrap gap-4">
                  <div className="flex-1 min-w-[200px]">
                    <Input
                      placeholder="Buscar por remitente o asunto..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-gray-500" />
                    <select
                      value={filterImportance}
                      onChange={(e) => setFilterImportance(e.target.value)}
                      className="border rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="all">Todas las prioridades</option>
                      <option value="alta">Alta prioridad</option>
                      <option value="media">Media prioridad</option>
                      <option value="baja">Baja prioridad</option>
                    </select>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setFilterCategory('all');
                      setFilterImportance('all');
                      setSearchQuery('');
                    }}
                  >
                    Limpiar filtros
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Lista de Emails por Categoría */}
            {filteredEmails.length === 0 ? (
              <Card className="border-none shadow-lg">
                <CardContent className="p-12 text-center">
                  <Inbox className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-xl font-bold mb-2">No hay emails procesados</h3>
                  <p className="text-gray-600">Procesa tu primer email para verlo aquí</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {Object.entries(emailsByCategory).map(([category, emails]) => {
                  if (emails.length === 0) return null;
                  const config = categoryIcons[category];
                  const Icon = config.icon;
                  
                  return (
                    <Card key={category} className="border-none shadow-lg">
                      <CardHeader className={`${config.bg} border-b`}>
                        <CardTitle className="flex items-center gap-3">
                          <Icon className={`w-6 h-6 ${config.color}`} />
                          <span className="capitalize">{category}</span>
                          <Badge variant="outline">{emails.length} emails</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          {emails.map((email) => (
                            <div 
                              key={email.id}
                              className="flex items-start justify-between p-4 bg-gray-50 rounded-lg border hover:border-gray-300 transition-all"
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2 flex-wrap">
                                  <p className="font-medium">{email.subject || 'Sin asunto'}</p>
                                  {email.extracted_data?.importance && (
                                    <Badge className={importanceColors[email.extracted_data.importance]}>
                                      {email.extracted_data.importance === 'alta' ? '🔴' : email.extracted_data.importance === 'media' ? '🟡' : '🟢'}
                                      {email.extracted_data.importance}
                                    </Badge>
                                  )}
                                  {email.extracted_data?.is_new_sender && (
                                    <Badge className="bg-blue-100 text-blue-800">
                                      ✨ Remitente Nuevo
                                    </Badge>
                                  )}
                                  {email.extracted_data?.requires_action && (
                                    <Badge className="bg-red-100 text-red-800">
                                      ⚡ Requiere Acción
                                    </Badge>
                                  )}
                                  {email.extracted_data?.reviewed && (
                                    <Badge className="bg-green-100 text-green-800">
                                      ✓ Revisado
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                                  <span className="flex items-center gap-1">
                                    <Mail className="w-3 h-3" />
                                    {email.sender}
                                  </span>
                                  {email.received_date && (
                                    <span>
                                      {isValid(new Date(email.received_date)) && format(new Date(email.received_date), 'dd/MM/yyyy HH:mm')}
                                    </span>
                                  )}
                                  {email.extracted_data?.sender_type && (
                                    <Badge variant="outline" className="text-xs">
                                      {email.extracted_data.sender_type}
                                    </Badge>
                                  )}
                                </div>
                                {email.body && (
                                  <details className="mt-2">
                                    <summary className="text-xs text-blue-600 cursor-pointer hover:underline">
                                      Ver contenido completo del email
                                    </summary>
                                    <div className="mt-2 p-3 bg-white rounded border text-sm text-gray-700 max-h-40 overflow-y-auto">
                                      {email.body}
                                    </div>
                                  </details>
                                )}
                                {email.extracted_data?.summary && (
                                  <div className="mt-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                                    <p className="text-xs text-blue-600 font-medium mb-1">📝 Resumen IA:</p>
                                    <p className="text-sm text-gray-700">{email.extracted_data.summary}</p>
                                  </div>
                                )}
                                {email.action_taken && (
                                  <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" />
                                    {email.action_taken}
                                  </p>
                                )}
                                {email.extracted_data?.keywords && email.extracted_data.keywords.length > 0 && (
                                  <div className="flex gap-1 mt-2 flex-wrap">
                                    {email.extracted_data.keywords.slice(0, 5).map((keyword, i) => (
                                      <span key={i} className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded">
                                        {keyword}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="flex gap-2 ml-4">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => markAsReviewedMutation.mutate({ 
                                    id: email.id, 
                                    reviewed: !email.extracted_data?.reviewed 
                                  })}
                                >
                                  <CheckCircle2 className={`w-4 h-4 ${email.extracted_data?.reviewed ? 'text-green-600' : 'text-gray-400'}`} />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    navigator.clipboard.writeText(email.sender);
                                    toast.success('Remitente copiado');
                                  }}
                                >
                                  <Mail className="w-4 h-4 text-blue-600" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}