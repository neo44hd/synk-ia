import React, { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
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
  Trash2
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import FilePreviewModal from "@/components/FilePreviewModal";

export default function DocumentArchive() {
  const [previewFile, setPreviewFile] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [providerSearch, setProviderSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [processingLogs, setProcessingLogs] = useState([]);
  const [showLogs, setShowLogs] = useState(false);
  const [hideCompleted, setHideCompleted] = useState(false);
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();
  const logsEndRef = useRef(null);

  // Auto-scroll logs (only when opening logs, not on every update to allow reading history)
  useEffect(() => {
    if (showLogs && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [showLogs]);

  const addLog = (message, type = 'info') => {
    setProcessingLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), message, type }]);
  };

  const { data: files = [], isLoading } = useQuery({
    queryKey: ['uploaded-files'],
    queryFn: () => base44.entities.UploadedFile.list('-upload_date', 1000),
    staleTime: 30000,
  });

  // Procesamiento con creación automática de entidades
  const processDocument = async (file) => {
    addLog(`🔍 Analizando ${file.filename}...`, 'pending');

    try {
      await base44.entities.UploadedFile.update(file.id, { processing_status: 'processing' });

      const isCSV = file.filename.toLowerCase().endsWith('.csv') || file.content_type?.includes('csv');

      const genericSchema = {
        type: "object",
        properties: {
          document_type: { type: "string", description: "OBLIGATORIO: Tipo exacto (Factura, Nómina, Contrato, Escritura, Albarán, etc)" },
          has_multiple_records: { type: "boolean", description: "TRUE si el PDF contiene MÚLTIPLES páginas con DIFERENTES registros (ej: 10 nóminas de 10 empleados distintos). FALSE si es un solo documento." },
          records: {
            type: "array",
            description: "SI has_multiple_records=true, DEBES listar TODOS los registros encontrados en TODAS las páginas del PDF. Cada página = 1 registro.",
            items: {
              type: "object",
              properties: {
                employee_name: { type: "string", description: "Nombre COMPLETO del empleado (de esta nómina específica)" },
                employee_dni: { type: "string", description: "DNI/NIE" },
                amount: { type: "number", description: "Salario NETO de esta nómina" },
                gross_salary: { type: "number", description: "Salario BRUTO" },
                social_security: { type: "number", description: "Cotización SS" },
                irpf: { type: "number", description: "Retención IRPF" },
                document_date: { type: "string", description: "Fecha emisión YYYY-MM-DD" },
                period: { type: "string", description: "CRÍTICO: Periodo YYYY-MM (ej: 2024-12)" },
                provider_name: { type: "string", description: "Si es factura: nombre del proveedor" },
                invoice_number: { type: "string", description: "Si es factura: número de factura" }
              }
            }
          },
          provider_name: { type: "string", description: "Si es 1 sola factura: nombre completo del proveedor" },
          provider_cif: { type: "string", description: "CIF del proveedor" },
          employee_name: { type: "string", description: "Si es 1 sola nómina: nombre del empleado" },
          employee_dni: { type: "string", description: "DNI del empleado" },
          amount: { type: "number", description: "Importe TOTAL (neto si es nómina, total con IVA si es factura)" },
          gross_salary: { type: "number", description: "Solo nóminas: salario bruto" },
          social_security: { type: "number", description: "Solo nóminas: cotización" },
          irpf: { type: "number", description: "Solo nóminas: retención IRPF" },
          subtotal: { type: "number", description: "Solo facturas: base imponible sin IVA" },
          iva: { type: "number", description: "Solo facturas: IVA aplicado" },
          document_date: { type: "string", description: "Fecha de emisión YYYY-MM-DD" },
          period: { type: "string", description: "Solo nóminas: periodo YYYY-MM" },
          invoice_number: { type: "string", description: "Solo facturas: número de factura" },
          due_date: { type: "string", description: "Solo facturas: fecha vencimiento YYYY-MM-DD" },
          summary: { type: "string", description: "Resumen breve del documento" }
        },
        required: ["document_type"]
      };

      try {
        const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
          file_url: file.file_url,
          json_schema: genericSchema
        });

        if (result.status === "success" && result.output) {
          const data = result.output;
          const docType = (data.document_type || '').toLowerCase();

          // CREAR ENTIDADES SEGÚN TIPO CON TRAZABILIDAD
          let destination = null;
          let createdCount = 0;

          if (docType.includes('nómina') || docType.includes('nomina')) {
            // Si hay múltiples nóminas en el mismo archivo
            if (data.has_multiple_records && data.records && data.records.length > 0) {
              addLog(`📋 Detectadas ${data.records.length} nóminas en el archivo`, 'info');
              
              for (const record of data.records) {
                if (record.employee_name) {
                  const existing = await base44.entities.Employee.filter({ full_name: record.employee_name });
                  let employee;

                  if (existing.length === 0) {
                    const period = record.period || (record.document_date ? record.document_date.substring(0, 7) : new Date().toISOString().substring(0, 7));
                    employee = await base44.entities.Employee.create({
                      full_name: record.employee_name,
                      dni: record.employee_dni || '',
                      salary_net: record.amount || 0,
                      salary_gross: record.gross_salary || record.amount || 0,
                      status: 'activo',
                      payrolls: [{
                        period: period,
                        net_salary: record.amount || 0,
                        gross_salary: record.gross_salary || record.amount || 0,
                        social_security: record.social_security || 0,
                        irpf: record.irpf || 0,
                        payment_date: record.document_date || new Date().toISOString().split('T')[0],
                        status: 'pagada',
                        file_url: file.file_url
                      }]
                    });
                    addLog(`👤 Empleado creado: ${record.employee_name} - Nómina ${period}`, 'success');
                    createdCount++;
                  } else {
                    employee = existing[0];
                    const currentPayrolls = employee.payrolls || [];
                    const period = record.period || (record.document_date ? record.document_date.substring(0, 7) : new Date().toISOString().substring(0, 7));
                    const newPayroll = {
                      period: period,
                      net_salary: record.amount || 0,
                      gross_salary: record.gross_salary || record.amount || 0,
                      social_security: record.social_security || 0,
                      irpf: record.irpf || 0,
                      payment_date: record.document_date || new Date().toISOString().split('T')[0],
                      status: 'pagada',
                      file_url: file.file_url
                    };
                    
                    // Agregar nómina solo si no existe ya ese periodo
                    const periodExists = currentPayrolls.some(p => p.period === newPayroll.period);
                    if (!periodExists) {
                      await base44.entities.Employee.update(employee.id, {
                        payrolls: [...currentPayrolls, newPayroll]
                      });
                      addLog(`📄 Nómina ${period} agregada a: ${record.employee_name}`, 'success');
                    } else {
                      addLog(`⚠️ Nómina duplicada ignorada: ${record.employee_name} (${period})`, 'info');
                    }
                  }
                }
              }
              
              destination = {
                type: 'Employee',
                id: 'multiple',
                name: `${data.records.length} nóminas procesadas`,
                section: 'Personal'
              };
            } else if (data.employee_name) {
              // Una sola nómina
              const existing = await base44.entities.Employee.filter({ full_name: data.employee_name });
              let employee;

              if (existing.length === 0) {
                const period = data.period || (data.document_date ? data.document_date.substring(0, 7) : new Date().toISOString().substring(0, 7));
                employee = await base44.entities.Employee.create({
                  full_name: data.employee_name,
                  dni: data.employee_dni || '',
                  salary_net: data.amount || 0,
                  salary_gross: data.gross_salary || data.amount || 0,
                  status: 'activo',
                  payrolls: [{
                    period: period,
                    net_salary: data.amount || 0,
                    gross_salary: data.gross_salary || data.amount || 0,
                    social_security: data.social_security || 0,
                    irpf: data.irpf || 0,
                    payment_date: data.document_date || new Date().toISOString().split('T')[0],
                    status: 'pagada',
                    file_url: file.file_url
                  }]
                });
                addLog(`👤 Empleado creado: ${data.employee_name} - Nómina ${period}`, 'success');
              } else {
                employee = existing[0];
                const currentPayrolls = employee.payrolls || [];
                const period = data.period || (data.document_date ? data.document_date.substring(0, 7) : new Date().toISOString().substring(0, 7));
                const newPayroll = {
                  period: period,
                  net_salary: data.amount || 0,
                  gross_salary: data.gross_salary || data.amount || 0,
                  social_security: data.social_security || 0,
                  irpf: data.irpf || 0,
                  payment_date: data.document_date || new Date().toISOString().split('T')[0],
                  status: 'pagada',
                  file_url: file.file_url
                };
                
                const periodExists = currentPayrolls.some(p => p.period === newPayroll.period);
                if (!periodExists) {
                  await base44.entities.Employee.update(employee.id, {
                    payrolls: [...currentPayrolls, newPayroll]
                  });
                  addLog(`📄 Nómina ${period} agregada a: ${data.employee_name}`, 'success');
                } else {
                  addLog(`⚠️ Nómina duplicada ignorada: ${data.employee_name} (${period})`, 'info');
                }
              }

              destination = {
                type: 'Employee',
                id: employee.id,
                name: data.employee_name,
                section: 'Personal'
              };
            }
          } else if (docType.includes('factura') || docType.includes('invoice') || docType.includes('albar')) {
            // Facturas múltiples
            if (data.has_multiple_records && data.records && data.records.length > 0) {
              addLog(`📋 Detectadas ${data.records.length} facturas en el archivo`, 'info');
              
              for (const record of data.records) {
                if (record.provider_name) {
                  const existingProvider = await base44.entities.Provider.filter({ name: record.provider_name });
                  if (existingProvider.length === 0) {
                    await base44.entities.Provider.create({
                      name: record.provider_name,
                      cif: record.provider_cif || '',
                      category: 'otros',
                      status: 'activo'
                    });
                    addLog(`🏢 Proveedor creado: ${record.provider_name}`, 'success');
                  }
                  
                  await base44.entities.Invoice.create({
                    provider_name: record.provider_name,
                    invoice_number: record.invoice_number || `INV-${Date.now()}`,
                    invoice_date: record.document_date || new Date().toISOString().split('T')[0],
                    due_date: record.due_date,
                    subtotal: record.subtotal || 0,
                    iva: record.iva || 0,
                    total: record.amount || 0,
                    status: 'pendiente',
                    file_url: file.file_url
                  });
                  addLog(`📄 Factura creada: ${record.provider_name} - ${record.amount}€`, 'success');
                  createdCount++;
                }
              }
              
              destination = {
                type: 'Invoice',
                id: 'multiple',
                name: `${data.records.length} facturas procesadas`,
                section: 'Facturas'
              };
              
            } else if (data.provider_name) {
              // Una sola factura
              const existingProvider = await base44.entities.Provider.filter({ name: data.provider_name });
              if (existingProvider.length === 0) {
                await base44.entities.Provider.create({
                  name: data.provider_name,
                  cif: data.provider_cif || '',
                  category: 'otros',
                  status: 'activo'
                });
                addLog(`🏢 Proveedor creado: ${data.provider_name}`, 'success');
              }

              const newInvoice = await base44.entities.Invoice.create({
                provider_name: data.provider_name,
                invoice_number: data.invoice_number || file.filename,
                invoice_date: data.document_date || new Date().toISOString().split('T')[0],
                due_date: data.due_date,
                subtotal: data.subtotal || 0,
                iva: data.iva || 0,
                total: data.amount || 0,
                status: 'pendiente',
                file_url: file.file_url
              });

              destination = {
                type: 'Invoice',
                id: newInvoice.id,
                name: `${data.provider_name} - ${data.amount}€`,
                section: 'Facturas'
              };
              addLog(`📄 Factura creada: ${data.amount}€`, 'success');
            }

          } else if (docType.includes('escritura') || docType.includes('legal') || docType.includes('constitución')) {
            const newDoc = await base44.entities.CompanyDocument.create({
              title: file.filename,
              document_type: 'constitucion',
              category: 'legal',
              issue_date: data.document_date || new Date().toISOString().split('T')[0],
              file_url: file.file_url,
              status: 'vigente'
            });

            destination = {
              type: 'CompanyDocument',
              id: newDoc.id,
              name: file.filename,
              section: 'Documentos Empresa'
            };
            addLog(`📜 Documento legal creado`, 'success');
          }

          await base44.entities.UploadedFile.update(file.id, {
            processing_status: 'completed',
            detected_type: data.document_type || 'Documento',
            metadata: {
              provider: data.provider_name,
              employee_name: data.employee_name,
              amount: data.amount,
              document_date: data.document_date,
              summary: data.summary,
              destination: destination
            }
          });
          return { file, result: `✅ ${data.document_type || 'Procesado'}` };
        }
      } catch (standardError) {
        if (isCSV && standardError.message.includes('encoding')) {
          const flexResult = await base44.functions.invoke('processFlexibleCSV', {
            file_url: file.file_url,
            file_id: file.id
          });
          if (flexResult.data.success) {
            return { file, result: `✅ CSV procesado` };
          }
        }
        throw standardError;
      }

      throw new Error('No se pudo extraer información');

    } catch (error) {
      console.error(`Error procesando ${file.filename}:`, error);
      await base44.entities.UploadedFile.update(file.id, { 
        processing_status: 'error',
        metadata: { error: error.message.substring(0, 200) }
      });
      throw error;
    }
  };

  // Mutation para procesar con IA (Single file)
  const processMutation = useMutation({
    mutationFn: processDocument,
    onSuccess: (data) => {
      addLog(`✅ ${data.file.filename}: ${data.result}`, 'success');
      queryClient.invalidateQueries({ queryKey: ['uploaded-files'] });
    },
    onError: (error, variables) => {
      addLog(`❌ Error en ${variables.filename}: ${error.message}`, 'error');
    }
  });

  const [isReprocessing, setIsReprocessing] = useState(false);

  const handleResetStates = async () => {
    if(!confirm("¿Detener y resetear estados? Los archivos 'Analizando' volverán a 'En cola'.")) return;
    
    setIsReprocessing(false); 
    
    const processingFiles = files.filter(f => f.processing_status === 'processing');
    const toastId = toast.loading(`Reseteando ${processingFiles.length} archivos...`);
    
    for (const file of processingFiles) {
      await base44.entities.UploadedFile.update(file.id, { processing_status: 'pending' });
    }
    
    toast.success("Estados reseteados. Ahora puedes procesar uno a uno.", { id: toastId });
    queryClient.invalidateQueries({ queryKey: ['uploaded-files'] });
  };

  const handleDeleteFile = async (fileId) => {
    if(!confirm("¿Eliminar este archivo del registro?")) return;
    try {
      await base44.entities.UploadedFile.delete(fileId);
      toast.success("Archivo eliminado");
      queryClient.invalidateQueries({ queryKey: ['uploaded-files'] });
    } catch (error) {
      toast.error("Error al eliminar: " + error.message);
    }
  };

  const handleDeleteAllErrors = async () => {
    const errorFiles = files.filter(f => f.processing_status === 'error');
    if (errorFiles.length === 0) {
      toast.info("No hay archivos con error");
      return;
    }
    if(!confirm(`¿Eliminar ${errorFiles.length} archivos con error?`)) return;
    
    const toastId = toast.loading(`Eliminando ${errorFiles.length} archivos...`);
    for (const file of errorFiles) {
      await base44.entities.UploadedFile.delete(file.id);
    }
    toast.success(`${errorFiles.length} archivos eliminados`, { id: toastId });
    queryClient.invalidateQueries({ queryKey: ['uploaded-files'] });
  };

  const handleReprocessAll = async () => {
    if(!confirm(`¿Reprocesar archivos pendientes? Se usarán 3 procesos paralelos para mayor velocidad.`)) return;
    
    setIsReprocessing(true);
    setShowLogs(true);
    setProcessingLogs([]);
    
    const toProcess = files.filter(f => f.processing_status !== 'completed');
    addLog(`🚀 Iniciando procesamiento paralelo (3 hilos) para ${toProcess.length} archivos...`, 'info');
    
    if (toProcess.length === 0) {
      addLog("No hay archivos pendientes de procesar.", 'info');
      setIsReprocessing(false);
      return;
    }

    let processedCount = 0;
    let currentIndex = 0;
    const CONCURRENCY_LIMIT = 3;

    const processNext = async () => {
      while (currentIndex < toProcess.length) {
        const index = currentIndex++;
        const file = toProcess[index];
        
        try {
          addLog(`🔄 [${index + 1}/${toProcess.length}] Analizando: ${file.filename}...`, 'pending');
          const data = await processDocument(file);
          addLog(`✅ [${index + 1}/${toProcess.length}] ${file.filename}: OK`, 'success');
        } catch (err) {
          console.error(`Error file ${file.filename}:`, err);
          addLog(`❌ [${index + 1}/${toProcess.length}] ${file.filename}: ${err.message}`, 'error');
        }
        processedCount++;
      }
    };

    // Iniciar workers
    const workers = Array(Math.min(CONCURRENCY_LIMIT, toProcess.length))
      .fill(null)
      .map(() => processNext());

    await Promise.all(workers);
    
    addLog(`🎉 FINALIZADO: ${processedCount} archivos procesados.`, 'success');
    setIsReprocessing(false);
    queryClient.invalidateQueries({ queryKey: ['uploaded-files'] });
  };

  const handleFileUpload = async (fileList) => {
    setIsUploading(true);
    const filesToUpload = Array.from(fileList);
    let uploadedCount = 0;

    for (const file of filesToUpload) {
      try {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        
        const newFile = await base44.entities.UploadedFile.create({
          filename: file.name,
          file_url: file_url,
          source: "Archivo Global",
          upload_date: new Date().toISOString(),
          uploaded_by: "Admin (Manual)", 
          size: file.size,
          content_type: file.type,
          processing_status: 'pending'
        });
        
        // NO auto-procesar. Dejar en pendiente para control manual.
        // processMutation.mutate(newFile); 
        
        uploadedCount++;
      } catch (error) {
        console.error(error);
        toast.error(`Error subiendo ${file.name}`);
      }
    }

    setIsUploading(false);
    if (uploadedCount > 0) {
      toast.success(`${uploadedCount} archivos subidos. Listos para procesar.`);
      queryClient.invalidateQueries({ queryKey: ['uploaded-files'] });
    }
  };

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
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files);
    }
  };

  const filteredFiles = files.filter(file => {
    const metadata = file.metadata || {};
    const searchLower = searchQuery.toLowerCase();
    
    // Ocultar completados si está activado
    if (hideCompleted && file.processing_status === 'completed') {
      return false;
    }
    
    // Búsqueda general
    const matchesSearch = !searchQuery || 
      file.filename?.toLowerCase().includes(searchLower) ||
      (metadata.provider && metadata.provider.toLowerCase().includes(searchLower)) ||
      (metadata.employee_name && metadata.employee_name.toLowerCase().includes(searchLower)) ||
      (metadata.doc_number && metadata.doc_number.toLowerCase().includes(searchLower));

    // Filtro por Tipo
    const matchesType = typeFilter === "all" || 
      (file.detected_type && file.detected_type.toLowerCase().includes(typeFilter.toLowerCase()));

    // Filtro por Proveedor (específico)
    const matchesProvider = !providerSearch || 
      (metadata.provider && metadata.provider.toLowerCase().includes(providerSearch.toLowerCase()));

    // Filtro por Fecha (Subida o Documento)
    const matchesDate = !dateFilter || 
      (file.upload_date && file.upload_date.startsWith(dateFilter)) ||
      (metadata.document_date && metadata.document_date.startsWith(dateFilter));

    return matchesSearch && matchesType && matchesProvider && matchesDate;
  });

  const getStatusBadge = (status) => {
    switch(status) {
      case 'completed': return <Badge className="bg-green-500/20 text-green-400 border-green-500/30"><CheckCircle2 className="w-3 h-3 mr-1" /> Procesado</Badge>;
      case 'processing': return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Analizando...</Badge>;
      case 'error': return <Badge className="bg-red-500/20 text-red-400 border-red-500/30"><AlertCircle className="w-3 h-3 mr-1" /> Fallo</Badge>;
      default: return <Badge variant="outline" className="text-zinc-500 border-zinc-800">En cola</Badge>;
    }
  };

  const getRowStyle = (file) => {
    // Si no está procesado o no tiene tipo detectado, estilo por defecto
    if (file.processing_status !== 'completed' && !file.detected_type) return "border-zinc-800 hover:bg-zinc-900/50";
    
    // Normalizar texto para comparación
    const type = (file.detected_type || file.ai_summary || "").toLowerCase();
    const filename = file.filename.toLowerCase();
    
    // 1. NÓMINAS (RRHH) -> Violeta/Púrpura
    if (type.includes('nómina') || type.includes('nomina') || filename.includes('nomina')) {
      return "border-l-4 border-l-violet-500 bg-violet-950/10 hover:bg-violet-900/20 border-y-zinc-800 border-r-zinc-800";
    }
    
    // 2. DOCUMENTACIÓN EMPRESA / CONFIDENCIAL -> Cyan/Azul
    if (type.includes('escritura') || type.includes('poder') || type.includes('cif') || type.includes('sociedad') || type.includes('legal') || type.includes('fiscal')) {
      return "border-l-4 border-l-cyan-500 bg-cyan-950/10 hover:bg-cyan-900/20 border-y-zinc-800 border-r-zinc-800";
    }
    
    // 3. FACTURAS / PROVEEDORES -> Naranja/Ámbar
    if (type.includes('factura') || type.includes('invoice') || type.includes('proveedor')) {
      return "border-l-4 border-l-orange-500 bg-orange-950/10 hover:bg-orange-900/20 border-y-zinc-800 border-r-zinc-800";
    }

    // Por defecto
    return "border-zinc-800 hover:bg-zinc-900/50";
  };

  const getTypeBadge = (file) => {
    const type = (file.detected_type || "Desconocido").toLowerCase();
    const filename = file.filename.toLowerCase();

    if (type.includes('nómina') || filename.includes('nomina')) return <Badge className="bg-violet-500/20 text-violet-300 border-violet-500/30">RRHH / Nómina</Badge>;
    if (type.includes('escritura') || type.includes('sociedad')) return <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/30">Legal / Sociedad</Badge>;
    if (type.includes('factura')) return <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/30">Factura</Badge>;
    
    return <span className="text-zinc-500 text-sm italic">{file.detected_type || "Pendiente..."}</span>;
  };

  return (
    <div className="p-4 md:p-8 min-h-screen bg-gradient-to-br from-zinc-950 via-neutral-900 to-zinc-950 text-white">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-black text-white flex items-center gap-3">
              <HardDrive className="w-8 h-8 text-cyan-400" />
              <span className="text-cyan-400">Archivo Global</span>
            </h1>
            <p className="text-zinc-400 mt-1">
              Centro unificado de documentos. Sube todo aquí para que la IA lo procese.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              className={`border-zinc-700 text-zinc-400 hover:text-white ${!hideCompleted ? 'bg-zinc-800' : ''}`}
              onClick={() => setHideCompleted(!hideCompleted)}
            >
              {hideCompleted ? '📂 Mostrar Procesados' : '✅ Ocultar Procesados'}
            </Button>
            <Button 
              variant="outline" 
              className={`border-zinc-700 text-zinc-400 hover:text-white ${showLogs ? 'bg-zinc-800' : ''}`}
              onClick={() => setShowLogs(!showLogs)}
            >
              {showLogs ? 'Ocultar Logs' : 'Ver Logs'}
            </Button>
            <Button 
              variant="outline" 
              className="border-red-500/30 text-red-400 hover:bg-red-500/10"
              onClick={handleReprocessAll}
              disabled={isReprocessing || files.length === 0}
            >
              {isReprocessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Bot className="w-4 h-4 mr-2" />}
              {isReprocessing ? "Procesando..." : "Reprocesar Todo"}
            </Button>
            
            <Button 
              variant="outline" 
              className="border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
              onClick={handleResetStates}
            >
              <AlertCircle className="w-4 h-4 mr-2" />
              Resetear / Parar
            </Button>

            <Button 
              variant="outline" 
              className="border-red-600/30 text-red-400 hover:bg-red-600/10"
              onClick={handleDeleteAllErrors}
              disabled={files.filter(f => f.processing_status === 'error').length === 0}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Borrar Errores
            </Button>

            <div className="bg-zinc-900 px-4 py-2 rounded-lg border border-zinc-800">
              <span className="text-2xl font-bold text-white">{filteredFiles.length}</span>
              <span className="text-zinc-500 text-sm ml-2">/ {files.length} archivos</span>
            </div>
          </div>
        </div>

        {/* LOGS PANEL */}
        {showLogs && (
          <Card className="mb-8 bg-black/50 border-zinc-800 max-h-60 overflow-hidden flex flex-col">
            <CardHeader className="py-3 px-4 border-b border-zinc-800 bg-zinc-900/50">
              <CardTitle className="text-sm font-mono text-cyan-400 flex items-center gap-2">
                <Bot className="w-4 h-4" /> Console Output - AI Processor
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 overflow-y-auto font-mono text-xs space-y-2">
              {processingLogs.length === 0 && <span className="text-zinc-600">Esperando tareas...</span>}
              {processingLogs.map((log, i) => (
                <div key={i} className={`flex gap-2 ${
                  log.type === 'error' ? 'text-red-400' : 
                  log.type === 'success' ? 'text-green-400' : 
                  log.type === 'pending' ? 'text-blue-400' : 'text-zinc-400'
                }`}>
                  <span className="opacity-50">[{log.time}]</span>
                  <span>{log.message}</span>
                </div>
              ))}
              <div ref={logsEndRef} />
            </CardContent>
          </Card>
        )}

        {/* Upload Zone */}
        <Card 
          className={`mb-8 border-2 border-dashed transition-all duration-200 ${
            dragActive ? 'border-cyan-500 bg-cyan-900/10' : 'border-zinc-800 bg-zinc-900/50'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 bg-zinc-800 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
              {isUploading ? (
                <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
              ) : (
                <Upload className="w-8 h-8 text-cyan-400" />
              )}
            </div>
            <h3 className="text-xl font-bold text-white mb-2">
              {isUploading ? "Subiendo archivos..." : "Arrastra tus documentos aquí"}
            </h3>
            <p className="text-zinc-400 mb-6 max-w-md">
              Nóminas, Facturas, Contratos, Albaranes... La IA clasificará y procesará todo automáticamente desde este buzón único.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => handleFileUpload(e.target.files)}
            />
            <Button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="bg-cyan-600 hover:bg-cyan-700 font-bold"
            >
              Seleccionar Archivos
            </Button>
          </CardContent>
        </Card>

        {/* Filtros Avanzados */}
        <Card className="bg-zinc-900/30 border-zinc-800 mb-6">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Buscador General */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-500 w-4 h-4" />
                <Input 
                  placeholder="Buscar archivo, nº..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-zinc-950 border-zinc-800 text-white h-9"
                />
              </div>

              {/* Filtro Tipo */}
              <select 
                className="h-9 px-3 rounded-md bg-zinc-950 border border-zinc-800 text-sm text-white focus:outline-none focus:border-cyan-500"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="all">Todos los Tipos</option>
                <option value="factura">Facturas</option>
                <option value="nómina">Nóminas</option>
                <option value="legal">Legal / Sociedad</option>
                <option value="contrato">Contratos</option>
              </select>

              {/* Filtro Proveedor */}
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-500 w-4 h-4" />
                <Input 
                  placeholder="Proveedor / Empleado" 
                  value={providerSearch}
                  onChange={(e) => setProviderSearch(e.target.value)}
                  className="pl-9 bg-zinc-950 border-zinc-800 text-white h-9"
                />
              </div>

              {/* Filtro Fecha */}
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-500 w-4 h-4" />
                <Input 
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="pl-9 bg-zinc-950 border-zinc-800 text-white h-9 [color-scheme:dark]"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/50 border-zinc-800 border-none shadow-xl">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-800 hover:bg-zinc-900/50">
                    <TableHead className="text-zinc-400">Documento</TableHead>
                    <TableHead className="text-zinc-400">Detalles IA</TableHead>
                    <TableHead className="text-zinc-400">Destino</TableHead>
                    <TableHead className="text-zinc-400">Importe</TableHead>
                    <TableHead className="text-zinc-400">Estado</TableHead>
                    <TableHead className="text-zinc-400 text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-zinc-500">Cargando...</TableCell>
                    </TableRow>
                  ) : filteredFiles.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-zinc-500">Vacío.</TableCell>
                    </TableRow>
                  ) : (
                    filteredFiles.map((file) => (
                      <TableRow key={file.id} className={`${getRowStyle(file)} transition-colors`}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                              getRowStyle(file).includes('violet') ? 'bg-violet-900/30' : 
                              getRowStyle(file).includes('cyan') ? 'bg-cyan-900/30' :
                              getRowStyle(file).includes('orange') ? 'bg-orange-900/30' : 'bg-zinc-800'
                            }`}>
                              <FileText className={`w-5 h-5 ${
                                getRowStyle(file).includes('violet') ? 'text-violet-400' : 
                                getRowStyle(file).includes('cyan') ? 'text-cyan-400' :
                                getRowStyle(file).includes('orange') ? 'text-orange-400' : 'text-zinc-400'
                              }`} />
                            </div>
                            <div>
                              <p className="font-medium text-white">{file.filename}</p>
                              <p className="text-xs text-zinc-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {getTypeBadge(file)}
                            {file.metadata?.provider && (
                              <span className="text-xs text-zinc-400 flex items-center gap-1">
                                <Building2 className="w-3 h-3" /> {file.metadata.provider}
                              </span>
                            )}
                            {file.metadata?.employee_name && (
                              <span className="text-xs text-zinc-400 flex items-center gap-1">
                                <User className="w-3 h-3" /> {file.metadata.employee_name}
                              </span>
                            )}
                          </div>
                          </TableCell>
                          <TableCell>
                          {file.metadata?.destination ? (
                            <div className="flex flex-col gap-1">
                              <Badge className="bg-cyan-900/30 text-cyan-300 border-cyan-500/30 w-fit">
                                {file.metadata.destination.section}
                              </Badge>
                              <a 
                                href={file.metadata.destination.type === 'Invoice' ? '/Invoices' : 
                                      file.metadata.destination.type === 'Employee' ? '/Staff' : 
                                      '/CompanyDocs'}
                                className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <ChevronRight className="w-3 h-3" />
                                {file.metadata.destination.name}
                              </a>
                            </div>
                          ) : (
                            <span className="text-xs text-zinc-600">Sin destino</span>
                          )}
                          </TableCell>
                          <TableCell>
                          {file.metadata?.amount ? (
                            <span className="font-mono font-bold text-white">
                              {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(file.metadata.amount)}
                            </span>
                          ) : (
                            <span className="text-zinc-600">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(file.processing_status)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {file.processing_status !== 'completed' && (
                              <Button 
                                size="icon"
                                variant="ghost"
                                onClick={async () => {
                                  setShowLogs(true);
                                  try {
                                    await processMutation.mutateAsync(file);
                                  } catch (e) { console.error(e); }
                                }}
                                className="w-9 h-9 hover:bg-blue-900/20 text-blue-400 hover:text-blue-300 transition-colors"
                                title={file.processing_status === 'processing' ? "Reintentar análisis" : "Analizar con IA ahora"}
                              >
                                <Bot className={`w-4 h-4 ${file.processing_status === 'processing' ? 'text-yellow-400' : ''}`} />
                              </Button>
                            )}
                            <Button 
                              size="icon"
                              variant="ghost"
                              onClick={() => setPreviewFile(file)}
                              className="w-9 h-9 hover:bg-zinc-800 text-zinc-400 hover:text-cyan-400 transition-colors"
                              title="Previsualizar archivo"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button 
                              size="icon"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteFile(file.id);
                              }}
                              className="w-9 h-9 hover:bg-red-900/20 text-red-400 hover:text-red-300 transition-colors"
                              title="Eliminar archivo"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
      <FilePreviewModal 
        file={previewFile} 
        isOpen={!!previewFile} 
        onClose={() => setPreviewFile(null)} 
      />
    </div>
  );
}