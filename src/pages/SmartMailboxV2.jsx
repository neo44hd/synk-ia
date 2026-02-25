/**
 * SYNK-IA - Smart Mailbox V2 - FASE 2A.1
 * Módulo de correo mejorado con clasificación IA y extracción de adjuntos
 */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Inbox,
  Star,
  FileText,
  Users,
  Trash2,
  Archive,
  AlertTriangle,
  Search,
  RefreshCw,
  Mail,
  MailOpen,
  Paperclip,
  Clock,
  Filter,
  MoreVertical,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Loader2,
  CheckCircle2,
  XCircle,
  Building2,
  Heart,
  Ban,
  Sparkles,
  Download,
  Eye,
  ExternalLink,
  Send,
  Calendar,
  Tag,
  Zap,
  BarChart3,
  TrendingUp,
  Bell,
  FileCheck,
  Package,
  UserCircle,
  Megaphone,
  Building,
  Briefcase,
  CheckCheck,
  X,
  Link,
  AlertCircle
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { toast } from "sonner";
import moment from "moment";
import "moment/locale/es";
import { emailService, EMAIL_CATEGORIES } from "@/services/emailService";

moment.locale("es");

// Configuración de carpetas
const FOLDERS = [
  { id: "all", label: "Todos", icon: Mail, color: "text-cyan-400" },
  { id: "inbox", label: "Bandeja de entrada", icon: Inbox, color: "text-blue-400" },
  { id: "sent", label: "Enviados", icon: Send, color: "text-green-400" },
  { id: "importantes", label: "Importantes", icon: Star, color: "text-yellow-400" },
  { id: "facturas", label: "Facturas", icon: FileText, color: "text-emerald-400" },
  { id: "proveedores", label: "Proveedores", icon: Building2, color: "text-purple-400" },
  { id: "archivado", label: "Archivado", icon: Archive, color: "text-gray-400" },
  { id: "spam", label: "Spam", icon: AlertTriangle, color: "text-red-400" },
  { id: "papelera", label: "Papelera", icon: Trash2, color: "text-zinc-500" },
];

// Configuración de categorías con colores
const CATEGORY_CONFIG = {
  factura: { icon: FileText, label: "Factura", bg: "bg-emerald-500/20", text: "text-emerald-400", border: "border-emerald-500/30" },
  proveedor: { icon: Building, label: "Proveedor", bg: "bg-purple-500/20", text: "text-purple-400", border: "border-purple-500/30" },
  cliente: { icon: UserCircle, label: "Cliente", bg: "bg-blue-500/20", text: "text-blue-400", border: "border-blue-500/30" },
  interno: { icon: Briefcase, label: "Interno", bg: "bg-amber-500/20", text: "text-amber-400", border: "border-amber-500/30" },
  marketing: { icon: Megaphone, label: "Marketing", bg: "bg-red-500/20", text: "text-red-400", border: "border-red-500/30" },
  rrhh: { icon: Users, label: "RRHH", bg: "bg-orange-500/20", text: "text-orange-400", border: "border-orange-500/30" },
  gestoria: { icon: FileCheck, label: "Gestoría", bg: "bg-cyan-500/20", text: "text-cyan-400", border: "border-cyan-500/30" },
  otros: { icon: Mail, label: "Otros", bg: "bg-zinc-500/20", text: "text-zinc-400", border: "border-zinc-500/30" },
};

// Prioridades
const PRIORITY_CONFIG = {
  alta: { color: "bg-red-500", label: "Alta" },
  media: { color: "bg-yellow-500", label: "Media" },
  baja: { color: "bg-green-500", label: "Baja" },
};

export default function SmartMailboxV2() {
  // Estados principales
  const [activeFolder, setActiveFolder] = useState("inbox");
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEmails, setSelectedEmails] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [showContacts, setShowContacts] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [linkProviderDialog, setLinkProviderDialog] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  
  // Estados de sincronización
  const [syncProgress, setSyncProgress] = useState({ status: 'idle', current: 0, total: 0, message: '' });
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Filtros avanzados
  const [filters, setFilters] = useState({
    category: null,
    hasAttachments: null,
    isRead: null,
    priority: null,
    dateRange: null,
    sender: null,
  });

  const queryClient = useQueryClient();

  // Suscribirse a actualizaciones de progreso
  useEffect(() => {
    const unsubscribe = emailService.onProgressUpdate((progress) => {
      setSyncProgress(progress);
    });
    return unsubscribe;
  }, []);

  // ===== QUERIES =====

  // Cargar todos los emails
  const { data: allEmails = [], isLoading: loadingEmails, refetch: refetchEmails } = useQuery({
    queryKey: ["emails-all"],
    queryFn: async () => {
      return base44.entities.EmailMessage.list("-received_date", 500);
    }
  });

  // Cargar contactos
  const { data: contacts = [], refetch: refetchContacts } = useQuery({
    queryKey: ["emailContacts"],
    queryFn: () => base44.entities.EmailContact.list("-emails_received", 100)
  });

  // Cargar proveedores (para vinculación)
  const { data: providers = [] } = useQuery({
    queryKey: ["providers"],
    queryFn: () => base44.entities.Provider.list("name", 200)
  });

  // ===== FILTRADO DE EMAILS =====
  
  const filteredEmails = useMemo(() => {
    let result = [...allEmails];

    // Filtrar por carpeta
    if (activeFolder !== "all") {
      result = result.filter(email => {
        if (activeFolder === "facturas") return email.category === "factura";
        if (activeFolder === "proveedores") return email.category === "proveedor";
        return email.folder === activeFolder;
      });
    }

    // Búsqueda
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      result = result.filter(email =>
        email.subject?.toLowerCase().includes(search) ||
        email.sender_name?.toLowerCase().includes(search) ||
        email.sender_email?.toLowerCase().includes(search) ||
        email.body_preview?.toLowerCase().includes(search)
      );
    }

    // Filtros avanzados
    if (filters.category) {
      result = result.filter(e => e.category === filters.category);
    }
    if (filters.hasAttachments !== null) {
      result = result.filter(e => !!e.has_attachments === filters.hasAttachments);
    }
    if (filters.isRead !== null) {
      result = result.filter(e => !!e.is_read === filters.isRead);
    }
    if (filters.priority) {
      result = result.filter(e => e.priority === filters.priority);
    }
    if (filters.sender) {
      result = result.filter(e => e.sender_email?.includes(filters.sender));
    }

    return result;
  }, [allEmails, activeFolder, searchTerm, filters]);

  // ===== ESTADÍSTICAS =====
  
  const stats = useMemo(() => {
    const unread = allEmails.filter(e => !e.is_read && e.folder !== 'spam' && e.folder !== 'papelera').length;
    const byCategory = {};
    Object.keys(CATEGORY_CONFIG).forEach(cat => {
      byCategory[cat] = allEmails.filter(e => e.category === cat).length;
    });
    const byFolder = {};
    FOLDERS.forEach(folder => {
      if (folder.id === "all") {
        byFolder[folder.id] = allEmails.length;
      } else if (folder.id === "facturas") {
        byFolder[folder.id] = allEmails.filter(e => e.category === "factura").length;
      } else if (folder.id === "proveedores") {
        byFolder[folder.id] = allEmails.filter(e => e.category === "proveedor").length;
      } else {
        byFolder[folder.id] = allEmails.filter(e => e.folder === folder.id).length;
      }
    });
    
    return {
      total: allEmails.length,
      unread,
      byCategory,
      byFolder,
      withAttachments: allEmails.filter(e => e.has_attachments).length,
      today: allEmails.filter(e => moment(e.received_date).isSame(moment(), 'day')).length,
      thisWeek: allEmails.filter(e => moment(e.received_date).isSame(moment(), 'week')).length,
    };
  }, [allEmails]);

  // ===== ACCIONES =====
  
  // Sincronizar emails
  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const result = await emailService.syncEmails({
        maxEmails: 500,
        monthsBack: 2,
        folders: ['INBOX', 'SENT']
      });
      
      if (result.success) {
        toast.success(
          <div>
            <p className="font-semibold">✅ Sincronización completada</p>
            <p className="text-sm">{result.emails.length} emails procesados</p>
            <p className="text-xs text-zinc-400">
              {result.stats.invoicesDetected} facturas detectadas
            </p>
          </div>
        );
        refetchEmails();
        refetchContacts();
        localStorage.setItem('lastEmailSync', new Date().toISOString());
      }
    } catch (error) {
      toast.error("Error sincronizando: " + error.message);
    } finally {
      setIsSyncing(false);
    }
  };

  // Mover email
  const moveEmail = async (emailId, newFolder) => {
    try {
      await base44.entities.EmailMessage.update(emailId, { folder: newFolder });
      toast.success(`Movido a ${newFolder}`);
      refetchEmails();
      if (selectedEmail?.id === emailId) {
        setSelectedEmail(null);
        setDetailOpen(false);
      }
    } catch (error) {
      toast.error("Error moviendo email");
    }
  };

  // Marcar como leído/no leído
  const toggleRead = async (emailId, currentState) => {
    try {
      await base44.entities.EmailMessage.update(emailId, { is_read: !currentState });
      refetchEmails();
    } catch (error) {
      toast.error("Error actualizando");
    }
  };

  // Marcar como favorito
  const toggleStar = async (emailId, currentState) => {
    try {
      await base44.entities.EmailMessage.update(emailId, { is_starred: !currentState });
      refetchEmails();
    } catch (error) {
      toast.error("Error actualizando");
    }
  };

  // Seleccionar email
  const handleSelectEmail = (email) => {
    setSelectedEmail(email);
    setDetailOpen(true);
    if (!email.is_read) {
      toggleRead(email.id, false);
    }
  };

  // Acciones masivas
  const handleBulkAction = async (action) => {
    if (selectedEmails.length === 0) return;
    
    try {
      for (const emailId of selectedEmails) {
        if (action === 'read') {
          await base44.entities.EmailMessage.update(emailId, { is_read: true });
        } else if (action === 'unread') {
          await base44.entities.EmailMessage.update(emailId, { is_read: false });
        } else if (action === 'archive') {
          await base44.entities.EmailMessage.update(emailId, { folder: 'archivado' });
        } else if (action === 'delete') {
          await base44.entities.EmailMessage.update(emailId, { folder: 'papelera' });
        }
      }
      toast.success(`${selectedEmails.length} emails actualizados`);
      setSelectedEmails([]);
      refetchEmails();
    } catch (error) {
      toast.error("Error en acción masiva");
    }
  };

  // Vincular con proveedor
  const handleLinkProvider = async (providerId) => {
    if (!linkProviderDialog) return;
    
    try {
      await base44.entities.EmailMessage.update(linkProviderDialog.id, { 
        linked_provider_id: providerId,
        category: 'proveedor'
      });
      toast.success("Vinculado con proveedor");
      setLinkProviderDialog(null);
      refetchEmails();
    } catch (error) {
      toast.error("Error vinculando");
    }
  };

  // Limpiar filtros
  const clearFilters = () => {
    setFilters({
      category: null,
      hasAttachments: null,
      isRead: null,
      priority: null,
      dateRange: null,
      sender: null,
    });
    setSearchTerm("");
  };

  // ===== RENDER =====
  
  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-zinc-950 via-neutral-900 to-zinc-950">
      {/* ===== HEADER ===== */}
      <div className="p-4 border-b border-cyan-500/20 bg-black/50 backdrop-blur">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div 
              className="w-14 h-14 bg-black rounded-xl flex items-center justify-center border border-cyan-500/50"
              style={{ boxShadow: '0 0 25px rgba(6, 182, 212, 0.4)' }}
            >
              <Mail className="w-7 h-7 text-cyan-400" style={{ filter: 'drop-shadow(0 0 8px rgba(6, 182, 212, 0.8))' }} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-cyan-400" style={{ textShadow: '0 0 10px rgba(6, 182, 212, 0.6)' }}>
                Buzón Inteligente
              </h1>
              <div className="flex items-center gap-3 text-sm text-zinc-400">
                {stats.unread > 0 && (
                  <span className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                    {stats.unread} sin leer
                  </span>
                )}
                <span>•</span>
                <span>{stats.total} emails</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-purple-400" />
                  IA Activada
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Última sincronización */}
            {localStorage.getItem('lastEmailSync') && (
              <span className="text-xs text-zinc-500">
                Última sync: {moment(localStorage.getItem('lastEmailSync')).fromNow()}
              </span>
            )}
            
            {/* Botón Estadísticas */}
            <Button
              variant="outline"
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              onClick={() => setShowStats(true)}
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              Stats
            </Button>

            {/* Botón Contactos */}
            <Button
              variant="outline"
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              onClick={() => setShowContacts(true)}
            >
              <Users className="w-4 h-4 mr-2" />
              Contactos ({contacts.length})
            </Button>

            {/* Botón Sincronizar */}
            <Button
              onClick={handleSync}
              disabled={isSyncing}
              className="bg-black border border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10 px-6"
              style={{ boxShadow: '0 0 20px rgba(6, 182, 212, 0.3)' }}
            >
              {isSyncing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sincronizando...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Sincronizar Gmail
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Barra de progreso de sincronización */}
        {isSyncing && (
          <div className="mt-4 bg-zinc-900/50 rounded-lg p-3 border border-cyan-500/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-cyan-400">{syncProgress.message}</span>
              <span className="text-sm text-zinc-500">
                {syncProgress.current}/{syncProgress.total}
              </span>
            </div>
            <Progress 
              value={syncProgress.total > 0 ? (syncProgress.current / syncProgress.total) * 100 : 0} 
              className="h-2 bg-zinc-800"
            />
          </div>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ===== SIDEBAR - CARPETAS ===== */}
        <div className="w-64 bg-black/50 border-r border-cyan-500/20 flex flex-col">
          <div className="p-4 flex-1">
            <div className="space-y-1">
              {FOLDERS.map((folder) => {
                const Icon = folder.icon;
                const count = stats.byFolder[folder.id] || 0;
                const isActive = activeFolder === folder.id;
                
                return (
                  <button
                    key={folder.id}
                    onClick={() => setActiveFolder(folder.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all ${
                      isActive
                        ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/50"
                        : "text-zinc-400 hover:bg-zinc-800/50 border border-transparent hover:border-zinc-700"
                    }`}
                    style={isActive ? { boxShadow: '0 0 15px rgba(6, 182, 212, 0.2)' } : {}}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-5 h-5 ${isActive ? "text-cyan-400" : folder.color}`} />
                      <span className="font-medium text-sm">{folder.label}</span>
                    </div>
                    {count > 0 && (
                      <Badge 
                        className={`${
                          isActive ? "bg-cyan-500/30 text-cyan-300" : "bg-zinc-800 text-zinc-400"
                        } text-xs px-2`}
                      >
                        {count}
                      </Badge>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Categorías IA */}
            <div className="mt-6 pt-4 border-t border-cyan-500/20">
              <h3 className="text-xs font-semibold text-cyan-400 uppercase mb-3 flex items-center gap-2">
                <Sparkles className="w-3 h-3" />
                Clasificación IA
              </h3>
              <div className="space-y-1">
                {Object.entries(CATEGORY_CONFIG).map(([key, config]) => {
                  const Icon = config.icon;
                  const count = stats.byCategory[key] || 0;
                  if (count === 0) return null;
                  
                  return (
                    <button
                      key={key}
                      onClick={() => setFilters(f => ({ ...f, category: f.category === key ? null : key }))}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all text-sm ${
                        filters.category === key
                          ? `${config.bg} ${config.text} ${config.border} border`
                          : "text-zinc-400 hover:bg-zinc-800/50"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className={`w-4 h-4 ${config.text}`} />
                        <span>{config.label}</span>
                      </div>
                      <span className="text-xs">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="p-4 border-t border-cyan-500/20 bg-zinc-900/30">
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="bg-zinc-800/50 rounded-lg p-2">
                <p className="text-lg font-bold text-cyan-400">{stats.today}</p>
                <p className="text-xs text-zinc-500">Hoy</p>
              </div>
              <div className="bg-zinc-800/50 rounded-lg p-2">
                <p className="text-lg font-bold text-purple-400">{stats.withAttachments}</p>
                <p className="text-xs text-zinc-500">Adjuntos</p>
              </div>
            </div>
          </div>
        </div>

        {/* ===== LISTA DE EMAILS ===== */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Barra de herramientas */}
          <div className="p-3 border-b border-zinc-800 bg-zinc-900/30 flex items-center gap-3">
            {/* Búsqueda */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <Input
                placeholder="Buscar emails..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-zinc-800 border-zinc-700 text-white h-9"
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  <X className="w-4 h-4 text-zinc-500 hover:text-white" />
                </button>
              )}
            </div>

            {/* Filtros rápidos */}
            <Button
              variant="outline"
              size="sm"
              className={`border-zinc-700 ${showFilters ? 'bg-zinc-800' : ''}`}
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="w-4 h-4 mr-2" />
              Filtros
              {Object.values(filters).some(v => v !== null) && (
                <Badge className="ml-2 bg-cyan-500/30 text-cyan-300">
                  {Object.values(filters).filter(v => v !== null).length}
                </Badge>
              )}
            </Button>

            {/* Acciones masivas */}
            {selectedEmails.length > 0 && (
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-sm text-zinc-400">{selectedEmails.length} seleccionados</span>
                <Button size="sm" variant="ghost" onClick={() => handleBulkAction('read')}>
                  <MailOpen className="w-4 h-4 mr-1" /> Leído
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleBulkAction('archive')}>
                  <Archive className="w-4 h-4 mr-1" /> Archivar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleBulkAction('delete')} className="text-red-400">
                  <Trash2 className="w-4 h-4 mr-1" /> Eliminar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelectedEmails([])}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Panel de filtros expandible */}
          {showFilters && (
            <div className="p-3 border-b border-zinc-800 bg-zinc-900/50 flex flex-wrap items-center gap-3">
              <Select
                value={filters.hasAttachments === null ? "" : filters.hasAttachments.toString()}
                onValueChange={(v) => setFilters(f => ({ ...f, hasAttachments: v === "" ? null : v === "true" }))}
              >
                <SelectTrigger className="w-40 h-8 bg-zinc-800 border-zinc-700">
                  <SelectValue placeholder="Adjuntos" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-700">
                  <SelectItem value="">Todos</SelectItem>
                  <SelectItem value="true">Con adjuntos</SelectItem>
                  <SelectItem value="false">Sin adjuntos</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={filters.isRead === null ? "" : filters.isRead.toString()}
                onValueChange={(v) => setFilters(f => ({ ...f, isRead: v === "" ? null : v === "true" }))}
              >
                <SelectTrigger className="w-40 h-8 bg-zinc-800 border-zinc-700">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-700">
                  <SelectItem value="">Todos</SelectItem>
                  <SelectItem value="true">Leídos</SelectItem>
                  <SelectItem value="false">No leídos</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={filters.priority || ""}
                onValueChange={(v) => setFilters(f => ({ ...f, priority: v || null }))}
              >
                <SelectTrigger className="w-40 h-8 bg-zinc-800 border-zinc-700">
                  <SelectValue placeholder="Prioridad" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-700">
                  <SelectItem value="">Todas</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="media">Media</SelectItem>
                  <SelectItem value="baja">Baja</SelectItem>
                </SelectContent>
              </Select>

              {Object.values(filters).some(v => v !== null) && (
                <Button size="sm" variant="ghost" onClick={clearFilters} className="text-zinc-400">
                  <X className="w-4 h-4 mr-1" /> Limpiar filtros
                </Button>
              )}
              
              <span className="text-sm text-zinc-500 ml-auto">
                {filteredEmails.length} resultados
              </span>
            </div>
          )}

          {/* Lista de emails */}
          <ScrollArea className="flex-1">
            {loadingEmails ? (
              <div className="flex items-center justify-center h-40">
                <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
              </div>
            ) : filteredEmails.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-zinc-500">
                <Inbox className="w-12 h-12 mb-3 opacity-50" />
                <p>No hay emails {searchTerm && `para "${searchTerm}"`}</p>
                {Object.values(filters).some(v => v !== null) && (
                  <Button size="sm" variant="ghost" onClick={clearFilters} className="mt-2">
                    Limpiar filtros
                  </Button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-zinc-800/50">
                {filteredEmails.map((email) => (
                  <EmailRow
                    key={email.id}
                    email={email}
                    isSelected={selectedEmail?.id === email.id}
                    isChecked={selectedEmails.includes(email.id)}
                    onSelect={() => handleSelectEmail(email)}
                    onCheck={(checked) => {
                      if (checked) {
                        setSelectedEmails(prev => [...prev, email.id]);
                      } else {
                        setSelectedEmails(prev => prev.filter(id => id !== email.id));
                      }
                    }}
                    onToggleStar={() => toggleStar(email.id, email.is_starred)}
                    onMove={(folder) => moveEmail(email.id, folder)}
                    onLinkProvider={() => setLinkProviderDialog(email)}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* ===== PANEL DE DETALLE ===== */}
        <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
          <SheetContent className="w-[500px] sm:max-w-[500px] bg-zinc-900 border-zinc-800 p-0">
            {selectedEmail && (
              <EmailDetail
                email={selectedEmail}
                onClose={() => {
                  setDetailOpen(false);
                  setSelectedEmail(null);
                }}
                onToggleStar={() => toggleStar(selectedEmail.id, selectedEmail.is_starred)}
                onMove={(folder) => moveEmail(selectedEmail.id, folder)}
                onLinkProvider={() => setLinkProviderDialog(selectedEmail)}
              />
            )}
          </SheetContent>
        </Sheet>
      </div>

      {/* ===== DIÁLOGOS ===== */}
      
      {/* Diálogo de Estadísticas */}
      <Dialog open={showStats} onOpenChange={setShowStats}>
        <DialogContent className="max-w-2xl bg-zinc-900 border-zinc-800 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-cyan-400" />
              Estadísticas del Buzón
            </DialogTitle>
          </DialogHeader>
          
          <div className="grid grid-cols-4 gap-4 mt-4">
            <StatCard label="Total Emails" value={stats.total} icon={Mail} color="cyan" />
            <StatCard label="Sin Leer" value={stats.unread} icon={MailOpen} color="blue" />
            <StatCard label="Con Adjuntos" value={stats.withAttachments} icon={Paperclip} color="purple" />
            <StatCard label="Esta Semana" value={stats.thisWeek} icon={Calendar} color="green" />
          </div>

          <div className="mt-6">
            <h4 className="text-sm font-semibold text-zinc-400 mb-3">Por Categoría IA</h4>
            <div className="space-y-2">
              {Object.entries(CATEGORY_CONFIG).map(([key, config]) => {
                const count = stats.byCategory[key] || 0;
                const percent = stats.total > 0 ? (count / stats.total) * 100 : 0;
                const Icon = config.icon;
                
                return (
                  <div key={key} className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg ${config.bg} flex items-center justify-center`}>
                      <Icon className={`w-4 h-4 ${config.text}`} />
                    </div>
                    <span className="w-24 text-sm">{config.label}</span>
                    <div className="flex-1 bg-zinc-800 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${config.bg.replace('/20', '')}`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <span className="w-16 text-right text-sm text-zinc-400">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Contactos */}
      <Dialog open={showContacts} onOpenChange={setShowContacts}>
        <DialogContent className="max-w-2xl bg-zinc-900 border-zinc-800 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-cyan-400" />
              Gestión de Contactos
            </DialogTitle>
          </DialogHeader>
          
          <Tabs defaultValue="all" className="mt-4">
            <TabsList className="bg-zinc-800">
              <TabsTrigger value="all">Todos ({contacts.length})</TabsTrigger>
              <TabsTrigger value="favorites">
                <Star className="w-3 h-3 mr-1" /> Favoritos
              </TabsTrigger>
              <TabsTrigger value="providers">
                <Building2 className="w-3 h-3 mr-1" /> Proveedores
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-4">
              <ScrollArea className="h-80">
                <div className="space-y-2">
                  {contacts.map((contact) => (
                    <ContactRow key={contact.id} contact={contact} />
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="favorites" className="mt-4">
              <ScrollArea className="h-80">
                <div className="space-y-2">
                  {contacts.filter(c => c.is_favorite).map((contact) => (
                    <ContactRow key={contact.id} contact={contact} />
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="providers" className="mt-4">
              <ScrollArea className="h-80">
                <div className="space-y-2">
                  {contacts.filter(c => c.type === 'proveedor').map((contact) => (
                    <ContactRow key={contact.id} contact={contact} />
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Diálogo Vincular Proveedor */}
      <Dialog open={!!linkProviderDialog} onOpenChange={() => setLinkProviderDialog(null)}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link className="w-5 h-5 text-purple-400" />
              Vincular con Proveedor
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              Selecciona un proveedor para asociar este email
            </DialogDescription>
          </DialogHeader>
          
          <div className="mt-4">
            <Input
              placeholder="Buscar proveedor..."
              className="bg-zinc-800 border-zinc-700 mb-4"
            />
            <ScrollArea className="h-60">
              <div className="space-y-2">
                {providers.map((provider) => (
                  <button
                    key={provider.id}
                    onClick={() => handleLinkProvider(provider.id)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-800 transition-colors text-left"
                  >
                    <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                      <p className="font-medium">{provider.name}</p>
                      <p className="text-xs text-zinc-500">{provider.email}</p>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ===== COMPONENTES AUXILIARES =====

function EmailRow({ email, isSelected, isChecked, onSelect, onCheck, onToggleStar, onMove, onLinkProvider }) {
  const category = CATEGORY_CONFIG[email.category] || CATEGORY_CONFIG.otros;
  const CategoryIcon = category.icon;
  
  return (
    <div
      className={`flex items-start gap-3 p-3 cursor-pointer transition-all hover:bg-zinc-800/50 ${
        !email.is_read ? "bg-zinc-800/30" : ""
      } ${isSelected ? "bg-cyan-900/20 border-l-2 border-cyan-500" : ""}`}
    >
      {/* Checkbox */}
      <div className="pt-1" onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={isChecked}
          onCheckedChange={onCheck}
          className="border-zinc-600"
        />
      </div>

      {/* Estrella y Prioridad */}
      <div className="flex flex-col items-center gap-1 pt-1">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleStar();
          }}
          className="hover:scale-110 transition-transform"
        >
          <Star
            className={`w-4 h-4 ${
              email.is_starred ? "fill-yellow-500 text-yellow-500" : "text-zinc-600"
            }`}
          />
        </button>
        <div className={`w-2 h-2 rounded-full ${PRIORITY_CONFIG[email.priority]?.color || 'bg-gray-500'}`} />
      </div>

      {/* Contenido principal */}
      <div className="flex-1 min-w-0" onClick={onSelect}>
        <div className="flex items-center gap-2 mb-1">
          <span className={`font-medium truncate text-sm ${!email.is_read ? "text-white" : "text-zinc-400"}`}>
            {email.sender_name || email.sender_email}
          </span>
          
          {/* Indicadores */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {email.has_attachments && (
              <Paperclip className="w-3.5 h-3.5 text-zinc-500" />
            )}
            <Badge className={`${category.bg} ${category.text} ${category.border} border text-xs px-1.5 py-0`}>
              <CategoryIcon className="w-3 h-3 mr-1" />
              {category.label}
            </Badge>
          </div>
        </div>

        <p className={`text-sm truncate ${!email.is_read ? "text-zinc-300" : "text-zinc-500"}`}>
          {email.subject}
        </p>

        {email.ai_summary && (
          <p className="text-xs text-zinc-600 mt-1 truncate flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-purple-400 flex-shrink-0" />
            {email.ai_summary}
          </p>
        )}
      </div>

      {/* Fecha y Acciones */}
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <span className="text-xs text-zinc-500">
          {moment(email.received_date).format("DD MMM")}
        </span>
        <span className="text-xs text-zinc-600">
          {moment(email.received_date).format("HH:mm")}
        </span>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 mt-1">
              <MoreVertical className="w-4 h-4 text-zinc-500" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-800">
            <DropdownMenuItem onClick={() => onMove("importantes")}>
              <Star className="w-4 h-4 mr-2" /> Marcar importante
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onLinkProvider}>
              <Link className="w-4 h-4 mr-2" /> Vincular proveedor
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-zinc-800" />
            <DropdownMenuItem onClick={() => onMove("archivado")}>
              <Archive className="w-4 h-4 mr-2" /> Archivar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onMove("spam")}>
              <AlertTriangle className="w-4 h-4 mr-2" /> Marcar spam
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onMove("papelera")} className="text-red-400">
              <Trash2 className="w-4 h-4 mr-2" /> Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function EmailDetail({ email, onClose, onToggleStar, onMove, onLinkProvider }) {
  const category = CATEGORY_CONFIG[email.category] || CATEGORY_CONFIG.otros;
  const CategoryIcon = category.icon;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800">
        <div className="flex items-center justify-between mb-3">
          <Badge className={`${category.bg} ${category.text} ${category.border} border`}>
            <CategoryIcon className="w-3 h-3 mr-1" />
            {category.label}
          </Badge>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={onToggleStar}>
              <Star className={`w-4 h-4 ${email.is_starred ? "fill-yellow-500 text-yellow-500" : ""}`} />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onMove("archivado")}>
              <Archive className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onMove("papelera")}>
              <Trash2 className="w-4 h-4 text-red-400" />
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        <h2 className="text-lg font-bold text-white mb-3">{email.subject}</h2>
        
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-600 to-purple-600 flex items-center justify-center text-white font-bold">
            {email.sender_name?.charAt(0).toUpperCase() || "?"}
          </div>
          <div>
            <p className="text-zinc-300 font-medium">{email.sender_name}</p>
            <p className="text-xs text-zinc-500">{email.sender_email}</p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-xs text-zinc-500">
              {moment(email.received_date).format("DD MMM YYYY")}
            </p>
            <p className="text-xs text-zinc-600">
              {moment(email.received_date).format("HH:mm")}
            </p>
          </div>
        </div>
      </div>

      {/* Contenido */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {/* Resumen IA */}
          {email.ai_summary && (
            <div className="bg-purple-900/30 border border-purple-700/50 rounded-lg p-3">
              <p className="text-xs text-purple-400 font-semibold mb-1 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Resumen IA
              </p>
              <p className="text-sm text-zinc-300">{email.ai_summary}</p>
            </div>
          )}

          {/* Acción sugerida */}
          {email.ai_action && (
            <div className="bg-blue-900/30 border border-blue-700/50 rounded-lg p-3">
              <p className="text-xs text-blue-400 font-semibold mb-1">💡 Acción sugerida</p>
              <p className="text-sm text-zinc-300">{email.ai_action}</p>
            </div>
          )}

          {/* Cuerpo del email */}
          <div className="bg-zinc-800/50 rounded-lg overflow-hidden">
            {email.html_body ? (
              <div className="bg-white p-4">
                <iframe
                  srcDoc={email.html_body}
                  className="w-full h-[400px] border-none"
                  title="Email Content"
                  sandbox="allow-same-origin"
                />
              </div>
            ) : (
              <div className="p-4">
                <p className="text-sm text-zinc-300 whitespace-pre-wrap">
                  {email.body_preview || "Sin contenido disponible"}
                </p>
              </div>
            )}
          </div>

          {/* Adjuntos */}
          {email.has_attachments && (
            <div className="bg-zinc-800/50 rounded-lg p-4">
              <p className="text-sm text-zinc-400 font-semibold mb-3 flex items-center gap-2">
                <Paperclip className="w-4 h-4" />
                Adjuntos ({(email.attachments || []).length})
              </p>
              <div className="space-y-2">
                {(email.attachments || []).map((att, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                        <FileText className="w-5 h-5 text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm text-zinc-300">{att.filename}</p>
                        <p className="text-xs text-zinc-500">
                          {att.size ? `${Math.round(att.size / 1024)} KB` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="ghost">
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost">
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Acciones */}
          <div className="flex gap-2">
            <Button 
              className="flex-1 bg-purple-600 hover:bg-purple-700"
              onClick={onLinkProvider}
            >
              <Link className="w-4 h-4 mr-2" />
              Vincular Proveedor
            </Button>
            <Button 
              variant="outline" 
              className="flex-1 border-zinc-700"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Ver en Gmail
            </Button>
          </div>

          {/* Metadatos */}
          <div className="text-xs text-zinc-500 space-y-1">
            <p>Prioridad: <span className="text-zinc-400">{email.priority || "Normal"}</span></p>
            <p>Carpeta: <span className="text-zinc-400">{email.folder}</span></p>
            {email.linked_provider_id && (
              <p className="flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-green-500" />
                Vinculado con proveedor
              </p>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

function ContactRow({ contact }) {
  return (
    <div className="flex items-center justify-between p-3 hover:bg-zinc-800 rounded-lg">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white font-bold">
          {contact.name?.charAt(0).toUpperCase() || "?"}
        </div>
        <div>
          <p className="font-medium text-white">{contact.name || contact.email}</p>
          <p className="text-xs text-zinc-400">{contact.email}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge className={`text-xs ${
          contact.type === 'proveedor' ? 'bg-purple-600' :
          contact.type === 'cliente' ? 'bg-blue-600' : 'bg-gray-600'
        }`}>
          {contact.type || 'otros'}
        </Badge>
        <span className="text-xs text-zinc-500">{contact.emails_received || 0} emails</span>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }) {
  const colorClasses = {
    cyan: "text-cyan-400 bg-cyan-500/20 border-cyan-500/30",
    blue: "text-blue-400 bg-blue-500/20 border-blue-500/30",
    purple: "text-purple-400 bg-purple-500/20 border-purple-500/30",
    green: "text-green-400 bg-green-500/20 border-green-500/30",
  };
  
  return (
    <div className={`rounded-xl p-4 border ${colorClasses[color]}`}>
      <div className="flex items-center justify-between mb-2">
        <Icon className={`w-5 h-5 ${colorClasses[color].split(' ')[0]}`} />
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-zinc-400">{label}</p>
    </div>
  );
}
