/**
 * Assembly Line Orchestrator (Cadena de Montaje)
 * 
 * Flujo completo:
 * Reprocessar → Clasificar → Extraer Datos → Enviar a Destino
 * 
 * Ejemplos de destinos:
 * - Facturas → Contabilidad (análisis financiero)
 * - Nóminas → RRHH (gestión de empleados)
 * - Documentos → Archivo (clasificación)
 * - Correos → CRM (seguimiento de clientes)
 */

import { EventEmitter } from 'events';
import { readFileSync } from 'fs';
import path from 'path';

const DATA_DIR = process.env.DATA_DIR || '/Users/davidnows/sinkia-next/data';

class AssemblyLineOrchestrator extends EventEmitter {
  constructor() {
    super();
    this.isRunning = false;
    this.stats = {
      reprocessed: 0,
      classified: 0,
      extracted: 0,
      routed: 0,
      failed: 0,
      destinations: {
        accounting: 0,
        hr: 0,
        crm: 0,
        archive: 0,
        compliance: 0,
        other: 0
      },
      startTime: null,
      endTime: null
    };
  }

  /**
   * Inicia la cadena de montaje
   */
  start(intervalMs = 600000) {
    if (this.isRunning) {
      console.log('[AssemblyLine] ⚠️  Ya está en ejecución');
      return;
    }

    this.isRunning = true;
    this.stats.startTime = new Date().toISOString();

    console.log(`[AssemblyLine] ✅ CADENA DE MONTAJE INICIADA`);
    console.log(`[AssemblyLine] 🔗 Flujo: Reprocessar → Clasificar → Extraer → Destino`);
    console.log(`[AssemblyLine] ⏰ Intervalo: ${intervalMs}ms (${(intervalMs/60000).toFixed(1)} min)\n`);

    this.emit('started', { timestamp: new Date().toISOString() });

    // Primera ejecución inmediata
    this._runAssemblyLine();

    // Luego periódicamente
    this.intervalId = setInterval(() => {
      if (this.isRunning) {
        this._runAssemblyLine();
      }
    }, intervalMs);
  }

  /**
   * Detiene la cadena de montaje
   */
  stop() {
    if (!this.isRunning) return;

    this.isRunning = false;
    clearInterval(this.intervalId);
    this.stats.endTime = new Date().toISOString();

    console.log('[AssemblyLine] ⏹️  Detenido');
    this.emit('stopped', this.stats);
  }

  /**
   * Ejecuta la cadena de montaje completa
   */
  async _runAssemblyLine() {
    try {
      console.log('\n[AssemblyLine] 🔄 INICIANDO CICLO DE CADENA DE MONTAJE\n');

      // ETAPA 1: REPROCESSAMIENTO
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('ETAPA 1️⃣  REPROCESSAMIENTO');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      const reprocessed = await this._reprocessAll();
      this.stats.reprocessed += reprocessed.count;
      console.log(`✅ Reprocessados: ${reprocessed.count} items\n`);

      // ETAPA 2: CLASIFICACIÓN
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('ETAPA 2️⃣  CLASIFICACIÓN');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      const classified = await this._classifyAll(reprocessed.items);
      this.stats.classified += classified.count;
      console.log(`✅ Clasificados: ${classified.count} items\n`);

      // ETAPA 3: EXTRACCIÓN
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('ETAPA 3️⃣  EXTRACCIÓN DE DATOS');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      const extracted = await this._extractData(classified.items);
      this.stats.extracted += extracted.count;
      console.log(`✅ Extraídos: ${extracted.count} datasets\n`);

      // ETAPA 4: ENRUTAMIENTO A DESTINO
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('ETAPA 4️⃣  ENRUTAMIENTO A DESTINO');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      const routed = await this._routeToDestinations(extracted.items);
      this.stats.routed += routed.count;
      
      // Actualizar contadores por destino
      Object.keys(routed.destinationCount).forEach(dest => {
        if (this.stats.destinations[dest] !== undefined) {
          this.stats.destinations[dest] += routed.destinationCount[dest];
        }
      });

      console.log(`✅ Enrutados: ${routed.count} items a destinos\n`);

      // RESUMEN
      this._printSummary();
      this.emit('cycle-complete', this.stats);

    } catch (error) {
      console.error('[AssemblyLine] Error crítico:', error.message);
      this.stats.failed++;
      this.emit('error', { error: error.message });
    }
  }

  /**
   * ETAPA 1: Reprocessamiento
   */
  async _reprocessAll() {
    try {
      const items = [];
      
      // Cargar todas las fuentes
      const emails = this._loadJSON('emails.json') || [];
      const files = this._loadJSON('uploadedfile.json') || [];
      const invoices = this._loadJSON('invoice.json') || [];

      items.push(
        ...emails.map(e => ({ id: e.message_id, type: 'email', data: e })),
        ...files.map(f => ({ id: f.id, type: 'file', data: f })),
        ...invoices.map(i => ({ id: i.id, type: 'invoice', data: i }))
      );

      console.log(`📧 Correos: ${emails.length}`);
      console.log(`💾 Archivos: ${files.length}`);
      console.log(`💰 Facturas: ${invoices.length}`);

      return { count: items.length, items };
    } catch (error) {
      console.error('Error reprocessando:', error.message);
      return { count: 0, items: [] };
    }
  }

  /**
   * ETAPA 2: Clasificación automática
   */
  async _classifyAll(items) {
    const classified = items.map(item => {
      let category = 'other';
      let destination = 'archive';

      if (item.type === 'email') {
        const subject = (item.data.subject || '').toLowerCase();
        
        if (subject.includes('invoice') || subject.includes('factura')) {
          category = 'invoice';
          destination = 'accounting';
        } else if (subject.includes('nomina') || subject.includes('payroll')) {
          category = 'payroll';
          destination = 'hr';
        } else if (subject.includes('contract') || subject.includes('acuerdo')) {
          category = 'contract';
          destination = 'compliance';
        }
      } else if (item.type === 'file') {
        const filename = (item.data.filename || '').toLowerCase();
        
        if (filename.includes('invoice') || filename.includes('factura')) {
          category = 'invoice';
          destination = 'accounting';
        } else if (filename.includes('nomina') || filename.includes('payroll')) {
          category = 'payroll';
          destination = 'hr';
        } else if (filename.includes('contrato') || filename.includes('contract')) {
          category = 'contract';
          destination = 'compliance';
        }
      } else if (item.type === 'invoice') {
        category = 'invoice';
        destination = 'accounting';
      }

      return {
        ...item,
        category,
        destination,
        classified_at: new Date().toISOString()
      };
    });

    // Estadísticas de clasificación
    const stats = {};
    classified.forEach(c => {
      stats[c.destination] = (stats[c.destination] || 0) + 1;
    });

    Object.entries(stats).forEach(([dest, count]) => {
      console.log(`   ${this._getDestinationEmoji(dest)} ${dest}: ${count}`);
    });

    return { count: classified.length, items: classified };
  }

  /**
   * ETAPA 3: Extracción de datos
   */
  async _extractData(items) {
    const extracted = items.map(item => {
      const data = {};

      if (item.type === 'email') {
        data.from = item.data.sender_email || 'unknown';
        data.subject = item.data.subject || '';
        data.date = item.data.received_date || new Date().toISOString();
        data.has_attachments = item.data.has_attachments || false;
      } else if (item.type === 'file') {
        data.filename = item.data.filename || 'unknown';
        data.size = item.data.size || 0;
        data.type = item.data.detected_type || item.data.tipo || 'unknown';
        data.uploaded = item.data.upload_date || item.data.synced_at;
      } else if (item.type === 'invoice') {
        data.number = item.data.numero || item.data.id;
        data.provider = item.data.provider_name || 'unknown';
        data.amount = item.data.total || 0;
        data.date = item.data.invoice_date || new Date().toISOString();
        data.status = item.data.status || 'unknown';
      }

      return {
        ...item,
        extracted_data: data,
        extracted_at: new Date().toISOString()
      };
    });

    console.log(`   ✓ Extraídos ${extracted.length} datasets`);

    return { count: extracted.length, items: extracted };
  }

  /**
   * ETAPA 4: Enrutamiento a destinos
   */
  async _routeToDestinations(items) {
    const routed = [];
    const destinationCount = {};

    items.forEach(item => {
      const dest = item.destination || 'archive';
      destinationCount[dest] = (destinationCount[dest] || 0) + 1;

      routed.push({
        ...item,
        routed_to: dest,
        routed_at: new Date().toISOString(),
        ready_for_processing: true
      });
    });

    // Mostrar destinos
    console.log(`   🎯 Destinos:`);
    Object.entries(destinationCount).forEach(([dest, count]) => {
      console.log(`      ${this._getDestinationEmoji(dest)} ${dest.toUpperCase()}: ${count} items`);
    });

    return { count: routed.length, items: routed, destinationCount };
  }

  /**
   * Helpers
   */
  _loadJSON(filename) {
    try {
      const filePath = path.join(DATA_DIR, filename);
      const content = readFileSync(filePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      return null;
    }
  }

  _getDestinationEmoji(dest) {
    const emojis = {
      accounting: '💼',
      hr: '👥',
      crm: '📞',
      archive: '📁',
      compliance: '⚖️',
      other: '📦'
    };
    return emojis[dest] || '📦';
  }

  _printSummary() {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📊 RESUMEN DE CICLO');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`✅ Reprocessados:  ${this.stats.reprocessed}`);
    console.log(`📂 Clasificados:   ${this.stats.classified}`);
    console.log(`🔍 Extraídos:      ${this.stats.extracted}`);
    console.log(`🎯 Enrutados:      ${this.stats.routed}`);
    console.log(`\n📍 Distribución por destino:`);
    console.log(`   💼 Contabilidad (Accounting): ${this.stats.destinations.accounting}`);
    console.log(`   👥 RRHH (HR): ${this.stats.destinations.hr}`);
    console.log(`   📞 CRM: ${this.stats.destinations.crm}`);
    console.log(`   📁 Archivo: ${this.stats.destinations.archive}`);
    console.log(`   ⚖️  Compliance: ${this.stats.destinations.compliance}`);
    console.log(`   📦 Otros: ${this.stats.destinations.other}`);
    console.log('═══════════════════════════════════════════════════════════\n');
  }

  /**
   * Obtiene estadísticas
   */
  getStats() {
    return {
      isRunning: this.isRunning,
      stats: this.stats,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Instancia singleton
 */
let orchestratorInstance = null;

export function getAssemblyLineOrchestrator() {
  if (!orchestratorInstance) {
    orchestratorInstance = new AssemblyLineOrchestrator();
  }
  return orchestratorInstance;
}

export default AssemblyLineOrchestrator;
