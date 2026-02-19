import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  Upload, 
  FileText, 
  Loader2, 
  CheckCircle2,
  Download,
  FolderOpen,
  Calendar,
  Building2,
  Send,
  Eye,
  Trash2,
  Filter
} from "lucide-react";
import { toast } from "sonner";
import { format, isValid, startOfQuarter, endOfQuarter } from "date-fns";

export default function GestorFacturas() {
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [selectedQuarter, setSelectedQuarter] = useState('all');
  const [selectedProvider, setSelectedProvider] = useState('all');
  const [viewingPDF, setViewingPDF] = useState(null);
  const [selectedForBiloop, setSelectedForBiloop] = useState([]);
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => base44.entities.Invoice.list('-invoice_date'),
    initialData: [],
  });

  const { data: providers = [] } = useQuery({
    queryKey: ['providers'],
    queryFn: () => base44.entities.Provider.list(),
    initialData: [],
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Invoice.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Factura eliminada');
    },
  });

  // Organizar por trimestres
  const getQuarter = (date) => {
    if (!date) return null;
    const d = new Date(date);
    if (!isValid(d)) return null;
    const quarter = Math.floor(d.getMonth() / 3) + 1;
    return `${d.getFullYear()}-Q${quarter}`;
  };

  const quarters = [...new Set(invoices.map(inv => getQuarter(inv.invoice_date)).filter(Boolean))].sort().reverse();

  const filteredInvoices = invoices.filter(inv => {
    const matchesQuarter = selectedQuarter === 'all' || getQuarter(inv.invoice_date) === selectedQuarter;
    const matchesProvider = selectedProvider === 'all' || inv.provider_name === selectedProvider;
    return matchesQuarter && matchesProvider;
  });

  // Agrupar por proveedor
  const invoicesByProvider = filteredInvoices.reduce((acc, inv) => {
    const provider = inv.provider_name || 'Sin clasificar';
    if (!acc[provider]) acc[provider] = [];
    acc[provider].push(inv);
    return acc;
  }, {});

  // Estadísticas por trimestre
  const quarterStats = quarters.map(q => {
    const qInvoices = invoices.filter(inv => getQuarter(inv.invoice_date) === q);
    return {
      quarter: q,
      count: qInvoices.length,
      total: qInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0),
      paid: qInvoices.filter(inv => inv.status === 'pagada').length,
      pending: qInvoices.filter(inv => inv.status === 'pendiente').length
    };
  });

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files).filter(
      file => file.type === "application/pdf" || file.type.startsWith("image/")
    );

    if (files.length > 0) {
      await processFiles(files);
    }
  };

  const handleFileInput = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      await processFiles(files);
    }
  };

  const processFiles = async (files) => {
    setIsUploading(true);
    let processed = 0;

    try {
      for (const file of files) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        const invoiceSchema = await base44.entities.Invoice.schema();
        const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
          file_url,
          json_schema: invoiceSchema
        });

        if (result.status === "success" && result.output) {
          await base44.entities.Invoice.create({
            ...result.output,
            file_url,
            status: result.output.status || 'pendiente'
          });
          processed++;
        }
      }
      
      toast.success(`${processed} facturas procesadas correctamente`);
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    } catch (error) {
      toast.error('Error al procesar facturas');
      console.error(error);
    } finally {
      setIsUploading(false);
    }
  };

  const exportToBiloop = async () => {
    const invoicesToExport = selectedForBiloop.length > 0 
      ? filteredInvoices.filter(inv => selectedForBiloop.includes(inv.id))
      : filteredInvoices;

    if (invoicesToExport.length === 0) {
      toast.error('No hay facturas para exportar');
      return;
    }

    // Agrupar por proveedor
    const byProvider = invoicesToExport.reduce((acc, inv) => {
      const provider = inv.provider_name || 'Sin_proveedor';
      if (!acc[provider]) acc[provider] = [];
      acc[provider].push(inv);
      return acc;
    }, {});

    toast.info('Descargando PDFs organizados por proveedor...');

    // Descargar cada PDF individualmente
    let downloaded = 0;
    for (const [provider, invoices] of Object.entries(byProvider)) {
      for (const invoice of invoices) {
        if (invoice.file_url) {
          const link = document.createElement('a');
          link.href = invoice.file_url;
          const fileName = `${provider}/${invoice.invoice_number || 'factura'}_${invoice.invoice_date || ''}.pdf`;
          link.download = fileName.replace(/[/\\?%*:|"<>]/g, '_');
          link.click();
          downloaded++;
          await new Promise(resolve => setTimeout(resolve, 300)); // Delay entre descargas
        }
      }
    }
    
    toast.success(`${downloaded} PDFs descargados organizados por proveedor`);
  };

  const toggleSelection = (invoiceId) => {
    setSelectedForBiloop(prev => 
      prev.includes(invoiceId) 
        ? prev.filter(id => id !== invoiceId)
        : [...prev, invoiceId]
    );
  };

  const providerNames = [...new Set(invoices.map(inv => inv.provider_name).filter(Boolean))];

  return (
    <div className="p-4 md:p-8 min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <FolderOpen className="w-8 h-8 text-blue-600" />
              Gestor de Facturas
            </h1>
            <p className="text-gray-600 mt-1">
              Organiza, clasifica y exporta tus facturas por trimestre
            </p>
          </div>
          <Button
            onClick={exportToBiloop}
            disabled={filteredInvoices.length === 0}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Download className="w-5 h-5 mr-2" />
            Descargar PDFs ({selectedForBiloop.length || filteredInvoices.length})
          </Button>
        </div>

        {/* KPIs por Trimestre */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {quarterStats.slice(0, 4).map((qs) => (
            <Card 
              key={qs.quarter} 
              className={`border-none shadow-lg cursor-pointer transition-all ${
                selectedQuarter === qs.quarter ? 'ring-2 ring-blue-500' : ''
              }`}
              onClick={() => setSelectedQuarter(selectedQuarter === qs.quarter ? 'all' : qs.quarter)}
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <Calendar className="w-6 h-6 text-blue-600" />
                  <Badge variant="outline">{qs.count} facturas</Badge>
                </div>
                <p className="text-sm text-gray-600 mb-1">{qs.quarter}</p>
                <p className="text-2xl font-bold">{qs.total.toFixed(0)}€</p>
                <div className="flex gap-2 mt-2 text-xs">
                  <span className="text-green-600">{qs.paid} pagadas</span>
                  <span className="text-orange-600">{qs.pending} pendientes</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Upload Zone */}
        <Card className="border-none shadow-lg mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Subir Facturas en Lote
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={handleFileInput}
                multiple
                className="hidden"
                disabled={isUploading}
              />
              
              {isUploading ? (
                <div className="space-y-4">
                  <Loader2 className="w-12 h-12 text-blue-500 mx-auto animate-spin" />
                  <p className="text-sm font-medium">Procesando facturas...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <Upload className="w-16 h-16 text-blue-600 mx-auto" />
                  <div>
                    <p className="text-lg font-medium mb-2">
                      Arrastra múltiples facturas aquí
                    </p>
                    <p className="text-sm text-gray-600 mb-4">
                      La IA extraerá todos los datos automáticamente
                    </p>
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Seleccionar Archivos
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Filtros */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-500" />
            <span className="text-sm font-medium">Trimestre:</span>
            <select
              value={selectedQuarter}
              onChange={(e) => setSelectedQuarter(e.target.value)}
              className="border rounded-lg px-3 py-1 text-sm"
            >
              <option value="all">Todos</option>
              {quarters.map(q => (
                <option key={q} value={q}>{q}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-gray-500" />
            <span className="text-sm font-medium">Proveedor:</span>
            <select
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value)}
              className="border rounded-lg px-3 py-1 text-sm"
            >
              <option value="all">Todos</option>
              {providerNames.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          {selectedForBiloop.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedForBiloop([])}
            >
              Limpiar selección ({selectedForBiloop.length})
            </Button>
          )}
        </div>

        {/* Facturas por Proveedor */}
        <div className="space-y-6">
          {Object.entries(invoicesByProvider).map(([providerName, providerInvoices]) => {
            const provider = providers.find(p => p.name === providerName);
            const total = providerInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
            
            return (
              <Card key={providerName} className="border-none shadow-lg">
                <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {provider?.logo_url ? (
                        <img src={provider.logo_url} alt={providerName} className="w-12 h-12 object-contain bg-white rounded-lg p-1 border" />
                      ) : (
                        <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
                          <Building2 className="w-6 h-6 text-white" />
                        </div>
                      )}
                      <div>
                        <CardTitle className="text-xl">{providerName}</CardTitle>
                        <p className="text-sm text-gray-600">{providerInvoices.length} facturas • {total.toFixed(2)}€</p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const allSelected = providerInvoices.every(inv => selectedForBiloop.includes(inv.id));
                        if (allSelected) {
                          setSelectedForBiloop(prev => prev.filter(id => !providerInvoices.find(inv => inv.id === id)));
                        } else {
                          setSelectedForBiloop(prev => [...new Set([...prev, ...providerInvoices.map(inv => inv.id)])]);
                        }
                      }}
                    >
                      {providerInvoices.every(inv => selectedForBiloop.includes(inv.id)) ? (
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                      ) : null}
                      Seleccionar todas
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-3">
                    {providerInvoices.map((invoice) => (
                      <div 
                        key={invoice.id} 
                        className={`flex items-center justify-between p-4 rounded-lg border-2 transition-all cursor-pointer ${
                          selectedForBiloop.includes(invoice.id) 
                            ? 'bg-blue-50 border-blue-500' 
                            : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => toggleSelection(invoice.id)}
                      >
                        <div className="flex items-center gap-4 flex-1">
                          <input
                            type="checkbox"
                            checked={selectedForBiloop.includes(invoice.id)}
                            onChange={() => toggleSelection(invoice.id)}
                            className="w-4 h-4"
                          />
                          <FileText className="w-5 h-5 text-gray-400" />
                          <div>
                            <p className="font-medium">{invoice.invoice_number}</p>
                            <p className="text-sm text-gray-600">
                              {invoice.invoice_date && format(new Date(invoice.invoice_date), 'dd/MM/yyyy')}
                              {invoice.category && ` • ${invoice.category}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <Badge className={
                            invoice.status === 'pagada' ? 'bg-green-100 text-green-800' :
                            invoice.status === 'pendiente' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }>
                            {invoice.status}
                          </Badge>
                          <p className="text-lg font-bold w-24 text-right">{invoice.total?.toFixed(2)}€</p>
                          <div className="flex gap-2">
                            {invoice.file_url && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setViewingPDF(invoice);
                                }}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm('¿Eliminar esta factura?')) {
                                  deleteMutation.mutate(invoice.id);
                                }
                              }}
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {filteredInvoices.length === 0 && (
          <Card className="border-none shadow-lg">
            <CardContent className="p-12 text-center">
              <FolderOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">No hay facturas</h3>
              <p className="text-gray-600">
                {selectedQuarter !== 'all' || selectedProvider !== 'all' 
                  ? 'No hay facturas con los filtros seleccionados' 
                  : 'Sube tus primeras facturas para comenzar'}
              </p>
            </CardContent>
          </Card>
        )}

        {/* PDF Viewer */}
        {viewingPDF && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setViewingPDF(null)}>
            <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="p-6 border-b flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold">{viewingPDF.invoice_number}</h3>
                  <p className="text-sm text-gray-600">{viewingPDF.provider_name} • {viewingPDF.total?.toFixed(2)}€</p>
                </div>
                <Button variant="ghost" onClick={() => setViewingPDF(null)}>✕</Button>
              </div>
              <div className="p-6 overflow-auto max-h-[70vh]">
                {viewingPDF.file_url?.endsWith('.pdf') ? (
                  <iframe
                    src={viewingPDF.file_url}
                    className="w-full h-[60vh] border rounded-lg"
                    title="Factura PDF"
                  />
                ) : (
                  <img
                    src={viewingPDF.file_url}
                    alt="Factura"
                    className="w-full h-auto max-h-[60vh] object-contain"
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}