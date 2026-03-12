import { base44 } from "@/api/base44Client";

/**
 * CEO BRAIN AGENT SERVICE
 * Agente especializado en análisis estratégico y métricas empresariales
 */

export const CEOBrainService = {
  // Configuración del agente
  agentName: "ceo_brain",
  agentTitle: "CEO Brain - Cerebro Ejecutivo",
  
  // Prompt del sistema optimizado
  systemPrompt: `Eres el CEO Brain de SYNK-IA, un cerebro omnipotente con control total del sistema empresarial.

TUS CAPACIDADES:
1. 📊 ANÁLISIS ESTRATÉGICO: Analizar métricas empresariales, tendencias y KPIs
2. 💰 ANÁLISIS FINANCIERO: Revisar facturas, ventas, márgenes y rentabilidad
3. 🎯 INSIGHTS ESTRATÉGICOS: Generar recomendaciones basadas en datos
4. 📈 PREDICCIONES: Identificar tendencias y hacer proyecciones
5. 🚨 ALERTAS INTELIGENTES: Detectar anomalías y riesgos
6. 🔍 ACCESO COMPLETO: Tienes acceso a TODOS los datos del sistema

CÓMO RESPONDES:
- Sé directo y ejecutivo, sin rodeos
- Usa emojis estratégicamente para destacar puntos clave
- Proporciona números y métricas específicas
- Destaca insights accionables
- Prioriza información crítica primero
- Sugiere acciones concretas

DATOS DISPONIBLES:
- Facturas emitidas y recibidas
- Clientes y proveedores
- Nóminas y RRHH
- Ventas y presupuestos
- Emails y comunicaciones

CONTEXTO DE USUARIO:
Tienes acceso exclusivo del CEO. Respeta la privacidad y confidencialidad de todos los datos.`,

  /**
   * Obtener métricas empresariales
   */
  async getBusinessMetrics() {
    try {
      const metrics = {
        invoices: await this.getInvoiceMetrics(),
        sales: await this.getSalesMetrics(),
        clients: await this.getClientMetrics(),
        expenses: await this.getExpenseMetrics()
      };
      return metrics;
    } catch (error) {
      console.error("Error getting business metrics:", error);
      return null;
    }
  },

  /**
   * Métricas de facturas
   */
  async getInvoiceMetrics() {
    try {
      const invoices = await base44.entities.Invoice.list();
      const total = invoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
      // Use Spanish status values
      const pending = invoices.filter(inv => inv.status === 'pendiente').length;
      const paid = invoices.filter(inv => inv.status === 'pagada').length;
      const overdue = invoices.filter(inv => inv.status === 'vencida').length;
      
      return {
        total: invoices.length,
        totalAmount: total,
        pending,
        paid,
        overdue,
        averageAmount: invoices.length > 0 ? total / invoices.length : 0
      };
    } catch (error) {
      console.error("Error getting invoice metrics:", error);
      return { total: 0, totalAmount: 0, pending: 0, paid: 0, overdue: 0 };
    }
  },

  /**
   * Métricas de ventas
   */
  async getSalesMetrics() {
    try {
      // Obtener facturas del último mes
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const invoices = await base44.entities.Invoice.list();
      const recentInvoices = invoices.filter(inv => 
        new Date(inv.created_at) >= thirtyDaysAgo
      );
      
      const monthlyRevenue = recentInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
      
      return {
        monthlyRevenue,
        monthlyInvoiceCount: recentInvoices.length,
        averageTicket: recentInvoices.length > 0 ? monthlyRevenue / recentInvoices.length : 0
      };
    } catch (error) {
      console.error("Error getting sales metrics:", error);
      return { monthlyRevenue: 0, monthlyInvoiceCount: 0 };
    }
  },

  /**
   * Métricas de clientes
   */
  async getClientMetrics() {
    try {
      const clients = await base44.entities.Client.list();
      return {
        total: clients.length,
        active: clients.filter(c => c.status === 'active').length
      };
    } catch (error) {
      console.error("Error getting client metrics:", error);
      return { total: 0, active: 0 };
    }
  },

  /**
   * Métricas de gastos
   */
  async getExpenseMetrics() {
    try {
      // Obtener facturas de proveedores (expense invoices)
      const expenses = await base44.entities.Invoice.list({ type: 'expense' });
      const total = expenses.reduce((sum, exp) => sum + (exp.total || 0), 0);
      
      return {
        total: expenses.length,
        totalAmount: total
      };
    } catch (error) {
      console.error("Error getting expense metrics:", error);
      return { total: 0, totalAmount: 0 };
    }
  },

  /**
   * Analizar tendencias
   */
  async analyzeTrends() {
    try {
      const metrics = await this.getBusinessMetrics();
      
      // Análisis básico de tendencias
      const insights = [];
      
      if (metrics?.invoices?.pending > metrics?.invoices?.paid) {
        insights.push({
          type: 'warning',
          message: `⚠️ Tienes ${metrics.invoices.pending} facturas pendientes vs ${metrics.invoices.paid} pagadas. Revisar flujo de caja.`
        });
      }
      
      if (metrics?.invoices?.overdue > 0) {
        insights.push({
          type: 'alert',
          message: `🚨 Tienes ${metrics.invoices.overdue} facturas vencidas que requieren atención inmediata.`
        });
      }
      
      if (metrics?.sales?.monthlyRevenue > 0) {
        insights.push({
          type: 'info',
          message: `📊 Facturación mensual: €${metrics.sales.monthlyRevenue.toFixed(2)} (${metrics.sales.monthlyInvoiceCount} facturas)`
        });
      }
      
      return insights;
    } catch (error) {
      console.error("Error analyzing trends:", error);
      return [];
    }
  },

  /**
   * Generar resumen ejecutivo
   */
  async generateExecutiveSummary() {
    try {
      const metrics = await this.getBusinessMetrics();
      const insights = await this.analyzeTrends();
      
      return {
        metrics,
        insights,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error("Error generating executive summary:", error);
      return null;
    }
  },

  /**
   * Enriquecer mensaje con contexto de métricas
   */
  async enrichMessageWithContext(userMessage) {
    try {
      // Detectar si el mensaje requiere métricas
      const needsMetrics = /métrica|análisis|resumen|kpi|dashboard|estado|situación/i.test(userMessage);
      
      if (needsMetrics) {
        const summary = await this.generateExecutiveSummary();
        return {
          userMessage,
          context: summary,
          enriched: true
        };
      }
      
      return {
        userMessage,
        enriched: false
      };
    } catch (error) {
      console.error("Error enriching message:", error);
      return { userMessage, enriched: false };
    }
  }
};