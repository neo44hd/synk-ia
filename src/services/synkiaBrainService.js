import { base44 } from "@/api/base44Client";

/**
 * SYNK-IA BRAIN SERVICE
 * Agente único unificado que combina CEO Brain, HR Agent, Biloop Agent y Central Agent
 * Migrado: localStorage → /api/data/chathistory (persistencia en servidor)
 */

const API_BASE = '/api/data/chathistory';
const MAX_MESSAGES = 100;

// Caché en memoria para el historial de chat
let _chatCache = null;

// Helpers para API
async function apiGet(url) {
  try {
    const res = await fetch(url, { headers: { 'Content-Type': 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[SynkiaBrain] API no disponible:', err.message);
    return null;
  }
}

async function apiBulkReplace(records) {
  try {
    const res = await fetch(`${API_BASE}/bulk`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records, merge: false }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[SynkiaBrain] Error guardando:', err.message);
    return null;
  }
}

export const SynkiaBrainService = {
  agentName: "synkia_brain",
  agentTitle: "SYNK-IA Brain - Inteligencia Empresarial Unificada",

  systemPrompt: `Eres SYNK-IA BRAIN, el cerebro único y omnipotente de la plataforma SYNK-IA. Combinas las capacidades de análisis estratégico, recursos humanos, procesamiento de documentos y coordinación central.

🧠 TUS CAPACIDADES PRINCIPALES:

📊 ANÁLISIS ESTRATÉGICO (CEO):
- Análisis de métricas empresariales y KPIs
- Análisis financiero: facturas, ventas, márgenes
- Insights estratégicos y recomendaciones
- Predicciones y detección de tendencias
- Alertas inteligentes y detección de anomalías

👥 RECURSOS HUMANOS (HR):
- Análisis y explicación de nóminas
- Gestión de personal, contratos y vacaciones
- Control horario y fichajes
- Detección de anomalías en nóminas
- Análisis de productividad

📄 PROCESAMIENTO DE DOCUMENTOS (BILOOP):
- Extracción de datos de facturas (PDF, imágenes, Excel)
- Identificación automática de proveedores
- Clasificación de gastos e ingresos
- Validación y detección de errores
- Generación de informes contables

⚡ COORDINACIÓN CENTRAL:
- Procesamiento automático de emails
- Gestión integral de proveedores
- Comparación de precios y ahorro
- Automatizaciones y procesos
- Búsqueda inteligente global

🎯 COMANDOS RÁPIDOS DISPONIBLES:
- /facturas - Resumen de facturas
- /empleados - Lista de empleados
- /ventas - Resumen de ventas
- /proveedores - Lista de proveedores
- /gastos - Análisis de gastos
- /ayuda - Ver todos los comandos
- /limpiar - Limpiar historial

CÓMO RESPONDES:
- Sé directo, ejecutivo y eficiente
- Usa emojis estratégicamente para organizar la información
- Proporciona números y métricas específicas
- Destaca insights accionables
- Sugiere acciones concretas
- Protege la privacidad de datos sensibles
- Responde siempre en español

CONTEXTO:
Tienes acceso completo a todos los datos empresariales: facturas, clientes, proveedores, empleados, nóminas, emails y documentos.`,

  // ==========================================
  // GESTIÓN DE MEMORIA PERSISTENTE (API)
  // ==========================================

  async loadChatHistory() {
    if (_chatCache) return _chatCache;
    try {
      const result = await apiGet(`${API_BASE}?sort=-created_date`);
      const records = result?.data || [];
      // Los mensajes se guardan como registros individuales, extraer el array
      if (records.length > 0 && records[0].messages) {
        _chatCache = records[0].messages;
      } else {
        _chatCache = records.map(r => ({
          role: r.role,
          content: r.content,
          type: r.type,
          timestamp: r.timestamp || r.created_date
        }));
      }
      return _chatCache;
    } catch (error) {
      console.warn("[SynkiaBrain] Error cargando historial:", error.message);
      return [];
    }
  },

  async saveChatMessage(message) {
    try {
      const history = await this.loadChatHistory();
      history.push({
        ...message,
        timestamp: new Date().toISOString()
      });
      const trimmed = history.slice(-MAX_MESSAGES);
      _chatCache = trimmed;

      // Guardar todo el historial como un registro bulk
      const records = trimmed.map((m, i) => ({
        id: `chat_${i}`,
        role: m.role,
        content: m.content,
        type: m.type || 'chat',
        timestamp: m.timestamp
      }));
      await apiBulkReplace(records);
      return true;
    } catch (error) {
      console.warn("[SynkiaBrain] Error guardando mensaje:", error.message);
      return false;
    }
  },

  async clearChatHistory() {
    try {
      _chatCache = [];
      await apiBulkReplace([]);
      return true;
    } catch (error) {
      console.warn("[SynkiaBrain] Error limpiando historial:", error.message);
      return false;
    }
  },

  exportChatHistory() {
    try {
      const history = _chatCache || [];
      const blob = new Blob([JSON.stringify(history, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `synkia-brain-history-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return true;
    } catch (error) {
      console.error("Error exporting chat history:", error);
      return false;
    }
  },

  // ==========================================
  // COMANDOS RÁPIDOS
  // ==========================================

  async processCommand(command) {
    const cmd = command.toLowerCase().trim();

    switch (cmd) {
      case '/facturas':
        return await this.getInvoiceSummary();
      case '/empleados':
        return await this.getEmployeesList();
      case '/ventas':
        return await this.getSalesSummary();
      case '/proveedores':
        return await this.getProvidersList();
      case '/gastos':
        return await this.getExpenseSummary();
      case '/ayuda':
        return this.getHelpMessage();
      case '/limpiar':
        await this.clearChatHistory();
        return { type: 'system', content: '🧹 Historial de chat limpiado correctamente.' };
      default:
        return null;
    }
  },

  getHelpMessage() {
    return {
      type: 'help',
      content: `🎯 **COMANDOS RÁPIDOS DISPONIBLES**

📊 **Consultas:**
• \`/facturas\` - Ver resumen de facturas pendientes y pagadas
• \`/empleados\` - Listar empleados y su estado
• \`/ventas\` - Resumen de ventas del día/semana/mes
• \`/proveedores\` - Ver lista de proveedores activos
• \`/gastos\` - Análisis de gastos recientes

⚙️ **Sistema:**
• \`/ayuda\` - Mostrar esta ayuda
• \`/limpiar\` - Limpiar historial de conversación

💡 **También puedes preguntarme directamente:**
• "¿Cuántas facturas tengo pendientes?"
• "Dame un resumen de las ventas de hoy"
• "¿Cuántos empleados tenemos?"
• "Analiza los gastos del último mes"
• "¿Qué proveedores tenemos activos?"`
    };
  },

  // ==========================================
  // FUNCIONALIDADES CEO BRAIN
  // ==========================================

  async getInvoiceSummary() {
    try {
      const invoices = await base44.entities.Invoice.list();
      const total = invoices.length;
      const pending = invoices.filter(inv => inv.status === 'pending');
      const paid = invoices.filter(inv => inv.status === 'paid');
      const totalAmount = invoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
      const pendingAmount = pending.reduce((sum, inv) => sum + (inv.total || 0), 0);

      return {
        type: 'data',
        content: `📊 **RESUMEN DE FACTURAS**

📋 **Total facturas:** ${total}
⏳ **Pendientes:** ${pending.length} (€${pendingAmount.toFixed(2)})
✅ **Pagadas:** ${paid.length}
💰 **Importe total:** €${totalAmount.toFixed(2)}

${pending.length > 0 ? `\n⚠️ Tienes ${pending.length} facturas pendientes de cobro.` : '\n✅ No tienes facturas pendientes.'}`,
        data: { total, pending: pending.length, paid: paid.length, totalAmount, pendingAmount }
      };
    } catch (error) {
      console.error("Error getting invoice summary:", error);
      return { type: 'error', content: '❌ Error al obtener el resumen de facturas. Por favor, inténtalo de nuevo.' };
    }
  },

  async getSalesSummary() {
    try {
      const invoices = await base44.entities.Invoice.list();
      const now = new Date();

      const today = invoices.filter(inv => {
        const date = new Date(inv.created_at);
        return date.toDateString() === now.toDateString();
      });

      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      const thisWeek = invoices.filter(inv => new Date(inv.created_at) >= weekAgo);

      const monthAgo = new Date(now);
      monthAgo.setDate(monthAgo.getDate() - 30);
      const thisMonth = invoices.filter(inv => new Date(inv.created_at) >= monthAgo);

      const todayTotal = today.reduce((sum, inv) => sum + (inv.total || 0), 0);
      const weekTotal = thisWeek.reduce((sum, inv) => sum + (inv.total || 0), 0);
      const monthTotal = thisMonth.reduce((sum, inv) => sum + (inv.total || 0), 0);

      return {
        type: 'data',
        content: `📈 **RESUMEN DE VENTAS**

📅 **Hoy:** ${today.length} facturas - €${todayTotal.toFixed(2)}
📊 **Esta semana:** ${thisWeek.length} facturas - €${weekTotal.toFixed(2)}
📆 **Últimos 30 días:** ${thisMonth.length} facturas - €${monthTotal.toFixed(2)}

💡 **Ticket medio mensual:** €${thisMonth.length > 0 ? (monthTotal / thisMonth.length).toFixed(2) : '0.00'}`,
        data: { todayTotal, weekTotal, monthTotal, todayCount: today.length, weekCount: thisWeek.length, monthCount: thisMonth.length }
      };
    } catch (error) {
      console.error("Error getting sales summary:", error);
      return { type: 'error', content: '❌ Error al obtener el resumen de ventas.' };
    }
  },

  async getBusinessMetrics() {
    try {
      const [invoices, clients] = await Promise.all([
        base44.entities.Invoice.list().catch(() => []),
        base44.entities.Client.list().catch(() => [])
      ]);

      const total = invoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
      const pending = invoices.filter(inv => inv.status === 'pending').length;
      const paid = invoices.filter(inv => inv.status === 'paid').length;

      return {
        invoices: {
          total: invoices.length,
          totalAmount: total,
          pending,
          paid,
          averageAmount: invoices.length > 0 ? total / invoices.length : 0
        },
        clients: {
          total: clients.length,
          active: clients.filter(c => c.status === 'active').length
        }
      };
    } catch (error) {
      console.error("Error getting business metrics:", error);
      return null;
    }
  },

  // ==========================================
  // FUNCIONALIDADES HR AGENT
  // ==========================================

  async getEmployeesList() {
    try {
      let employees = [];
      try {
        employees = await base44.entities.Employee.list();
      } catch {
        try {
          employees = await base44.entities.User.list();
        } catch {
          employees = [];
        }
      }

      if (employees.length === 0) {
        return {
          type: 'data',
          content: `👥 **EMPLEADOS**

📋 No hay empleados registrados en el sistema.

💡 Puedes añadir empleados desde la sección de Gestión de Personal.`
        };
      }

      const employeeList = employees.slice(0, 10).map(emp =>
        `• ${emp.name || emp.email || 'Sin nombre'} - ${emp.role || emp.position || 'Sin rol'}`
      ).join('\n');

      return {
        type: 'data',
        content: `👥 **EMPLEADOS** (${employees.length} total)

${employeeList}
${employees.length > 10 ? `\n... y ${employees.length - 10} más` : ''}`,
        data: { total: employees.length, employees }
      };
    } catch (error) {
      console.error("Error getting employees list:", error);
      return { type: 'error', content: '❌ Error al obtener la lista de empleados.' };
    }
  },

  async getEmployeePayrolls(employeeEmail) {
    try {
      const payrolls = await base44.entities.Payroll.list({
        employee_email: employeeEmail
      });
      return payrolls;
    } catch (error) {
      console.error("Error getting employee payrolls:", error);
      return [];
    }
  },

  async getVacationInfo(employeeEmail) {
    return {
      totalDays: 23,
      usedDays: 8,
      remainingDays: 15,
      pendingRequests: 0
    };
  },

  // ==========================================
  // FUNCIONALIDADES BILOOP AGENT
  // ==========================================

  async getProvidersList() {
    try {
      let providers = [];
      try {
        providers = await base44.entities.Provider.list();
      } catch {
        try {
          providers = await base44.entities.Supplier.list();
        } catch {
          providers = [];
        }
      }

      if (providers.length === 0) {
        return {
          type: 'data',
          content: `🏢 **PROVEEDORES**

📋 No hay proveedores registrados en el sistema.

💡 Los proveedores se registran automáticamente al importar facturas.`
        };
      }

      const providerList = providers.slice(0, 10).map(prov =>
        `• ${prov.name || prov.company_name || 'Sin nombre'} - ${prov.category || 'General'}`
      ).join('\n');

      return {
        type: 'data',
        content: `🏢 **PROVEEDORES** (${providers.length} total)

${providerList}
${providers.length > 10 ? `\n... y ${providers.length - 10} más` : ''}`,
        data: { total: providers.length, providers }
      };
    } catch (error) {
      console.error("Error getting providers list:", error);
      return { type: 'error', content: '❌ Error al obtener la lista de proveedores.' };
    }
  },

  async getExpenseSummary() {
    try {
      const invoices = await base44.entities.Invoice.list();
      const expenses = invoices.filter(inv => inv.type === 'expense' || inv.type === 'gasto');

      const now = new Date();
      const monthAgo = new Date(now);
      monthAgo.setDate(monthAgo.getDate() - 30);

      const recentExpenses = expenses.filter(exp => new Date(exp.created_at) >= monthAgo);
      const totalExpenses = recentExpenses.reduce((sum, exp) => sum + (exp.total || 0), 0);

      const byCategory = {};
      recentExpenses.forEach(exp => {
        const cat = exp.category || 'Sin categoría';
        if (!byCategory[cat]) byCategory[cat] = 0;
        byCategory[cat] += exp.total || 0;
      });

      const categoryList = Object.entries(byCategory)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([cat, amount]) => `• ${cat}: €${amount.toFixed(2)}`)
        .join('\n');

      return {
        type: 'data',
        content: `💸 **RESUMEN DE GASTOS** (últimos 30 días)

📋 **Total gastos:** ${recentExpenses.length} facturas
💰 **Importe total:** €${totalExpenses.toFixed(2)}

📊 **Por categoría:**
${categoryList || '• Sin datos de categorías'}`,
        data: { total: recentExpenses.length, totalAmount: totalExpenses, byCategory }
      };
    } catch (error) {
      console.error("Error getting expense summary:", error);
      return { type: 'error', content: '❌ Error al obtener el resumen de gastos.' };
    }
  },

  async processBiloopFile(fileUrl, fileName) {
    try {
      const extraction = await base44.integrations.Core.ExtractData({
        file_url: fileUrl,
        extraction_type: 'invoice'
      });

      return {
        fileName,
        processed: true,
        invoices: extraction.invoices || [],
        rawData: extraction
      };
    } catch (error) {
      console.error("Error processing Biloop file:", error);
      return { fileName, processed: false, error: error.message };
    }
  },

  // ==========================================
  // FUNCIONALIDADES CENTRAL AGENT
  // ==========================================

  async searchAll(query) {
    try {
      const results = { invoices: [], clients: [], providers: [] };

      try {
        const invoices = await base44.entities.Invoice.list();
        results.invoices = invoices.filter(inv =>
          JSON.stringify(inv).toLowerCase().includes(query.toLowerCase())
        ).slice(0, 5);
      } catch {}

      try {
        const clients = await base44.entities.Client.list();
        results.clients = clients.filter(client =>
          JSON.stringify(client).toLowerCase().includes(query.toLowerCase())
        ).slice(0, 5);
      } catch {}

      return results;
    } catch (error) {
      console.error("Error in searchAll:", error);
      return null;
    }
  },

  async analyzeSavingsOpportunities() {
    try {
      const invoices = await base44.entities.Invoice.list();
      const opportunities = [];

      const byProvider = {};
      invoices.forEach(inv => {
        const provider = inv.provider_name || 'unknown';
        if (!byProvider[provider]) byProvider[provider] = [];
        byProvider[provider].push(inv);
      });

      Object.entries(byProvider).forEach(([provider, providerInvoices]) => {
        if (providerInvoices.length > 1) {
          const amounts = providerInvoices.map(inv => inv.total || 0);
          const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
          const max = Math.max(...amounts);
          const min = Math.min(...amounts);

          if (avg > 0 && (max - min) / avg > 0.2) {
            opportunities.push({
              type: 'price_variation',
              provider,
              message: `Variación de precios del ${((max - min) / avg * 100).toFixed(0)}% en ${provider}`,
              potential_saving: max - min
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

  async generateSystemOverview() {
    try {
      const overview = {
        invoices: { total: 0, pending: 0, totalAmount: 0 },
        clients: { total: 0, active: 0 },
        opportunities: []
      };

      try {
        const invoices = await base44.entities.Invoice.list();
        overview.invoices.total = invoices.length;
        overview.invoices.pending = invoices.filter(i => i.status === 'pending').length;
        overview.invoices.totalAmount = invoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
      } catch {}

      try {
        const clients = await base44.entities.Client.list();
        overview.clients.total = clients.length;
        overview.clients.active = clients.filter(c => c.status === 'active').length;
      } catch {}

      overview.opportunities = await this.analyzeSavingsOpportunities();

      return overview;
    } catch (error) {
      console.error("Error generating overview:", error);
      return null;
    }
  },

  // ==========================================
  // PROCESAMIENTO DE MENSAJES
  // ==========================================

  async enrichMessageWithContext(userMessage) {
    try {
      let context = {};
      const lowerMessage = userMessage.toLowerCase();

      if (/factura|importe|cobro|pago/i.test(lowerMessage)) {
        context.invoices = await this.getBusinessMetrics();
      }

      if (/venta|ingreso|facturación/i.test(lowerMessage)) {
        const salesResult = await this.getSalesSummary();
        context.sales = salesResult.data;
      }

      if (/empleado|personal|equipo|nómina/i.test(lowerMessage)) {
        const employeesResult = await this.getEmployeesList();
        context.employees = employeesResult.data;
      }

      if (/gasto|coste|proveedor/i.test(lowerMessage)) {
        const expenseResult = await this.getExpenseSummary();
        context.expenses = expenseResult.data;
      }

      if (/resumen|estado|situación|overview/i.test(lowerMessage)) {
        context.overview = await this.generateSystemOverview();
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
  },

  async processMessage(message, userEmail = null) {
    await this.saveChatMessage({
      role: 'user',
      content: message
    });

    if (message.startsWith('/')) {
      const commandResult = await this.processCommand(message);
      if (commandResult) {
        await this.saveChatMessage({
          role: 'assistant',
          content: commandResult.content,
          type: commandResult.type
        });
        return commandResult;
      }
    }

    const enriched = await this.enrichMessageWithContext(message);

    return {
      type: 'chat',
      enrichedContext: enriched,
      systemPrompt: this.systemPrompt
    };
  },

  getSuggestedActions(context) {
    const actions = [];

    if (context === 'dashboard' || !context) {
      actions.push(
        { label: '📊 Ver facturas', command: '/facturas' },
        { label: '📈 Resumen ventas', command: '/ventas' },
        { label: '👥 Ver empleados', command: '/empleados' },
        { label: '💸 Analizar gastos', command: '/gastos' }
      );
    }

    if (context === 'finance') {
      actions.push(
        { label: '📊 Facturas pendientes', command: '/facturas' },
        { label: '💸 Gastos del mes', command: '/gastos' },
        { label: '🏢 Ver proveedores', command: '/proveedores' }
      );
    }

    if (context === 'hr') {
      actions.push(
        { label: '👥 Lista empleados', command: '/empleados' },
        { label: '📅 Vacaciones pendientes', command: '¿Cuántas vacaciones me quedan?' }
      );
    }

    return actions;
  }
};

export default SynkiaBrainService;
