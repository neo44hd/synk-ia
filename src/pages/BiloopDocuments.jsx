import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  FileText, 
  Download, 
  Upload, 
  Eye, 
  RefreshCw, 
  Loader2,
  Search,
  Calendar,
  Send,
  CheckCircle2,
  AlertCircle,
  Filter
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function BiloopDocuments() {
  const [dateFrom, setDateFrom] = useState('2025-01-01');
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [searchProvider, setSearchProvider] = useState('');
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
  const [pdfData, setPdfData] = useState(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  const queryClient = useQueryClient();

  // Obtener documentos de Biloop
  const { data: biloopDocs, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['biloop-documents', dateFrom, dateTo, searchProvider],
    queryFn: async () => {
      const response = await base44.functions.invoke('biloopGetDocuments', {
        date_from: dateFrom,
        date_to: dateTo,
        provider: searchProvider || undefined
      });
      return response.data?.documents || [];
    },
    initialData: []
  });

  // Obtener facturas locales para sincronizar
  const { data: localInvoices } = useQuery({
    queryKey: ['local-invoices'],
    queryFn: () => base44.entities.Invoice.list('-created_date', 100),
    initialData: []
  });

  // Ver PDF
  const viewPdf = async (doc) => {
    setSelectedDoc(doc);
    setPdfData(null);
    setPdfViewerOpen(true);

    if (doc.pdf_url) {
      setPdfData(doc.pdf_url);
    } else {
      try {
        const response = await base44.functions.invoke('biloopDownloadPdf', {
          biloop_id: doc.id
        });
        if (response.data?.pdf_base64) {
          setPdfData(`data:application/pdf;base64,${response.data.pdf_base64}`);
        } else if (response.data?.pdf_url) {
          setPdfData(response.data.pdf_url);
        }
      } catch (error) {
        toast.error('No se pudo cargar el PDF');
      }
    }
  };

  // Subir factura a Biloop
  const uploadToBiloop = async (invoice, pdfFile) => {
    setIsUploading(true);
    try {
      let pdf_base64 = null;
      
      if (pdfFile) {
        const reader = new FileReader();
        pdf_base64 = await new Promise((resolve) => {
          reader.onload = (e) => {
            const base64 = e.target.result.split(',')[1];
            resolve(base64);
          };
          reader.readAsDataURL(pdfFile);
        });
      }

      const response = await base44.functions.invoke('biloopUploadInvoice', {
        invoice_number: invoice.invoice_number,
        provider_name: invoice.provider_name,
        provider_cif: invoice.provider_cif || '',
        invoice_date: invoice.invoice_date,
        due_date: invoice.due_date,
        subtotal: invoice.subtotal,
        iva: invoice.iva,
        total: invoice.total,
        category: invoice.category,
        pdf_url: invoice.file_url,
        pdf_base64: pdf_base64,
        notes: invoice.notes
      });

      if (response.data?.success) {
        toast.success(`✅ Factura ${invoice.invoice_number} enviada a Biloop`);
        refetch();
      } else {
        toast.error(response.data?.error || 'Error al enviar factura');
      }
    } catch (error) {
      toast.error('Error: ' + error.message);
    } finally {
      setIsUploading(false);
      setUploadDialogOpen(false);
    }
  };

  // Importar factura de Biloop a local
  const importToLocal = async (doc) => {
    try {
      // Verificar si ya existe
      const existing = localInvoices.find(inv => inv.invoice_number === doc.invoice_number);
      if (existing) {
        toast.info('Esta factura ya existe localmente');
        return;
      }

      await base44.entities.Invoice.create({
        invoice_number: doc.invoice_number,
        provider_name: doc.provider_name,
        invoice_date: doc.date,
        due_date: doc.due_date,
        subtotal: doc.subtotal,
        iva: doc.iva,
        total: doc.total,
        status: doc.status === 'pagada' ? 'pagada' : 'pendiente',
        category: doc.category || 'suministros',
        file_url: doc.pdf_url
      });

      toast.success(`✅ Factura ${doc.invoice_number} importada`);
      queryClient.invalidateQueries({ queryKey: ['local-invoices'] });
    } catch (error) {
      toast.error('Error: ' + error.message);
    }
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      pagada: { color: 'bg-green-100 text-green-800', label: 'Pagada' },
      pendiente: { color: 'bg-yellow-100 text-yellow-800', label: 'Pendiente' },
      vencida: { color: 'bg-red-100 text-red-800', label: 'Vencida' }
    };
    const s = statusMap[status?.toLowerCase()] || statusMap.pendiente;
    return <Badge className={s.color}>{s.label}</Badge>;
  };

  return (
    <div className="p-4 md:p-8 min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
            <span className="text-sm font-medium text-green-400">
              Biloop Sync • Bidireccional
            </span>
          </div>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
                <FileText className="w-10 h-10 text-blue-400" />
                Documentos Biloop
              </h1>
              <p className="text-gray-400">
                Visualiza, descarga y sincroniza facturas con Biloop
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={() => setUploadDialogOpen(true)}
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
              >
                <Upload className="w-4 h-4 mr-2" />
                Enviar a Biloop
              </Button>
              <Button
                onClick={() => refetch()}
                disabled={isRefetching}
                className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
              >
                {isRefetching ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Actualizar
              </Button>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <Card className="border-none shadow-xl bg-slate-800 mb-6">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <Label className="text-gray-300 text-sm">Desde</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-40 bg-slate-700 border-slate-600 text-white"
                />
              </div>
              <div>
                <Label className="text-gray-300 text-sm">Hasta</Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-40 bg-slate-700 border-slate-600 text-white"
                />
              </div>
              <div className="flex-1 min-w-[200px]">
                <Label className="text-gray-300 text-sm">Buscar proveedor</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Nombre del proveedor..."
                    value={searchProvider}
                    onChange={(e) => setSearchProvider(e.target.value)}
                    className="pl-10 bg-slate-700 border-slate-600 text-white"
                  />
                </div>
              </div>
              <Button onClick={() => refetch()} variant="outline" className="border-slate-600 text-white hover:bg-slate-700">
                <Filter className="w-4 h-4 mr-2" />
                Filtrar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="bg-gradient-to-br from-blue-600 to-blue-700 border-none">
            <CardContent className="p-4">
              <p className="text-blue-100 text-sm">Documentos Biloop</p>
              <p className="text-3xl font-bold text-white">{biloopDocs.length}</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-600 to-green-700 border-none">
            <CardContent className="p-4">
              <p className="text-green-100 text-sm">Total Facturas</p>
              <p className="text-3xl font-bold text-white">
                {biloopDocs.reduce((sum, d) => sum + (d.total || 0), 0).toFixed(0)}€
              </p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-yellow-600 to-orange-600 border-none">
            <CardContent className="p-4">
              <p className="text-yellow-100 text-sm">Pendientes</p>
              <p className="text-3xl font-bold text-white">
                {biloopDocs.filter(d => d.status === 'pendiente').length}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-600 to-pink-600 border-none">
            <CardContent className="p-4">
              <p className="text-purple-100 text-sm">Locales sin sync</p>
              <p className="text-3xl font-bold text-white">
                {localInvoices.filter(inv => !biloopDocs.find(d => d.invoice_number === inv.invoice_number)).length}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabla de documentos */}
        <Card className="border-none shadow-xl bg-slate-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Facturas en Biloop
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
              </div>
            ) : biloopDocs.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No se encontraron documentos en Biloop</p>
                <p className="text-sm mt-2">Verifica los filtros o las credenciales</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700">
                    <TableHead className="text-gray-300">Nº Factura</TableHead>
                    <TableHead className="text-gray-300">Proveedor</TableHead>
                    <TableHead className="text-gray-300">Fecha</TableHead>
                    <TableHead className="text-gray-300">Total</TableHead>
                    <TableHead className="text-gray-300">Estado</TableHead>
                    <TableHead className="text-gray-300">PDF</TableHead>
                    <TableHead className="text-gray-300">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {biloopDocs.map((doc, idx) => {
                    const isLocal = localInvoices.find(inv => inv.invoice_number === doc.invoice_number);
                    return (
                      <TableRow key={idx} className="border-slate-700 hover:bg-slate-700/50">
                        <TableCell className="text-white font-medium">
                          {doc.invoice_number}
                        </TableCell>
                        <TableCell className="text-gray-300">
                          {doc.provider_name}
                          {doc.provider_cif && (
                            <span className="text-xs text-gray-500 block">{doc.provider_cif}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-gray-300">
                          {doc.date ? format(new Date(doc.date), 'dd/MM/yyyy') : '-'}
                        </TableCell>
                        <TableCell className="text-white font-bold">
                          {doc.total?.toFixed(2)}€
                        </TableCell>
                        <TableCell>{getStatusBadge(doc.status)}</TableCell>
                        <TableCell>
                          {doc.pdf_url ? (
                            <Badge className="bg-green-600 text-white">PDF</Badge>
                          ) : (
                            <Badge className="bg-gray-600 text-gray-300">Sin PDF</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => viewPdf(doc)}
                              className="border-slate-600 text-white hover:bg-slate-700"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            {!isLocal && (
                              <Button
                                size="sm"
                                onClick={() => importToLocal(doc)}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                <Download className="w-4 h-4" />
                              </Button>
                            )}
                            {isLocal && (
                              <Badge className="bg-blue-600 text-white">
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Local
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Dialog para ver PDF */}
        <Dialog open={pdfViewerOpen} onOpenChange={setPdfViewerOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>
                Factura {selectedDoc?.invoice_number} - {selectedDoc?.provider_name}
              </DialogTitle>
            </DialogHeader>
            <div className="h-[70vh]">
              {pdfData ? (
                <iframe
                  src={pdfData}
                  className="w-full h-full rounded-lg"
                  title="PDF Viewer"
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog para subir factura */}
        <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Send className="w-5 h-5" />
                Enviar Factura a Biloop
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Selecciona una factura local para enviar a Biloop:
              </p>
              <div className="max-h-[400px] overflow-y-auto space-y-2">
                {localInvoices
                  .filter(inv => !biloopDocs.find(d => d.invoice_number === inv.invoice_number))
                  .map((inv, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100">
                      <div>
                        <p className="font-medium">{inv.invoice_number}</p>
                        <p className="text-sm text-gray-600">{inv.provider_name}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold">{inv.total?.toFixed(2)}€</span>
                        <Button
                          size="sm"
                          onClick={() => uploadToBiloop(inv)}
                          disabled={isUploading}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          {isUploading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Send className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                {localInvoices.filter(inv => !biloopDocs.find(d => d.invoice_number === inv.invoice_number)).length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <CheckCircle2 className="w-12 h-12 mx-auto mb-2 text-green-500" />
                    <p>Todas las facturas están sincronizadas</p>
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}