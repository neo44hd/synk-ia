import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  FileText, 
  Download, 
  Eye, 
  Shield,
  AlertCircle,
  Building2,
  Calendar
} from "lucide-react";
import { format, isValid } from "date-fns";

export default function PortalGestoria() {
  const [user, setUser] = useState(null);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    const checkAccess = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
        setHasAccess(currentUser.gestoria_access === true || currentUser.role === 'admin');
      } catch (error) {
        console.error('Error checking access:', error);
      }
    };
    checkAccess();
  }, []);

  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices-gestoria'],
    queryFn: () => base44.entities.Invoice.list('-created_date'),
    initialData: [],
    enabled: hasAccess,
  });

  const { data: documents = [] } = useQuery({
    queryKey: ['documents-fiscal'],
    queryFn: async () => {
      const allDocs = await base44.entities.Document.list('-created_date');
      return allDocs.filter(doc => doc.category === 'fiscal' || doc.category === 'RGPD');
    },
    initialData: [],
    enabled: hasAccess,
  });

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return isValid(date) ? format(date, 'dd/MM/yyyy') : '';
  };

  const exportToCSV = () => {
    const csvData = invoices.map(inv => ({
      Proveedor: inv.provider_name,
      'Nº Factura': inv.invoice_number,
      Fecha: formatDate(inv.invoice_date),
      Subtotal: inv.subtotal || 0,
      IVA: inv.iva || 0,
      Total: inv.total || 0,
      Estado: inv.status
    }));

    const headers = Object.keys(csvData[0]);
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => headers.map(h => JSON.stringify(row[h])).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `facturas_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!hasAccess) {
    return (
      <div className="p-4 md:p-8 min-h-screen flex items-center justify-center">
        <Card className="border-none shadow-lg max-w-md">
          <CardContent className="p-12 text-center">
            <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Acceso Restringido</h2>
            <p className="text-gray-600 mb-6">
              No tienes permisos para acceder al portal de gestoría.
            </p>
            <p className="text-sm text-gray-500">
              Contacta con el administrador si necesitas acceso.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalInvoices = invoices.length;
  const totalAmount = invoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
  const totalIVA = invoices.reduce((sum, inv) => sum + (inv.iva || 0), 0);

  return (
    <div className="p-4 md:p-8 min-h-screen bg-gradient-to-br from-zinc-950 via-neutral-900 to-zinc-950">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div 
              className="w-12 h-12 bg-black rounded-xl flex items-center justify-center border border-cyan-500/50"
              style={{ boxShadow: '0 0 20px rgba(6, 182, 212, 0.4)' }}
            >
              <Shield className="w-6 h-6 text-cyan-400" style={{ filter: 'drop-shadow(0 0 6px rgba(6, 182, 212, 0.8))' }} />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-cyan-400" style={{ textShadow: '0 0 15px rgba(6, 182, 212, 0.6)' }}>Portal Gestoría</h1>
              <p className="text-zinc-400">Acceso de solo lectura - {user?.gestoria_company || 'Asesoría Fiscal'}</p>
            </div>
          </div>
          <Badge className="bg-cyan-500/20 text-cyan-400 border border-cyan-500/50">
            ✓ Acceso autorizado
          </Badge>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="border-none shadow-lg bg-zinc-800/50 border border-zinc-800">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <FileText className="w-5 h-5 text-cyan-400" />
                <p className="text-sm text-zinc-400">Total Facturas</p>
              </div>
              <p className="text-3xl font-bold text-white">{totalInvoices}</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-lg bg-zinc-800/50 border border-zinc-800">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <Calendar className="w-5 h-5 text-cyan-400" />
                <p className="text-sm text-zinc-400">Importe Total</p>
              </div>
              <p className="text-3xl font-bold text-white">{totalAmount.toFixed(2)}€</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-lg bg-zinc-800/50 border border-zinc-800">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <Building2 className="w-5 h-5 text-cyan-400" />
                <p className="text-sm text-zinc-400">Total IVA</p>
              </div>
              <p className="text-3xl font-bold text-white">{totalIVA.toFixed(2)}€</p>
            </CardContent>
          </Card>
        </div>

        {/* Export Actions */}
        <div className="flex justify-end mb-6">
          <Button
            onClick={exportToCSV}
            className="bg-black border border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10"
            style={{ boxShadow: '0 0 15px rgba(6, 182, 212, 0.3)' }}
            disabled={invoices.length === 0}
          >
            <Download className="w-4 h-4 mr-2" />
            Exportar CSV
          </Button>
        </div>

        {/* Invoices Table */}
        <Card className="border-none shadow-lg bg-zinc-800/50 border border-zinc-800 mb-8">
          <CardHeader>
            <CardTitle className="text-white">Facturas Registradas</CardTitle>
          </CardHeader>
          <CardContent>
            {invoices.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
                <p className="text-zinc-400">No hay facturas disponibles</p>
              </div>
            ) : (
              <div className="space-y-3">
                {invoices.map((invoice) => (
                  <div
                    key={invoice.id}
                    className="flex items-center justify-between p-4 bg-zinc-900/50 rounded-lg hover:bg-zinc-900 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-cyan-500/20 rounded-lg flex items-center justify-center border border-cyan-500/30">
                        <FileText className="w-5 h-5 text-cyan-400" />
                      </div>
                      <div>
                        <p className="font-medium text-white">{invoice.provider_name}</p>
                        <p className="text-sm text-zinc-400">
                          {invoice.invoice_number} • {formatDate(invoice.invoice_date) || 'Sin fecha'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-semibold text-white">{invoice.total?.toFixed(2)}€</p>
                        <p className="text-sm text-zinc-400">IVA: {invoice.iva?.toFixed(2)}€</p>
                      </div>
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
            )}
          </CardContent>
        </Card>

        {/* Documents Section */}
        <Card className="border-none shadow-lg bg-zinc-800/50 border border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white">Documentos Fiscales</CardTitle>
          </CardHeader>
          <CardContent>
            {documents.length === 0 ? (
              <div className="text-center py-12">
                <AlertCircle className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
                <p className="text-zinc-400">No hay documentos fiscales disponibles</p>
              </div>
            ) : (
              <div className="space-y-3">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-4 bg-zinc-900/50 rounded-lg hover:bg-zinc-900 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-cyan-500/20 rounded-lg flex items-center justify-center border border-cyan-500/30">
                        <FileText className="w-5 h-5 text-cyan-400" />
                      </div>
                      <div>
                        <p className="font-medium text-white">{doc.title}</p>
                        <p className="text-sm text-zinc-400">{doc.category}</p>
                      </div>
                    </div>
                    {doc.file_url && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(doc.file_url, '_blank')}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Ver
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer Notice */}
        <div className="mt-8 p-4 bg-cyan-900/20 border border-cyan-500/30 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-cyan-400 mt-0.5" />
            <div>
              <p className="font-medium text-cyan-300">Modo solo lectura</p>
              <p className="text-sm text-cyan-100/70 mt-1">
                Este portal permite consultar y exportar información, pero no modificarla. 
                Para cambios, contacta con el administrador.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}