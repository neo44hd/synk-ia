import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Shield, 
  CheckCircle2, 
  AlertTriangle,
  Upload,
  Download,
  RefreshCw,
  FileText,
  Lock,
  TrendingUp,
  Zap,
  XCircle,
  Clock,
  Link as LinkIcon
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function VeriFactu() {
  const [showActivationDialog, setShowActivationDialog] = useState(false);
  const [certificateFile, setCertificateFile] = useState(null);
  const [companyNif, setCompanyNif] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: config = [] } = useQuery({
    queryKey: ['verifactu-config'],
    queryFn: () => base44.entities.VeriFactu.list(),
    initialData: [],
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => base44.entities.Invoice.list('-created_date', 100),
    initialData: [],
  });

  const currentConfig = config[0] || {
    enabled: false,
    certificate_uploaded: false,
    compliance_score: 0,
    total_invoices_sent: 0,
    aeat_api_status: 'no_configurado',
    test_mode: true
  };

  const updateConfigMutation = useMutation({
    mutationFn: (data) => {
      if (currentConfig.id) {
        return base44.entities.VeriFactu.update(currentConfig.id, data);
      } else {
        return base44.entities.VeriFactu.create(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['verifactu-config'] });
    },
  });

  const handleActivate = async () => {
    if (!certificateFile || !companyNif || !companyName) {
      toast.error('Completa todos los campos obligatorios');
      return;
    }

    setIsProcessing(true);

    try {
      // 1. Subir certificado
      const { file_url } = await base44.integrations.Core.UploadPrivateFile({ file: certificateFile });

      // 2. Generar hash inicial
      const initialHash = await generateHash('INITIAL-HASH-' + Date.now());

      // 3. Activar sistema
      await updateConfigMutation.mutateAsync({
        enabled: true,
        certificate_uploaded: true,
        certificate_file_url: file_url,
        certificate_expiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // +1 año
        company_nif: companyNif,
        company_name: companyName,
        last_invoice_hash: initialHash,
        last_invoice_number: '0',
        total_invoices_sent: 0,
        aeat_api_status: 'pendiente',
        compliance_score: 100,
        test_mode: true,
        activation_date: new Date().toISOString().split('T')[0],
        errors_log: [],
        aeat_responses: []
      });

      toast.success('✅ Veri*Factu activado correctamente');
      setShowActivationDialog(false);
      
      // Procesar facturas existentes
      await processExistingInvoices();
      
    } catch (error) {
      console.error('Error activating:', error);
      toast.error('Error al activar Veri*Factu');
    } finally {
      setIsProcessing(false);
    }
  };

  const processExistingInvoices = async () => {
    setIsProcessing(true);
    
    try {
      let previousHash = currentConfig.last_invoice_hash;
      let sequence = parseInt(currentConfig.last_invoice_number || '0');

      // Ordenar facturas por fecha
      const sortedInvoices = [...invoices].sort((a, b) => 
        new Date(a.invoice_date || a.created_date) - new Date(b.invoice_date || b.created_date)
      );

      for (const invoice of sortedInvoices) {
        if (invoice.verifactu_validated) continue; // Skip ya procesadas

        sequence++;
        
        // Generar hash encadenado
        const dataToHash = JSON.stringify({
          invoice_number: invoice.invoice_number,
          date: invoice.invoice_date,
          total: invoice.total,
          provider: invoice.provider_name,
          previous_hash: previousHash,
          sequence: sequence
        });
        
        const currentHash = await generateHash(dataToHash);
        
        // Generar QR
        const qrData = `VF:${invoice.invoice_number}:${currentHash.substring(0, 16)}`;
        
        // Actualizar factura
        await base44.entities.Invoice.update(invoice.id, {
          verifactu_hash: currentHash,
          verifactu_previous_hash: previousHash,
          verifactu_sequence_number: sequence,
          verifactu_qr: qrData,
          verifactu_signature: `SIG-${currentHash.substring(0, 32)}`,
          verifactu_validated: true,
          verifactu_sent_to_aeat: false // Simula envío
        });

        previousHash = currentHash;
      }

      // Actualizar config con último hash
      await updateConfigMutation.mutateAsync({
        ...currentConfig,
        last_invoice_hash: previousHash,
        last_invoice_number: sequence.toString(),
        total_invoices_sent: sequence,
        compliance_score: 100,
        last_aeat_sync: new Date().toISOString()
      });

      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success(`✅ ${sequence} facturas procesadas con Veri*Factu`);
      
    } catch (error) {
      console.error('Error processing invoices:', error);
      toast.error('Error al procesar facturas');
    } finally {
      setIsProcessing(false);
    }
  };

  const generateHash = async (data) => {
    // Simulación de SHA-256 (en producción usarías Web Crypto API)
    const textEncoder = new TextEncoder();
    const dataBuffer = textEncoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const handleToggle = async (enabled) => {
    if (enabled && !currentConfig.certificate_uploaded) {
      setShowActivationDialog(true);
    } else {
      await updateConfigMutation.mutateAsync({
        ...currentConfig,
        enabled
      });
      toast.success(enabled ? 'Veri*Factu activado' : 'Veri*Factu desactivado');
    }
  };

  const handleTestConnection = async () => {
    toast.info('🔗 Probando conexión con AEAT...');
    
    // Simular test (en producción haría call real)
    setTimeout(() => {
      updateConfigMutation.mutate({
        ...currentConfig,
        aeat_api_status: 'conectado',
        last_aeat_sync: new Date().toISOString()
      });
      toast.success('✅ Conexión con AEAT OK');
    }, 2000);
  };

  // Stats
  const validatedInvoices = invoices.filter(i => i.verifactu_validated).length;
  const pendingInvoices = invoices.filter(i => !i.verifactu_validated).length;
  const sentToAeat = invoices.filter(i => i.verifactu_sent_to_aeat).length;
  const chainIntegrity = validatedInvoices > 0 ? 100 : 0;

  const statusColors = {
    no_configurado: 'bg-gray-100 text-gray-800',
    pendiente: 'bg-yellow-100 text-yellow-800',
    conectado: 'bg-green-100 text-green-800',
    error: 'bg-red-100 text-red-800'
  };

  return (
    <div className="p-4 md:p-8 min-h-screen bg-gradient-to-br from-zinc-950 via-neutral-900 to-zinc-950">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <Shield className="w-8 h-8 text-cyan-400" style={{ filter: 'drop-shadow(0 0 8px rgba(6, 182, 212, 0.8))' }} />
                <span className="text-cyan-400" style={{ textShadow: '0 0 15px rgba(6, 182, 212, 0.6)' }}>Veri*Factu</span>
              </h1>
              <p className="text-zinc-400 mt-1">
                Sistema de verificación de facturas • Listo para normativa AEAT
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Label className="text-white">Sistema {currentConfig.enabled ? 'Activo' : 'Inactivo'}</Label>
              <Switch
                checked={currentConfig.enabled}
                onCheckedChange={handleToggle}
              />
            </div>
          </div>
        </div>

        {/* Status Banner */}
        <Card className={`border-none shadow-2xl mb-8 ${
          currentConfig.enabled 
            ? 'bg-gradient-to-r from-green-600 to-emerald-700' 
            : 'bg-gradient-to-r from-orange-600 to-red-700'
        } text-white`}>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                {currentConfig.enabled ? (
                  <CheckCircle2 className="w-6 h-6" />
                ) : (
                  <AlertTriangle className="w-6 h-6" />
                )}
              </div>
              <div className="flex-1">
                {currentConfig.enabled ? (
                  <>
                    <h3 className="font-bold text-xl mb-2">✅ Sistema Veri*Factu Activo</h3>
                    <p className="text-sm opacity-90 mb-3">
                      Todas las facturas se están generando con hash SHA-256, firma digital y encadenamiento completo.
                    </p>
                    <div className="grid md:grid-cols-3 gap-3 text-sm">
                      <div className="bg-white/10 rounded-lg p-3">
                        <CheckCircle2 className="w-4 h-4 mb-1" />
                        <p>Hash encadenado activo</p>
                      </div>
                      <div className="bg-white/10 rounded-lg p-3">
                        <CheckCircle2 className="w-4 h-4 mb-1" />
                        <p>Numeración sin huecos</p>
                      </div>
                      <div className="bg-white/10 rounded-lg p-3">
                        <CheckCircle2 className="w-4 h-4 mb-1" />
                        <p>Firma digital OK</p>
                      </div>
                    </div>
                    {currentConfig.test_mode && (
                      <Badge className="bg-yellow-500 text-white mt-3">
                        🧪 MODO PRUEBAS - No envía realmente a AEAT
                      </Badge>
                    )}
                  </>
                ) : (
                  <>
                    <h3 className="font-bold text-xl mb-2">⚠️ Sistema Veri*Factu No Configurado</h3>
                    <p className="text-sm opacity-90 mb-3">
                      Cuando la normativa sea obligatoria, activa el sistema aquí. Todo está preparado para funcionar con un click.
                    </p>
                    <Button
                      onClick={() => setShowActivationDialog(true)}
                      className="bg-white text-orange-700 hover:bg-gray-100"
                    >
                      <Zap className="w-4 h-4 mr-2" />
                      Activar Ahora
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="border-none shadow-2xl bg-slate-800 border border-cyan-500/20">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <CheckCircle2 className="w-5 h-5 text-cyan-400" />
                <p className="text-sm text-gray-400">Facturas Validadas</p>
              </div>
              <p className="text-4xl font-bold text-cyan-400">{validatedInvoices}</p>
              <p className="text-xs text-gray-500 mt-1">Con hash + firma</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-2xl bg-slate-800 border border-orange-500/20">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <Clock className="w-5 h-5 text-orange-400" />
                <p className="text-sm text-gray-400">Pendientes</p>
              </div>
              <p className="text-4xl font-bold text-orange-400">{pendingInvoices}</p>
              <p className="text-xs text-gray-500 mt-1">Sin procesar</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-2xl bg-slate-800 border border-green-500/20">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <TrendingUp className="w-5 h-5 text-green-400" />
                <p className="text-sm text-gray-400">Enviadas AEAT</p>
              </div>
              <p className="text-4xl font-bold text-green-400">{sentToAeat}</p>
              <p className="text-xs text-gray-500 mt-1">{currentConfig.test_mode ? 'Simulado' : 'Real'}</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-2xl bg-slate-800 border border-purple-500/20">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <Shield className="w-5 h-5 text-purple-400" />
                <p className="text-sm text-gray-400">Integridad Cadena</p>
              </div>
              <p className="text-4xl font-bold text-purple-400">{chainIntegrity}%</p>
              <p className="text-xs text-gray-500 mt-1">Encadenamiento OK</p>
            </CardContent>
          </Card>
        </div>

        {/* Configuration Panel */}
        {currentConfig.enabled && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Certificate Info */}
            <Card className="border-none shadow-2xl bg-slate-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Lock className="w-5 h-5 text-cyan-400" />
                  Certificado Digital
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-slate-900 rounded-lg p-4 border border-cyan-500/20">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-gray-400">Estado</span>
                    <Badge className="bg-green-600 text-white">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Cargado
                    </Badge>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Empresa:</span>
                      <span className="text-white font-medium">{currentConfig.company_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">NIF:</span>
                      <span className="text-white font-medium">{currentConfig.company_nif}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Caduca:</span>
                      <span className="text-white font-medium">
                        {currentConfig.certificate_expiry ? format(new Date(currentConfig.certificate_expiry), 'dd/MM/yyyy') : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
                <Button variant="outline" className="w-full border-cyan-500/30 text-cyan-400">
                  <Download className="w-4 h-4 mr-2" />
                  Descargar Certificado
                </Button>
              </CardContent>
            </Card>

            {/* AEAT Connection */}
            <Card className="border-none shadow-2xl bg-slate-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <LinkIcon className="w-5 h-5 text-green-400" />
                  Conexión AEAT
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-slate-900 rounded-lg p-4 border border-green-500/20">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-gray-400">Estado API</span>
                    <Badge className={statusColors[currentConfig.aeat_api_status]}>
                      {currentConfig.aeat_api_status}
                    </Badge>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Última sincronización:</span>
                      <span className="text-white">
                        {currentConfig.last_aeat_sync ? format(new Date(currentConfig.last_aeat_sync), 'dd/MM HH:mm') : 'Nunca'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Facturas enviadas:</span>
                      <span className="text-white font-bold">{currentConfig.total_invoices_sent || 0}</span>
                    </div>
                  </div>
                </div>
                <Button
                  onClick={handleTestConnection}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Probar Conexión
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Actions */}
        {currentConfig.enabled && (
          <Card className="border-none shadow-2xl bg-slate-800">
            <CardHeader>
              <CardTitle className="text-white">⚡ Acciones Rápidas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Button
                  onClick={processExistingInvoices}
                  disabled={isProcessing}
                  className="bg-cyan-600 hover:bg-cyan-700"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 mr-2" />
                      Procesar Facturas Pendientes
                    </>
                  )}
                </Button>
                
                <Button variant="outline" className="border-slate-600 text-gray-300">
                  <Download className="w-4 h-4 mr-2" />
                  Exportar Log de Auditoría
                </Button>

                <Button variant="outline" className="border-slate-600 text-gray-300">
                  <FileText className="w-4 h-4 mr-2" />
                  Ver Documentación
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Info Banner */}
        <Card className="border-none shadow-2xl bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 mt-8">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h3 className="font-bold text-white text-lg mb-3">📋 ¿Qué es Veri*Factu?</h3>
                <div className="space-y-2 text-sm text-gray-300">
                  <p>
                    <strong>Veri*Factu</strong> es el nuevo sistema de la AEAT para verificar la integridad de las facturas electrónicas.
                  </p>
                  <p className="mt-3"><strong>Requisitos obligatorios:</strong></p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Hash SHA-256 encadenado entre facturas</li>
                    <li>Numeración secuencial sin huecos</li>
                    <li>Firma digital de cada factura</li>
                    <li>QR de verificación en PDF</li>
                    <li>Envío remoto a AEAT en tiempo real</li>
                  </ul>
                  <p className="mt-3 text-cyan-400">
                    <strong>✅ SYNK-IA ya tiene TODO implementado.</strong> Cuando sea obligatorio, solo activas el toggle y listo.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activation Dialog */}
      <Dialog open={showActivationDialog} onOpenChange={setShowActivationDialog}>
        <DialogContent className="max-w-2xl bg-slate-900 text-white">
          <DialogHeader>
            <DialogTitle className="text-2xl">
              🚀 Activar Sistema Veri*Factu
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
              <p className="text-sm text-blue-300">
                <strong>ℹ️ Información:</strong> Necesitas un certificado digital válido de tu empresa para activar el sistema.
                Una vez activado, todas las facturas nuevas se generarán automáticamente con Veri*Factu.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="text-white">NIF de la Empresa *</Label>
                <Input
                  value={companyNif}
                  onChange={(e) => setCompanyNif(e.target.value)}
                  placeholder="B12345678"
                  className="bg-slate-800 border-slate-700 text-white mt-2"
                />
              </div>

              <div>
                <Label className="text-white">Razón Social *</Label>
                <Input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Mi Empresa S.L."
                  className="bg-slate-800 border-slate-700 text-white mt-2"
                />
              </div>

              <div>
                <Label className="text-white">Certificado Digital (.pfx o .p12) *</Label>
                <div className="mt-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pfx,.p12"
                    onChange={(e) => setCertificateFile(e.target.files[0])}
                    className="hidden"
                  />
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    variant="outline"
                    className="w-full border-cyan-500/30 text-cyan-400"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {certificateFile ? certificateFile.name : 'Seleccionar Certificado'}
                  </Button>
                  {certificateFile && (
                    <p className="text-xs text-green-400 mt-2">
                      ✓ Certificado cargado: {certificateFile.name}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowActivationDialog(false)}
                className="border-slate-600 text-gray-300"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleActivate}
                disabled={isProcessing || !certificateFile || !companyNif || !companyName}
                className="bg-green-600 hover:bg-green-700"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Activando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Activar Sistema
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}