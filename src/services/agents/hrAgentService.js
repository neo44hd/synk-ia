import { base44 } from "@/api/base44Client";

/**
 * HR AGENT SERVICE
 * Agente especializado en gestión de recursos humanos y nóminas
 */

export const HRAgentService = {
  // Configuración del agente
  agentName: "hr_assistant",
  agentTitle: "Asistente RRHH",
  
  // Prompt del sistema optimizado
  systemPrompt: `Eres el Asistente de Recursos Humanos de SYNK-IA, especializado en gestión de personal y nóminas.

TUS CAPACIDADES:
1. 💰 ANÁLISIS DE NÓMINAS: Explicar conceptos, desglosar importes
2. 📊 GESTIÓN DE PERSONAL: Información sobre contratos, vacaciones, permisos
3. ⏰ CONTROL HORARIO: Revisar fichajes y horas trabajadas
4. 🔍 DETECCIÓN DE ANOMALÍAS: Identificar irregularidades en nóminas
5. 📈 ANÁLISIS DE PRODUCTIVIDAD: Evaluar rendimiento y métricas de personal
6. 📄 DOCUMENTACIÓN: Acceso a contratos, convenios y documentos laborales

CÓMO RESPONDES:
- Sé empático y cercano, es un tema personal
- Explica conceptos complejos de forma simple
- Usa emojis para hacer la información más amigable
- Protege la privacidad de los datos personales
- Cumple siempre con la normativa laboral
- Proporciona información precisa y verificable

DATOS DISPONIBLES:
- Nóminas y conceptos salariales
- Contratos y condiciones laborales
- Fichajes y registro horario
- Vacaciones y permisos
- Datos de empleados (con permisos)

CONTEXTO DE SEGURIDAD:
Solo proporciona información del empleado que está consultando. Respeta la confidencialidad.`,

  /**
   * Obtener nóminas del empleado
   */
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

  /**
   * Analizar última nómina
   */
  async analyzeLatestPayroll(employeeEmail) {
    try {
      const payrolls = await this.getEmployeePayrolls(employeeEmail);
      if (payrolls.length === 0) {
        return null;
      }

      // Ordenar por fecha y obtener la más reciente
      const latest = payrolls.sort((a, b) => 
        new Date(b.period) - new Date(a.period)
      )[0];

      // Analizar conceptos
      const analysis = {
        period: latest.period,
        grossSalary: latest.gross_salary || 0,
        netSalary: latest.net_salary || 0,
        deductions: latest.deductions || 0,
        bonuses: latest.bonuses || 0,
        concepts: latest.concepts || []
      };

      return analysis;
    } catch (error) {
      console.error("Error analyzing payroll:", error);
      return null;
    }
  },

  /**
   * Detectar anomalías en nóminas
   */
  async detectPayrollAnomalies(employeeEmail) {
    try {
      const payrolls = await this.getEmployeePayrolls(employeeEmail);
      if (payrolls.length < 2) {
        return [];
      }

      const anomalies = [];

      // Calcular salario promedio
      const avgSalary = payrolls.reduce((sum, p) => sum + (p.net_salary || 0), 0) / payrolls.length;

      // Detectar variaciones significativas (más del 20%)
      payrolls.forEach(payroll => {
        const variation = Math.abs(payroll.net_salary - avgSalary) / avgSalary;
        if (variation > 0.2) {
          anomalies.push({
            type: 'significant_variation',
            period: payroll.period,
            message: `Variación del ${(variation * 100).toFixed(0)}% respecto al promedio`,
            severity: variation > 0.3 ? 'high' : 'medium'
          });
        }
      });

      return anomalies;
    } catch (error) {
      console.error("Error detecting anomalies:", error);
      return [];
    }
  },

  /**
   * Obtener información de vacaciones
   */
  async getVacationInfo(employeeEmail) {
    try {
      // Aquí se implementaría la lógica real de vacaciones
      // Por ahora, retornamos datos de ejemplo
      return {
        totalDays: 23,
        usedDays: 8,
        remainingDays: 15,
        pendingRequests: 0
      };
    } catch (error) {
      console.error("Error getting vacation info:", error);
      return null;
    }
  },

  /**
   * Explicar concepto de nómina
   */
  explainPayrollConcept(conceptName) {
    const concepts = {
      'salario_base': {
        name: 'Salario Base',
        description: 'Es tu sueldo fijo mensual según contrato, antes de complementos y deducciones.',
        emoji: '💰'
      },
      'irpf': {
        name: 'IRPF (Retención)',
        description: 'Impuesto sobre la Renta que se retiene y se paga a Hacienda. Depende de tu situación personal.',
        emoji: '🏛️'
      },
      'seguridad_social': {
        name: 'Seguridad Social',
        description: 'Cotización obligatoria para pensiones, sanidad y desempleo. Aproximadamente el 6.35% de tu base.',
        emoji: '🛡️'
      },
      'plus_transporte': {
        name: 'Plus de Transporte',
        description: 'Complemento salarial para gastos de desplazamiento al trabajo.',
        emoji: '🚗'
      },
      'plus_comida': {
        name: 'Plus de Comida',
        description: 'Complemento salarial para gastos de alimentación durante la jornada laboral.',
        emoji: '🍽️'
      },
      'horas_extra': {
        name: 'Horas Extra',
        description: 'Pago adicional por horas trabajadas fuera de tu jornada habitual.',
        emoji: '⏰'
      }
    };

    const key = conceptName.toLowerCase().replace(/\s+/g, '_');
    return concepts[key] || {
      name: conceptName,
      description: 'Concepto salarial. Consulta con RRHH para más detalles.',
      emoji: '💼'
    };
  },

  /**
   * Enriquecer mensaje con contexto de RRHH
   */
  async enrichMessageWithContext(userMessage, employeeEmail) {
    try {
      let context = {};

      // Detectar si pregunta por nómina
      if (/nómina|nomina|salario|sueldo/i.test(userMessage)) {
        context.payroll = await this.analyzeLatestPayroll(employeeEmail);
        context.anomalies = await this.detectPayrollAnomalies(employeeEmail);
      }

      // Detectar si pregunta por vacaciones
      if (/vacaciones|dias libres|permisos/i.test(userMessage)) {
        context.vacation = await this.getVacationInfo(employeeEmail);
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