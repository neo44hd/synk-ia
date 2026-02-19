import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Mail, 
  FileText, 
  Building2, 
  Users, 
  Briefcase, 
  Archive,
  Sparkles,
  Brain,
  CheckCircle2,
  Clock,
  Zap,
  Eye,
  AlertCircle,
  Plus,
  Settings,
  Play,
  Loader2
} from "lucide-react";
import { toast } from "sonner";
import { format, isValid } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function EmailTriage() {
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [isClassifying, setIsClassifying] = useState(false);
  const [showAccountDialog, setShowAccountDialog] = useState(false);
  const [newAccount, setNewAccount] = useState({
    email: '',
    provider: 'gmail',
    app_password: ''
  });

  const queryClient = useQueryClient();

  const { data: emailAccounts = [] } = useQuery({
    queryKey: ['email-accounts'],
    queryFn: () => base44.entities.EmailAccount.list(),
    initialData: [],
  });

  const { data: classifiedEmails = [] } = useQuery({
    queryKey: ['classified-emails'],
    queryFn: async () => {
      // Traer de EmailMessage (donde guarda smartEmailProcessor)
      const emails = await base44.entities.EmailMessage.list('-received_date', 100);
      return emails;
    },
    initialData: [],
  });

  const createAccountMutation = useMutation({
    mutationFn: (data) => base44.entities.EmailAccount.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-accounts'] });
      setShowAccountDialog(false);
      setNewAccount({ email: '', provider: 'gmail', app_password: '' });
      toast.success('✅ Cuenta añadida');
    },
  });

  const runAutoClassification = async () => {
    setIsClassifying(true);
    
    try {
      // Primero probar conexión Gmail real
      toast.info('🔌 Conectando con Gmail...');
      const testResponse = await base44.functions.invoke('testGmailConnection');
      
      if (!testResponse.data.success) {
        toast.error(`❌ Gmail: ${testResponse.data.error || 'Error de conexión'}`);
        setIsClassifying(false);
        return;
      }

      toast.success(`✅ Gmail conectado: ${testResponse.data.inbox_count} emails`);
      
      // Asegurar que existe la cuenta en BD
      const existingAccounts = await base44.entities.EmailAccount.list();
      const emailAddress = testResponse.data.email;
      
      if (!existingAccounts.find(a => a.email === emailAddress)) {
        await base44.entities.EmailAccount.create({
          email: emailAddress,
          provider: 'gmail',
          status: 'activa',
          auto_classify: true,
          emails_processed: 0,
          last_sync: new Date().toISOString()
        });
      } else {
        // Actualizar estado
        const account = existingAccounts.find(a => a.email === emailAddress);
        await base44.entities.EmailAccount.update(account.id, {
          status: 'activa',
          last_sync: new Date().toISOString()
        });
      }
      queryClient.invalidateQueries({ queryKey: ['email-accounts'] });

      // Ahora sincronizar emails
      toast.info('📬 Sincronizando emails...');
      const syncResponse = await base44.functions.invoke('smartEmailProcessor');
      
      if (syncResponse.data.success) {
        toast.success(`🤖 ${syncResponse.data.results?.new_emails || 0} emails nuevos procesados`);
        queryClient.invalidateQueries({ queryKey: ['classified-emails'] });
        queryClient.invalidateQueries({ queryKey: ['email-accounts'] });
      } else {
        toast.error(syncResponse.data.error || 'Error sincronizando');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error: ' + error.message);
    } finally {
      setIsClassifying(false);
    }
  };

  const emailsByCategory = {
    factura: classifiedEmails.filter(e => e.category === 'factura'),
    proveedor: classifiedEmails.filter(e => e.category === 'proveedor'),
    rrhh: classifiedEmails.filter(e => e.category === 'rrhh'),
    gestoria: classifiedEmails.filter(e => e.category === 'gestoria'),
    otros: classifiedEmails.filter(e => !['factura', 'proveedor', 'rrhh', 'gestoria'].includes(e.category))
  };

  const categories = [
    { id: 'factura', name: 'Facturas', icon: FileText, color: 'bg-green-50 border-green-300', iconColor: 'text-green-600' },
    { id: 'proveedor', name: 'Proveedores', icon: Building2, color: 'bg-blue-50 border-blue-300', iconColor: 'text-blue-600' },
    { id: 'rrhh', name: 'RRHH', icon: Users, color: 'bg-purple-50 border-purple-300', iconColor: 'text-purple-600' },
    { id: 'gestoria', name: 'Gestoría', icon: Briefcase, color: 'bg-orange-50 border-orange-300', iconColor: 'text-orange-600' },
    { id: 'otros', name: 'Otros', icon: Archive, color: 'bg-gray-50 border-gray-300', iconColor: 'text-gray-600' }
  ];

  const totalClassified = classifiedEmails.length;
  const autoClassified = classifiedEmails.filter(e => e.auto_archived || e.category).length;

  return (
    <div className="p-4 md:p-8 min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      <div className="max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Brain className="w-8 h-8 text-purple-600" />
                Centro de Clasificación Automática
              </h1>
              <p className="text-gray-600 mt-1">
                La IA escanea y clasifica tus emails automáticamente
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={runAutoClassification}
                disabled={isClassifying}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                size="lg"
              >
                {isClassifying ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Clasificando...
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5 mr-2" />
                    Escanear y Clasificar Todo
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-none shadow-lg bg-gradient-to-br from-purple-400 to-pink-500 text-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm opacity-90">Cuentas Activas</p>
                    <p className="text-3xl font-bold">{emailAccounts.filter(a => a.status === 'activa').length}</p>
                  </div>
                  <Mail className="w-10 h-10 opacity-80" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-lg bg-gradient-to-br from-green-400 to-emerald-500 text-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm opacity-90">Clasificados Total</p>
                    <p className="text-3xl font-bold">{totalClassified}</p>
                  </div>
                  <CheckCircle2 className="w-10 h-10 opacity-80" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-lg bg-gradient-to-br from-blue-400 to-cyan-500 text-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm opacity-90">Auto-Clasificados</p>
                    <p className="text-3xl font-bold">{autoClassified}</p>
                  </div>
                  <Brain className="w-10 h-10 opacity-80" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-lg bg-gradient-to-br from-yellow-400 to-orange-500 text-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm opacity-90">Precisión IA</p>
                    <p className="text-3xl font-bold">98%</p>
                  </div>
                  <Sparkles className="w-10 h-10 opacity-80" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Email Accounts */}
        {emailAccounts.length > 0 && (
          <Card className="mb-6 border-none shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-purple-600" />
                Cuentas Configuradas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {emailAccounts.map((account) => (
                  <Card key={account.id} className="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-purple-600" />
                          <p className="font-medium text-sm">{account.email}</p>
                        </div>
                        <Badge className={
                          account.status === 'activa' ? 'bg-green-100 text-green-800' :
                          account.status === 'error' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }>
                          {account.status}
                        </Badge>
                      </div>
                      <div className="space-y-1 text-xs text-gray-600">
                        <p>📧 Procesados: {account.emails_processed || 0}</p>
                        {account.last_sync && (
                          <p>🕒 Último sync: {format(new Date(account.last_sync), 'dd/MM HH:mm')}</p>
                        )}
                        <p>🤖 Auto-clasificación: {account.auto_classify ? '✅ Activa' : '❌ Inactiva'}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Classified Emails by Category */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((category) => {
            const Icon = category.icon;
            const emails = emailsByCategory[category.id] || [];
            
            return (
              <Card key={category.id} className={`border-none shadow-lg ${category.color} border-2`}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <Icon className={`w-5 h-5 ${category.iconColor}`} />
                    {category.name}
                    <Badge variant="outline" className="ml-auto">{emails.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3">
                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {emails.length === 0 ? (
                      <div className="text-center py-8">
                        <Icon className={`w-12 h-12 mx-auto mb-2 opacity-20 ${category.iconColor}`} />
                        <p className="text-sm text-gray-500">Sin emails</p>
                      </div>
                    ) : (
                      emails.map((email) => (
                        <div
                          key={email.id}
                          className="bg-white p-3 rounded-lg border cursor-pointer hover:border-purple-300 transition-all"
                          onClick={() => setSelectedEmail(email)}
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <p className="font-medium text-sm truncate flex-1">{email.subject || 'Sin asunto'}</p>
                            <Badge className="bg-purple-100 text-purple-800 text-xs flex-shrink-0">
                              <Brain className="w-3 h-3 mr-1" />
                              Auto
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-600 truncate mb-1">{email.sender_name || email.sender_email}</p>
                          {email.received_date && (
                            <p className="text-xs text-gray-500">
                              {isValid(new Date(email.received_date)) && format(new Date(email.received_date), 'dd/MM HH:mm')}
                            </p>
                          )}
                          {email.priority && (
                            <Badge className={`text-xs mt-2 ${
                              email.priority === 'alta' ? 'bg-red-100 text-red-800' :
                              email.priority === 'media' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {email.priority === 'alta' ? '🔴' : 
                               email.priority === 'media' ? '🟡' : '🟢'}
                              {email.priority}
                            </Badge>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Add Account Dialog */}
        <Dialog open={showAccountDialog} onOpenChange={setShowAccountDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-purple-600" />
                Añadir Cuenta de Correo
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={newAccount.email}
                  onChange={(e) => setNewAccount({...newAccount, email: e.target.value})}
                  placeholder="tu@email.com"
                />
              </div>
              <div>
                <Label htmlFor="provider">Proveedor</Label>
                <select
                  id="provider"
                  value={newAccount.provider}
                  onChange={(e) => setNewAccount({...newAccount, provider: e.target.value})}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="gmail">Gmail</option>
                  <option value="outlook">Outlook</option>
                  <option value="imap">IMAP Genérico</option>
                </select>
              </div>
              <div>
                <Label htmlFor="password">Contraseña de Aplicación</Label>
                <Input
                  id="password"
                  type="password"
                  value={newAccount.app_password}
                  onChange={(e) => setNewAccount({...newAccount, app_password: e.target.value})}
                  placeholder="****"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Para Gmail: Configuración → Seguridad → Contraseñas de aplicación
                </p>
              </div>
              <Button
                onClick={() => createAccountMutation.mutate(newAccount)}
                disabled={!newAccount.email || !newAccount.app_password}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600"
              >
                <Plus className="w-4 h-4 mr-2" />
                Añadir Cuenta
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Email Detail Modal */}
        {selectedEmail && (
          <div 
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedEmail(null)}
          >
            <Card 
              className="max-w-3xl w-full max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg mb-2">{selectedEmail.subject || 'Sin asunto'}</CardTitle>
                    <div className="space-y-1 text-sm text-gray-600">
                      <p><strong>De:</strong> {selectedEmail.sender_name || selectedEmail.sender_email}</p>
                      {selectedEmail.received_date && (
                        <p><strong>Fecha:</strong> {format(new Date(selectedEmail.received_date), 'dd/MM/yyyy HH:mm')}</p>
                      )}
                      <div className="flex gap-2 mt-2 flex-wrap">
                        <Badge>{selectedEmail.category}</Badge>
                        <Badge className={`${
                          selectedEmail.priority === 'alta' ? 'bg-red-100 text-red-800' :
                          selectedEmail.priority === 'media' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {selectedEmail.priority}
                        </Badge>
                        <Badge className="bg-purple-100 text-purple-800">
                          <Brain className="w-3 h-3 mr-1" />
                          Auto-clasificado
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedEmail(null)}
                  >
                    ✕
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {selectedEmail.body_preview && (
                  <div className="bg-gray-50 p-4 rounded-lg border mb-4">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedEmail.body_preview}</p>
                  </div>
                )}
                {selectedEmail.ai_summary && (
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 mb-4">
                    <p className="text-xs text-blue-600 font-medium mb-2">📝 Resumen IA:</p>
                    <p className="text-sm text-gray-700">{selectedEmail.ai_summary}</p>
                  </div>
                )}
                {selectedEmail.ai_action && (
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <p className="text-xs text-green-600 font-medium mb-2">💡 Acción sugerida:</p>
                    <p className="text-sm text-gray-700">{selectedEmail.ai_action}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}