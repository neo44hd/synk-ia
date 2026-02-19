import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { 
  Upload, 
  FileText, 
  Camera, 
  Loader2, 
  CheckCircle2,
  Eye,
  Filter,
  Building2,
  Package,
  Calendar,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Search,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { toast } from "sonner";
import { format, isValid } from "date-fns";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function Invoices() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [previewInvoice, setPreviewInvoice] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [viewingPDF, setViewingPDF] = useState(null);
  const fileInputRef = useRef(null);

  const queryClient = useQueryClient();

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['invoices', filterStatus],
    queryFn: async () => {
      const allInvoices = await base44.entities.Invoice.list('-created_date');
      if (filterStatus === 'all') return allInvoices;
      return allInvoices.filter(inv => inv.status === filterStatus);
    },
    initialData: [],
  });

  const { data: providers = [] } = useQuery({
    queryKey: ['providers'],
    queryFn: () => base44.entities.Provider.list(),
    initialData: [],
  });

  const createInvoiceMutation = useMutation({
    mutationFn: (data) => base44.entities.Invoice.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Factura guardada correctamente');
      setPreviewInvoice(null);
    },
  });

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return isValid(date) ? format(date, 'dd/MM/yyyy') : '';
  };

  // Agrupar facturas por proveedor
  const invoicesByProvider = invoices.reduce((acc, invoice) => {
    const provider = invoice.provider_name || 'Sin proveedor';
    if (!acc[provider]) {
      acc[provider] = {
        name: provider,
        invoices: [],
        total: 0,
        count: 0
      };
    }
    acc[provider].invoices.push(invoice);
    acc[provider].total += invoice.total || 0;
    acc[provider].count += 1;
    return acc;
  }, {});

  const providerStats = Object.values(invoicesByProvider).sort((a, b) => b.total - a.total);

  // Agrupar por categoría
  const invoicesByCategory = invoices.reduce((acc, invoice) => {
    const category = invoice.category || 'otros';
    if (!acc[category]) {
      acc[category] = {
        name: category,
        invoices: [],
        total: 0,
        count: 0
      };
    }
    acc[category].invoices.push(invoice);
    acc[category].total += invoice.total || 0;
    acc[category].count += 1;
    return acc;
  }, {});

  const categoryStats = Object.values(invoicesByCategory).sort((a, b) => b.total - a.total);

  // Datos para gráficos
  const monthlyData = invoices.reduce((acc, invoice) => {
    if (invoice.invoice_date) {
      const date = new Date(invoice.invoice_date);
      if (isValid(date)) {
        const month = format(date, 'MMM yyyy');
        if (!acc[month]) {
          acc[month] = { month, total: 0, count: 0 };
        }
        acc[month].total += invoice.total || 0;
        acc[month].count += 1;
      }
    }
    return acc;
  }, {});

  const chartData = Object.values(monthlyData).slice(-6);

  const pieColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

  // Filtrar facturas
  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch = !searchQuery || 
      inv.provider_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.invoice_number?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
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
      file => file.type === "application/pdf" || 
              file.type === "application/zip" ||
              file.type === "application/x-zip-compressed" ||
              file.type.startsWith("image/")
    );

    if (files.length > 0) {
      await processFile(files[0]);
    }
  };

  const handleFileInput = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      await processFile(files[0]);
    }
  };

  const processFile = async (file) => {
    setIsUploading(true);
    setUploadProgress(10);

    try {
      setUploadProgress(30);
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      setUploadProgress(50);
      const invoiceSchema = await base44.entities.Invoice.schema();
      
      setUploadProgress(70);
      const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: invoiceSchema
      });

      setUploadProgress(90);

      if (result.status === "success" && result.output) {
        // Extraer logo del proveedor con IA
        let providerLogo = null;
        try {
          const logoResult = await base44.integrations.Core.InvokeLLM({
            prompt: `Analiza esta factura y extrae SOLO la URL del logo del proveedor si está visible en la imagen. Si no hay logo visible, responde con null.`,
            file_urls: [file_url],
            response_json_schema: {
              type: "object",
              properties: {
                logo_detected: { type: "boolean" },
                logo_description: { type: "string" }
              }
            }
          });
          
          if (logoResult.logo_detected) {
            // Crear proveedor con logo si no existe
            const existingProviders = await base44.entities.Provider.list();
            const providerExists = existingProviders.find(p => p.name === result.output.provider_name);
            
            if (!providerExists && result.output.provider_name) {
              await base44.entities.Provider.create({
                name: result.output.provider_name,
                category: result.output.category || 'suministros',
                status: 'activo',
                rating: 4,
                logo_description: logoResult.logo_description
              });
            }
          }
        } catch (e) {
          console.log('Logo extraction skipped:', e.message);
        }

        setUploadProgress(100);
        setPreviewInvoice({
          ...result.output,
          file_url,
          file_name: file.name
        });
        toast.success('Factura procesada con IA');
      } else {
        toast.error('No se pudo extraer datos de la factura');
      }
    } catch (error) {
      toast.error('Error al procesar la factura');
      console.error(error);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleSaveInvoice = () => {
    createInvoiceMutation.mutate(previewInvoice);
  };

  const statusColors = {
    pendiente: 'bg-yellow-100 text-yellow-800',
    pagada: 'bg-green-100 text-green-800',
    vencida: 'bg-red-100 text-red-800',
    cancelada: 'bg-gray-100 text-gray-800'
  };

  const totalAmount = invoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
  const pendingAmount = invoices
    .filter(inv => inv.status === 'pendiente')
    .reduce((sum, inv) => sum + (inv.total || 0), 0);

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Facturas</h1>
            <p className="text-gray-600 mt-1">
              Gestión inteligente con análisis visual
            </p>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="border-none shadow-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <FileText className="w-8 h-8 opacity-80" />
                <TrendingUp className="w-5 h-5" />
              </div>
              <p className="text-sm opacity-90 mb-1">Total Facturas</p>
              <p className="text-3xl font-bold">{invoices.length}</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-lg bg-gradient-to-br from-green-500 to-green-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <DollarSign className="w-8 h-8 opacity-80" />
                <TrendingUp className="w-5 h-5" />
              </div>
              <p className="text-sm opacity-90 mb-1">Importe Total</p>
              <p className="text-3xl font-bold">{totalAmount.toFixed(0)}€</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-lg bg-gradient-to-br from-orange-500 to-orange-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Calendar className="w-8 h-8 opacity-80" />
                <TrendingDown className="w-5 h-5" />
              </div>
              <p className="text-sm opacity-90 mb-1">Pendiente Pago</p>
              <p className="text-3xl font-bold">{pendingAmount.toFixed(0)}€</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-lg bg-gradient-to-br from-purple-500 to-purple-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Building2 className="w-8 h-8 opacity-80" />
                <TrendingUp className="w-5 h-5" />
              </div>
              <p className="text-sm opacity-90 mb-1">Proveedores</p>
              <p className="text-3xl font-bold">{providerStats.length}</p>
            </CardContent>
          </Card>
        </div>

        {/* Upload Zone */}
        <Card className="border-none shadow-lg mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Subir Factura
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
                accept=".pdf,.png,.jpg,.jpeg,.zip"
                onChange={handleFileInput}
                className="hidden"
                disabled={isUploading}
              />
              
              {isUploading ? (
                <div className="space-y-4">
                  <Loader2 className="w-12 h-12 text-blue-500 mx-auto animate-spin" />
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Procesando con IA...</p>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500">{uploadProgress}%</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-center gap-4">
                    <div className="w-16 h-16 bg-blue-100 rounded-xl flex items-center justify-center">
                      <FileText className="w-8 h-8 text-blue-600" />
                    </div>
                    <div className="w-16 h-16 bg-purple-100 rounded-xl flex items-center justify-center">
                      <Camera className="w-8 h-8 text-purple-600" />
                    </div>
                  </div>
                  <div>
                    <p className="text-lg font-medium mb-2">
                      Arrastra tu factura aquí o haz clic para seleccionar
                    </p>
                    <p className="text-sm text-gray-600 mb-4">
                      PDF, PNG, JPEG, ZIP - La IA extraerá todos los datos automáticamente
                    </p>
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Seleccionar Archivo
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Búsqueda y Filtros */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                placeholder="Buscar por proveedor o número de factura..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Filter className="w-5 h-5 text-gray-500 mt-2" />
            {['all', 'pendiente', 'pagada', 'vencida'].map((status) => (
              <Button
                key={status}
                variant={filterStatus === status ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterStatus(status)}
                className={filterStatus === status ? 'bg-blue-600' : ''}
              >
                {status === 'all' ? 'Todas' : status.charAt(0).toUpperCase() + status.slice(1)}
              </Button>
            ))}
          </div>
        </div>

        {/* Tabs con Vistas */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="all" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Todas las Facturas
            </TabsTrigger>
            <TabsTrigger value="by-provider" className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Por Proveedor
            </TabsTrigger>
            <TabsTrigger value="by-category" className="flex items-center gap-2">
              <Package className="w-4 h-4" />
              Por Categoría
            </TabsTrigger>
          </TabsList>

          {/* TAB: Todas las Facturas */}
          <TabsContent value="all" className="space-y-6">
            {chartData.length > 0 && (
              <Card className="border-none shadow-lg">
                <CardHeader>
                  <CardTitle>Tendencia de Gastos (Últimos 6 meses)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2} name="Total €" />
                      <Line type="monotone" dataKey="count" stroke="#10b981" strokeWidth={2} name="Nº Facturas" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            <div className="space-y-4">
              {isLoading ? (
                <Card className="border-none shadow-lg">
                  <CardContent className="p-12 text-center">
                    <Loader2 className="w-8 h-8 text-gray-400 mx-auto animate-spin mb-4" />
                    <p className="text-gray-600">Cargando facturas...</p>
                  </CardContent>
                </Card>
              ) : filteredInvoices.length === 0 ? (
                <Card className="border-none shadow-lg">
                  <CardContent className="p-12 text-center">
                    <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-600 mb-4">No hay facturas registradas</p>
                    <p className="text-sm text-gray-500">
                      Sube tu primera factura para comenzar
                    </p>
                  </CardContent>
                </Card>
              ) : (
                filteredInvoices.map((invoice) => {
                  const provider = providers.find(p => p.name === invoice.provider_name);
                  return (
                  <Card key={invoice.id} className="border-none shadow-lg hover:shadow-xl transition-all">
                    <CardContent className="p-6">
                      <div className="flex justify-between items-start">
                        <div className="flex items-start gap-4 flex-1">
                          {provider?.logo_url ? (
                            <div className="w-12 h-12 bg-white border rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden">
                              <img src={provider.logo_url} alt={provider.name} className="w-full h-full object-contain p-1" />
                            </div>
                          ) : (
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center flex-shrink-0">
                              <FileText className="w-6 h-6 text-white" />
                            </div>
                          )}
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg">{invoice.provider_name}</h3>
                            <p className="text-sm text-gray-600">{invoice.invoice_number}</p>
                            <div className="flex items-center gap-3 mt-2 flex-wrap">
                              <Badge className={statusColors[invoice.status]}>
                                {invoice.status}
                              </Badge>
                              {invoice.category && (
                                <Badge variant="outline">{invoice.category}</Badge>
                              )}
                              {invoice.invoice_date && (
                                <span className="text-sm text-gray-500 flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {formatDate(invoice.invoice_date)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right flex flex-col items-end gap-2">
                          <p className="text-2xl font-bold">{invoice.total?.toFixed(2)}€</p>
                          {invoice.iva && (
                            <p className="text-sm text-gray-600">IVA: {invoice.iva?.toFixed(2)}€</p>
                          )}
                          {invoice.file_url && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setViewingPDF(invoice)}
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              Ver Factura
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  );
                })
              )}
            </div>
          </TabsContent>

          {/* TAB: Por Proveedor */}
          <TabsContent value="by-provider" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
              <Card className="border-none shadow-lg">
                <CardHeader>
                  <CardTitle className="text-lg">Top Proveedores por Gasto</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={providerStats.slice(0, 8)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" width={120} />
                      <Tooltip />
                      <Bar dataKey="total" fill="#3b82f6" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="border-none shadow-lg">
                <CardHeader>
                  <CardTitle className="text-lg">Distribución por Proveedor</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={providerStats.slice(0, 7).map((p, i) => ({
                          name: p.name,
                          value: p.total
                        }))}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label
                      >
                        {providerStats.slice(0, 7).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              {providerStats.map((providerGroup) => (
                <Card key={providerGroup.name} className="border-none shadow-lg hover:shadow-xl transition-all">
                  <CardHeader className="cursor-pointer" onClick={() => setSelectedProvider(selectedProvider === providerGroup.name ? null : providerGroup.name)}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center">
                          <Building2 className="w-7 h-7 text-white" />
                        </div>
                        <div>
                          <CardTitle className="text-xl">{providerGroup.name}</CardTitle>
                          <p className="text-sm text-gray-600">{providerGroup.count} facturas</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-3xl font-bold text-blue-600">{providerGroup.total.toFixed(2)}€</p>
                          <p className="text-sm text-gray-600">Promedio: {(providerGroup.total / providerGroup.count).toFixed(2)}€</p>
                        </div>
                        {selectedProvider === providerGroup.name ? (
                          <ChevronUp className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  {selectedProvider === providerGroup.name && (
                    <CardContent className="border-t pt-4">
                      <div className="space-y-3">
                        {providerGroup.invoices.map((invoice) => (
                          <div key={invoice.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-all">
                            <div className="flex items-center gap-4">
                              <FileText className="w-5 h-5 text-gray-400" />
                              <div>
                                <p className="font-medium">{invoice.invoice_number}</p>
                                <p className="text-sm text-gray-600">{formatDate(invoice.invoice_date)}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <Badge className={statusColors[invoice.status]}>
                                {invoice.status}
                              </Badge>
                              <p className="text-lg font-bold">{invoice.total?.toFixed(2)}€</p>
                              {invoice.file_url && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => window.open(invoice.file_url, '_blank')}
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* TAB: Por Categoría */}
          <TabsContent value="by-category" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
              <Card className="border-none shadow-lg">
                <CardHeader>
                  <CardTitle className="text-lg">Gasto por Categoría</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={categoryStats}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="total" fill="#10b981" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="border-none shadow-lg">
                <CardHeader>
                  <CardTitle className="text-lg">Distribución por Categoría</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={categoryStats.map((c, i) => ({
                          name: c.name,
                          value: c.total
                        }))}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label
                      >
                        {categoryStats.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categoryStats.map((categoryGroup, idx) => (
                <Card key={categoryGroup.name} className="border-none shadow-lg hover:shadow-xl transition-all">
                  <CardHeader>
                    <div className="flex items-center justify-between mb-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center`} style={{
                        background: `linear-gradient(135deg, ${pieColors[idx % pieColors.length]}, ${pieColors[(idx + 1) % pieColors.length]})`
                      }}>
                        <Package className="w-6 h-6 text-white" />
                      </div>
                      <Badge className="bg-green-100 text-green-800">
                        {categoryGroup.count} facturas
                      </Badge>
                    </div>
                    <CardTitle className="text-lg capitalize">{categoryGroup.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Total:</span>
                        <span className="text-2xl font-bold text-green-600">{categoryGroup.total.toFixed(2)}€</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Promedio:</span>
                        <span className="text-lg font-semibold">{(categoryGroup.total / categoryGroup.count).toFixed(2)}€</span>
                      </div>
                      <div className="pt-3 border-t">
                        <p className="text-xs text-gray-500 mb-2">Últimas facturas:</p>
                        {categoryGroup.invoices.slice(0, 3).map((inv) => (
                          <div key={inv.id} className="text-sm flex justify-between mb-1">
                            <span className="text-gray-600 truncate mr-2">{inv.provider_name}</span>
                            <span className="font-medium whitespace-nowrap">{inv.total?.toFixed(2)}€</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* PDF Viewer Dialog */}
        <Dialog open={!!viewingPDF} onOpenChange={() => setViewingPDF(null)}>
          <DialogContent className="max-w-6xl max-h-[90vh] p-0">
            <DialogHeader className="p-6 pb-0">
              <DialogTitle className="flex items-center gap-3">
                <FileText className="w-6 h-6 text-blue-600" />
                {viewingPDF?.invoice_number} - {viewingPDF?.provider_name}
              </DialogTitle>
            </DialogHeader>
            {viewingPDF && (
              <div className="p-6 pt-4">
                {viewingPDF.file_url?.endsWith('.pdf') ? (
                  <iframe
                    src={viewingPDF.file_url}
                    className="w-full h-[70vh] border rounded-lg"
                    title="Factura PDF"
                  />
                ) : (
                  <img
                    src={viewingPDF.file_url}
                    alt="Factura"
                    className="w-full h-auto max-h-[70vh] object-contain border rounded-lg"
                  />
                )}
                <div className="flex justify-between items-center mt-4 pt-4 border-t">
                  <div>
                    <p className="text-sm text-gray-600">Total: <span className="font-bold text-lg">{viewingPDF.total?.toFixed(2)}€</span></p>
                    <p className="text-xs text-gray-500">{viewingPDF.invoice_date}</p>
                  </div>
                  <Button
                    onClick={() => window.open(viewingPDF.file_url, '_blank')}
                    variant="outline"
                  >
                    Abrir en nueva pestaña
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Preview Dialog */}
        <Dialog open={!!previewInvoice} onOpenChange={() => setPreviewInvoice(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                Datos Extraídos por IA - Revisa y Guarda
              </DialogTitle>
            </DialogHeader>
            {previewInvoice && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Proveedor</Label>
                    <Input
                      value={previewInvoice.provider_name || ''}
                      onChange={(e) => setPreviewInvoice({...previewInvoice, provider_name: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label>Número de Factura</Label>
                    <Input
                      value={previewInvoice.invoice_number || ''}
                      onChange={(e) => setPreviewInvoice({...previewInvoice, invoice_number: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label>Fecha</Label>
                    <Input
                      type="date"
                      value={previewInvoice.invoice_date || ''}
                      onChange={(e) => setPreviewInvoice({...previewInvoice, invoice_date: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label>Total</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={previewInvoice.total || ''}
                      onChange={(e) => setPreviewInvoice({...previewInvoice, total: parseFloat(e.target.value)})}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <Button variant="outline" onClick={() => setPreviewInvoice(null)}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleSaveInvoice}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Guardar Factura
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}