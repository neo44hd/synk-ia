/**
 * SmartDocumentArchive - Módulo de Archivo Inteligente v2
 * Con OCR real, extracción automática de datos, validación y vinculación de proveedores
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  FileText,
  Search,
  Download,
  Calendar,
  Filter,
  HardDrive,
  User,
  Eye,
  Upload,
  Loader2,
  Bot,
  CheckCircle2,
  AlertCircle,
  Building2,
  ChevronRight,
  Trash2,
  ScanLine,
  Sparkles,
  FileCheck,
  FileWarning,
  RefreshCw,
  Link,
  Unlink,
  Plus,
  Settings,
  MoreVertical,
  X,
  Check,
  AlertTriangle,
  Percent,
  Euro,
  Hash,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  Receipt,
  FileSpreadsheet,
  Image,
  File,
  Truck,
  Scale,
  Briefcase,
  LayoutGrid,
  List,
  ChevronDown,
  Save,
  Edit2,
  Clock,
  History,
  ExternalLink,
  Zap,
  ArrowUpRight,
  Info,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { ocrService } from "@/services/ocrService";
import { invoiceExtractor, DOCUMENT_TYPES } from "@/services/invoiceExtractorService";

// Document type configuration
const DOC_TYPE_CONFIG = {
  factura: { label: "Factura", color: "orange", icon: Receipt, bgClass: "bg-orange-500/20", borderClass: "border-l-orange-500" },
  nomina: { label: "Nómina", color: "violet", icon: User, bgClass: "bg-violet-500/20", borderClass: "border-l-violet-500" },
  albaran: { label: "Albarán", color: "blue", icon: Truck, bgClass: "bg-blue-500/20", borderClass: "border-l-blue-500" },
  contrato: { label: "Contrato", color: "emerald", icon: Briefcase, bgClass: "bg-emerald-500/20", borderClass: "border-l-emerald-500" },
  legal: { label: "Legal", color: "cyan", icon: Scale, bgClass: "bg-cyan-500/20", borderClass: "border-l-cyan-500" },
  otros: { label: "Otros", color: "zinc", icon: File, bgClass: "bg-zinc-500/20", borderClass: "border-l-zinc-500" },
};

// Processing status configuration
const STATUS_CONFIG = {
  pending: { label: "Pendiente", color: "zinc", icon: Clock },
  processing: { label: "Procesando", color: "blue", icon: Loader2 },
  ocr_processing: { label: "OCR en curso", color: "purple", icon: ScanLine },
  extracting: { label: "Extrayendo datos", color: "amber", icon: Sparkles },
  validating: { label: "Validando", color: "yellow", icon: FileCheck },
  completed: { label: "Procesado", color: "green", icon: CheckCircle2 },
  error: { label: "Error", color: "red", icon: AlertCircle },
  needs_review: { label: "Revisar", color: "orange", icon: FileWarning },
};

export default function SmartDocumentArchive() {
  // State management
  const [viewMode, setViewMode] = useState("list"); // "list" or "grid"
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [detailFile, setDetailFile] = useState(null);
  const [editingData, setEditingData] = useState(null);
  const [showProviderDialog, setShowProviderDialog] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [newProviderData, setNewProviderData] = useState(null);
  const [showStatsDialog, setShowStatsDialog] = useState(false);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [providerFilter, setProviderFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  
  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // OCR state
  const [ocrProgress, setOcrProgress] = useState(null);
  const [processingQueue, setProcessingQueue] = useState([]);
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  
  // Refs
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();

  // OCR progress listener
  useEffect(() => {
    const unsubscribe = ocrService.addProgressListener((progress) => {
      setOcrProgress(progress);
    });
    return unsubscribe;
  }, []);

  // Fetch files
  const { data: files = [], isLoading } = useQuery({
    queryKey: ['smart-archive-files'],
    queryFn: () => base44.entities.UploadedFile.list('-upload_date', 1000),
    staleTime: 30000,
  });

  // Fetch providers for linking
  const { data: providers = [] } = useQuery({
    queryKey: ['providers'],
    queryFn: () => base44.entities.Provider.list(),
    staleTime: 60000,
  });

  // Process a single document with OCR and extraction
  const processDocument = async (file, options = {}) => {
    const { useOCR = true, forceReprocess = false } = options;
    
    try {
      // Update status to processing
      await base44.entities.UploadedFile.update(file.id, { 
        processing_status: 'processing',
        metadata: { ...file.metadata, processing_started: new Date().toISOString() }
      });

      let extractedText = "";
      let ocrConfidence = 0;
      let ocrMethod = "none";

      // Step 1: OCR if needed
      if (useOCR) {
        await base44.entities.UploadedFile.update(file.id, { processing_status: 'ocr_processing' });
        
        const ocrResult = await ocrService.processDocument(file.file_url, file.content_type);
        
        if (ocrResult.success) {
          extractedText = ocrResult.text;
          ocrConfidence = ocrResult.confidence;
          ocrMethod = ocrResult.pages ? 
            (ocrResult.pages.some(p => p.method === 'ocr') ? 'ocr' : 'direct') : 
            'ocr';
        }
      }

      // Step 2: Extract structured data
      await base44.entities.UploadedFile.update(file.id, { processing_status: 'extracting' });
      
      let extractedData = null;
      if (extractedText.length > 50) {
        // Use our regex extractor first
        extractedData = invoiceExtractor.extractInvoiceData(extractedText);
      }

      // Step 3: Use AI for additional extraction if needed
      if (!extractedData || extractedData.confidence < 50) {
        try {
          const aiResult = await base44.integrations.Core.ExtractDataFromUploadedFile({
            file_url: file.file_url,
            json_schema: {
              type: "object",
              properties: {
                document_type: { type: "string", description: "Tipo: Factura, Nómina, Albarán, Contrato, Legal, Otros" },
                provider_name: { type: "string", description: "Nombre del proveedor/empresa emisora" },
                provider_cif: { type: "string", description: "CIF/NIF del proveedor" },
                invoice_number: { type: "string", description: "Número de factura/documento" },
                document_date: { type: "string", description: "Fecha de emisión YYYY-MM-DD" },
                due_date: { type: "string", description: "Fecha de vencimiento YYYY-MM-DD" },
                subtotal: { type: "number", description: "Base imponible sin IVA" },
                iva_amount: { type: "number", description: "Importe del IVA" },
                iva_percentage: { type: "number", description: "Porcentaje de IVA" },
                total: { type: "number", description: "Total con IVA" },
                payment_method: { type: "string", description: "Forma de pago" },
                provider_address: { type: "string", description: "Dirección del proveedor" },
                provider_phone: { type: "string", description: "Teléfono" },
                provider_email: { type: "string", description: "Email" },
                concepts: { type: "array", description: "Lista de conceptos/productos", items: { type: "object" } },
                summary: { type: "string", description: "Resumen breve del documento" }
              }
            }
          });

          if (aiResult.status === "success" && aiResult.output) {
            // Merge AI results with regex results
            extractedData = mergeExtractionResults(extractedData, aiResult.output);
          }
        } catch (aiError) {
          console.warn("AI extraction failed, using regex results:", aiError);
        }
      }

      // Step 4: Validate data
      await base44.entities.UploadedFile.update(file.id, { processing_status: 'validating' });
      
      const validation = extractedData ? invoiceExtractor.validateExtractedData(extractedData) : { isComplete: false, missingCritical: ['Todos los datos'] };
      const confidence = extractedData?.confidence || 0;

      // Step 5: Determine final status
      const finalStatus = validation.isComplete && confidence >= 60 ? 'completed' : 
                         confidence >= 30 ? 'needs_review' : 'error';

      // Step 6: Try to link provider
      let providerLink = null;
      if (extractedData?.provider?.cif?.value || extractedData?.provider?.name?.value) {
        providerLink = await findOrCreateProvider(extractedData.provider, file);
      }

      // Step 7: Update file with all extracted data
      await base44.entities.UploadedFile.update(file.id, {
        processing_status: finalStatus,
        detected_type: extractedData?.documentType?.label || 'Otros',
        metadata: {
          ...file.metadata,
          ocr: {
            text: extractedText.substring(0, 10000), // Limit stored text
            confidence: ocrConfidence,
            method: ocrMethod,
            processed_at: new Date().toISOString()
          },
          extracted: {
            invoiceNumber: extractedData?.invoiceNumber?.value,
            invoiceDate: extractedData?.invoiceDate?.value,
            dueDate: extractedData?.dueDate?.value,
            provider: extractedData?.provider?.name?.value,
            providerCif: extractedData?.provider?.cif?.value,
            providerAddress: extractedData?.provider?.address?.value,
            providerPhone: extractedData?.provider?.phone?.value,
            providerEmail: extractedData?.provider?.email?.value,
            subtotal: extractedData?.subtotal?.value,
            iva: extractedData?.iva?.value,
            ivaPercentage: extractedData?.iva?.percentage,
            total: extractedData?.total?.value,
            paymentMethod: extractedData?.paymentMethod?.value,
            concepts: extractedData?.concepts,
          },
          validation: validation,
          confidence: confidence,
          providerLink: providerLink,
          processing_completed: new Date().toISOString()
        }
      });

      return { success: true, file, extractedData, providerLink };
    } catch (error) {
      console.error("Document processing error:", error);
      await base44.entities.UploadedFile.update(file.id, {
        processing_status: 'error',
        metadata: { ...file.metadata, error: error.message }
      });
      throw error;
    }
  };

  // Merge regex and AI extraction results
  const mergeExtractionResults = (regexData, aiData) => {
    if (!regexData) {
      return {
        documentType: DOCUMENT_TYPES[aiData.document_type?.toLowerCase()] || DOCUMENT_TYPES.OTROS,
        invoiceNumber: { value: aiData.invoice_number, confidence: 70 },
        invoiceDate: { value: aiData.document_date, confidence: 70 },
        dueDate: { value: aiData.due_date, confidence: 70 },
        provider: {
          name: { value: aiData.provider_name, confidence: 70 },
          cif: { value: aiData.provider_cif, confidence: 70, valid: invoiceExtractor.validateCIF(aiData.provider_cif) },
          address: { value: aiData.provider_address, confidence: 60 },
          phone: { value: aiData.provider_phone, confidence: 60 },
          email: { value: aiData.provider_email, confidence: 60 },
        },
        subtotal: { value: aiData.subtotal, confidence: 70 },
        iva: { value: aiData.iva_amount, percentage: aiData.iva_percentage, confidence: 70 },
        total: { value: aiData.total, confidence: 70 },
        paymentMethod: { value: aiData.payment_method, confidence: 60 },
        concepts: aiData.concepts || [],
        confidence: 65
      };
    }

    // Prefer regex results when available, fill gaps with AI
    return {
      ...regexData,
      invoiceNumber: regexData.invoiceNumber?.value ? regexData.invoiceNumber : { value: aiData.invoice_number, confidence: 70 },
      invoiceDate: regexData.invoiceDate?.value ? regexData.invoiceDate : { value: aiData.document_date, confidence: 70 },
      provider: {
        name: regexData.provider?.name?.value ? regexData.provider.name : { value: aiData.provider_name, confidence: 70 },
        cif: regexData.provider?.cif?.value ? regexData.provider.cif : { value: aiData.provider_cif, confidence: 70, valid: invoiceExtractor.validateCIF(aiData.provider_cif) },
        address: regexData.provider?.address?.value ? regexData.provider.address : { value: aiData.provider_address, confidence: 60 },
        phone: regexData.provider?.phone?.value ? regexData.provider.phone : { value: aiData.provider_phone, confidence: 60 },
        email: regexData.provider?.email?.value ? regexData.provider.email : { value: aiData.provider_email, confidence: 60 },
      },
      total: regexData.total?.value ? regexData.total : { value: aiData.total, confidence: 70 },
      confidence: Math.max(regexData.confidence || 0, 65)
    };
  };

  // Find or create provider
  const findOrCreateProvider = async (providerData, file) => {
    const cif = providerData?.cif?.value;
    const name = providerData?.name?.value;

    if (!cif && !name) return null;

    try {
      // Try to find by CIF first
      if (cif) {
        const byCif = await base44.entities.Provider.filter({ cif: cif });
        if (byCif.length > 0) {
          return { type: 'linked', id: byCif[0].id, name: byCif[0].name, method: 'cif' };
        }
      }

      // Try by name
      if (name) {
        const byName = await base44.entities.Provider.filter({ name: name });
        if (byName.length > 0) {
          return { type: 'linked', id: byName[0].id, name: byName[0].name, method: 'name' };
        }
      }

      // Create new provider
      const newProvider = await base44.entities.Provider.create({
        name: name || 'Proveedor sin nombre',
        cif: cif || '',
        address: providerData?.address?.value || '',
        phone: providerData?.phone?.value || '',
        email: providerData?.email?.value || '',
        category: 'otros',
        status: 'activo',
        created_from_document: file.id,
        auto_created: true
      });

      toast.success(`Nuevo proveedor creado: ${newProvider.name}`);
      
      return { type: 'created', id: newProvider.id, name: newProvider.name, method: 'auto' };
    } catch (error) {
      console.error("Error finding/creating provider:", error);
      return null;
    }
  };

  // Process mutation
  const processMutation = useMutation({
    mutationFn: (file) => processDocument(file, { useOCR: true }),
    onSuccess: (result) => {
      toast.success(`Documento procesado: ${result.file.filename}`);
      queryClient.invalidateQueries({ queryKey: ['smart-archive-files'] });
      queryClient.invalidateQueries({ queryKey: ['providers'] });
    },
    onError: (error, file) => {
      toast.error(`Error procesando ${file.filename}: ${error.message}`);
    }
  });

  // Batch process
  const handleProcessBatch = async () => {
    const pendingFiles = files.filter(f => f.processing_status !== 'completed' && f.processing_status !== 'processing');
    if (pendingFiles.length === 0) {
      toast.info("No hay archivos pendientes");
      return;
    }

    setIsProcessingBatch(true);
    setProcessingQueue(pendingFiles.map(f => f.id));

    let processed = 0;
    for (const file of pendingFiles) {
      try {
        await processDocument(file, { useOCR: true });
        processed++;
      } catch (error) {
        console.error(`Error batch processing ${file.filename}:`, error);
      }
      setProcessingQueue(prev => prev.filter(id => id !== file.id));
    }

    setIsProcessingBatch(false);
    toast.success(`Lote completado: ${processed}/${pendingFiles.length} archivos`);
    queryClient.invalidateQueries({ queryKey: ['smart-archive-files'] });
  };

  // File upload handler
  const handleFileUpload = async (fileList) => {
    setIsUploading(true);
    setUploadProgress(0);
    const filesToUpload = Array.from(fileList);
    let uploaded = 0;

    for (let i = 0; i < filesToUpload.length; i++) {
      const file = filesToUpload[i];
      try {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        
        await base44.entities.UploadedFile.create({
          filename: file.name,
          file_url: file_url,
          source: "Archivo Inteligente",
          upload_date: new Date().toISOString(),
          uploaded_by: "Usuario",
          size: file.size,
          content_type: file.type,
          processing_status: 'pending'
        });

        uploaded++;
        setUploadProgress(Math.round(((i + 1) / filesToUpload.length) * 100));
      } catch (error) {
        console.error(`Error uploading ${file.name}:`, error);
        toast.error(`Error subiendo ${file.name}`);
      }
    }

    setIsUploading(false);
    setUploadProgress(0);
    
    if (uploaded > 0) {
      toast.success(`${uploaded} archivo(s) subido(s). Listos para procesar.`);
      queryClient.invalidateQueries({ queryKey: ['smart-archive-files'] });
    }
  };

  // Drag and drop handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.length > 0) {
      handleFileUpload(e.dataTransfer.files);
    }
  };

  // Delete file
  const handleDeleteFile = async (fileId) => {
    if (!confirm("¿Eliminar este archivo?")) return;
    try {
      await base44.entities.UploadedFile.delete(fileId);
      toast.success("Archivo eliminado");
      queryClient.invalidateQueries({ queryKey: ['smart-archive-files'] });
      if (detailFile?.id === fileId) setDetailFile(null);
    } catch (error) {
      toast.error("Error al eliminar: " + error.message);
    }
  };

  // Save edited data
  const handleSaveEditedData = async () => {
    if (!detailFile || !editingData) return;
    
    try {
      await base44.entities.UploadedFile.update(detailFile.id, {
        metadata: {
          ...detailFile.metadata,
          extracted: editingData,
          manually_edited: true,
          edited_at: new Date().toISOString()
        }
      });
      
      toast.success("Datos guardados");
      setEditingData(null);
      queryClient.invalidateQueries({ queryKey: ['smart-archive-files'] });
    } catch (error) {
      toast.error("Error al guardar: " + error.message);
    }
  };

  // Link to provider
  const handleLinkProvider = async (providerId) => {
    if (!detailFile) return;
    
    try {
      const provider = providers.find(p => p.id === providerId);
      await base44.entities.UploadedFile.update(detailFile.id, {
        metadata: {
          ...detailFile.metadata,
          providerLink: { type: 'linked', id: providerId, name: provider?.name, method: 'manual' }
        }
      });
      
      toast.success(`Vinculado a: ${provider?.name}`);
      setShowProviderDialog(false);
      queryClient.invalidateQueries({ queryKey: ['smart-archive-files'] });
    } catch (error) {
      toast.error("Error al vincular: " + error.message);
    }
  };

  // Unlink provider
  const handleUnlinkProvider = async () => {
    if (!detailFile) return;
    
    try {
      await base44.entities.UploadedFile.update(detailFile.id, {
        metadata: {
          ...detailFile.metadata,
          providerLink: null
        }
      });
      
      toast.success("Proveedor desvinculado");
      queryClient.invalidateQueries({ queryKey: ['smart-archive-files'] });
    } catch (error) {
      toast.error("Error: " + error.message);
    }
  };

  // Filter files
  const filteredFiles = files.filter(file => {
    const meta = file.metadata || {};
    const ext = meta.extracted || {};
    
    // Search query
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matches = 
        file.filename?.toLowerCase().includes(q) ||
        ext.provider?.toLowerCase().includes(q) ||
        ext.invoiceNumber?.toLowerCase().includes(q) ||
        ext.providerCif?.toLowerCase().includes(q);
      if (!matches) return false;
    }
    
    // Type filter
    if (typeFilter !== "all") {
      const detectedType = (file.detected_type || "").toLowerCase();
      if (!detectedType.includes(typeFilter)) return false;
    }
    
    // Status filter
    if (statusFilter !== "all") {
      if (file.processing_status !== statusFilter) return false;
    }
    
    // Provider filter
    if (providerFilter) {
      const provider = ext.provider?.toLowerCase() || "";
      if (!provider.includes(providerFilter.toLowerCase())) return false;
    }
    
    // Amount range
    if (amountMin && ext.total && ext.total < parseFloat(amountMin)) return false;
    if (amountMax && ext.total && ext.total > parseFloat(amountMax)) return false;
    
    // Date range
    if (dateFrom && ext.invoiceDate && ext.invoiceDate < dateFrom) return false;
    if (dateTo && ext.invoiceDate && ext.invoiceDate > dateTo) return false;
    
    return true;
  });

  // Stats
  const stats = {
    total: files.length,
    pending: files.filter(f => f.processing_status === 'pending').length,
    processing: files.filter(f => ['processing', 'ocr_processing', 'extracting', 'validating'].includes(f.processing_status)).length,
    completed: files.filter(f => f.processing_status === 'completed').length,
    needsReview: files.filter(f => f.processing_status === 'needs_review').length,
    errors: files.filter(f => f.processing_status === 'error').length,
    facturas: files.filter(f => f.detected_type?.toLowerCase().includes('factura')).length,
    nominas: files.filter(f => f.detected_type?.toLowerCase().includes('nómina')).length,
  };

  // Get document type config
  const getDocTypeConfig = (file) => {
    const type = (file.detected_type || "").toLowerCase();
    if (type.includes('factura')) return DOC_TYPE_CONFIG.factura;
    if (type.includes('nómina') || type.includes('nomina')) return DOC_TYPE_CONFIG.nomina;
    if (type.includes('albarán') || type.includes('albaran')) return DOC_TYPE_CONFIG.albaran;
    if (type.includes('contrato')) return DOC_TYPE_CONFIG.contrato;
    if (type.includes('legal') || type.includes('escritura')) return DOC_TYPE_CONFIG.legal;
    return DOC_TYPE_CONFIG.otros;
  };

  // Get status config
  const getStatusConfig = (status) => {
    return STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  };

  // Format currency
  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined) return "-";
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    try {
      return format(new Date(dateStr), "dd MMM yyyy", { locale: es });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="p-4 md:p-6 min-h-screen bg-gradient-to-br from-zinc-950 via-neutral-900 to-zinc-950 text-white">
      <div className="max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-white flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center">
                <HardDrive className="w-5 h-5 text-white" />
              </div>
              <span>Archivo <span className="text-cyan-400">Inteligente</span></span>
            </h1>
            <p className="text-zinc-400 mt-1 text-sm">
              OCR automático • Extracción de datos • Vinculación de proveedores
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            {/* Stats badges */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2" onClick={() => setShowStatsDialog(true)}>
                    <FileText className="w-4 h-4 text-zinc-400" />
                    <span className="font-bold">{stats.total}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Total de documentos</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            {stats.pending > 0 && (
              <Badge variant="outline" className="bg-zinc-800/50 border-zinc-700">
                <Clock className="w-3 h-3 mr-1" /> {stats.pending} pendientes
              </Badge>
            )}
            {stats.processing > 0 && (
              <Badge className="bg-blue-500/20 border-blue-500/30 text-blue-400">
                <Loader2 className="w-3 h-3 mr-1 animate-spin" /> {stats.processing} procesando
              </Badge>
            )}
            {stats.needsReview > 0 && (
              <Badge className="bg-orange-500/20 border-orange-500/30 text-orange-400">
                <AlertTriangle className="w-3 h-3 mr-1" /> {stats.needsReview} revisar
              </Badge>
            )}
            
            <Separator orientation="vertical" className="h-6 bg-zinc-800" />
            
            {/* Actions */}
            <Button
              onClick={handleProcessBatch}
              disabled={isProcessingBatch || stats.pending === 0}
              className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700"
            >
              {isProcessingBatch ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Procesando...</>
              ) : (
                <><Zap className="w-4 h-4 mr-2" /> Procesar Todo</>
              )}
            </Button>
          </div>
        </div>

        {/* OCR Progress */}
        {ocrProgress && ocrProgress.status !== 'ready' && (
          <Card className="mb-4 bg-purple-900/20 border-purple-500/30">
            <CardContent className="py-3 px-4">
              <div className="flex items-center gap-3">
                <ScanLine className="w-5 h-5 text-purple-400 animate-pulse" />
                <div className="flex-1">
                  <p className="text-sm text-purple-300">{ocrProgress.message}</p>
                  <Progress value={ocrProgress.progress} className="h-1 mt-1" />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Upload Zone */}
        <Card
          className={`mb-6 border-2 border-dashed transition-all duration-300 ${
            dragActive 
              ? 'border-cyan-500 bg-cyan-900/20 scale-[1.01]' 
              : 'border-zinc-800 bg-zinc-900/30 hover:border-zinc-700'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-all ${
              dragActive ? 'bg-cyan-500/20 scale-110' : 'bg-zinc-800'
            }`}>
              {isUploading ? (
                <Loader2 className="w-7 h-7 text-cyan-400 animate-spin" />
              ) : (
                <Upload className={`w-7 h-7 ${dragActive ? 'text-cyan-400' : 'text-zinc-400'}`} />
              )}
            </div>
            
            {isUploading ? (
              <>
                <p className="text-white font-medium mb-2">Subiendo archivos...</p>
                <Progress value={uploadProgress} className="w-48 h-2" />
              </>
            ) : (
              <>
                <h3 className="text-lg font-bold text-white mb-1">
                  {dragActive ? "Suelta los archivos aquí" : "Arrastra documentos aquí"}
                </h3>
                <p className="text-zinc-500 text-sm mb-4">
                  PDF, imágenes (JPG, PNG) • OCR automático • Extracción con IA
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png,.gif,.bmp,.webp,.tiff"
                  className="hidden"
                  onChange={(e) => handleFileUpload(e.target.files)}
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  variant="outline"
                  className="border-zinc-700 hover:bg-zinc-800"
                >
                  <Plus className="w-4 h-4 mr-2" /> Seleccionar Archivos
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Filters */}
        <Card className="mb-4 bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-3">
            <div className="flex flex-wrap items-center gap-3">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <Input
                  placeholder="Buscar documento, proveedor, CIF..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-zinc-950 border-zinc-800 h-9"
                />
              </div>
              
              {/* Type filter */}
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[140px] h-9 bg-zinc-950 border-zinc-800">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800">
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="factura">Facturas</SelectItem>
                  <SelectItem value="nómina">Nóminas</SelectItem>
                  <SelectItem value="albarán">Albaranes</SelectItem>
                  <SelectItem value="contrato">Contratos</SelectItem>
                  <SelectItem value="legal">Legal</SelectItem>
                </SelectContent>
              </Select>
              
              {/* Status filter */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px] h-9 bg-zinc-950 border-zinc-800">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800">
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="completed">Procesado</SelectItem>
                  <SelectItem value="needs_review">Revisar</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
              
              {/* More filters toggle */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className={showFilters ? "bg-zinc-800" : ""}
              >
                <Filter className="w-4 h-4 mr-1" />
                Filtros
                <ChevronDown className={`w-4 h-4 ml-1 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
              </Button>
              
              {/* View mode toggle */}
              <div className="flex border border-zinc-800 rounded-md">
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-9 w-9 rounded-r-none ${viewMode === 'list' ? 'bg-zinc-800' : ''}`}
                  onClick={() => setViewMode('list')}
                >
                  <List className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-9 w-9 rounded-l-none ${viewMode === 'grid' ? 'bg-zinc-800' : ''}`}
                  onClick={() => setViewMode('grid')}
                >
                  <LayoutGrid className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            {/* Extended filters */}
            {showFilters && (
              <div className="mt-3 pt-3 border-t border-zinc-800 grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <Label className="text-xs text-zinc-500">Proveedor</Label>
                  <Input
                    placeholder="Nombre proveedor"
                    value={providerFilter}
                    onChange={(e) => setProviderFilter(e.target.value)}
                    className="h-8 bg-zinc-950 border-zinc-800 mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs text-zinc-500">Importe mín.</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={amountMin}
                    onChange={(e) => setAmountMin(e.target.value)}
                    className="h-8 bg-zinc-950 border-zinc-800 mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs text-zinc-500">Importe máx.</Label>
                  <Input
                    type="number"
                    placeholder="∞"
                    value={amountMax}
                    onChange={(e) => setAmountMax(e.target.value)}
                    className="h-8 bg-zinc-950 border-zinc-800 mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs text-zinc-500">Fecha desde</Label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="h-8 bg-zinc-950 border-zinc-800 mt-1 [color-scheme:dark]"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results count */}
        <div className="flex justify-between items-center mb-3">
          <p className="text-sm text-zinc-500">
            {filteredFiles.length === files.length 
              ? `${files.length} documentos`
              : `${filteredFiles.length} de ${files.length} documentos`
            }
          </p>
          {selectedFiles.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-400">{selectedFiles.length} seleccionados</span>
              <Button size="sm" variant="destructive" onClick={() => {
                if (confirm(`¿Eliminar ${selectedFiles.length} archivos?`)) {
                  selectedFiles.forEach(id => handleDeleteFile(id));
                  setSelectedFiles([]);
                }
              }}>
                <Trash2 className="w-4 h-4 mr-1" /> Eliminar
              </Button>
            </div>
          )}
        </div>

        {/* Documents List/Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
          </div>
        ) : filteredFiles.length === 0 ? (
          <Card className="bg-zinc-900/30 border-zinc-800">
            <CardContent className="py-16 text-center">
              <FileText className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-zinc-400">No hay documentos</h3>
              <p className="text-zinc-600 text-sm">Sube documentos para comenzar</p>
            </CardContent>
          </Card>
        ) : viewMode === 'list' ? (
          <Card className="bg-zinc-900/30 border-zinc-800 overflow-hidden">
            <ScrollArea className="h-[calc(100vh-400px)]">
              <div className="divide-y divide-zinc-800/50">
                {filteredFiles.map((file) => {
                  const docType = getDocTypeConfig(file);
                  const status = getStatusConfig(file.processing_status);
                  const meta = file.metadata || {};
                  const ext = meta.extracted || {};
                  const isProcessing = processingQueue.includes(file.id);
                  const StatusIcon = status.icon;
                  const DocIcon = docType.icon;
                  
                  return (
                    <div
                      key={file.id}
                      className={`p-3 hover:bg-zinc-800/30 transition-colors cursor-pointer border-l-4 ${docType.borderClass}`}
                      onClick={() => setDetailFile(file)}
                    >
                      <div className="flex items-center gap-3">
                        {/* Checkbox */}
                        <Checkbox
                          checked={selectedFiles.includes(file.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedFiles([...selectedFiles, file.id]);
                            } else {
                              setSelectedFiles(selectedFiles.filter(id => id !== file.id));
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="border-zinc-700"
                        />
                        
                        {/* Icon/Thumbnail */}
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${docType.bgClass}`}>
                          <DocIcon className={`w-5 h-5 text-${docType.color}-400`} />
                        </div>
                        
                        {/* Main info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-white truncate">{file.filename}</p>
                            {meta.confidence && (
                              <Badge variant="outline" className={`text-xs ${
                                meta.confidence >= 80 ? 'text-green-400 border-green-500/30' :
                                meta.confidence >= 50 ? 'text-yellow-400 border-yellow-500/30' :
                                'text-red-400 border-red-500/30'
                              }`}>
                                <Percent className="w-3 h-3 mr-1" />{meta.confidence}%
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-zinc-500 mt-0.5">
                            {ext.provider && (
                              <span className="flex items-center gap-1">
                                <Building2 className="w-3 h-3" /> {ext.provider}
                              </span>
                            )}
                            {ext.invoiceNumber && (
                              <span className="flex items-center gap-1">
                                <Hash className="w-3 h-3" /> {ext.invoiceNumber}
                              </span>
                            )}
                            {ext.invoiceDate && (
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" /> {formatDate(ext.invoiceDate)}
                              </span>
                            )}
                          </div>
                        </div>
                        
                        {/* Amount */}
                        <div className="text-right flex-shrink-0">
                          {ext.total ? (
                            <p className="font-mono font-bold text-white">{formatCurrency(ext.total)}</p>
                          ) : (
                            <span className="text-zinc-600">-</span>
                          )}
                        </div>
                        
                        {/* Status */}
                        <div className="flex-shrink-0 w-28">
                          <Badge className={`bg-${status.color}-500/20 text-${status.color}-400 border-${status.color}-500/30`}>
                            <StatusIcon className={`w-3 h-3 mr-1 ${file.processing_status === 'processing' || isProcessing ? 'animate-spin' : ''}`} />
                            {status.label}
                          </Badge>
                        </div>
                        
                        {/* Provider link indicator */}
                        {meta.providerLink && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <Link className="w-4 h-4 text-cyan-400" />
                              </TooltipTrigger>
                              <TooltipContent>Vinculado a: {meta.providerLink.name}</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        
                        {/* Actions */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-800">
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setDetailFile(file); }}>
                              <Eye className="w-4 h-4 mr-2" /> Ver detalles
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); processMutation.mutate(file); }}>
                              <RefreshCw className="w-4 h-4 mr-2" /> Re-procesar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); window.open(file.file_url, '_blank'); }}>
                              <Download className="w-4 h-4 mr-2" /> Descargar
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-zinc-800" />
                            <DropdownMenuItem 
                              className="text-red-400"
                              onClick={(e) => { e.stopPropagation(); handleDeleteFile(file.id); }}
                            >
                              <Trash2 className="w-4 h-4 mr-2" /> Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </Card>
        ) : (
          // Grid View
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredFiles.map((file) => {
              const docType = getDocTypeConfig(file);
              const status = getStatusConfig(file.processing_status);
              const meta = file.metadata || {};
              const ext = meta.extracted || {};
              const DocIcon = docType.icon;
              
              const isImage = file.content_type?.startsWith('image/');
              
              return (
                <Card
                  key={file.id}
                  className={`bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 cursor-pointer transition-all hover:scale-[1.02] overflow-hidden`}
                  onClick={() => setDetailFile(file)}
                >
                  {/* Thumbnail */}
                  <div className={`h-32 flex items-center justify-center ${docType.bgClass}`}>
                    {isImage ? (
                      <img
                        src={file.file_url}
                        alt={file.filename}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <DocIcon className={`w-12 h-12 text-${docType.color}-400/50`} />
                    )}
                  </div>
                  
                  <CardContent className="p-3">
                    <p className="font-medium text-white text-sm truncate">{file.filename}</p>
                    {ext.provider && (
                      <p className="text-xs text-zinc-500 truncate mt-1">{ext.provider}</p>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      {ext.total ? (
                        <span className="font-mono text-sm font-bold text-white">{formatCurrency(ext.total)}</span>
                      ) : (
                        <span className="text-xs text-zinc-600">Sin importe</span>
                      )}
                      <Badge variant="outline" className={`text-xs ${
                        status.color === 'green' ? 'text-green-400' :
                        status.color === 'red' ? 'text-red-400' :
                        status.color === 'orange' ? 'text-orange-400' :
                        'text-zinc-400'
                      }`}>
                        {status.label}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Detail Sheet */}
        <Sheet open={!!detailFile} onOpenChange={(open) => !open && setDetailFile(null)}>
          <SheetContent className="w-full sm:max-w-2xl bg-zinc-950 border-zinc-800 overflow-y-auto">
            {detailFile && (
              <DocumentDetailView
                file={detailFile}
                providers={providers}
                editingData={editingData}
                setEditingData={setEditingData}
                onSave={handleSaveEditedData}
                onReprocess={() => processMutation.mutate(detailFile)}
                onLinkProvider={() => setShowProviderDialog(true)}
                onUnlinkProvider={handleUnlinkProvider}
                onDelete={() => handleDeleteFile(detailFile.id)}
                formatCurrency={formatCurrency}
                formatDate={formatDate}
                getDocTypeConfig={getDocTypeConfig}
                getStatusConfig={getStatusConfig}
              />
            )}
          </SheetContent>
        </Sheet>

        {/* Provider Link Dialog */}
        <Dialog open={showProviderDialog} onOpenChange={setShowProviderDialog}>
          <DialogContent className="bg-zinc-950 border-zinc-800">
            <DialogHeader>
              <DialogTitle>Vincular Proveedor</DialogTitle>
              <DialogDescription>
                Selecciona un proveedor existente o crea uno nuevo
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label>Buscar proveedor</Label>
              <Input
                placeholder="Nombre o CIF..."
                className="bg-zinc-900 border-zinc-800 mt-2"
              />
              <ScrollArea className="h-[200px] mt-3">
                {providers.map((provider) => (
                  <div
                    key={provider.id}
                    className="p-3 hover:bg-zinc-800/50 rounded-lg cursor-pointer flex items-center justify-between"
                    onClick={() => handleLinkProvider(provider.id)}
                  >
                    <div>
                      <p className="font-medium text-white">{provider.name}</p>
                      <p className="text-xs text-zinc-500">{provider.cif}</p>
                    </div>
                    <Button size="sm" variant="ghost">
                      <Link className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </ScrollArea>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowProviderDialog(false)}>
                Cancelar
              </Button>
              <Button className="bg-cyan-600 hover:bg-cyan-700">
                <Plus className="w-4 h-4 mr-2" /> Crear Nuevo
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Stats Dialog */}
        <Dialog open={showStatsDialog} onOpenChange={setShowStatsDialog}>
          <DialogContent className="bg-zinc-950 border-zinc-800 max-w-lg">
            <DialogHeader>
              <DialogTitle>Estadísticas del Archivo</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-4">
              <StatCard label="Total" value={stats.total} icon={FileText} />
              <StatCard label="Procesados" value={stats.completed} icon={CheckCircle2} color="green" />
              <StatCard label="Pendientes" value={stats.pending} icon={Clock} color="zinc" />
              <StatCard label="Por revisar" value={stats.needsReview} icon={AlertTriangle} color="orange" />
              <StatCard label="Facturas" value={stats.facturas} icon={Receipt} color="orange" />
              <StatCard label="Nóminas" value={stats.nominas} icon={User} color="violet" />
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

// Document Detail View Component
function DocumentDetailView({
  file,
  providers,
  editingData,
  setEditingData,
  onSave,
  onReprocess,
  onLinkProvider,
  onUnlinkProvider,
  onDelete,
  formatCurrency,
  formatDate,
  getDocTypeConfig,
  getStatusConfig,
}) {
  const meta = file.metadata || {};
  const ext = editingData || meta.extracted || {};
  const ocr = meta.ocr || {};
  const validation = meta.validation || {};
  const docType = getDocTypeConfig(file);
  const status = getStatusConfig(file.processing_status);
  const StatusIcon = status.icon;
  const DocIcon = docType.icon;
  
  const isPdf = file.content_type === 'application/pdf' || file.filename?.toLowerCase().endsWith('.pdf');
  const isImage = file.content_type?.startsWith('image/');
  
  const startEditing = () => {
    setEditingData({ ...ext });
  };
  
  const cancelEditing = () => {
    setEditingData(null);
  };

  return (
    <>
      <SheetHeader className="pb-4 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${docType.bgClass}`}>
            <DocIcon className={`w-6 h-6 text-${docType.color}-400`} />
          </div>
          <div className="flex-1 min-w-0">
            <SheetTitle className="text-white truncate">{file.filename}</SheetTitle>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={`bg-${status.color}-500/20 text-${status.color}-400`}>
                <StatusIcon className="w-3 h-3 mr-1" /> {status.label}
              </Badge>
              {meta.confidence && (
                <Badge variant="outline" className={`text-xs ${
                  meta.confidence >= 80 ? 'text-green-400' :
                  meta.confidence >= 50 ? 'text-yellow-400' : 'text-red-400'
                }`}>
                  {meta.confidence}% confianza
                </Badge>
              )}
            </div>
          </div>
        </div>
      </SheetHeader>

      <Tabs defaultValue="data" className="mt-4">
        <TabsList className="bg-zinc-900 border border-zinc-800">
          <TabsTrigger value="data">Datos</TabsTrigger>
          <TabsTrigger value="preview">Vista previa</TabsTrigger>
          <TabsTrigger value="ocr">OCR</TabsTrigger>
        </TabsList>

        {/* Data Tab */}
        <TabsContent value="data" className="mt-4 space-y-4">
          {/* Validation warnings */}
          {validation.missingCritical?.length > 0 && (
            <Card className="bg-red-900/20 border-red-500/30">
              <CardContent className="p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-red-400">Datos críticos faltantes</p>
                    <p className="text-sm text-red-300/70">{validation.missingCritical.join(', ')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          
          {validation.warnings?.length > 0 && (
            <Card className="bg-yellow-900/20 border-yellow-500/30">
              <CardContent className="p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-yellow-400">Advertencias</p>
                    <ul className="text-sm text-yellow-300/70 list-disc list-inside">
                      {validation.warnings.map((w, i) => <li key={i}>{w}</li>)}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Provider section */}
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-zinc-400" /> Proveedor
                </span>
                {meta.providerLink ? (
                  <Button size="sm" variant="ghost" onClick={onUnlinkProvider} className="h-7 text-xs text-red-400">
                    <Unlink className="w-3 h-3 mr-1" /> Desvincular
                  </Button>
                ) : (
                  <Button size="sm" variant="ghost" onClick={onLinkProvider} className="h-7 text-xs text-cyan-400">
                    <Link className="w-3 h-3 mr-1" /> Vincular
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {meta.providerLink ? (
                <div className="flex items-center gap-3 p-3 bg-cyan-900/20 rounded-lg border border-cyan-500/30">
                  <CheckCircle2 className="w-5 h-5 text-cyan-400" />
                  <div>
                    <p className="font-medium text-white">{meta.providerLink.name}</p>
                    <p className="text-xs text-zinc-400">
                      Vinculado por {meta.providerLink.method === 'cif' ? 'CIF' : meta.providerLink.method === 'name' ? 'nombre' : 'manual'}
                      {meta.providerLink.type === 'created' && ' (nuevo)'}
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" className="ml-auto" onClick={() => window.open('/Providers', '_blank')}>
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <DataField
                    label="Nombre"
                    value={ext.provider}
                    editing={!!editingData}
                    onChange={(v) => setEditingData({ ...editingData, provider: v })}
                  />
                  <DataField
                    label="CIF/NIF"
                    value={ext.providerCif}
                    editing={!!editingData}
                    onChange={(v) => setEditingData({ ...editingData, providerCif: v })}
                    validation={meta.validation?.cifValid}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <DataField
                      label="Teléfono"
                      value={ext.providerPhone}
                      icon={Phone}
                      editing={!!editingData}
                      onChange={(v) => setEditingData({ ...editingData, providerPhone: v })}
                    />
                    <DataField
                      label="Email"
                      value={ext.providerEmail}
                      icon={Mail}
                      editing={!!editingData}
                      onChange={(v) => setEditingData({ ...editingData, providerEmail: v })}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Document data */}
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <Receipt className="w-4 h-4 text-zinc-400" /> Datos del Documento
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <DataField
                  label="Nº Factura"
                  value={ext.invoiceNumber}
                  icon={Hash}
                  editing={!!editingData}
                  onChange={(v) => setEditingData({ ...editingData, invoiceNumber: v })}
                />
                <DataField
                  label="Fecha"
                  value={ext.invoiceDate}
                  icon={Calendar}
                  editing={!!editingData}
                  onChange={(v) => setEditingData({ ...editingData, invoiceDate: v })}
                  type="date"
                />
              </div>
              <DataField
                label="Fecha vencimiento"
                value={ext.dueDate}
                icon={Calendar}
                editing={!!editingData}
                onChange={(v) => setEditingData({ ...editingData, dueDate: v })}
                type="date"
              />
            </CardContent>
          </Card>

          {/* Financial data */}
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <Euro className="w-4 h-4 text-zinc-400" /> Importes
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <DataField
                  label="Base imponible"
                  value={ext.subtotal}
                  type="currency"
                  editing={!!editingData}
                  onChange={(v) => setEditingData({ ...editingData, subtotal: parseFloat(v) })}
                />
                <DataField
                  label="IVA"
                  value={ext.iva}
                  type="currency"
                  editing={!!editingData}
                  onChange={(v) => setEditingData({ ...editingData, iva: parseFloat(v) })}
                  suffix={ext.ivaPercentage ? `(${ext.ivaPercentage}%)` : ''}
                />
              </div>
              <div className="p-3 bg-zinc-800/50 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Total</span>
                  {editingData ? (
                    <Input
                      type="number"
                      value={editingData.total || ''}
                      onChange={(e) => setEditingData({ ...editingData, total: parseFloat(e.target.value) })}
                      className="w-32 h-8 bg-zinc-900 border-zinc-700 text-right font-mono"
                    />
                  ) : (
                    <span className="text-xl font-bold text-white font-mono">
                      {formatCurrency(ext.total)}
                    </span>
                  )}
                </div>
              </div>
              <DataField
                label="Forma de pago"
                value={ext.paymentMethod}
                icon={CreditCard}
                editing={!!editingData}
                onChange={(v) => setEditingData({ ...editingData, paymentMethod: v })}
              />
            </CardContent>
          </Card>

          {/* Action buttons */}
          <div className="flex gap-2 pt-2">
            {editingData ? (
              <>
                <Button onClick={onSave} className="flex-1 bg-green-600 hover:bg-green-700">
                  <Save className="w-4 h-4 mr-2" /> Guardar cambios
                </Button>
                <Button variant="outline" onClick={cancelEditing}>
                  Cancelar
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={startEditing} className="flex-1">
                  <Edit2 className="w-4 h-4 mr-2" /> Editar datos
                </Button>
                <Button variant="outline" onClick={onReprocess}>
                  <RefreshCw className="w-4 h-4 mr-2" /> Re-procesar
                </Button>
              </>
            )}
          </div>
        </TabsContent>

        {/* Preview Tab */}
        <TabsContent value="preview" className="mt-4">
          <Card className="bg-zinc-900/50 border-zinc-800 overflow-hidden">
            <div className="h-[500px]">
              {isPdf ? (
                <iframe
                  src={`${file.file_url}#view=FitH`}
                  className="w-full h-full border-none"
                  title="PDF Preview"
                />
              ) : isImage ? (
                <div className="w-full h-full flex items-center justify-center p-4 bg-zinc-950">
                  <img
                    src={file.file_url}
                    alt={file.filename}
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <FileText className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
                    <p className="text-zinc-400">Vista previa no disponible</p>
                    <Button
                      onClick={() => window.open(file.file_url, '_blank')}
                      className="mt-4"
                      variant="outline"
                    >
                      <Download className="w-4 h-4 mr-2" /> Descargar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </TabsContent>

        {/* OCR Tab */}
        <TabsContent value="ocr" className="mt-4 space-y-4">
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <ScanLine className="w-4 h-4 text-purple-400" /> Resultado OCR
                </span>
                {ocr.confidence && (
                  <Badge variant="outline" className={`${
                    ocr.confidence >= 80 ? 'text-green-400' :
                    ocr.confidence >= 50 ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    {Math.round(ocr.confidence)}% confianza
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-xs">
                Método: {ocr.method === 'direct' ? 'Texto directo del PDF' : 'Reconocimiento óptico'}
                {ocr.processed_at && ` • ${formatDate(ocr.processed_at)}`}
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {ocr.text ? (
                <ScrollArea className="h-[300px] rounded-lg bg-zinc-950 border border-zinc-800 p-3">
                  <pre className="text-xs text-zinc-300 whitespace-pre-wrap font-mono">
                    {ocr.text}
                  </pre>
                </ScrollArea>
              ) : (
                <div className="text-center py-8 text-zinc-500">
                  <ScanLine className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No hay texto OCR disponible</p>
                  <Button onClick={onReprocess} className="mt-3" variant="outline" size="sm">
                    Ejecutar OCR
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <SheetFooter className="mt-6 pt-4 border-t border-zinc-800">
        <div className="flex justify-between w-full">
          <Button variant="destructive" onClick={onDelete} size="sm">
            <Trash2 className="w-4 h-4 mr-2" /> Eliminar
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.open(file.file_url, '_blank')}>
            <ExternalLink className="w-4 h-4 mr-2" /> Abrir original
          </Button>
        </div>
      </SheetFooter>
    </>
  );
}

// Data Field Component
function DataField({ label, value, icon: Icon, editing, onChange, type = 'text', validation, suffix }) {
  const displayValue = type === 'currency' && value ? 
    new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value) :
    value || '-';

  return (
    <div>
      <Label className="text-xs text-zinc-500 flex items-center gap-1">
        {Icon && <Icon className="w-3 h-3" />} {label}
        {validation === false && <AlertCircle className="w-3 h-3 text-red-400" />}
      </Label>
      {editing ? (
        <Input
          type={type === 'currency' ? 'number' : type}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 bg-zinc-900 border-zinc-700 mt-1"
        />
      ) : (
        <p className={`mt-1 ${value ? 'text-white' : 'text-zinc-600'}`}>
          {displayValue}
          {suffix && <span className="text-xs text-zinc-500 ml-1">{suffix}</span>}
        </p>
      )}
    </div>
  );
}

// Stat Card Component
function StatCard({ label, value, icon: Icon, color = 'zinc' }) {
  return (
    <Card className={`bg-${color}-900/20 border-${color}-500/30`}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg bg-${color}-500/20 flex items-center justify-center`}>
          <Icon className={`w-5 h-5 text-${color}-400`} />
        </div>
        <div>
          <p className="text-2xl font-bold text-white">{value}</p>
          <p className="text-xs text-zinc-400">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
