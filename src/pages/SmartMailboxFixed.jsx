import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Inbox,
  Star,
  FileText,
  Building2,
  AlertTriangle,
  Archive,
  Trash2,
  Search,
  RefreshCw,
  Mail,
  MailOpen,
  Clock,
  Users,
  Sparkles,
  ChevronRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

const FOLDERS = [
  { id: "inbox", label: "Bandeja de entrada", icon: Inbox, color: "text-blue-500" },
  { id: "importantes", label: "Importantes", icon: Star, color: "text-yellow-500" },
  { id: "facturas", label: "Facturas", icon: FileText, color: "text-green-500" },
  { id: "proveedores", label: "Proveedores", icon: Building2, color: "text-purple-500" },
  { id: "spam", label: "Spam", icon: AlertTriangle, color: "text-red-500" },
  { id: "archivado", label: "Archivado", icon: Archive, color: "text-gray-500" },
  { id: "papelera", label: "Papelera", icon: Trash2, color: "text-gray-400" },
];

export default function SmartMailboxFixed() {
  const [activeFolder, setActiveFolder] = useState("inbox");
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [emailStats, setEmailStats] = useState(null);
  const [mockEmails, setMockEmails] = useState([]);

  // Cargar datos reales del API
  useEffect(() => {
    const loadEmails = async () => {
      try {
        setLoading(true);
        const [statsRes, emailsRes] = await Promise.all([
          fetch('/api/email/stats'),
          fetch('/api/data/emailmessage?sort=-received_date&limit=500'),
        ]);
        const statsData = await statsRes.json();
        const emailsData = await emailsRes.json();

        if (statsData.success) setEmailStats(statsData);
        if (emailsData.success) setMockEmails(mapEmails(emailsData.data || []));
      } catch (error) {
        console.error('Error loading emails:', error);
        toast.error('Error cargando correos');
      } finally {
        setLoading(false);
      }
    };

    loadEmails();
  }, []);

  // Mapear correos reales del API (entidad EmailMessage) al formato de la UI
  const mapEmails = (records) => (records || []).map((e) => ({
    id: e.id,
    subject: e.subject || '(Sin asunto)',
    sender_name: e.sender_name || e.sender_email || 'Desconocido',
    sender_email: e.sender_email || '',
    received_date: e.received_date || e.created_date,
    is_read: !!e.is_read,
    is_starred: !!e.is_starred,
    has_attachments: !!e.has_attachments,
    folder: e.folder || 'inbox',
    preview: e.body_preview || '',
    body: e.body_preview || '',
    has_documents: (e.attachment_count || 0) > 0,
  }));

  // Sincronizar emails
  const handleSync = async () => {
    setSyncing(true);
    try {
      const response = await fetch('/api/email/sync', { method: 'POST' });
      const data = await response.json();
      
      if (data.success) {
        toast.success(`✅ Sincronización completada`);
        // Recargar datos
        setTimeout(() => window.location.reload(), 1000);
      } else {
        toast.error(data.message || "Error sincronizando");
      }
    } catch (error) {
      console.error('Error syncing:', error);
      toast.error('Error durante la sincronización');
    } finally {
      setSyncing(false);
    }
  };

  // Filtrar emails
  const filteredEmails = mockEmails.filter(email => {
    if (email.folder !== activeFolder) return false;
    if (!searchTerm) return true;
    
    const search = searchTerm.toLowerCase();
    return (
      email.subject?.toLowerCase().includes(search) ||
      email.sender_name?.toLowerCase().includes(search) ||
      email.sender_email?.toLowerCase().includes(search)
    );
  });

  const folderCounts = FOLDERS.reduce((acc, folder) => {
    acc[folder.id] = mockEmails.filter(e => e.folder === folder.id).length;
    return acc;
  }, {});

  const unreadCount = mockEmails.filter(e => !e.is_read && e.folder !== 'spam' && e.folder !== 'papelera').length;

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Hace un momento';
    if (diffMins < 60) return `Hace ${diffMins}m`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays < 7) return `Hace ${diffDays}d`;
    
    return date.toLocaleDateString('es-ES');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Loader2 className="animate-spin mx-auto mb-4" size={40} />
          <p className="text-slate-600">Cargando correos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex h-screen">
        {/* Sidebar */}
        <div className="w-64 bg-white border-r border-slate-200 flex flex-col">
          <div className="p-4 border-b border-slate-200">
            <div className="flex items-center gap-2 mb-4">
              <Mail className="text-blue-500" size={24} />
              <h1 className="text-xl font-bold">Smart Mailbox</h1>
            </div>
            <Button 
              onClick={handleSync} 
              disabled={syncing}
              className="w-full bg-blue-500 hover:bg-blue-600"
            >
              {syncing ? <Loader2 className="animate-spin mr-2" size={16} /> : <RefreshCw size={16} className="mr-2" />}
              {syncing ? 'Sincronizando...' : 'Sincronizar'}
            </Button>
          </div>

          <ScrollArea className="flex-1">
            <div className="space-y-1 p-3">
              {FOLDERS.map(folder => {
                const FolderIcon = folder.icon;
                const count = folderCounts[folder.id] || 0;
                const isActive = activeFolder === folder.id;
                
                return (
                  <button
                    key={folder.id}
                    onClick={() => setActiveFolder(folder.id)}
                    className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition ${
                      isActive
                        ? 'bg-blue-100 text-blue-700 font-semibold'
                        : 'hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <FolderIcon size={18} />
                    <span className="flex-1 text-left text-sm">{folder.label}</span>
                    {count > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {count}
                      </Badge>
                    )}
                  </button>
                );
              })}
            </div>
          </ScrollArea>

          {/* Stats */}
          <div className="p-4 border-t border-slate-200 space-y-3 text-sm">
            <div>
              <p className="text-slate-600">No leídos</p>
              <p className="text-2xl font-bold text-blue-500">{unreadCount}</p>
            </div>
            {emailStats && (
              <>
                <div>
                  <p className="text-slate-600">Total de correos</p>
                  <p className="text-2xl font-bold text-slate-900">{emailStats.total_emails}</p>
                </div>
                <div>
                  <p className="text-slate-600">Con documentos</p>
                  <p className="text-2xl font-bold text-green-500">{emailStats.emails_con_docs}</p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="bg-white border-b border-slate-200 p-4">
            <div className="flex items-center gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 text-slate-400" size={18} />
                <Input
                  placeholder="Buscar correos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          {/* Emails List */}
          <ScrollArea className="flex-1">
            <div className="divide-y divide-slate-200">
              {filteredEmails.length > 0 ? (
                filteredEmails.map(email => (
                  <div
                    key={email.id}
                    onClick={() => setSelectedEmail(email)}
                    className={`p-4 hover:bg-blue-50 cursor-pointer transition border-l-4 ${
                      !email.is_read ? 'border-blue-500 bg-blue-50' : 'border-transparent'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className={`font-semibold truncate ${!email.is_read ? 'font-bold' : ''}`}>
                            {email.sender_name}
                          </h3>
                          {email.has_attachments && (
                            <FileText size={14} className="text-slate-500 flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-sm text-slate-600 truncate">{email.subject}</p>
                        <p className="text-xs text-slate-500 mt-1">{email.preview}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {!email.is_read && (
                          <div className="w-2 h-2 bg-blue-500 rounded-full" />
                        )}
                        <span className="text-xs text-slate-500 whitespace-nowrap">
                          {formatDate(email.received_date)}
                        </span>
                        {email.is_starred && <Star size={16} className="text-yellow-400 fill-yellow-400" />}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-slate-500">
                  <Inbox size={40} className="mx-auto mb-4 opacity-50" />
                  <p>No hay correos en esta carpeta</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Email Detail */}
        {selectedEmail && (
          <div className="w-96 bg-white border-l border-slate-200 flex flex-col">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="font-bold text-lg">Detalles</h2>
              <button 
                onClick={() => setSelectedEmail(null)}
                className="text-slate-500 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <ScrollArea className="flex-1 p-4 space-y-4">
              <div>
                <p className="text-xs text-slate-500 uppercase font-semibold mb-1">De</p>
                <p className="font-semibold">{selectedEmail.sender_name}</p>
                <p className="text-sm text-slate-600">{selectedEmail.sender_email}</p>
              </div>

              <div>
                <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Asunto</p>
                <p className="font-semibold">{selectedEmail.subject}</p>
              </div>

              <div>
                <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Fecha</p>
                <p className="text-sm">{new Date(selectedEmail.received_date).toLocaleString('es-ES')}</p>
              </div>

              <div className="bg-slate-100 p-3 rounded">
                <p className="text-sm text-slate-700">{selectedEmail.body}</p>
              </div>

              {selectedEmail.has_documents && (
                <div className="bg-green-50 p-3 rounded border border-green-200">
                  <div className="flex items-center gap-2 text-green-700">
                    <CheckCircle2 size={16} />
                    <p className="text-sm font-semibold">Con documentos adjuntos</p>
                  </div>
                </div>
              )}
            </ScrollArea>

            <div className="p-4 border-t border-slate-200 space-y-2">
              <Button className="w-full bg-blue-500 hover:bg-blue-600">
                <MailOpen size={16} className="mr-2" />
                Abrir en Gmail
              </Button>
              <Button variant="outline" className="w-full">
                <Star size={16} className="mr-2" />
                Marcar como importante
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
