import { synkia } from '@/api/synkiaClient';

/**
 * BILOOP AGENT SERVICE
 * Agente especializado en procesamiento de documentos contables y facturas
 */

export const BiloopAgentService = {
  // Configuración del agente
  agentName: "biloop_assistant",
  agentTitle: "SYNK-IA Assistant - Procesador de Biloop",
  
  // Prompt del sistema optimizado
  systemPrompt: `Eres el Asistente de Biloop de SYNK-IA, especializado en procesamiento inteligente de documentos contables.

TUS CAPACIDADES:
1. 📄 EXTRACCIÓN DE DATOS: Extraer información de facturas (PDF, imágenes, CSV, Excel)
2. 🏢 IDENTIFICACIÓN DE PROVEEDORES: Detectar y registrar proveedores automáticamente
3. 💰 CLASIFICACIÓN AUTOMÁTICA: Categorizar gastos e ingresos
4. 📊 ANÁLISIS CONTABLE: Revisar importes, IVA, retenciones
5. 🔍 VALIDACIÓN: Detectar errores o inconsistencias en facturas
6. 📈 INFORMES: Generar resúmenes de gastos e ingresos
7. 🔄 INTEGRACIÓN BILOOP: Procesar archivos exportados de Biloop

CÓMO RESPONDES:
- Sé preciso con números y datos financieros
- Explica el proceso de extracción paso a paso
- Confirma datos antes de crear registros
- Alerta sobre posibles errores o anomalías
- Usa emojis para organizar la información
- Proporciona resúmenes claros

FORMATOS SOPORTADOS:
- 📄 PDF de facturas
- 🖼️ Imágenes de documentos (JPG, PNG)
- 📊 Excel/CSV de Biloop
- 📦 ZIP con múltiples archivos

PROCESO DE IMPORTACIÓN:
1. Analizar el archivo subido
2. Extraer datos clave (proveedor, fecha, importe, IVA)
3. Validar la información
4. Crear/actualizar registros en el sistema
5. Informar del resultado

CONTEXTO:
Trabaja principalmente con archivos exportados de Biloop o facturas escaneadas.`,

  /**
   * Procesar archivo de Biloop
   */
  async processBiloopFile(fileUrl, fileName) {
    try {
      // Determinar tipo de archivo
      const fileType = this.detectFileType(fileName);
      
      let result = {
        fileName,
        fileType,
        processed: false,
        invoices: [],
        errors: []
      };

      // Extracción de documentos
      if (fileType === 'pdf' || fileType === 'image') {
        result = await this.extractFromDocument(fileUrl, fileName);
      } else if (fileType === 'csv' || fileType === 'excel') {
        result = await this.extractFromSpreadsheet(fileUrl, fileName);
      }

      return result;
    } catch (error) {
      console.error("Error processing Biloop file:", error);
      return {
        fileName,
        processed: false,
        error: error.message
      };
    }
  },

  /**
   * Detectar tipo de archivo
   */
  detectFileType(fileName) {
    const ext = fileName.split('.').pop().toLowerCase();
    
    if (ext === 'pdf') return 'pdf';
    if (['jpg', 'jpeg', 'png'].includes(ext)) return 'image';
    if (ext === 'csv') return 'csv';
    if (['xlsx', 'xls'].includes(ext)) return 'excel';
    if (ext === 'zip') return 'zip';
    
    return 'unknown';
  },

  /**
   * Extraer datos de documento (PDF/imagen)
   */
  async extractFromDocument(fileUrl, fileName) {
    try {
      const extraction = await synkia.integrations.Core.ExtractData({
        file_url: fileUrl,
        extraction_type: 'invoice'
      });

      return {
        fileName,
        fileType: 'document',
        processed: true,
        invoices: extraction.invoices || [],
        rawData: extraction
      };
    } catch (error) {
      console.error("Error extracting from document:", error);
      return {
        fileName,
        processed: false,
        error: error.message
      };
    }
  },

  /**
   * Extraer datos de hoja de cálculo (CSV/Excel)
   */
  async extractFromSpreadsheet(fileUrl, fileName) {
    try {
      // Para CSV/Excel, podríamos leer el archivo y parsearlo
      // Procesando...
      const extraction = await synkia.integrations.Core.ExtractData({
        file_url: fileUrl,
        extraction_type: 'spreadsheet'
      });

      return {
        fileName,
        fileType: 'spreadsheet',
        processed: true,
        invoices: extraction.invoices || [],
        rawData: extraction
      };
    } catch (error) {
      console.error("Error extracting from spreadsheet:", error);
      return {
        fileName,
        processed: false,
        error: error.message
      };
    }
  },

  /**
   * Crear facturas en el sistema
   */
  async createInvoicesFromData(invoicesData) {
    try {
      const results = {
        success: [],
        failed: []
      };

      for (const invoiceData of invoicesData) {
        try {
          const invoice = await synkia.entities.Invoice.create(invoiceData);
          results.success.push(invoice);
        } catch (error) {
          results.failed.push({
            data: invoiceData,
            error: error.message
          });
        }
      }

      return results;
    } catch (error) {
      console.error("Error creating invoices:", error);
      return { success: [], failed: [] };
    }
  },

  /**
   * Analizar gastos recientes
   */
  async analyzeRecentExpenses(days = 30) {
    try {
      const since = new Date();
      since.setDate(since.getDate() - days);

      const invoices = await synkia.entities.Invoice.list({
        type: 'expense',
        since: since.toISOString()
      });

      // Análisis básico
      const total = invoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
      const byCategory = {};
      
      invoices.forEach(inv => {
        const category = inv.category || 'Sin categoría';
        if (!byCategory[category]) {
          byCategory[category] = { count: 0, total: 0 };
        }
        byCategory[category].count++;
        byCategory[category].total += inv.total || 0;
      });

      return {
        period: `${days} días`,
        totalInvoices: invoices.length,
        totalAmount: total,
        byCategory
      };
    } catch (error) {
      console.error("Error analyzing expenses:", error);
      return null;
    }
  },

  /**
   * Comparar precios entre proveedores
   */
  async compareProviderPrices(productOrService) {
    try {
      const invoices = await synkia.entities.Invoice.list();
      
      // Filtrar facturas que contengan el producto/servicio
      const relevant = invoices.filter(inv => 
        JSON.stringify(inv).toLowerCase().includes(productOrService.toLowerCase())
      );

      // Agrupar por proveedor
      const byProvider = {};
      relevant.forEach(inv => {
        const provider = inv.provider_name || 'Desconocido';
        if (!byProvider[provider]) {
          byProvider[provider] = [];
        }
        byProvider[provider].push({
          amount: inv.total || 0,
          date: inv.date
        });
      });

      return {
        searchTerm: productOrService,
        providersFound: Object.keys(byProvider).length,
        comparison: byProvider
      };
    } catch (error) {
      console.error("Error comparing prices:", error);
      return null;
    }
  },

  /**
   * Enriquecer mensaje con contexto de facturas
   */
  async enrichMessageWithContext(userMessage) {
    try {
      let context = {};

      // Detectar si pregunta por análisis de gastos
      if (/gastos|facturas|últimas|reciente/i.test(userMessage)) {
        context.expenses = await this.analyzeRecentExpenses(30);
      }

      // Detectar si busca ahorros o comparaciones
      if (/ahorro|compara|precio|proveedor/i.test(userMessage)) {
        context.opportunities = 'Puedo comparar precios entre proveedores. ¿Qué producto o servicio quieres analizar?';
      }

      return {
        userMessage,
        context,
        enriched: Object.keys(context).length > 0
      };
    } catch (error) {
      console.error("Error enriching message:", error);
      return { userMessage, enriched: false };
    }
  }
};