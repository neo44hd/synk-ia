import React, { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  Upload, 
  FileSpreadsheet, 
  Loader2, 
  CheckCircle2,
  AlertCircle,
  Download,
  ArrowRight,
  Sparkles,
  Database,
  Zap,
  TrendingUp,
  Users,
  History,
  Trash2,
  XCircle,
  Clock,
  HardDrive
} from "lucide-react";
import { toast } from "sonner";
import { useBackgroundTasks } from "@/components/BackgroundTasksManager";

export default function BiloopImport() {
  const { startTask, updateTask, addStep, completeTask, failTask, getTask } = useBackgroundTasks();
  
  // Recuperar estado de tarea en segundo plano si existe
  const existingTask = getTask('biloop_import');
  
  const [isProcessing, setIsProcessing] = useState(existingTask?.status === 'running');
  const [syncMode, setSyncMode] = useState('manual'); // 'manual' by default, 'auto' available for future
  const [dragActive, setDragActive] = useState(false);
  const [results, setResults] = useState(existingTask?.result || null);
  const [processingSteps, setProcessingSteps] = useState(existingTask?.steps || []);
  const [fileName, setFileName] = useState(existingTask?.metadata?.fileName || null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState(null); // 'uploading', 'processing', 'success', 'error'
  const [uploadLogs, setUploadLogs] = useState(() => {
    const saved = localStorage.getItem('biloop_upload_logs');
    return saved ? JSON.parse(saved) : [];
  });
  const fileInputRef = useRef(null);

  // Guardar logs en localStorage
  const addLog = (log) => {
    const newLog = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      ...log
    };
    setUploadLogs(prev => {
      const updated = [newLog, ...prev].slice(0, 50); // Máximo 50 logs
      localStorage.setItem('biloop_upload_logs', JSON.stringify(updated));
      return updated;
    });
  };

  const clearLogs = () => {
    setUploadLogs([]);
    localStorage.removeItem('biloop_upload_logs');
  };

  const queryClient = useQueryClient();

  // Sincronizar con el estado de la tarea en segundo plano
  useEffect(() => {
    if (existingTask) {
      if (existingTask.status === 'completed' && existingTask.result) {
        setResults(existingTask.result);
        setIsProcessing(false);
      }
      if (existingTask.status === 'failed') {
        setIsProcessing(false);
      }
      if (existingTask.steps) {
        setProcessingSteps(existingTask.steps);
      }
    }
  }, [existingTask]);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e) => {
  e.preventDefault();
  e.stopPropagation();
  setDragActive(false);

  // Aceptar todos los archivos arrastrados
  const files = Array.from(e.dataTransfer.files);

  if (files.length > 0) {
    await processMultipleFiles(files);
  }
  };

  const handleFileInput = async (e) => {
  const files = Array.from(e.target.files);
  if (files.length > 0) {
    await processMultipleFiles(files);
  }
  };

  const runAutoSync = async () => {
    setIsProcessing(true);
    setResults(null);
    setProcessingSteps([]);

    try {
      // PASO 1: Conectar con Biloop API
      setProcessingSteps([{ step: 'Conectando con Biloop API...', status: 'loading' }]);
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const response = await base44.functions.invoke('biloopRealSync');
      
      setProcessingSteps(prev => [
        ...prev.slice(0, -1),
        { step: 'Biloop API conectada', status: 'success' },
        { step: 'Sincronizando facturas 2025...', status: 'loading' }
      ]);
      await new Promise(resolve => setTimeout(resolve, 800));

      // PASO 2: Crear proveedores
      setProcessingSteps(prev => [
        ...prev.slice(0, -1),
        { step: 'Facturas sincronizadas', status: 'success' },
        { step: 'Creando proveedores automáticamente...', status: 'loading' }
      ]);
      await new Promise(resolve => setTimeout(resolve, 600));

      // PASO 3: Comparaciones de precios
      setProcessingSteps(prev => [
        ...prev.slice(0, -1),
        { step: 'Proveedores creados', status: 'success' },
        { step: 'Generando comparaciones de precios...', status: 'loading' }
      ]);
      await new Promise(resolve => setTimeout(resolve, 600));

      setProcessingSteps(prev => [
        ...prev.slice(0, -1),
        { step: 'Comparaciones generadas', status: 'success' },
        { step: '✓ Sincronización completada', status: 'success' }
      ]);

      setResults({
        success: response.data.results?.invoices_created || 0,
        errors: 0,
        providersCreated: response.data.results?.providers_created || 0,
        comparisonsCreated: response.data.results?.comparisons_created || 0,
        source: response.data.source,
        details: { created: [], errors: [], providers: [] }
      });

      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['providers'] });
      queryClient.invalidateQueries({ queryKey: ['price-comparisons'] });

      toast.success(`✅ Sincronización automática completada`);

    } catch (error) {
      setProcessingSteps(prev => [
        ...prev,
        { step: 'Error en sincronización', status: 'error' }
      ]);
      toast.error('Error: ' + error.message);
      setResults({
        success: 0,
        errors: 1,
        providersCreated: 0,
        comparisonsCreated: 0,
        details: { created: [], errors: [{ error: error.message }], providers: [] }
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const { clearTask } = useBackgroundTasks();
  
  const clearState = () => {
    setResults(null);
    setProcessingSteps([]);
    setFileName(null);
    // Limpiar tarea del gestor global
    clearTask('biloop_import');
  };

  // Procesar múltiples archivos en lote - FASE 1: Subir todos, FASE 2: Procesar todos
  const processMultipleFiles = async (files) => {
    setIsProcessing(true);
    setResults(null);
    setProcessingSteps([]);
    setFileName(`${files.length} archivos`);
    setUploadStatus('uploading');
    setUploadProgress(0);

    const totalFiles = files.length;
    const uploadedFiles = [];
    let totalInvoices = 0;
    let totalProviders = 0;
    let totalErrors = 0;
    const allErrors = [];

    startTask('biloop_import', { 
      name: `Importar ${totalFiles} archivos`,
      fileName: `${totalFiles} archivos`
    });

    addLog({
      fileName: `${totalFiles} archivos`,
      fileSize: (files.reduce((acc, f) => acc + f.size, 0) / 1024 / 1024).toFixed(2) + ' MB',
      status: 'iniciado',
      message: `Subiendo ${totalFiles} archivos...`
    });

    // ========== FASE 1: SUBIR TODOS LOS ARCHIVOS ==========
    setProcessingSteps([{ step: `📤 FASE 1: Subiendo ${totalFiles} archivos...`, status: 'loading' }]);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const progress = Math.round(((i + 1) / totalFiles) * 50); // 0-50% para subidas
      setUploadProgress(progress);
      updateTask('biloop_import', { progress });

      try {
        setProcessingSteps(prev => [
          ...prev.slice(0, -1),
          { step: `📤 Subiendo [${i + 1}/${totalFiles}] ${file.name}...`, status: 'loading' }
        ]);

        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        uploadedFiles.push({ file, file_url, name: file.name });

      } catch (uploadErr) {
        totalErrors++;
        allErrors.push({ file: file.name, error: `Error subiendo: ${uploadErr.message}` });
      }
    }

    setProcessingSteps(prev => [
      ...prev.slice(0, -1),
      { step: `✅ ${uploadedFiles.length}/${totalFiles} archivos subidos`, status: 'success' }
    ]);

    setUploadStatus('processing');

    // ========== FASE 2: PROCESAR TODOS CON IA ==========
    setProcessingSteps(prev => [
      ...prev,
      { step: `🧠 FASE 2: Procesando ${uploadedFiles.length} archivos con IA...`, status: 'loading' }
    ]);

    // Obtener proveedores existentes UNA sola vez
    const existingProviders = await base44.entities.Provider.list();
    const existingNames = new Set(existingProviders.map(p => p.name?.toLowerCase()));

    const biloopSchema = {
      type: "object",
      properties: {
        invoices: {
          type: "array",
          items: {
            type: "object",
            properties: {
              provider_name: { type: "string" },
              provider_cif: { type: "string" },
              invoice_number: { type: "string" },
              invoice_date: { type: "string" },
              due_date: { type: "string" },
              subtotal: { type: "number" },
              iva: { type: "number" },
              total: { type: "number" },
              status: { type: "string" },
              category: { type: "string" }
            }
          }
        }
      }
    };

    for (let i = 0; i < uploadedFiles.length; i++) {
      const { file_url, name } = uploadedFiles[i];
      const progress = 50 + Math.round(((i + 1) / uploadedFiles.length) * 50); // 50-100%
      setUploadProgress(progress);
      updateTask('biloop_import', { progress });

      try {
        setProcessingSteps(prev => [
          ...prev.slice(0, -1),
          { step: `🧠 Procesando [${i + 1}/${uploadedFiles.length}] ${name}...`, status: 'loading' }
        ]);

        const extractionResult = await base44.integrations.Core.ExtractDataFromUploadedFile({
          file_url,
          json_schema: biloopSchema
        });

        if (extractionResult.status === "success" && extractionResult.output) {
          let invoicesData = [];
          if (extractionResult.output.invoices && Array.isArray(extractionResult.output.invoices)) {
            invoicesData = extractionResult.output.invoices;
          } else if (Array.isArray(extractionResult.output)) {
            invoicesData = extractionResult.output;
          } else {
            invoicesData = [extractionResult.output];
          }

          for (const invoiceData of invoicesData) {
            try {
              // Crear proveedor si no existe
              const provName = invoiceData.provider_name;
              if (provName && !existingNames.has(provName.toLowerCase())) {
                await base44.entities.Provider.create({
                  name: provName,
                  cif: invoiceData.provider_cif || '',
                  category: invoiceData.category || 'otros',
                  status: 'activo',
                  rating: 3
                });
                existingNames.add(provName.toLowerCase());
                totalProviders++;
              }

              // Mapear estado
              let mappedStatus = 'pendiente';
              if (invoiceData.status) {
                const s = invoiceData.status.toLowerCase();
                if (s.includes('pagad') || s.includes('cobrad')) mappedStatus = 'pagada';
                else if (s.includes('vencid')) mappedStatus = 'vencida';
                else if (s.includes('cancel')) mappedStatus = 'cancelada';
              }

              // Crear factura
              await base44.entities.Invoice.create({
                provider_name: invoiceData.provider_name || 'Sin nombre',
                invoice_number: invoiceData.invoice_number || '',
                invoice_date: invoiceData.invoice_date || '',
                due_date: invoiceData.due_date || '',
                subtotal: invoiceData.subtotal || 0,
                iva: invoiceData.iva || 0,
                total: invoiceData.total || 0,
                status: mappedStatus,
                category: invoiceData.category || 'otros',
                file_url: file_url
              });
              totalInvoices++;
            } catch (invErr) {
              totalErrors++;
              allErrors.push({ file: name, error: invErr.message });
            }
          }
        }

      } catch (procErr) {
        totalErrors++;
        allErrors.push({ file: name, error: `Error procesando: ${procErr.message}` });
      }
    }

    // ========== RESULTADO FINAL ==========
    const finalResults = {
      success: totalInvoices,
      errors: totalErrors,
      providersCreated: totalProviders,
      comparisonsCreated: 0,
      source: 'batch_upload',
      details: { 
        created: [], 
        errors: allErrors.map(e => ({ error: `${e.file}: ${e.error}` })), 
        providers: [] 
      },
      message: `${totalInvoices} facturas + ${totalProviders} proveedores de ${totalFiles} archivos`
    };

    setResults(finalResults);
    setUploadStatus('success');
    setUploadProgress(100);
    completeTask('biloop_import', finalResults);

    setProcessingSteps(prev => [
      ...prev.slice(0, -1),
      { step: `✅ ${uploadedFiles.length} archivos procesados`, status: 'success' },
      { step: `🎉 ${totalInvoices} facturas + ${totalProviders} proveedores importados`, status: 'success' }
    ]);

    addLog({
      fileName: `${totalFiles} archivos`,
      fileSize: (files.reduce((acc, f) => acc + f.size, 0) / 1024 / 1024).toFixed(2) + ' MB',
      status: 'completado',
      message: `${totalInvoices} facturas + ${totalProviders} proveedores`,
      invoices: totalInvoices,
      providers: totalProviders
    });

    queryClient.invalidateQueries({ queryKey: ['invoices'] });
    queryClient.invalidateQueries({ queryKey: ['providers'] });

    toast.success(`✅ ${totalInvoices} facturas de ${totalFiles} archivos importadas`, { duration: 10000 });
    setIsProcessing(false);
  };

  const processFile = async (file) => {
    setIsProcessing(true);
    setResults(null);
    setProcessingSteps([]);
    setFileName(file.name);
    setUploadStatus('uploading');
    setUploadProgress(0);
    
    // Log inicio
    addLog({
      fileName: file.name,
      fileSize: (file.size / 1024 / 1024).toFixed(2) + ' MB',
      status: 'iniciado',
      message: 'Iniciando subida...'
    });
    
    // Iniciar tarea en segundo plano
    startTask('biloop_import', { 
      name: `Importar ${file.name}`,
      fileName: file.name 
    });

    try {
      // PASO 1: Subir archivo
      const step1 = { step: `Subiendo ${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)...`, status: 'loading' };
      setProcessingSteps([step1]);
      addStep('biloop_import', step1);
      updateTask('biloop_import', { progress: 10 });
      setUploadProgress(10);
      
      // Simular progreso durante la subida
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 5, 90));
      }, 500);
      
      let file_url;
      try {
        const uploadResult = await base44.integrations.Core.UploadFile({ file });
        file_url = uploadResult.file_url;

        // Registrar en Archivo Documental
        await base44.entities.UploadedFile.create({
          filename: file.name,
          file_url: file_url,
          source: "Biloop",
          upload_date: new Date().toISOString(),
          uploaded_by: "Sistema (Biloop Import)",
          size: file.size,
          content_type: file.type
        });

        clearInterval(progressInterval);
        setUploadProgress(100);
        setUploadStatus('processing');

        addLog({
          fileName: file.name,
          fileSize: (file.size / 1024 / 1024).toFixed(2) + ' MB',
          status: 'subido',
          message: 'Archivo subido correctamente, procesando...'
        });
      } catch (uploadError) {
        clearInterval(progressInterval);
        setUploadStatus('error');
        addLog({
          fileName: file.name,
          fileSize: (file.size / 1024 / 1024).toFixed(2) + ' MB',
          status: 'error',
          message: `Error subiendo: ${uploadError.message}`
        });
        throw uploadError;
      }
      
      const step2 = { step: 'Extrayendo datos con IA...', status: 'loading' };
      setProcessingSteps(prev => [
        ...prev.slice(0, -1),
        { step: 'Archivo subido', status: 'success' },
        step2
      ]);
      addStep('biloop_import', { step: 'Archivo subido', status: 'success' });
      addStep('biloop_import', step2);
      updateTask('biloop_import', { progress: 30 });

      // Detectar si es ZIP
      const isZip = file.name.toLowerCase().endsWith('.zip') || 
                    file.type === 'application/zip' || 
                    file.type === 'application/x-zip-compressed';

      let extractionResult;

      if (isZip) {
        // Procesar ZIP con función especializada
        setProcessingSteps(prev => [
          ...prev.slice(0, -1),
          { step: 'Descomprimiendo ZIP...', status: 'loading' }
        ]);
        
        const zipResult = await base44.functions.invoke('processZipFile', { file_url });
        
        if (zipResult.data?.success) {
          extractionResult = {
            status: "success",
            output: [] // Los datos ya fueron procesados por la función
          };
          
          // Mostrar resultados del ZIP
          const finalResults = {
            success: zipResult.data.results.invoices_created,
            errors: zipResult.data.results.errors.length,
            providersCreated: zipResult.data.results.providers_created,
            comparisonsCreated: 0,
            source: 'zip_upload',
            details: { 
              created: [], 
              errors: zipResult.data.results.errors.map(e => ({ error: e })), 
              providers: [],
              files: zipResult.data.results.extracted_files
            },
            message: zipResult.data.message
          };
          
          setResults(finalResults);
          completeTask('biloop_import', finalResults);
          
          setProcessingSteps(prev => [
            ...prev.slice(0, -1),
            { step: `ZIP: ${zipResult.data.results.files_processed} archivos procesados`, status: 'success' },
            { step: `${zipResult.data.results.invoices_created} facturas creadas`, status: 'success' },
            { step: '✓ Importación completada', status: 'success' }
          ]);

          queryClient.invalidateQueries({ queryKey: ['invoices'] });
          queryClient.invalidateQueries({ queryKey: ['providers'] });

          setUploadStatus('success');
          addLog({
            fileName: file.name,
            fileSize: (file.size / 1024 / 1024).toFixed(2) + ' MB',
            status: 'completado',
            message: zipResult.data.message,
            invoices: zipResult.data.results.invoices_created,
            providers: zipResult.data.results.providers_created
          });

          toast.success(zipResult.data.message, { duration: 10000 });
          setIsProcessing(false);
          return;
        } else {
          throw new Error(zipResult.data?.error || 'Error procesando ZIP');
        }
      }

      // PASO 2: Definir esquema de datos de Biloop (para CSV/Excel/PDF)
      // IMPORTANTE: El schema raíz debe ser "object", no "array"
      const biloopSchema = {
        type: "object",
        properties: {
          invoices: {
            type: "array",
            description: "Lista de facturas extraídas del documento",
            items: {
              type: "object",
              properties: {
                provider_name: { type: "string", description: "Nombre del proveedor" },
                provider_cif: { type: "string", description: "CIF/NIF del proveedor" },
                invoice_number: { type: "string", description: "Número de factura" },
                invoice_date: { type: "string", description: "Fecha de la factura (YYYY-MM-DD)" },
                due_date: { type: "string", description: "Fecha de vencimiento" },
                subtotal: { type: "number", description: "Base imponible" },
                iva: { type: "number", description: "Importe IVA" },
                total: { type: "number", description: "Total factura" },
                status: { type: "string", description: "Estado: pendiente, pagada, vencida" },
                category: { type: "string", description: "Categoría: suministros, servicios, etc." }
              }
            }
          }
        }
      };

      // PASO 3: Extraer datos con IA
      extractionResult = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: biloopSchema
      });

      if (extractionResult.status === "success" && extractionResult.output) {
        setProcessingSteps(prev => [
          ...prev.slice(0, -1),
          { step: 'Datos extraídos', status: 'success' },
          { step: 'Creando proveedores...', status: 'loading' }
        ]);
        updateTask('biloop_import', { progress: 50 });
        
        // Extraer array de facturas del objeto respuesta
        let invoicesData = [];
        if (extractionResult.output.invoices && Array.isArray(extractionResult.output.invoices)) {
          invoicesData = extractionResult.output.invoices;
        } else if (Array.isArray(extractionResult.output)) {
          invoicesData = extractionResult.output;
        } else {
          // Si es un objeto único (una sola factura), convertirlo en array
          invoicesData = [extractionResult.output];
        }

        // PASO 4: AUTOMÁTICO: Crear proveedores si no existen
        const createdProviders = [];
        const uniqueProviderNames = [...new Set(invoicesData.map(inv => inv.provider_name).filter(Boolean))];
        
        const existingProviders = await base44.entities.Provider.list();
        const existingNames = existingProviders.map(p => p.name);

        for (const providerName of uniqueProviderNames) {
          if (!existingNames.includes(providerName)) {
            try {
              const invoiceWithProvider = invoicesData.find(inv => inv.provider_name === providerName);
              const newProvider = await base44.entities.Provider.create({
                name: providerName,
                cif: invoiceWithProvider.provider_cif || '',
                category: invoiceWithProvider.category || 'otros',
                status: 'activo',
                rating: 3
              });
              createdProviders.push(newProvider);
            } catch (error) {
              console.error(`Error creating provider ${providerName}:`, error);
              // Optionally add provider creation errors to general errors list
              // errors.push({ data: { provider_name: providerName }, error: `Failed to create provider: ${error.message}` });
            }
          }
        }

        setProcessingSteps(prev => [
          ...prev.slice(0, -1),
          { step: `${createdProviders.length} proveedores creados`, status: 'success' },
          { step: 'Creando facturas...', status: 'loading' }
        ]);
        updateTask('biloop_import', { progress: 70 });

        // PASO 5: Crear facturas
        const created = [];
        const errors = [];

        for (const invoiceData of invoicesData) {
          try {
            // Mapear estado de Biloop a nuestro sistema
            let mappedStatus = 'pendiente';
            if (invoiceData.status) {
              const statusLower = invoiceData.status.toLowerCase();
              if (statusLower.includes('pagad') || statusLower.includes('cobrad')) {
                mappedStatus = 'pagada';
              } else if (statusLower.includes('vencid')) {
                mappedStatus = 'vencida';
              } else if (statusLower.includes('cancel')) {
                mappedStatus = 'cancelada';
              }
            }

            const newInvoice = await base44.entities.Invoice.create({
              provider_name: invoiceData.provider_name || 'Sin nombre',
              invoice_number: invoiceData.invoice_number || '',
              invoice_date: invoiceData.invoice_date || '',
              due_date: invoiceData.due_date || '',
              subtotal: invoiceData.subtotal || 0,
              iva: invoiceData.iva || 0,
              total: invoiceData.total || 0,
              status: mappedStatus,
              category: invoiceData.category || 'otros'
            });
            created.push(newInvoice);
          } catch (error) {
            errors.push({ data: invoiceData, error: error.message });
          }
        }

        setProcessingSteps(prev => [
          ...prev.slice(0, -1),
          { step: `${created.length} facturas creadas`, status: 'success' },
          { step: '✓ Importación completada', status: 'success' }
        ]);

        const finalResults = {
          success: created.length,
          errors: errors.length,
          providersCreated: createdProviders.length,
          comparisonsCreated: 0,
          source: 'manual_upload',
          details: { created, errors, providers: createdProviders },
          message: `${created.length} facturas + ${createdProviders.length} proveedores importados`
        };
        
        setResults(finalResults);
        completeTask('biloop_import', finalResults);

        queryClient.invalidateQueries({ queryKey: ['invoices'] });
        queryClient.invalidateQueries({ queryKey: ['providers'] });

        setUploadStatus('success');
        addLog({
          fileName: file.name,
          fileSize: (file.size / 1024 / 1024).toFixed(2) + ' MB',
          status: 'completado',
          message: `${created.length} facturas + ${createdProviders.length} proveedores importados`,
          invoices: created.length,
          providers: createdProviders.length
        });

        toast.success(`✅ ${created.length} facturas + ${createdProviders.length} proveedores creados automáticamente`, {
          duration: 10000
        });
        if (errors.length > 0) {
          toast.warning(`⚠️ ${errors.length} registros con errores`);
        }
      } else {
        const errorResult = {
          success: 0,
          errors: 1,
          providersCreated: 0,
          details: { created: [], errors: [{ error: extractionResult.details }], providers: [] }
        };
        setResults(errorResult);
        failTask('biloop_import', 'No se pudieron extraer datos del archivo');
      }
    } catch (error) {
      console.error(error);
      const errorResult = {
        success: 0,
        errors: 1,
        providersCreated: 0,
        details: { created: [], errors: [{ error: error.message }], providers: [] }
      };
      setResults(errorResult);
      setUploadStatus('error');
      addLog({
        fileName: file.name,
        fileSize: (file.size / 1024 / 1024).toFixed(2) + ' MB',
        status: 'error',
        message: error.message
      });
      failTask('biloop_import', error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="p-4 md:p-8 min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-3 h-3 bg-cyan-400 rounded-full animate-pulse" style={{ boxShadow: '0 0 10px rgba(6, 182, 212, 0.8)' }} />
            <span className="text-sm font-medium text-cyan-400" style={{ textShadow: '0 0 10px rgba(6, 182, 212, 0.6)' }}>
              Sincronización Biloop • Assempsa
            </span>
          </div>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <h1 className="text-5xl font-black text-white mb-3 flex items-center gap-4">
                <div 
                  className="w-16 h-16 bg-black rounded-2xl flex items-center justify-center border border-cyan-500/50"
                  style={{ boxShadow: '0 0 30px rgba(6, 182, 212, 0.4), inset 0 0 20px rgba(6, 182, 212, 0.1)' }}
                >
                  <Database className="w-9 h-9 text-cyan-400" style={{ filter: 'drop-shadow(0 0 10px rgba(6, 182, 212, 0.8))' }} />
                </div>
                <span className="text-cyan-400" style={{ textShadow: '0 0 20px rgba(6, 182, 212, 0.6)' }}>BILOOP SYNC</span>
              </h1>
              <p className="text-xl text-zinc-400">
                🔄 Sincronización automática de facturas 2025 • Gestión inteligente
              </p>
            </div>
          </div>
        </div>

        {/* Mode Selector */}
        <Card 
          className="border-none shadow-2xl mb-8 bg-black border border-cyan-500/50"
          style={{ boxShadow: '0 0 30px rgba(6, 182, 212, 0.3)' }}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-start gap-4">
                <div 
                  className="w-12 h-12 bg-black border border-cyan-500/50 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ boxShadow: '0 0 15px rgba(6, 182, 212, 0.4)' }}
                >
                  <Zap className="w-6 h-6 text-cyan-400" style={{ filter: 'drop-shadow(0 0 6px rgba(6, 182, 212, 0.8))' }} />
                </div>
                <div>
                  <h3 className="font-bold text-xl mb-2 text-cyan-400">⚡ Modo de Sincronización</h3>
                  <p className="text-sm text-cyan-100/70">
                    {syncMode === 'auto' 
                      ? '🤖 Automático: Conecta directamente con Biloop API y sincroniza facturas 2025'
                      : '📁 Manual: Sube archivos CSV/Excel exportados desde Biloop'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Label htmlFor="sync-mode" className="text-cyan-400 font-medium cursor-pointer">
                  {syncMode === 'auto' ? 'Automático' : 'Manual'}
                </Label>
                <Switch
                  id="sync-mode"
                  checked={syncMode === 'auto'}
                  onCheckedChange={(checked) => setSyncMode(checked ? 'auto' : 'manual')}
                  className="data-[state=checked]:bg-cyan-500 data-[state=unchecked]:bg-zinc-700"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Auto Sync Panel */}
        {syncMode === 'auto' && (
          <Card className="border-none shadow-2xl bg-zinc-800/50 border border-zinc-800 mb-8">
            <CardHeader 
              className="bg-black border-b border-cyan-500/30 text-white rounded-t-xl"
              style={{ boxShadow: '0 0 20px rgba(6, 182, 212, 0.2)' }}
            >
              <CardTitle className="flex items-center gap-3">
                <Zap className="w-7 h-7 text-cyan-400" style={{ filter: 'drop-shadow(0 0 8px rgba(6, 182, 212, 0.8))' }} />
                <span className="text-cyan-400">🚀 Sincronización Automática</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8">
              {!isProcessing && !results && (
                <div className="text-center space-y-6">
                  <div className="flex justify-center gap-6 mb-8">
                    <div className="text-center">
                      <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-xl">
                        <Database className="w-10 h-10 text-white" />
                      </div>
                      <p className="text-sm font-medium text-gray-300">Biloop API</p>
                    </div>
                    <div className="flex items-center">
                      <ArrowRight className="w-8 h-8 text-blue-400" />
                    </div>
                    <div className="text-center">
                      <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-xl">
                        <CheckCircle2 className="w-10 h-10 text-white" />
                      </div>
                      <p className="text-sm font-medium text-gray-300">Facturas 2025</p>
                    </div>
                  </div>
                  <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                    <h3 className="text-lg font-bold text-white mb-4">🎯 Proceso Automático:</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                          <span className="text-white font-bold">1</span>
                        </div>
                        <div>
                          <p className="text-white font-medium text-sm">Conecta con Biloop</p>
                          <p className="text-gray-400 text-xs mt-1">API assempsa.biloop.es</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center flex-shrink-0">
                          <span className="text-white font-bold">2</span>
                        </div>
                        <div>
                          <p className="text-white font-medium text-sm">Sincroniza datos</p>
                          <p className="text-gray-400 text-xs mt-1">Facturas + Proveedores</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                          <span className="text-white font-bold">3</span>
                        </div>
                        <div>
                          <p className="text-white font-medium text-sm">Genera insights</p>
                          <p className="text-gray-400 text-xs mt-1">Comparaciones IA</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <Button
                    onClick={runAutoSync}
                    size="lg"
                    className="bg-black border border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10 font-bold text-lg px-8 py-6"
                    style={{ boxShadow: '0 0 25px rgba(6, 182, 212, 0.4)' }}
                  >
                    <Zap className="w-6 h-6 mr-3" />
                    Iniciar Sincronización Automática
                  </Button>
                </div>
              )}

              {isProcessing && (
                <div className="space-y-6">
                  <div className="flex justify-center mb-6">
                    <Loader2 className="w-20 h-20 text-blue-500 animate-spin" />
                  </div>
                  <div className="space-y-3">
                    {processingSteps.map((step, idx) => (
                      <div key={idx} className="flex items-center gap-3 bg-slate-800 rounded-lg p-4 border border-slate-700">
                        {step.status === 'loading' && <Loader2 className="w-5 h-5 text-blue-400 animate-spin flex-shrink-0" />}
                        {step.status === 'success' && <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />}
                        {step.status === 'error' && <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />}
                        <span className={`text-sm font-medium ${
                          step.status === 'success' ? 'text-green-300' :
                          step.status === 'error' ? 'text-red-300' :
                          'text-blue-300'
                        }`}>
                          {step.step}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Manual Upload Panel */}
        {syncMode === 'manual' && (
          <Card className="border-none shadow-2xl bg-zinc-800/50 border border-zinc-800 mb-8">
            <CardHeader 
              className="bg-black border-b border-cyan-500/30 text-white rounded-t-xl"
              style={{ boxShadow: '0 0 20px rgba(6, 182, 212, 0.2)' }}
            >
              <CardTitle className="flex items-center gap-3">
                <Upload className="w-7 h-7 text-cyan-400" style={{ filter: 'drop-shadow(0 0 8px rgba(6, 182, 212, 0.8))' }} />
                <span className="text-cyan-400">📁 Importación Manual</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8">
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-12 text-center transition-all ${
                  dragActive ? 'border-purple-500 bg-purple-900/20' : 'border-slate-600 hover:border-slate-500'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls,.pdf,.zip"
                  onChange={handleFileInput}
                  className="hidden"
                  disabled={isProcessing}
                  multiple
                />
                
                {isProcessing ? (
                  <div className="space-y-6">
                    {/* Barra de progreso */}
                    <div className="w-full max-w-md mx-auto">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-purple-300">
                          {uploadStatus === 'uploading' ? '📤 Subiendo archivo...' : '🔄 Procesando...'}
                        </span>
                        <span className="text-sm font-bold text-white">{uploadProgress}%</span>
                      </div>
                      <div className="w-full bg-slate-700 rounded-full h-4 overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300 rounded-full"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>

                    {fileName && (
                      <div className="flex items-center justify-center gap-3 bg-slate-700/50 rounded-xl p-4 max-w-md mx-auto">
                        <HardDrive className="w-6 h-6 text-purple-400" />
                        <div className="text-left">
                          <p className="text-white font-medium">{fileName}</p>
                          <p className="text-xs text-gray-400">
                            {uploadStatus === 'uploading' ? 'Subiendo al servidor...' : 'Extrayendo datos con IA...'}
                          </p>
                        </div>
                      </div>
                    )}

                    <p className="text-center text-gray-400 text-sm">
                      💡 Puedes navegar a otras páginas, el proceso continuará en segundo plano
                    </p>

                    <div className="space-y-3">
                      {processingSteps.map((step, idx) => (
                        <div key={idx} className="flex items-center justify-center gap-3 text-gray-300">
                          {step.status === 'loading' && <Loader2 className="w-4 h-4 animate-spin" />}
                          {step.status === 'success' && <CheckCircle2 className="w-4 h-4 text-green-400" />}
                          {step.status === 'error' && <XCircle className="w-4 h-4 text-red-400" />}
                          <span className="text-sm">{step.step}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex justify-center">
                      <div className="w-24 h-24 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-2xl">
                        <FileSpreadsheet className="w-12 h-12 text-white" />
                      </div>
                    </div>
                    <div>
                      <p className="text-xl font-bold mb-2 text-white">
                        Arrastra tu archivo de Biloop aquí
                      </p>
                      <p className="text-sm text-gray-400 mb-6">
                        CSV, Excel, PDF o ZIP • La IA procesará todo automáticamente
                      </p>
                      <Button
                        onClick={() => fileInputRef.current?.click()}
                        size="lg"
                        className="bg-black border border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10 font-bold"
                        style={{ boxShadow: '0 0 20px rgba(6, 182, 212, 0.4)' }}
                      >
                        <Upload className="w-5 h-5 mr-2" />
                        Seleccionar Archivo
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {results && (
          <Card className="border-none shadow-2xl bg-zinc-800/50 border border-zinc-800">
            <CardHeader 
              className="bg-black border-b border-cyan-500/30 text-white rounded-t-xl"
              style={{ boxShadow: '0 0 20px rgba(6, 182, 212, 0.2)' }}
            >
              <CardTitle className="flex items-center gap-3 text-2xl">
                {results.success > 0 ? (
                  <>
                    <CheckCircle2 className="w-8 h-8 text-cyan-400" style={{ filter: 'drop-shadow(0 0 8px rgba(6, 182, 212, 0.8))' }} />
                    <span className="text-cyan-400">✅ Sincronización Completada</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-8 h-8 text-red-400" />
                    <span className="text-red-400">❌ Error en Sincronización</span>
                  </>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-gradient-to-br from-green-900/30 to-emerald-900/30 border-2 border-green-600 rounded-xl p-6">
                  <div className="flex items-center gap-4 mb-3">
                    <div className="w-14 h-14 bg-green-600 rounded-xl flex items-center justify-center">
                      <FileSpreadsheet className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-400 font-medium">Facturas</p>
                      <p className="text-4xl font-black text-white">{results.success}</p>
                    </div>
                  </div>
                  <Badge className="bg-green-600 text-white">
                    {results.source === 'biloop_api' ? '🌐 API Real' : '📁 Upload Manual'}
                  </Badge>
                </div>

                <div className="bg-gradient-to-br from-blue-900/30 to-cyan-900/30 border-2 border-blue-600 rounded-xl p-6">
                  <div className="flex items-center gap-4 mb-3">
                    <div className="w-14 h-14 bg-blue-600 rounded-xl flex items-center justify-center">
                      <Users className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-400 font-medium">Proveedores</p>
                      <p className="text-4xl font-black text-white">{results.providersCreated}</p>
                    </div>
                  </div>
                  <Badge className="bg-blue-600 text-white">Automático</Badge>
                </div>

                <div className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 border-2 border-purple-600 rounded-xl p-6">
                  <div className="flex items-center gap-4 mb-3">
                    <div className="w-14 h-14 bg-purple-600 rounded-xl flex items-center justify-center">
                      <TrendingUp className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-400 font-medium">Comparaciones</p>
                      <p className="text-4xl font-black text-white">{results.comparisonsCreated || 0}</p>
                    </div>
                  </div>
                  <Badge className="bg-purple-600 text-white">IA Insights</Badge>
                </div>
              </div>

              {results.providersCreated > 0 && results.details.providers?.length > 0 && (
                <div className="bg-slate-800 border border-slate-600 rounded-xl p-6 mb-6">
                  <p className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-blue-400" />
                    Proveedores creados automáticamente:
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {results.details.providers.map((prov, idx) => (
                      <Badge key={idx} className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white text-sm px-4 py-2">
                        {prov.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {results.success > 0 && (
                <div className="flex justify-center gap-4">
                  <Button
                    onClick={() => window.location.href = '/Invoices'}
                    size="lg"
                    className="bg-black border border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10 font-bold"
                    style={{ boxShadow: '0 0 20px rgba(6, 182, 212, 0.4)' }}
                  >
                    Ver Facturas Importadas
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:border-cyan-500/50"
                    onClick={clearState}
                  >
                    Nueva Sincronización
                  </Button>
                </div>
              )}

              {results.errors > 0 && results.details.errors.length > 0 && (
                <div className="mt-6 space-y-2">
                  <p className="text-sm font-medium text-gray-700">Detalles de errores:</p>
                  <div className="bg-red-50 rounded-lg p-4 space-y-2 max-h-60 overflow-y-auto">
                    {results.details.errors.map((err, idx) => (
                      <div key={idx} className="text-sm text-red-700">
                        • {err.error}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Historial de Cargas */}
        {uploadLogs.length > 0 && (
          <Card className="border-none shadow-2xl bg-gradient-to-br from-slate-800 to-slate-900 mb-8">
            <CardHeader className="bg-gradient-to-r from-slate-700 to-slate-600 text-white rounded-t-xl">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <History className="w-6 h-6" />
                  📋 Historial de Cargas
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearLogs}
                  className="text-gray-300 hover:text-white hover:bg-slate-600"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Limpiar
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 max-h-80 overflow-y-auto">
              <div className="divide-y divide-slate-700">
                {uploadLogs.map((log) => (
                  <div key={log.id} className="p-4 hover:bg-slate-700/50 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        {log.status === 'completado' && <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />}
                        {log.status === 'error' && <XCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />}
                        {log.status === 'subido' && <Upload className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />}
                        {log.status === 'iniciado' && <Clock className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />}
                        <div>
                          <p className="font-medium text-white">{log.fileName}</p>
                          <p className="text-sm text-gray-400">{log.fileSize}</p>
                          <p className={`text-sm mt-1 ${
                            log.status === 'completado' ? 'text-green-400' : 
                            log.status === 'error' ? 'text-red-400' : 'text-gray-300'
                          }`}>
                            {log.message}
                          </p>
                          {log.invoices !== undefined && (
                            <div className="flex gap-4 mt-2">
                              <Badge className="bg-green-600 text-white">{log.invoices} facturas</Badge>
                              <Badge className="bg-blue-600 text-white">{log.providers} proveedores</Badge>
                            </div>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-gray-500 flex-shrink-0">
                        {new Date(log.timestamp).toLocaleString('es-ES', { 
                          day: '2-digit', 
                          month: '2-digit', 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Support Info */}
        {!results && (
          <Card className="border-none shadow-2xl bg-slate-800 border border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="font-bold text-white mb-2 text-lg">💡 Información</p>
                  <div className="space-y-2 text-sm text-gray-300">
                    <p>
                      <strong className="text-white">Modo Automático:</strong> Conecta directamente con assempsa.biloop.es vía API y sincroniza solo facturas de 2025
                    </p>
                    <p>
                      <strong className="text-white">Modo Manual:</strong> Exporta desde Biloop y sube archivos CSV/Excel/PDF
                    </p>
                    <p className="pt-2 border-t border-slate-700">
                      <strong className="text-blue-400">Formato recomendado:</strong> CSV con columnas: Proveedor, CIF, Nº Factura, Fecha, Total, IVA
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}