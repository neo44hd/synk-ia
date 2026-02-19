import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  FileText, 
  Users, 
  Plus, 
  Search, 
  Euro,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowRight,
  TrendingUp,
  Brain
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function Billing() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [selectedQuote, setSelectedQuote] = useState(null);
  const queryClient = useQueryClient();

  const { data: invoices = [] } = useQuery({
    queryKey: ['sales-invoices'],
    queryFn: () => base44.entities.SalesInvoice.list('-invoice_date', 100),
  });

  const { data: quotes = [] } = useQuery({
    queryKey: ['quotes'],
    queryFn: () => base44.entities.Quote.list('-quote_date', 100),
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Client.list('-created_date', 100),
  });

  const convertQuoteMutation = useMutation({
    mutationFn: async (quote) => {
      // Obtener último número de factura
      const lastInvoice = invoices[0];
      const year = new Date().getFullYear();
      let nextNum = 1;
      if (lastInvoice?.invoice_number) {
        const match = lastInvoice.invoice_number.match(/FAC-\d{4}-(\d+)/);
        if (match) nextNum = parseInt(match[1]) + 1;
      }
      const invoiceNumber = `FAC-${year}-${String(nextNum).padStart(3, '0')}`;

      // Crear factura
      const invoice = await base44.entities.SalesInvoice.create({
        invoice_number: invoiceNumber,
        client_name: quote.client_name,
        client_cif: quote.client_cif,
        client_address: quote.client_address,
        invoice_date: new Date().toISOString().split('T')[0],
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        items: quote.items,
        subtotal: quote.subtotal,
        iva_percent: quote.iva_percent || 21,
        iva: quote.iva,
        total: quote.total,
        status: 'emitida',
        from_quote_id: quote.id,
        notes: quote.notes
      });

      // Actualizar presupuesto
      await base44.entities.Quote.update(quote.id, {
        status: 'facturado',
        converted_to_invoice: invoice.id
      });

      return invoice;
    },
    onSuccess: (invoice) => {
      queryClient.invalidateQueries({ queryKey: ['sales-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      toast.success(`Factura ${invoice.invoice_number} creada`);
      setSelectedQuote(null);
    }
  });

  // Estadísticas
  const stats = {
    totalInvoiced: invoices.reduce((sum, inv) => sum + (inv.total || 0), 0),
    pendingAmount: invoices.filter(inv => ['emitida', 'enviada'].includes(inv.status)).reduce((sum, inv) => sum + (inv.total || 0), 0),
    paidAmount: invoices.filter(inv => inv.status === 'pagada').reduce((sum, inv) => sum + (inv.total || 0), 0),
    quotesTotal: quotes.filter(q => q.status !== 'rechazado').reduce((sum, q) => sum + (q.total || 0), 0),
    acceptedQuotes: quotes.filter(q => q.status === 'aceptado').length,
    pendingQuotes: quotes.filter(q => ['borrador', 'enviado'].includes(q.status)).length
  };

  const statusColors = {
    borrador: 'bg-gray-100 text-gray-800',
    emitida: 'bg-blue-100 text-blue-800',
    enviada: 'bg-purple-100 text-purple-800',
    pagada: 'bg-green-100 text-green-800',
    vencida: 'bg-red-100 text-red-800',
    anulada: 'bg-gray-100 text-gray-500',
    aceptado: 'bg-green-100 text-green-800',
    rechazado: 'bg-red-100 text-red-800',
    facturado: 'bg-blue-100 text-blue-800'
  };

  const filteredInvoices = invoices.filter(inv => 
    inv.client_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    inv.invoice_number?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredQuotes = quotes.filter(q => 
    q.client_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    q.quote_number?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-4 md:p-8 min-h-screen bg-gradient-to-br from-zinc-950 via-neutral-900 to-zinc-950">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-3 h-3 bg-cyan-400 rounded-full animate-pulse" style={{ boxShadow: '0 0 10px rgba(6, 182, 212, 0.8)' }} />
            <span className="text-sm font-medium text-cyan-400" style={{ textShadow: '0 0 10px rgba(6, 182, 212, 0.6)' }}>
              Centro de Facturación
            </span>
          </div>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <h1 className="text-4xl font-black text-white mb-2 flex items-center gap-4">
                <div 
                  className="w-14 h-14 bg-black rounded-2xl flex items-center justify-center border border-cyan-500/50"
                  style={{ boxShadow: '0 0 25px rgba(6, 182, 212, 0.4), inset 0 0 15px rgba(6, 182, 212, 0.1)' }}
                >
                  <FileText className="w-8 h-8 text-cyan-400" style={{ filter: 'drop-shadow(0 0 8px rgba(6, 182, 212, 0.8))' }} />
                </div>
                <span className="text-cyan-400" style={{ textShadow: '0 0 15px rgba(6, 182, 212, 0.6)' }}>FACTURACIÓN</span>
              </h1>
              <p className="text-zinc-400">
                Facturas de venta, presupuestos y clientes
              </p>
            </div>
            <div className="flex gap-3">
              <Link to={createPageUrl("CEOBrain")}>
                <Button 
                  className="bg-black border border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10 font-bold"
                  style={{ boxShadow: '0 0 15px rgba(6, 182, 212, 0.3)' }}
                >
                  <Brain className="w-5 h-5 mr-2" />
                  Crear con IA
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-gradient-to-br from-green-900/30 to-emerald-900/30 border-green-600/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
                  <Euro className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">Total Facturado</p>
                  <p className="text-xl font-bold text-white">{stats.totalInvoiced.toFixed(2)}€</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-900/30 to-cyan-900/30 border-blue-600/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                  <Clock className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">Pendiente Cobro</p>
                  <p className="text-xl font-bold text-white">{stats.pendingAmount.toFixed(2)}€</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 border-purple-600/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">Presupuestos</p>
                  <p className="text-xl font-bold text-white">{stats.quotesTotal.toFixed(2)}€</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-yellow-900/30 to-orange-900/30 border-yellow-600/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-yellow-600 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">Clientes</p>
                  <p className="text-xl font-bold text-white">{clients.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por cliente o número..."
              className="pl-10 bg-slate-800 border-slate-700 text-white"
            />
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="invoices" className="space-y-6">
          <TabsList className="bg-black border border-cyan-500/30">
            <TabsTrigger value="invoices" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400 data-[state=active]:border-cyan-500">
              Facturas ({invoices.length})
            </TabsTrigger>
            <TabsTrigger value="quotes" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400 data-[state=active]:border-cyan-500">
              Presupuestos ({quotes.length})
            </TabsTrigger>
            <TabsTrigger value="clients" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400 data-[state=active]:border-cyan-500">
              Clientes ({clients.length})
            </TabsTrigger>
          </TabsList>

          {/* Facturas */}
          <TabsContent value="invoices">
            <Card className="bg-slate-900 border-slate-700">
              <CardContent className="p-0">
                {filteredInvoices.length === 0 ? (
                  <div className="p-12 text-center">
                    <FileText className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400 mb-4">No hay facturas todavía</p>
                    <Link to={createPageUrl("CEOBrain")}>
                      <Button className="bg-yellow-600 hover:bg-yellow-700">
                        <Brain className="w-4 h-4 mr-2" />
                        Crear con CEO Brain
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-700">
                    {filteredInvoices.map((invoice) => (
                      <div
                        key={invoice.id}
                        className="p-4 hover:bg-slate-800/50 cursor-pointer transition-colors"
                        onClick={() => setSelectedInvoice(invoice)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-slate-800 rounded-lg flex items-center justify-center">
                              <FileText className="w-6 h-6 text-yellow-500" />
                            </div>
                            <div>
                              <p className="font-bold text-white">{invoice.invoice_number}</p>
                              <p className="text-sm text-gray-400">{invoice.client_name}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="font-bold text-white text-lg">{invoice.total?.toFixed(2)}€</p>
                              <p className="text-xs text-gray-500">
                                {invoice.invoice_date && format(new Date(invoice.invoice_date), 'dd/MM/yyyy')}
                              </p>
                            </div>
                            <Badge className={statusColors[invoice.status]}>
                              {invoice.status}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Presupuestos */}
          <TabsContent value="quotes">
            <Card className="bg-slate-900 border-slate-700">
              <CardContent className="p-0">
                {filteredQuotes.length === 0 ? (
                  <div className="p-12 text-center">
                    <FileText className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400 mb-4">No hay presupuestos todavía</p>
                    <Link to={createPageUrl("CEOBrain")}>
                      <Button className="bg-yellow-600 hover:bg-yellow-700">
                        <Brain className="w-4 h-4 mr-2" />
                        Crear con CEO Brain
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-700">
                    {filteredQuotes.map((quote) => (
                      <div
                        key={quote.id}
                        className="p-4 hover:bg-slate-800/50 cursor-pointer transition-colors"
                        onClick={() => setSelectedQuote(quote)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-slate-800 rounded-lg flex items-center justify-center">
                              <FileText className="w-6 h-6 text-blue-500" />
                            </div>
                            <div>
                              <p className="font-bold text-white">{quote.quote_number}</p>
                              <p className="text-sm text-gray-400">{quote.client_name}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="font-bold text-white text-lg">{quote.total?.toFixed(2)}€</p>
                              <p className="text-xs text-gray-500">
                                {quote.quote_date && format(new Date(quote.quote_date), 'dd/MM/yyyy')}
                              </p>
                            </div>
                            <Badge className={statusColors[quote.status]}>
                              {quote.status}
                            </Badge>
                            {quote.status === 'aceptado' && !quote.converted_to_invoice && (
                              <Button
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  convertQuoteMutation.mutate(quote);
                                }}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                <ArrowRight className="w-4 h-4 mr-1" />
                                Facturar
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Clientes */}
          <TabsContent value="clients">
            <Card className="bg-slate-900 border-slate-700">
              <CardContent className="p-0">
                {clients.length === 0 ? (
                  <div className="p-12 text-center">
                    <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400 mb-4">No hay clientes registrados</p>
                    <p className="text-sm text-gray-500">Los clientes se crean automáticamente al facturar</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-700">
                    {clients.map((client) => (
                      <div
                        key={client.id}
                        className="p-4 hover:bg-slate-800/50 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                              <span className="text-white font-bold text-lg">
                                {client.name?.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <p className="font-bold text-white">{client.name}</p>
                              <p className="text-sm text-gray-400">{client.cif || 'Sin CIF'}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="text-sm text-gray-400">{client.email || '-'}</p>
                              <p className="text-xs text-gray-500">{client.phone || '-'}</p>
                            </div>
                            <Badge className={client.status === 'activo' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                              {client.status || 'activo'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Dialog Factura */}
        <Dialog open={!!selectedInvoice} onOpenChange={() => setSelectedInvoice(null)}>
          <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <FileText className="w-6 h-6 text-yellow-500" />
                {selectedInvoice?.invoice_number}
              </DialogTitle>
            </DialogHeader>
            {selectedInvoice && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-400">Cliente</p>
                    <p className="font-medium">{selectedInvoice.client_name}</p>
                    <p className="text-sm text-gray-400">{selectedInvoice.client_cif}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">Fecha</p>
                    <p className="font-medium">
                      {selectedInvoice.invoice_date && format(new Date(selectedInvoice.invoice_date), 'dd/MM/yyyy')}
                    </p>
                    <Badge className={statusColors[selectedInvoice.status]}>
                      {selectedInvoice.status}
                    </Badge>
                  </div>
                </div>

                <div className="bg-slate-800 rounded-lg p-4">
                  <p className="text-xs text-gray-400 mb-3">Conceptos</p>
                  <div className="space-y-2">
                    {selectedInvoice.items?.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span>{item.description} x{item.quantity}</span>
                        <span>{item.total?.toFixed(2)}€</span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-slate-700 mt-4 pt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Base imponible</span>
                      <span>{selectedInvoice.subtotal?.toFixed(2)}€</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">IVA ({selectedInvoice.iva_percent || 21}%)</span>
                      <span>{selectedInvoice.iva?.toFixed(2)}€</span>
                    </div>
                    <div className="flex justify-between font-bold text-lg pt-2 border-t border-slate-700">
                      <span>TOTAL</span>
                      <span className="text-yellow-400">{selectedInvoice.total?.toFixed(2)}€</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Dialog Presupuesto */}
        <Dialog open={!!selectedQuote} onOpenChange={() => setSelectedQuote(null)}>
          <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <FileText className="w-6 h-6 text-blue-500" />
                {selectedQuote?.quote_number}
              </DialogTitle>
            </DialogHeader>
            {selectedQuote && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-400">Cliente</p>
                    <p className="font-medium">{selectedQuote.client_name}</p>
                    <p className="text-sm text-gray-400">{selectedQuote.client_cif}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">Fecha</p>
                    <p className="font-medium">
                      {selectedQuote.quote_date && format(new Date(selectedQuote.quote_date), 'dd/MM/yyyy')}
                    </p>
                    <Badge className={statusColors[selectedQuote.status]}>
                      {selectedQuote.status}
                    </Badge>
                  </div>
                </div>

                <div className="bg-slate-800 rounded-lg p-4">
                  <p className="text-xs text-gray-400 mb-3">Conceptos</p>
                  <div className="space-y-2">
                    {selectedQuote.items?.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span>{item.description} x{item.quantity}</span>
                        <span>{item.total?.toFixed(2)}€</span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-slate-700 mt-4 pt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Base imponible</span>
                      <span>{selectedQuote.subtotal?.toFixed(2)}€</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">IVA ({selectedQuote.iva_percent || 21}%)</span>
                      <span>{selectedQuote.iva?.toFixed(2)}€</span>
                    </div>
                    <div className="flex justify-between font-bold text-lg pt-2 border-t border-slate-700">
                      <span>TOTAL</span>
                      <span className="text-blue-400">{selectedQuote.total?.toFixed(2)}€</span>
                    </div>
                  </div>
                </div>

                {selectedQuote.status === 'aceptado' && !selectedQuote.converted_to_invoice && (
                  <Button
                    onClick={() => convertQuoteMutation.mutate(selectedQuote)}
                    className="w-full bg-green-600 hover:bg-green-700"
                    disabled={convertQuoteMutation.isPending}
                  >
                    <ArrowRight className="w-5 h-5 mr-2" />
                    Convertir en Factura
                  </Button>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}