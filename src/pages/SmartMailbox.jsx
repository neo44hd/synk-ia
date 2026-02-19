import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
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
  Loader2,
  CheckCircle2,
  XCircle,
  Building2,
  Heart,
  Ban,
  Sparkles
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import moment from "moment";
import "moment/locale/es";
moment.locale("es");

const FOLDERS = [
  { id: "inbox", label: "Bandeja de entrada", icon: Inbox, color: "text-blue-500" },
  { id: "importantes", label: "Importantes", icon: Star, color: "text-yellow-500" },
  { id: "facturas", label: "Facturas", icon: FileText, color: "text-green-500" },
  { id: "proveedores", label: "Proveedores", icon: Building2, color: "text-purple-500" },
  { id: "spam", label: "Spam", icon: AlertTriangle, color: "text-red-500" },
  { id: "archivado", label: "Archivado", icon: Archive, color: "text-gray-500" },
  { id: "papelera", label: "Papelera", icon: Trash2, color: "text-gray-400" },
];

export default function SmartMailbox() {
  const [activeFolder, setActiveFolder] = useState("inbox");
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEmails, setSelectedEmails] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [showContacts, setShowContacts] = useState(false);
  
  const queryClient = useQueryClient();

  // Cargar emails
  const { data: emails = [], isLoading: loadingEmails, refetch: refetchEmails } = useQuery({
    queryKey: ["emails", activeFolder],
    queryFn: async () => {
      if (activeFolder === "all") {
        return base44.entities.EmailMessage.list("-received_date", 200);
      }
      return base44.entities.EmailMessage.filter({ folder: activeFolder }, "-received_date", 100);
    }
  });

  // Cargar contactos
  const { data: contacts = [], refetch: refetchContacts } = useQuery({
    queryKey: ["emailContacts"],
    queryFn: () => base44.entities.EmailContact.list("-emails_received", 100)
  });

  // Contar emails por carpeta
  const { data: allEmails = [] } = useQuery({
    queryKey: ["allEmails"],
    queryFn: () => base44.entities.EmailMessage.list("-received_date", 500)
  });

  const folderCounts = FOLDERS.reduce((acc, folder) => {
    acc[folder.id] = allEmails.filter(e => e.folder === folder.id).length;
    return acc;
  }, {});

  const unreadCount = allEmails.filter(e => !e.is_read && e.folder !== 'spam' && e.folder !== 'papelera').length;

  // Sincronizar emails
  const handleSync = async () => {
    setSyncing(true);
    try {
      const response = await base44.functions.invoke("smartEmailProcessor");
      const data = response.data;
      
      if (data.success) {
        toast.success(`✅ ${data.results.new_emails} emails procesados`);
        refetchEmails();
        queryClient.invalidateQueries(["allEmails"]);
        refetchContacts();
      } else {
        toast.error(data.error || "Error sincronizando");
      }
    } catch (error) {
      toast.error("Error: " + error.message);
    } finally {
      setSyncing(false);
    }
  };

  // Mover email
  const moveEmail = async (emailId, newFolder) => {
    try {
      await base44.entities.EmailMessage.update(emailId, { folder: newFolder });
      toast.success(`Movido a ${newFolder}`);
      refetchEmails();
      queryClient.invalidateQueries(["allEmails"]);
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

  // Toggle contacto favorito
  const toggleContactFavorite = async (contactId, currentState) => {
    try {
      await base44.entities.EmailContact.update(contactId, { is_favorite: !currentState });
      toast.success(currentState ? "Quitado de favoritos" : "Añadido a favoritos");
      refetchContacts();
    } catch (error) {
      toast.error("Error actualizando");
    }
  };

  // Bloquear contacto
  const blockContact = async (contactId, currentState) => {
    try {
      await base44.entities.EmailContact.update(contactId, { is_blocked: !currentState });
      toast.success(currentState ? "Desbloqueado" : "Bloqueado");
      refetchContacts();
    } catch (error) {
      toast.error("Error actualizando");
    }
  };

  // Filtrar emails
  const filteredEmails = emails.filter(email => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      email.subject?.toLowerCase().includes(search) ||
      email.sender_name?.toLowerCase().includes(search) ||
      email.sender_email?.toLowerCase().includes(search)
    );
  });

  // Agrupar contactos
  const favoriteContacts = contacts.filter(c => c.is_favorite && !c.is_blocked);
  const blockedContacts = contacts.filter(c => c.is_blocked);
  const frequentContacts = contacts.filter(c => !c.is_favorite && !c.is_blocked && (c.emails_received || 0) >= 3);

  const getPriorityColor = (priority) => {
    switch (priority) {
      case "alta": return "bg-red-500";
      case "media": return "bg-yellow-500";
      case "baja": return "bg-green-500";
      default: return "bg-gray-500";
    }
  };

  const getCategoryBadge = (category) => {
    const colors = {
      factura: "bg-green-100 text-green-800",
      proveedor: "bg-purple-100 text-purple-800",
      cliente: "bg-blue-100 text-blue-800",
      rrhh: "bg-orange-100 text-orange-800",
      gestoria: "bg-cyan-100 text-cyan-800",
      spam: "bg-red-100 text-red-800",
      publicidad: "bg-pink-100 text-pink-800",
      personal: "bg-indigo-100 text-indigo-800",
      notificacion: "bg-gray-100 text-gray-800",
      otros: "bg-slate-100 text-slate-800"
    };
    return colors[category] || colors.otros;
  };

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-zinc-950 via-neutral-900 to-zinc-950">
      {/* Header */}
      <div className="p-4 border-b border-cyan-500/20 bg-black/50 backdrop-blur">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div 
              className="w-12 h-12 bg-black rounded-xl flex items-center justify-center border border-cyan-500/50"
              style={{ boxShadow: '0 0 20px rgba(6, 182, 212, 0.4)' }}
            >
              <Mail className="w-6 h-6 text-cyan-400" style={{ filter: 'drop-shadow(0 0 6px rgba(6, 182, 212, 0.8))' }} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-cyan-400" style={{ textShadow: '0 0 10px rgba(6, 182, 212, 0.6)' }}>Buzón Inteligente</h1>
              <p className="text-sm text-zinc-400">
                {unreadCount > 0 ? `${unreadCount} sin leer` : "Todo al día"} • {allEmails.length} emails
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:border-cyan-500/50"
              onClick={() => setShowContacts(true)}
            >
              <Users className="w-4 h-4 mr-2" />
              Contactos ({contacts.length})
            </Button>
            <Button
              onClick={handleSync}
              disabled={syncing}
              className="bg-black border border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10"
              style={{ boxShadow: '0 0 15px rgba(6, 182, 212, 0.3)' }}
            >
              {syncing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Sincronizar
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Carpetas */}
        <div className="w-64 bg-black/50 border-r border-cyan-500/20 p-4">
          <div className="space-y-1">
            {FOLDERS.map((folder) => (
              <button
                key={folder.id}
                onClick={() => setActiveFolder(folder.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all ${
                  activeFolder === folder.id
                    ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/50"
                    : "text-zinc-400 hover:bg-zinc-800/50 border border-transparent"
                }`}
                style={activeFolder === folder.id ? { boxShadow: '0 0 10px rgba(6, 182, 212, 0.2)' } : {}}
              >
                <div className="flex items-center gap-3">
                  <folder.icon className={`w-5 h-5 ${activeFolder === folder.id ? "text-cyan-400" : folder.color}`} />
                  <span className="font-medium">{folder.label}</span>
                </div>
                {folderCounts[folder.id] > 0 && (
                  <Badge className={`${
                    activeFolder === folder.id ? "bg-cyan-500/30 text-cyan-300" : "bg-zinc-800 text-zinc-400"
                  } text-xs`}>
                    {folderCounts[folder.id]}
                  </Badge>
                )}
              </button>
            ))}
          </div>

          {/* Contactos Favoritos */}
          <div className="mt-6 pt-4 border-t border-cyan-500/20">
            <h3 className="text-xs font-semibold text-cyan-400 uppercase mb-3 flex items-center gap-2">
              <Star className="w-3 h-3 text-cyan-400" />
              Favoritos
            </h3>
            <div className="space-y-2">
              {favoriteContacts.slice(0, 5).map((contact) => (
                <div
                  key={contact.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-zinc-800 cursor-pointer text-sm text-zinc-400"
                  onClick={() => setSearchTerm(contact.email)}
                >
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xs font-bold">
                    {contact.name?.charAt(0).toUpperCase() || "?"}
                  </div>
                  <span className="truncate">{contact.name || contact.email}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Lista de emails */}
        <div className="flex-1 flex flex-col">
          {/* Barra de búsqueda */}
          <div className="p-4 border-b border-zinc-800 bg-zinc-900/30">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
              <Input
                placeholder="Buscar emails..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
          </div>

          {/* Lista */}
          <ScrollArea className="flex-1">
            {loadingEmails ? (
              <div className="flex items-center justify-center h-40">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              </div>
            ) : filteredEmails.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-zinc-500">
                <Inbox className="w-12 h-12 mb-3 opacity-50" />
                <p>No hay emails en esta carpeta</p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-800/50">
                {filteredEmails.map((email) => (
                  <div
                    key={email.id}
                    onClick={() => {
                      setSelectedEmail(email);
                      if (!email.is_read) toggleRead(email.id, false);
                    }}
                    className={`flex items-start gap-4 p-4 cursor-pointer transition-all hover:bg-zinc-800/50 ${
                      !email.is_read ? "bg-zinc-800/30" : ""
                    } ${selectedEmail?.id === email.id ? "bg-blue-900/30 border-l-2 border-blue-500" : ""}`}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleStar(email.id, email.is_starred);
                        }}
                        className="hover:scale-110 transition-transform"
                      >
                        <Star
                          className={`w-5 h-5 ${
                            email.is_starred ? "fill-yellow-500 text-yellow-500" : "text-gray-500"
                          }`}
                        />
                      </button>
                      <div className={`w-2 h-2 rounded-full ${getPriorityColor(email.priority)}`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`font-medium truncate ${!email.is_read ? "text-white" : "text-zinc-400"}`}>
                          {email.sender_name || email.sender_email}
                        </span>
                        {email.has_attachments && (
                          <Paperclip className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                        )}
                        <Badge className={`${getCategoryBadge(email.category)} text-xs flex-shrink-0`}>
                          {email.category}
                        </Badge>
                      </div>
                      <p className={`text-sm truncate ${!email.is_read ? "text-zinc-300" : "text-zinc-500"}`}>
                        {email.subject}
                      </p>
                      {email.ai_summary && (
                        <p className="text-xs text-zinc-600 mt-1 truncate flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-purple-400" />
                          {email.ai_summary}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <span className="text-xs text-zinc-500">
                        {moment(email.received_date).fromNow()}
                      </span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                            <MoreVertical className="w-4 h-4 text-zinc-500" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-800">
                          <DropdownMenuItem onClick={() => moveEmail(email.id, "importantes")}>
                            <Star className="w-4 h-4 mr-2" /> Marcar importante
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => moveEmail(email.id, "archivado")}>
                            <Archive className="w-4 h-4 mr-2" /> Archivar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => moveEmail(email.id, "spam")}>
                            <AlertTriangle className="w-4 h-4 mr-2" /> Marcar spam
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => moveEmail(email.id, "papelera")} className="text-red-400">
                            <Trash2 className="w-4 h-4 mr-2" /> Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Panel de detalle */}
        {selectedEmail && (
          <div className="w-96 border-l border-zinc-800 bg-zinc-900/30 flex flex-col">
            <div className="p-4 border-b border-zinc-800">
              <div className="flex items-center justify-between mb-3">
                <Badge className={getCategoryBadge(selectedEmail.category)}>
                  {selectedEmail.category}
                </Badge>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => toggleStar(selectedEmail.id, selectedEmail.is_starred)}>
                    <Star className={`w-4 h-4 ${selectedEmail.is_starred ? "fill-yellow-500 text-yellow-500" : ""}`} />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => moveEmail(selectedEmail.id, "archivado")}>
                    <Archive className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => moveEmail(selectedEmail.id, "papelera")}>
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </Button>
                </div>
              </div>
              <h2 className="text-lg font-bold text-white mb-2">{selectedEmail.subject}</h2>
              <div className="flex items-center gap-2 text-sm text-zinc-400">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white font-bold">
                  {selectedEmail.sender_name?.charAt(0).toUpperCase() || "?"}
                </div>
                <div>
                  <p className="text-zinc-300">{selectedEmail.sender_name}</p>
                  <p className="text-xs">{selectedEmail.sender_email}</p>
                </div>
              </div>
              </div>

            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {selectedEmail.ai_summary && (
                  <div className="bg-purple-900/30 border border-purple-700/50 rounded-lg p-3">
                    <p className="text-xs text-purple-400 font-semibold mb-1 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> Resumen IA
                    </p>
                    <p className="text-sm text-zinc-300">{selectedEmail.ai_summary}</p>
                  </div>
                )}

                {selectedEmail.ai_action && (
                  <div className="bg-blue-900/30 border border-blue-700/50 rounded-lg p-3">
                    <p className="text-xs text-blue-400 font-semibold mb-1">💡 Acción sugerida</p>
                    <p className="text-sm text-zinc-300">{selectedEmail.ai_action}</p>
                  </div>
                )}

                <div className="bg-zinc-800/50 rounded-lg overflow-hidden min-h-[300px]">
                  {selectedEmail.html_body ? (
                    <div className="w-full h-full bg-white p-4">
                       <iframe 
                        srcDoc={selectedEmail.html_body}
                        className="w-full h-[600px] border-none"
                        title="Email Content"
                        sandbox="allow-same-origin"
                      />
                    </div>
                  ) : (
                    <div className="p-4">
                      <p className="text-sm text-zinc-300 whitespace-pre-wrap">
                        {selectedEmail.body_preview || "Sin contenido disponible"}
                      </p>
                    </div>
                  )}
                </div>

                {selectedEmail.has_attachments && (
                  <div className="bg-zinc-800/50 rounded-lg p-3">
                    <p className="text-xs text-zinc-500 font-semibold mb-2 flex items-center gap-1">
                      <Paperclip className="w-3 h-3" /> Adjuntos
                    </p>
                    <div className="space-y-2">
                      {(selectedEmail.attachments || []).map((att, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm text-zinc-300">
                          <FileText className="w-4 h-4 text-blue-400" />
                          {att.filename}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="text-xs text-zinc-500">
                  <p>Recibido: {moment(selectedEmail.received_date).format("DD MMM YYYY, HH:mm")}</p>
                  <p>Prioridad: {selectedEmail.priority}</p>
                </div>
                </div>
            </ScrollArea>
          </div>
        )}
      </div>

      {/* Dialog de Contactos */}
      <Dialog open={showContacts} onOpenChange={setShowContacts}>
        <DialogContent className="max-w-2xl bg-zinc-900 border-zinc-800 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Gestión de Contactos
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="favorites" className="mt-4">
            <TabsList className="bg-zinc-800">
              <TabsTrigger value="favorites">
                <Star className="w-4 h-4 mr-1" /> Favoritos ({favoriteContacts.length})
              </TabsTrigger>
              <TabsTrigger value="frequent">
                <Heart className="w-4 h-4 mr-1" /> Frecuentes ({frequentContacts.length})
              </TabsTrigger>
              <TabsTrigger value="blocked">
                <Ban className="w-4 h-4 mr-1" /> Bloqueados ({blockedContacts.length})
              </TabsTrigger>
              <TabsTrigger value="all">
                Todos ({contacts.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="favorites" className="mt-4">
              <ScrollArea className="h-80">
                {favoriteContacts.map((contact) => (
                  <ContactRow key={contact.id} contact={contact} onToggleFavorite={toggleContactFavorite} onBlock={blockContact} />
                ))}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="frequent" className="mt-4">
              <ScrollArea className="h-80">
                {frequentContacts.map((contact) => (
                  <ContactRow key={contact.id} contact={contact} onToggleFavorite={toggleContactFavorite} onBlock={blockContact} />
                ))}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="blocked" className="mt-4">
              <ScrollArea className="h-80">
                {blockedContacts.map((contact) => (
                  <ContactRow key={contact.id} contact={contact} onToggleFavorite={toggleContactFavorite} onBlock={blockContact} />
                ))}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="all" className="mt-4">
              <ScrollArea className="h-80">
                {contacts.map((contact) => (
                  <ContactRow key={contact.id} contact={contact} onToggleFavorite={toggleContactFavorite} onBlock={blockContact} />
                ))}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ContactRow({ contact, onToggleFavorite, onBlock }) {
  return (
    <div className="flex items-center justify-between p-3 hover:bg-zinc-800 rounded-lg mb-1">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white font-bold">
          {contact.name?.charAt(0).toUpperCase() || "?"}
        </div>
        <div>
          <p className="font-medium text-white">{contact.name || contact.email}</p>
          <p className="text-xs text-zinc-400">{contact.email}</p>
          <p className="text-xs text-zinc-500">{contact.emails_received || 0} emails recibidos</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge className={`text-xs ${
          contact.type === 'proveedor' ? 'bg-purple-600' :
          contact.type === 'cliente' ? 'bg-blue-600' :
          contact.type === 'spam' ? 'bg-red-600' : 'bg-gray-600'
        }`}>
          {contact.type}
        </Badge>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onToggleFavorite(contact.id, contact.is_favorite)}
        >
          <Star className={`w-4 h-4 ${contact.is_favorite ? "fill-yellow-500 text-yellow-500" : ""}`} />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onBlock(contact.id, contact.is_blocked)}
        >
          <Ban className={`w-4 h-4 ${contact.is_blocked ? "text-red-500" : ""}`} />
        </Button>
      </div>
    </div>
  );
}