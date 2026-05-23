import { synkia } from '@/api/synkiaClient';

/**
 * CENTRAL AGENT SERVICE
 * Agente coordinador central con acceso a todos los módulos
 */

export const CentralAgentService = {
  // Configuración del agente
  agentName: "central_coordinator",
  agentTitle: "IA Central - Coordinador del Sistema",
  
  // Prompt del sistema optimizado
  systemPrompt: `Eres la IA Central de SYNK-IA, el cerebro coordinador que gestiona TODOS los procesos automáticos del negocio.

TUS CAPACIDADES:
1. 📧 PROCESAMIENTO DE EMAILS: Analizar y procesar emails automáticamente
2. 🏢 GESTIÓN DE PROVEEDORES: Detectar, registrar y gestionar proveedores
3. 💰 ANÁLISIS DE PRECIOS: Comparar precios y detectar oportunidades de ahorro
4. 📊 REPORTES EJECUTIVOS: Generar análisis y resúmenes del negocio
5. ⚡ AUTOMATIZACIONES: Coordinar procesos automáticos
6. 🔍 BÚSQUEDA INTELIGENTE: Encontrar información en todo el sistema
7. 🎯 RECOMENDACIONES: Sugerir acciones basadas en datos
8. 🔐 GESTIÓN DE SEGURIDAD: Respetar permisos y roles de usuario

CÓMO RESPONDES:
- Sé proactivo y sugiere acciones automáticas
- Explica qué puedes hacer automáticamente
- Proporciona contexto de todas las áreas del negocio
- Usa emojis para organizar la información
- Destaca oportunidades de optimización
- Coordina con otros agentes especializados cuando sea necesario

MÓDULOS DISPONIBLES:
- 💼 Facturas y presupuestos
- 👥 Clientes y proveedores
- 📧 Procesamiento de emails
- 💰 Análisis financiero
- 📊 Dashboards y métricas
- 🔄 Automatizaciones
- 👔 Recursos Humanos
- 📄 Gestión documental

TU MISIÓN:
Facilitar el trabajo del usuario automatizando tareas, proporcionando información útil y coordinando procesos.`,

  /**
   * Buscar en todo el sistema
   */
  async searchAll(query) {
    try {
      const results = {
        invoices: [],
        clients: [],
        providers: [],
        emails: []
      };

      // Buscar en facturas
      try {
        const invoices = await synkia.entities.Invoice.list();
        results.invoices = invoices.filter(inv => 
          JSON.stringify(inv).toLowerCase().includes(query.toLowerCase())
        ).slice(0, 5);
      } catch (error) {
        console.error("Error searching invoices:", error);
      }

      // Buscar en clientes
      try {
        const clients = await synkia.entities.Client.list();
        results.clients = clients.filter(client => 
          JSON.stringify(client).toLowerCase().includes(query.toLowerCase())
        ).slice(0, 5);
      } catch (error) {
        console.error("Error searching clients:", error);
      }

      return results;
    } catch (error) {
      console.error("Error in searchAll:", error);
      return null;
    }
  },

  /**
   * Analizar oportunidades de ahorro
   */
  async analyzeSavingsOpportunities() {
    try {
      const opportunities = [];

      // Analizar facturas duplicadas o similares
      const invoices = await synkia.entities.Invoice.list();
      
      // Agrupar por proveedor
      const byProvider = {};
      invoices.forEach(inv => {
        const provider = inv.provider_name || 'unknown';
        if (!byProvider[provider]) {
          byProvider[provider] = [];
        }
        byProvider[provider].push(inv);
      });

      // Detectar variaciones de precio
      Object.entries(byProvider).forEach(([provider, providerInvoices]) => {
        if (providerInvoices.length > 1) {
          const amounts = providerInvoices.map(inv => inv.total || 0);
          const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
          const max = Math.max(...amounts);
          const min = Math.min(...amounts);
          
          if ((max - min) / avg > 0.2) {
            opportunities.push({
              type: 'price_variation',
              provider,
              message: `Variación de precios del ${((max - min) / avg * 100).toFixed(0)}% en ${provider}`,
              potential_saving: max - min,
              severity: 'medium'
            });
          }
        }
      });

      return opportunities;
    } catch (error) {
      console.error("Error analyzing savings:", error);
      return [];
    }
  },

  /**
   * Generar resumen del sistema
   */
  async generateSystemOverview() {
    try {
      const overview = {
        invoices: { total: 0, pending: 0, totalAmount: 0 },
        clients: { total: 0, active: 0 },
        providers: { total: 0 },
        opportunities: []
      };

      // Facturas
      try {
        const invoices = await synkia.entities.Invoice.list();
        overview.invoices.total = invoices.length;
        overview.invoices.pending = invoices.filter(i => i.status === 'pending').length;
        overview.invoices.totalAmount = invoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
      } catch (error) {
        console.error("Error getting invoices:", error);
      }

      // Clientes
      try {
        const clients = await synkia.entities.Client.list();
        overview.clients.total = clients.length;
        overview.clients.active = clients.filter(c => c.status === 'active').length;
      } catch (error) {
        console.error("Error getting clients:", error);
      }

      // Oportunidades de ahorro
      overview.opportunities = await this.analyzeSavingsOpportunities();

      return overview;
    } catch (error) {
      console.error("Error generating overview:", error);
      return null;
    }
  },

  /**
   * Procesar comando automático
   */
  async processAutomationCommand(command) {
    try {
      const lowerCommand = command.toLowerCase();

      // Detectar tipo de comando
      if (lowerCommand.includes('analizar') || lowerCommand.includes('análisis')) {
        return await this.generateSystemOverview();
      }

      if (lowerCommand.includes('ahorro') || lowerCommand.includes('optimiza')) {
        return await this.analyzeSavingsOpportunities();
      }

      if (lowerCommand.includes('buscar') || lowerCommand.includes('encuentra')) {
        const query = lowerCommand.replace(/buscar|encuentra|encontrar/gi, '').trim();
        return await this.searchAll(query);
      }

      return null;
    } catch (error) {
      console.error("Error processing automation command:", error);
      return null;
    }
  },

  /**
   * Enriquecer mensaje con contexto del sistema
   */
  async enrichMessageWithContext(userMessage) {
    try {
      let context = {};

      // Detectar si requiere vista general del sistema
      if (/resumen|estado|situación|overview|dashboard/i.test(userMessage)) {
        context.overview = await this.generateSystemOverview();
      }

      // Detectar si busca ahorros
      if (/ahorro|optimizar|reducir costes|comparar precio/i.test(userMessage)) {
        context.opportunities = await this.analyzeSavingsOpportunities();
      }

      // Detectar búsqueda
      if (/buscar|encontrar|busca|encuentra/i.test(userMessage)) {
        const searchTerms = userMessage.replace(/buscar|encontrar|busca|encuentra/gi, '').trim();
        if (searchTerms) {
          context.searchResults = await this.searchAll(searchTerms);
        }
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