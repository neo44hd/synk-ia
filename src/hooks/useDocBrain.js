/**
 * useDocBrain - Hook de integracion del Cerebro IA con SmartDocumentArchive
 * Auto-procesa documentos subidos, clasifica y vincula proveedores automaticamente
 *
 * FIX: El OCR fallaba para URLs local:// porque ocrService no puede fetchear ese esquema.
 *      Ahora se intenta primero getPendingFile(url) de integrationsService para obtener
 *      el File object real (disponible cuando el archivo se acaba de subir en la misma sesión).
 *      Si el archivo ya no está en memoria, se intenta con ocrService como antes.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { docBrain } from '@/services/docBrainService';
import { ocrService } from '@/services/ocrService';
import { invoiceExtractor } from '@/services/invoiceExtractorService';
import { getPendingFile, extractTextFromFile } from '@/services/integrationsService';
import { toast } from 'sonner';

export function useDocBrain() {
  const queryClient = useQueryClient();
  const [brainStatus, setBrainStatus] = useState('idle');
  const [brainStats, setBrainStats] = useState(null);
  const [autoProcessing, setAutoProcessing] = useState(true);
  const processingRef = useRef(false);

  // Auto-process new pending files
  const processNewFiles = useCallback(async (files) => {
    if (processingRef.current || !autoProcessing) return;

    const pending = files.filter(f =>
      f.processing_status === 'pending' &&
      !f.metadata?.brain_processed
    );

    if (pending.length === 0) return;

    processingRef.current = true;
    setBrainStatus('processing');

    let processed = 0;
    let errors = 0;

    for (const file of pending) {
      try {
        // Step 1: Extraer texto
        await base44.entities.UploadedFile.update(file.id, {
          processing_status: 'ocr_processing'
        });

        let extractedText = '';
        let ocrConfidence = 0;

        // NUEVO: si el archivo acaba de subirse, está en _pendingFiles de integrationsService
        // Esto evita el problema de que ocrService no puede leer URLs local://
        const pendingFile = getPendingFile(file.file_url);

        if (pendingFile) {
          // Tenemos el File object real → extraer texto directamente con PDF.js
          try {
            const text = await extractTextFromFile(pendingFile);
            if (text && text.length > 10) {
              extractedText = text;
              ocrConfidence = 80; // confianza estimada para PDF con texto embebido
            }
          } catch (e) {
            console.warn('[useDocBrain] extractTextFromFile error:', e.message);
          }
        }

        // Si no tenemos texto aún, intentar con ocrService (funciona para URLs reales)
        if (!extractedText && file.file_url && !file.file_url.startsWith('local://')) {
          try {
            const ocrResult = await ocrService.processDocument(
              file.file_url, file.content_type
            );
            if (ocrResult.success) {
              extractedText = ocrResult.text;
              ocrConfidence = ocrResult.confidence;
            }
          } catch (e) {
            console.warn('[useDocBrain] OCR failed:', e.message);
          }
        }

        // Step 2: DocBrain classification + extraction
        await base44.entities.UploadedFile.update(file.id, {
          processing_status: 'extracting'
        });

        // Use docBrain to classify with extracted text
        let brainResult = { extracted: {}, classification: {}, confidence: 0 };
        try {
          if (extractedText && extractedText.length > 10) {
            // Create a minimal file-like object for docBrain
            const fakeFile = {
              name: file.filename || 'document',
              type: file.content_type || 'application/pdf',
              size: file.size || 0,
              text: async () => extractedText
            };
            const docResult = await docBrain.processDocument(fakeFile, extractedText);
            if (docResult && docResult.status !== 'error') {
              brainResult = {
                extracted: docResult.extracted || {},
                classification: docResult.classification || {},
                confidence: docResult.confidence || docResult.extracted?.confidence || 0
              };
            }
          }
        } catch (brainError) {
          console.warn('[useDocBrain] DocBrain processing failed, using fallback:', brainError);
        }

        // Step 3: Merge OCR regex extraction with brain results
        let regexData = null;
        if (extractedText.length > 50) {
          regexData = invoiceExtractor.extractInvoiceData(extractedText);
        }

        const mergedData = mergeResults(regexData, brainResult);

        // Step 4: Auto-link/create provider
        let providerLink = null;
        const provName = mergedData.provider;
        const provCif = mergedData.providerCif;

        if (provName || provCif) {
          providerLink = await autoLinkProvider(provName, provCif, {
            address: mergedData.providerAddress,
            phone: mergedData.providerPhone,
            email: mergedData.providerEmail,
            sourceFileId: file.id
          });
        }

        // Step 5: Determine confidence and status
        const confidence = Math.max(
          brainResult.confidence || 0,
          regexData?.confidence || 0,
          ocrConfidence
        );

        const hasCriticalData = mergedData.provider && mergedData.total;
        const finalStatus = confidence >= 60 && hasCriticalData
          ? 'completed'
          : confidence >= 30
            ? 'needs_review'
            : extractedText.length > 20
              ? 'needs_review'  // tiene texto pero datos insuficientes → revisar
              : 'error';

        // Step 6: Save everything
        await base44.entities.UploadedFile.update(file.id, {
          processing_status: finalStatus,
          detected_type: mergedData.documentType || 'Otros',
          metadata: {
            ...file.metadata,
            ocr: {
              text: extractedText.substring(0, 10000),
              confidence: ocrConfidence,
              processed_at: new Date().toISOString()
            },
            extracted: mergedData,
            brain_processed: true,
            brain_classification: brainResult.classification,
            brain_confidence: brainResult.confidence,
            confidence: confidence,
            providerLink: providerLink,
            processing_completed: new Date().toISOString()
          }
        });

        processed++;

        if (providerLink?.type === 'created') {
          toast.success(`Nuevo proveedor creado: ${providerLink.name}`, { icon: '🧠' });
        }

      } catch (error) {
        console.error(`DocBrain error processing ${file.filename}:`, error);
        errors++;
        await base44.entities.UploadedFile.update(file.id, {
          processing_status: 'error',
          metadata: {
            ...file.metadata,
            brain_error: error.message,
            brain_processed: true
          }
        }).catch(() => {});
      }
    }

    processingRef.current = false;
    setBrainStatus('idle');

    if (processed > 0) {
      toast.success(
        `🧠 DocBrain: ${processed} documento(s) procesado(s)${errors > 0 ? `, ${errors} error(es)` : ''}`,
        { duration: 4000 }
      );
      queryClient.invalidateQueries({ queryKey: ['smart-archive-files'] });
      queryClient.invalidateQueries({ queryKey: ['providers'] });
    }

    setBrainStats({ processed, errors, lastRun: new Date() });
  }, [autoProcessing, queryClient]);

  return {
    brainStatus,
    brainStats,
    autoProcessing,
    setAutoProcessing,
    processNewFiles,
  };
}

// Merge regex extraction with AI brain results
function mergeResults(regexData, brainResult) {
  const ai = brainResult.extracted || {};
  const rx = regexData || {};

  return {
    documentType: ai.documentType?.label || rx.documentType?.label || 'Otros',
    provider: rx.provider?.name?.value || ai.provider?.name?.value || '',
    providerCif: rx.provider?.cif?.value || ai.provider?.cif?.value || '',
    providerAddress: rx.provider?.address?.value || ai.provider?.address?.value || '',
    providerPhone: rx.provider?.phone?.value || ai.provider?.phone?.value || '',
    providerEmail: rx.provider?.email?.value || ai.provider?.email?.value || '',
    invoiceNumber: rx.invoiceNumber?.value || ai.invoiceNumber?.value || '',
    invoiceDate: rx.invoiceDate?.value || ai.invoiceDate?.value || '',
    dueDate: rx.dueDate?.value || ai.dueDate?.value || '',
    subtotal: rx.subtotal?.value || ai.subtotal?.value || null,
    iva: rx.iva?.value || ai.iva?.value || null,
    ivaPercentage: rx.iva?.percentage || ai.iva?.percentage || null,
    total: rx.total?.value || ai.total?.value || null,
    paymentMethod: rx.paymentMethod?.value || ai.paymentMethod?.value || '',
    concepts: ai.concepts || rx.concepts || [],
    summary: ai.summary || '',
  };
}

// Auto-find or create provider
async function autoLinkProvider(name, cif, extra = {}) {
  if (!name && !cif) return null;

  try {
    // Try CIF first
    if (cif) {
      const byCif = await base44.entities.Provider.filter({ cif });
      if (byCif.length > 0) {
        return { type: 'linked', id: byCif[0].id, name: byCif[0].name, method: 'cif' };
      }
    }

    // Try name
    if (name) {
      const byName = await base44.entities.Provider.filter({ name });
      if (byName.length > 0) {
        return { type: 'linked', id: byName[0].id, name: byName[0].name, method: 'name' };
      }
    }

    // Create new
    const newProvider = await base44.entities.Provider.create({
      name: name || 'Proveedor sin nombre',
      cif: cif || '',
      address: extra.address || '',
      phone: extra.phone || '',
      email: extra.email || '',
      category: 'otros',
      status: 'activo',
      created_from_document: extra.sourceFileId,
      auto_created: true
    });

    return { type: 'created', id: newProvider.id, name: newProvider.name, method: 'auto' };
  } catch (error) {
    console.error('Error auto-linking provider:', error);
    return null;
  }
}

export default useDocBrain;
