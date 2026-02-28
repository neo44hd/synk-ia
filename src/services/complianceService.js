// Servicio de Compliance Legal - SYNK-IA
// Gestión de cumplimiento normativo español

import * as XLSX from 'xlsx';
import { format, differenceInDays, addDays, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

// Constantes de estado de cumplimiento
export const COMPLIANCE_STATUS = {
  OK: 'green',
  WARNING: 'yellow',
  CRITICAL: 'red'
};

// Umbrales de días para alertas
export const ALERT_THRESHOLDS = {
  CRITICAL: 7,
  WARNING: 15,
  NOTICE: 30
};

class ComplianceService {
  
  // ==========================================
  // FUNCIONES DE CÁLCULO DE SEMÁFORO
  // ==========================================
  
  // Calcular estado de cumplimiento general
  calculateOverallStatus(items) {
    if (!items || items.length === 0) return COMPLIANCE_STATUS.OK;
    
    const hasRed = items.some(item => item.status === COMPLIANCE_STATUS.CRITICAL);
    const hasYellow = items.some(item => item.status === COMPLIANCE_STATUS.WARNING);
    
    if (hasRed) return COMPLIANCE_STATUS.CRITICAL;
    if (hasYellow) return COMPLIANCE_STATUS.WARNING;
    return COMPLIANCE_STATUS.OK;
  }
  
  // Calcular estado de un documento por fecha de vencimiento
  getDocumentStatus(expirationDate) {
    if (!expirationDate) return COMPLIANCE_STATUS.CRITICAL;
    
    const today = new Date();
    const expDate = typeof expirationDate === 'string' ? parseISO(expirationDate) : expirationDate;
    const daysUntilExpiry = differenceInDays(expDate, today);
    
    if (daysUntilExpiry < 0) return COMPLIANCE_STATUS.CRITICAL;
    if (daysUntilExpiry <= ALERT_THRESHOLDS.CRITICAL) return COMPLIANCE_STATUS.CRITICAL;
    if (daysUntilExpiry <= ALERT_THRESHOLDS.WARNING) return COMPLIANCE_STATUS.WARNING;
    if (daysUntilExpiry <= ALERT_THRESHOLDS.NOTICE) return COMPLIANCE_STATUS.WARNING;
    return COMPLIANCE_STATUS.OK;
  }
  
  // ==========================================
  // ALERTAS Y VENCIMIENTOS
  // ==========================================
  
  // Obtener alertas de vencimientos próximos
  getExpirationAlerts(items, dateField = 'expiration_date') {
    const today = new Date();
    
    return items
      .filter(item => item[dateField])
      .map(item => {
        const expDate = typeof item[dateField] === 'string' ? parseISO(item[dateField]) : item[dateField];
        const daysUntilExpiry = differenceInDays(expDate, today);
        
        return {
          ...item,
          daysUntilExpiry,
          status: this.getDocumentStatus(expDate),
          isExpired: daysUntilExpiry < 0,
          urgencyLevel: daysUntilExpiry < 0 ? 'EXPIRED' : 
                        daysUntilExpiry <= 7 ? 'CRITICAL' :
                        daysUntilExpiry <= 15 ? 'WARNING' : 
                        daysUntilExpiry <= 30 ? 'NOTICE' : 'OK'
        };
      })
      .filter(item => item.daysUntilExpiry <= ALERT_THRESHOLDS.NOTICE || item.isExpired)
      .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
  }
  
  // Filtrar alertas por umbral de días
  filterAlertsByDays(alerts, days) {
    return alerts.filter(alert => alert.daysUntilExpiry <= days);
  }
  
  // ==========================================
  // INSPECCIÓN LABORAL
  // ==========================================
  
  // Evaluar cumplimiento laboral
  evaluateLaborCompliance(employees, timesheets, payrolls, contracts) {
    const issues = [];
    const today = new Date();
    const currentMonth = startOfMonth(today);
    
    // Verificar registro horario
    employees.forEach(emp => {
      if (emp.status !== 'active') return;
      
      const empTimesheets = timesheets.filter(ts => 
        ts.employee_id === emp.id && 
        new Date(ts.date) >= currentMonth
      );
      
      if (empTimesheets.length === 0) {
        issues.push({
          type: 'timesheet',
          severity: 'warning',
          employee: emp.full_name,
          message: `Sin registros horarios este mes`
        });
      }
    });
    
    // Verificar nóminas firmadas
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    employees.forEach(emp => {
      if (emp.status !== 'active') return;
      
      const empPayroll = payrolls.find(p => 
        p.employee_id === emp.id && 
        new Date(p.period_start) >= lastMonth
      );
      
      if (!empPayroll) {
        issues.push({
          type: 'payroll',
          severity: 'critical',
          employee: emp.full_name,
          message: `Sin nómina del mes anterior`
        });
      }
    });
    
    // Verificar contratos
    contracts.forEach(contract => {
      if (contract.type === 'temporal' && contract.end_date) {
        const daysToExpiry = differenceInDays(parseISO(contract.end_date), today);
        if (daysToExpiry <= 30 && daysToExpiry > 0) {
          issues.push({
            type: 'contract',
            severity: 'warning',
            employee: contract.employee_name,
            message: `Contrato temporal vence en ${daysToExpiry} días`
          });
        } else if (daysToExpiry <= 0) {
          issues.push({
            type: 'contract',
            severity: 'critical',
            employee: contract.employee_name,
            message: `Contrato temporal vencido`
          });
        }
      }
    });
    
    return {
      status: issues.some(i => i.severity === 'critical') ? COMPLIANCE_STATUS.CRITICAL :
              issues.some(i => i.severity === 'warning') ? COMPLIANCE_STATUS.WARNING :
              COMPLIANCE_STATUS.OK,
      issues,
      stats: {
        totalEmployees: employees.filter(e => e.status === 'active').length,
        withTimesheets: new Set(timesheets.map(ts => ts.employee_id)).size,
        withPayrolls: new Set(payrolls.map(p => p.employee_id)).size,
        contractsExpiring: contracts.filter(c => {
          if (!c.end_date) return false;
          const days = differenceInDays(parseISO(c.end_date), today);
          return days > 0 && days <= 30;
        }).length
      }
    };
  }
  
  // ==========================================
  // INSPECCIÓN SANIDAD (APPCC)
  // ==========================================
  
  // Evaluar cumplimiento sanitario
  evaluateHealthCompliance(temperatureRecords, foodHandlerCerts, cleaningRecords, pestControl, allergenPlan) {
    const issues = [];
    const today = new Date();
    
    // Verificar registros de temperatura
    const todayRecords = temperatureRecords.filter(tr => 
      format(parseISO(tr.recorded_at), 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')
    );
    
    if (todayRecords.length < 2) {
      issues.push({
        type: 'temperature',
        severity: 'critical',
        message: 'Faltan registros de temperatura del día de hoy'
      });
    }
    
    // Verificar temperaturas fuera de rango
    temperatureRecords.slice(-10).forEach(tr => {
      if (tr.temperature > tr.max_temp || tr.temperature < tr.min_temp) {
        issues.push({
          type: 'temperature',
          severity: 'critical',
          equipment: tr.equipment_name,
          message: `Temperatura fuera de rango: ${tr.temperature}°C`
        });
      }
    });
    
    // Verificar carnets de manipulador
    foodHandlerCerts.forEach(cert => {
      if (cert.expiration_date) {
        const daysToExpiry = differenceInDays(parseISO(cert.expiration_date), today);
        if (daysToExpiry <= 0) {
          issues.push({
            type: 'food_handler',
            severity: 'critical',
            employee: cert.employee_name,
            message: 'Carnet de manipulador vencido'
          });
        } else if (daysToExpiry <= 30) {
          issues.push({
            type: 'food_handler',
            severity: 'warning',
            employee: cert.employee_name,
            message: `Carnet vence en ${daysToExpiry} días`
          });
        }
      }
    });
    
    // Verificar registros de limpieza
    const lastWeekCleanings = cleaningRecords.filter(cr =>
      differenceInDays(today, parseISO(cr.date)) <= 7
    );
    
    if (lastWeekCleanings.length < 7) {
      issues.push({
        type: 'cleaning',
        severity: 'warning',
        message: 'Faltan registros de limpieza de la última semana'
      });
    }
    
    // Verificar control de plagas
    if (pestControl.length > 0) {
      const lastPestControl = pestControl[0];
      const daysSinceLastControl = differenceInDays(today, parseISO(lastPestControl.date));
      
      if (daysSinceLastControl > 90) {
        issues.push({
          type: 'pest_control',
          severity: 'warning',
          message: `Último control de plagas hace ${daysSinceLastControl} días`
        });
      }
      
      if (lastPestControl.next_visit && differenceInDays(parseISO(lastPestControl.next_visit), today) <= 7) {
        issues.push({
          type: 'pest_control',
          severity: 'notice',
          message: 'Visita de control de plagas próxima'
        });
      }
    }
    
    return {
      status: issues.some(i => i.severity === 'critical') ? COMPLIANCE_STATUS.CRITICAL :
              issues.some(i => i.severity === 'warning') ? COMPLIANCE_STATUS.WARNING :
              COMPLIANCE_STATUS.OK,
      issues,
      stats: {
        todayTemperatureRecords: todayRecords.length,
        validFoodHandlerCerts: foodHandlerCerts.filter(c => {
          if (!c.expiration_date) return false;
          return differenceInDays(parseISO(c.expiration_date), today) > 0;
        }).length,
        totalFoodHandlerCerts: foodHandlerCerts.length,
        cleaningRecordsThisWeek: lastWeekCleanings.length
      }
    };
  }
  
  // ==========================================
  // INSPECCIÓN INDUSTRIA/PRL
  // ==========================================
  
  // Evaluar cumplimiento PRL
  evaluateIndustryCompliance(prlPlan, riskEvaluations, prlTraining, epis, accidents, medicalReviews, licenses, insurance) {
    const issues = [];
    const today = new Date();
    
    // Verificar Plan de PRL
    if (!prlPlan || !prlPlan.approved_date) {
      issues.push({
        type: 'prl_plan',
        severity: 'critical',
        message: 'Plan de PRL no aprobado o inexistente'
      });
    }
    
    // Verificar evaluaciones de riesgos
    if (riskEvaluations.length === 0) {
      issues.push({
        type: 'risk_evaluation',
        severity: 'critical',
        message: 'Sin evaluaciones de riesgos registradas'
      });
    } else {
      const lastEvaluation = riskEvaluations[0];
      const daysSinceEval = differenceInDays(today, parseISO(lastEvaluation.date));
      if (daysSinceEval > 365) {
        issues.push({
          type: 'risk_evaluation',
          severity: 'warning',
          message: 'Evaluación de riesgos desactualizada (>1 año)'
        });
      }
    }
    
    // Verificar formación PRL por empleado
    prlTraining.forEach(training => {
      if (training.expiration_date) {
        const daysToExpiry = differenceInDays(parseISO(training.expiration_date), today);
        if (daysToExpiry <= 0) {
          issues.push({
            type: 'prl_training',
            severity: 'critical',
            employee: training.employee_name,
            message: 'Formación PRL vencida'
          });
        } else if (daysToExpiry <= 30) {
          issues.push({
            type: 'prl_training',
            severity: 'warning',
            employee: training.employee_name,
            message: `Formación vence en ${daysToExpiry} días`
          });
        }
      }
    });
    
    // Verificar revisiones médicas
    medicalReviews.forEach(review => {
      if (review.next_review_date) {
        const daysToReview = differenceInDays(parseISO(review.next_review_date), today);
        if (daysToReview <= 0) {
          issues.push({
            type: 'medical_review',
            severity: 'critical',
            employee: review.employee_name,
            message: 'Revisión médica vencida'
          });
        } else if (daysToReview <= 30) {
          issues.push({
            type: 'medical_review',
            severity: 'warning',
            employee: review.employee_name,
            message: `Revisión médica en ${daysToReview} días`
          });
        }
      }
    });
    
    // Verificar licencias y permisos
    licenses.forEach(license => {
      if (license.expiration_date) {
        const daysToExpiry = differenceInDays(parseISO(license.expiration_date), today);
        if (daysToExpiry <= 0) {
          issues.push({
            type: 'license',
            severity: 'critical',
            document: license.name,
            message: 'Licencia/permiso vencido'
          });
        } else if (daysToExpiry <= 30) {
          issues.push({
            type: 'license',
            severity: 'warning',
            document: license.name,
            message: `Vence en ${daysToExpiry} días`
          });
        }
      }
    });
    
    // Verificar seguros
    insurance.forEach(ins => {
      if (ins.expiration_date) {
        const daysToExpiry = differenceInDays(parseISO(ins.expiration_date), today);
        if (daysToExpiry <= 0) {
          issues.push({
            type: 'insurance',
            severity: 'critical',
            document: ins.name,
            message: 'Seguro vencido'
          });
        } else if (daysToExpiry <= 30) {
          issues.push({
            type: 'insurance',
            severity: 'warning',
            document: ins.name,
            message: `Vence en ${daysToExpiry} días`
          });
        }
      }
    });
    
    return {
      status: issues.some(i => i.severity === 'critical') ? COMPLIANCE_STATUS.CRITICAL :
              issues.some(i => i.severity === 'warning') ? COMPLIANCE_STATUS.WARNING :
              COMPLIANCE_STATUS.OK,
      issues,
      stats: {
        hasPRLPlan: !!prlPlan?.approved_date,
        riskEvaluationsCount: riskEvaluations.length,
        trainedEmployees: prlTraining.filter(t => !t.expiration_date || differenceInDays(parseISO(t.expiration_date), today) > 0).length,
        validMedicalReviews: medicalReviews.filter(r => !r.next_review_date || differenceInDays(parseISO(r.next_review_date), today) > 0).length,
        validLicenses: licenses.filter(l => !l.expiration_date || differenceInDays(parseISO(l.expiration_date), today) > 0).length,
        validInsurance: insurance.filter(i => !i.expiration_date || differenceInDays(parseISO(i.expiration_date), today) > 0).length,
        accidentsThisYear: accidents.filter(a => new Date(a.date).getFullYear() === today.getFullYear()).length
      }
    };
  }
  
  // ==========================================
  // EXPORTACIÓN PARA INSPECCIÓN
  // ==========================================
  
  // Generar informe completo para inspección
  generateInspectionReport(type, data) {
    const wb = XLSX.utils.book_new();
    const today = format(new Date(), 'dd-MM-yyyy', { locale: es });
    
    switch (type) {
      case 'laboral':
        this.addLaborSheets(wb, data);
        XLSX.writeFile(wb, `Informe_Inspeccion_Laboral_${today}.xlsx`);
        break;
      case 'sanidad':
        this.addHealthSheets(wb, data);
        XLSX.writeFile(wb, `Informe_Inspeccion_Sanidad_${today}.xlsx`);
        break;
      case 'industria':
        this.addIndustrySheets(wb, data);
        XLSX.writeFile(wb, `Informe_Inspeccion_PRL_${today}.xlsx`);
        break;
      case 'complete':
        this.addLaborSheets(wb, data.laboral);
        this.addHealthSheets(wb, data.sanidad);
        this.addIndustrySheets(wb, data.industria);
        XLSX.writeFile(wb, `Informe_Compliance_Completo_${today}.xlsx`);
        break;
    }
  }
  
  // Hojas de inspección laboral
  addLaborSheets(wb, data) {
    // Registro horario
    if (data.timesheets) {
      const tsData = data.timesheets.map(ts => ({
        'Empleado': ts.employee_name,
        'DNI': ts.employee_dni || '-',
        'Fecha': format(parseISO(ts.date), 'dd/MM/yyyy'),
        'Entrada': ts.check_in || '-',
        'Salida': ts.check_out || '-',
        'Horas': ts.hours_worked || '-',
        'Verificado': ts.verified ? 'Sí' : 'No'
      }));
      const ws = XLSX.utils.json_to_sheet(tsData);
      XLSX.utils.book_append_sheet(wb, ws, 'Registro Horario');
    }
    
    // Contratos
    if (data.contracts) {
      const cData = data.contracts.map(c => ({
        'Empleado': c.employee_name,
        'DNI': c.employee_dni || '-',
        'Tipo Contrato': c.type,
        'Fecha Inicio': c.start_date ? format(parseISO(c.start_date), 'dd/MM/yyyy') : '-',
        'Fecha Fin': c.end_date ? format(parseISO(c.end_date), 'dd/MM/yyyy') : 'Indefinido',
        'Estado': c.status
      }));
      const ws = XLSX.utils.json_to_sheet(cData);
      XLSX.utils.book_append_sheet(wb, ws, 'Contratos');
    }
    
    // Nóminas
    if (data.payrolls) {
      const pData = data.payrolls.map(p => ({
        'Empleado': p.employee_name,
        'DNI': p.employee_dni || '-',
        'Período': p.period || '-',
        'Bruto': p.gross_salary,
        'Neto': p.net_salary,
        'Firmada': p.signed ? 'Sí' : 'No',
        'Fecha Firma': p.signed_date ? format(parseISO(p.signed_date), 'dd/MM/yyyy') : '-'
      }));
      const ws = XLSX.utils.json_to_sheet(pData);
      XLSX.utils.book_append_sheet(wb, ws, 'Nóminas');
    }
  }
  
  // Hojas de inspección sanitaria
  addHealthSheets(wb, data) {
    // Temperaturas
    if (data.temperatures) {
      const tData = data.temperatures.map(t => ({
        'Equipo': t.equipment_name,
        'Fecha/Hora': format(parseISO(t.recorded_at), 'dd/MM/yyyy HH:mm'),
        'Temperatura': `${t.temperature}°C`,
        'Mín': `${t.min_temp}°C`,
        'Máx': `${t.max_temp}°C`,
        'Estado': t.temperature >= t.min_temp && t.temperature <= t.max_temp ? 'OK' : 'ALERTA',
        'Registrado Por': t.recorded_by || '-'
      }));
      const ws = XLSX.utils.json_to_sheet(tData);
      XLSX.utils.book_append_sheet(wb, ws, 'Temperaturas');
    }
    
    // Carnets manipulador
    if (data.foodHandlerCerts) {
      const fData = data.foodHandlerCerts.map(f => ({
        'Empleado': f.employee_name,
        'DNI': f.employee_dni || '-',
        'Número Carnet': f.certificate_number || '-',
        'Fecha Emisión': f.issue_date ? format(parseISO(f.issue_date), 'dd/MM/yyyy') : '-',
        'Fecha Caducidad': f.expiration_date ? format(parseISO(f.expiration_date), 'dd/MM/yyyy') : '-',
        'Estado': f.status
      }));
      const ws = XLSX.utils.json_to_sheet(fData);
      XLSX.utils.book_append_sheet(wb, ws, 'Carnets Manipulador');
    }
    
    // Registros limpieza
    if (data.cleaningRecords) {
      const cData = data.cleaningRecords.map(c => ({
        'Fecha': format(parseISO(c.date), 'dd/MM/yyyy'),
        'Área': c.area,
        'Tarea': c.task,
        'Realizado Por': c.performed_by || '-',
        'Hora': c.time || '-',
        'Verificado': c.verified ? 'Sí' : 'No'
      }));
      const ws = XLSX.utils.json_to_sheet(cData);
      XLSX.utils.book_append_sheet(wb, ws, 'Limpieza');
    }
    
    // Control plagas
    if (data.pestControl) {
      const pData = data.pestControl.map(p => ({
        'Fecha Visita': format(parseISO(p.date), 'dd/MM/yyyy'),
        'Empresa': p.company,
        'Técnico': p.technician || '-',
        'Tipo Tratamiento': p.treatment_type,
        'Próxima Visita': p.next_visit ? format(parseISO(p.next_visit), 'dd/MM/yyyy') : '-',
        'Certificado': p.certificate_number || '-'
      }));
      const ws = XLSX.utils.json_to_sheet(pData);
      XLSX.utils.book_append_sheet(wb, ws, 'Control Plagas');
    }
  }
  
  // Hojas de inspección industria/PRL
  addIndustrySheets(wb, data) {
    // Evaluaciones de riesgo
    if (data.riskEvaluations) {
      const rData = data.riskEvaluations.map(r => ({
        'Puesto': r.position,
        'Fecha Evaluación': format(parseISO(r.date), 'dd/MM/yyyy'),
        'Riesgos Identificados': r.risks_count || 0,
        'Medidas Preventivas': r.preventive_measures || '-',
        'Evaluador': r.evaluator || '-',
        'Estado': r.status
      }));
      const ws = XLSX.utils.json_to_sheet(rData);
      XLSX.utils.book_append_sheet(wb, ws, 'Evaluaciones Riesgo');
    }
    
    // Formación PRL
    if (data.prlTraining) {
      const tData = data.prlTraining.map(t => ({
        'Empleado': t.employee_name,
        'DNI': t.employee_dni || '-',
        'Curso': t.course_name,
        'Fecha': format(parseISO(t.date), 'dd/MM/yyyy'),
        'Horas': t.hours || '-',
        'Caducidad': t.expiration_date ? format(parseISO(t.expiration_date), 'dd/MM/yyyy') : 'No caduca',
        'Certificado': t.certificate_number || '-'
      }));
      const ws = XLSX.utils.json_to_sheet(tData);
      XLSX.utils.book_append_sheet(wb, ws, 'Formación PRL');
    }
    
    // EPIs
    if (data.epis) {
      const eData = data.epis.map(e => ({
        'Empleado': e.employee_name,
        'EPI': e.epi_name,
        'Tipo': e.epi_type,
        'Fecha Entrega': format(parseISO(e.delivery_date), 'dd/MM/yyyy'),
        'Caducidad': e.expiration_date ? format(parseISO(e.expiration_date), 'dd/MM/yyyy') : '-',
        'Firmado': e.signed ? 'Sí' : 'No'
      }));
      const ws = XLSX.utils.json_to_sheet(eData);
      XLSX.utils.book_append_sheet(wb, ws, 'EPIs');
    }
    
    // Accidentes
    if (data.accidents) {
      const aData = data.accidents.map(a => ({
        'Fecha': format(parseISO(a.date), 'dd/MM/yyyy'),
        'Empleado': a.employee_name,
        'Tipo': a.type,
        'Descripción': a.description || '-',
        'Baja': a.sick_leave ? 'Sí' : 'No',
        'Días Baja': a.sick_leave_days || 0,
        'Parte Accidente': a.report_number || '-'
      }));
      const ws = XLSX.utils.json_to_sheet(aData);
      XLSX.utils.book_append_sheet(wb, ws, 'Accidentes');
    }
    
    // Revisiones médicas
    if (data.medicalReviews) {
      const mData = data.medicalReviews.map(m => ({
        'Empleado': m.employee_name,
        'DNI': m.employee_dni || '-',
        'Fecha Revisión': format(parseISO(m.date), 'dd/MM/yyyy'),
        'Resultado': m.result,
        'Próxima Revisión': m.next_review_date ? format(parseISO(m.next_review_date), 'dd/MM/yyyy') : '-',
        'Apto': m.fit_for_work ? 'Sí' : 'Con restricciones'
      }));
      const ws = XLSX.utils.json_to_sheet(mData);
      XLSX.utils.book_append_sheet(wb, ws, 'Revisiones Médicas');
    }
    
    // Licencias y seguros
    if (data.licenses) {
      const lData = data.licenses.map(l => ({
        'Documento': l.name,
        'Tipo': l.type,
        'Número': l.number || '-',
        'Fecha Emisión': l.issue_date ? format(parseISO(l.issue_date), 'dd/MM/yyyy') : '-',
        'Caducidad': l.expiration_date ? format(parseISO(l.expiration_date), 'dd/MM/yyyy') : 'No caduca',
        'Estado': l.status
      }));
      const ws = XLSX.utils.json_to_sheet(lData);
      XLSX.utils.book_append_sheet(wb, ws, 'Licencias y Seguros');
    }
  }
  
  // ==========================================
  // DATOS DE PRUEBA (DEMO)
  // ==========================================
  
  generateMockData() {
    const today = new Date();
    
    return {
      // Datos para Inspección Laboral
      laboral: {
        timesheets: [
          { id: 1, employee_id: 1, employee_name: 'Juan García López', employee_dni: '12345678A', date: format(today, 'yyyy-MM-dd'), check_in: '08:00', check_out: '16:00', hours_worked: 8, verified: true },
          { id: 2, employee_id: 2, employee_name: 'María Rodríguez Pérez', employee_dni: '23456789B', date: format(today, 'yyyy-MM-dd'), check_in: '09:00', check_out: '17:00', hours_worked: 8, verified: true },
          { id: 3, employee_id: 3, employee_name: 'Pedro Martínez Sánchez', employee_dni: '34567890C', date: format(today, 'yyyy-MM-dd'), check_in: '10:00', check_out: null, hours_worked: null, verified: false },
        ],
        contracts: [
          { id: 1, employee_id: 1, employee_name: 'Juan García López', employee_dni: '12345678A', type: 'indefinido', start_date: '2022-01-15', end_date: null, status: 'active' },
          { id: 2, employee_id: 2, employee_name: 'María Rodríguez Pérez', employee_dni: '23456789B', type: 'temporal', start_date: '2025-01-01', end_date: format(addDays(today, 20), 'yyyy-MM-dd'), status: 'active' },
          { id: 3, employee_id: 3, employee_name: 'Pedro Martínez Sánchez', employee_dni: '34567890C', type: 'temporal', start_date: '2025-06-01', end_date: format(addDays(today, 5), 'yyyy-MM-dd'), status: 'active' },
        ],
        payrolls: [
          { id: 1, employee_id: 1, employee_name: 'Juan García López', employee_dni: '12345678A', period: 'Febrero 2026', gross_salary: 2500, net_salary: 2000, signed: true, signed_date: '2026-02-25' },
          { id: 2, employee_id: 2, employee_name: 'María Rodríguez Pérez', employee_dni: '23456789B', period: 'Febrero 2026', gross_salary: 2200, net_salary: 1760, signed: true, signed_date: '2026-02-25' },
          { id: 3, employee_id: 3, employee_name: 'Pedro Martínez Sánchez', employee_dni: '34567890C', period: 'Febrero 2026', gross_salary: 1800, net_salary: 1450, signed: false, signed_date: null },
        ]
      },
      
      // Datos para Inspección Sanidad
      sanidad: {
        temperatures: [
          { id: 1, equipment_name: 'Cámara Principal', recorded_at: format(today, "yyyy-MM-dd'T'08:00:00"), temperature: 3.5, min_temp: 0, max_temp: 5, recorded_by: 'Juan García' },
          { id: 2, equipment_name: 'Congelador 1', recorded_at: format(today, "yyyy-MM-dd'T'08:00:00"), temperature: -18, min_temp: -22, max_temp: -16, recorded_by: 'Juan García' },
          { id: 3, equipment_name: 'Cámara Principal', recorded_at: format(today, "yyyy-MM-dd'T'14:00:00"), temperature: 4.2, min_temp: 0, max_temp: 5, recorded_by: 'María Rodríguez' },
          { id: 4, equipment_name: 'Vitrina Fría', recorded_at: format(today, "yyyy-MM-dd'T'08:00:00"), temperature: 7.5, min_temp: 0, max_temp: 5, recorded_by: 'Juan García' }, // FUERA DE RANGO
        ],
        foodHandlerCerts: [
          { id: 1, employee_id: 1, employee_name: 'Juan García López', employee_dni: '12345678A', certificate_number: 'MH-2024-001', issue_date: '2024-03-15', expiration_date: '2029-03-15', status: 'valid' },
          { id: 2, employee_id: 2, employee_name: 'María Rodríguez Pérez', employee_dni: '23456789B', certificate_number: 'MH-2023-045', issue_date: '2023-06-10', expiration_date: format(addDays(today, 15), 'yyyy-MM-dd'), status: 'expiring' },
          { id: 3, employee_id: 3, employee_name: 'Pedro Martínez Sánchez', employee_dni: '34567890C', certificate_number: 'MH-2022-089', issue_date: '2022-01-20', expiration_date: '2025-01-20', status: 'expired' },
        ],
        cleaningRecords: Array.from({ length: 7 }, (_, i) => ({
          id: i + 1,
          date: format(addDays(today, -i), 'yyyy-MM-dd'),
          area: ['Cocina', 'Baños', 'Sala', 'Almacén'][i % 4],
          task: 'Limpieza general y desinfección',
          performed_by: 'Personal de limpieza',
          time: '06:00',
          verified: true
        })),
        pestControl: [
          { id: 1, date: format(addDays(today, -45), 'yyyy-MM-dd'), company: 'Control Plagas Madrid S.L.', technician: 'Antonio López', treatment_type: 'Desratización + Desinsectación', next_visit: format(addDays(today, 45), 'yyyy-MM-dd'), certificate_number: 'CPM-2026-0234' }
        ],
        allergenPlan: {
          last_update: format(addDays(today, -30), 'yyyy-MM-dd'),
          products_with_allergens: 45,
          allergen_matrix: true
        }
      },
      
      // Datos para Inspección Industria/PRL
      industria: {
        prlPlan: {
          id: 1,
          name: 'Plan de Prevención de Riesgos Laborales',
          approved_date: '2024-06-15',
          last_review: '2025-06-15',
          responsible: 'SPA Prevención S.L.'
        },
        riskEvaluations: [
          { id: 1, position: 'Cocinero/a', date: '2025-06-15', risks_count: 8, preventive_measures: 'EPIs, formación, protocolos', evaluator: 'SPA Prevención S.L.', status: 'active' },
          { id: 2, position: 'Camarero/a', date: '2025-06-15', risks_count: 5, preventive_measures: 'Ergonomía, EPIs', evaluator: 'SPA Prevención S.L.', status: 'active' },
          { id: 3, position: 'Limpieza', date: '2025-06-15', risks_count: 6, preventive_measures: 'Productos químicos, EPIs', evaluator: 'SPA Prevención S.L.', status: 'active' },
        ],
        prlTraining: [
          { id: 1, employee_id: 1, employee_name: 'Juan García López', employee_dni: '12345678A', course_name: 'PRL Básico - 60h', date: '2024-02-10', hours: 60, expiration_date: format(addDays(today, 400), 'yyyy-MM-dd'), certificate_number: 'PRL-2024-001' },
          { id: 2, employee_id: 2, employee_name: 'María Rodríguez Pérez', employee_dni: '23456789B', course_name: 'PRL Básico - 60h', date: '2023-11-15', hours: 60, expiration_date: format(addDays(today, 10), 'yyyy-MM-dd'), certificate_number: 'PRL-2023-089' },
          { id: 3, employee_id: 3, employee_name: 'Pedro Martínez Sánchez', employee_dni: '34567890C', course_name: 'PRL Básico - 60h', date: '2022-05-20', hours: 60, expiration_date: '2025-05-20', certificate_number: 'PRL-2022-045' },
        ],
        epis: [
          { id: 1, employee_id: 1, employee_name: 'Juan García López', epi_name: 'Guantes de cocina', epi_type: 'Protección térmica', delivery_date: '2025-12-01', expiration_date: '2026-12-01', signed: true },
          { id: 2, employee_id: 1, employee_name: 'Juan García López', epi_name: 'Calzado antideslizante', epi_type: 'Protección pies', delivery_date: '2025-06-15', expiration_date: null, signed: true },
          { id: 3, employee_id: 2, employee_name: 'María Rodríguez Pérez', epi_name: 'Calzado antideslizante', epi_type: 'Protección pies', delivery_date: '2025-06-15', expiration_date: null, signed: true },
        ],
        accidents: [
          { id: 1, date: '2025-09-12', employee_id: 2, employee_name: 'María Rodríguez Pérez', type: 'Leve', description: 'Corte leve en mano', sick_leave: false, sick_leave_days: 0, report_number: 'ACC-2025-001' },
        ],
        medicalReviews: [
          { id: 1, employee_id: 1, employee_name: 'Juan García López', employee_dni: '12345678A', date: '2025-06-10', result: 'Apto', next_review_date: '2026-06-10', fit_for_work: true },
          { id: 2, employee_id: 2, employee_name: 'María Rodríguez Pérez', employee_dni: '23456789B', date: '2025-03-15', result: 'Apto', next_review_date: format(addDays(today, 20), 'yyyy-MM-dd'), fit_for_work: true },
          { id: 3, employee_id: 3, employee_name: 'Pedro Martínez Sánchez', employee_dni: '34567890C', date: '2024-01-20', result: 'Apto', next_review_date: '2025-01-20', fit_for_work: true },
        ],
        licenses: [
          { id: 1, name: 'Licencia de Apertura', type: 'Municipal', number: 'LA-2020-1234', issue_date: '2020-03-15', expiration_date: null, status: 'active' },
          { id: 2, name: 'Licencia de Actividad', type: 'Municipal', number: 'ACT-2020-5678', issue_date: '2020-03-15', expiration_date: null, status: 'active' },
          { id: 3, name: 'Certificado Instalación Eléctrica', type: 'Industrial', number: 'CIE-2023-001', issue_date: '2023-05-10', expiration_date: '2028-05-10', status: 'active' },
          { id: 4, name: 'Certificado Gas', type: 'Industrial', number: 'CG-2024-045', issue_date: '2024-02-20', expiration_date: format(addDays(today, 25), 'yyyy-MM-dd'), status: 'expiring' },
        ],
        insurance: [
          { id: 1, name: 'Seguro Responsabilidad Civil', type: 'RC', number: 'POL-RC-2026-001', issue_date: '2026-01-01', expiration_date: '2027-01-01', status: 'active' },
          { id: 2, name: 'Seguro de Accidentes Convenio', type: 'Accidentes', number: 'POL-ACC-2026-001', issue_date: '2026-01-01', expiration_date: format(addDays(today, 8), 'yyyy-MM-dd'), status: 'expiring' },
          { id: 3, name: 'Seguro Multirriesgo', type: 'Local', number: 'POL-MR-2026-001', issue_date: '2026-01-01', expiration_date: '2027-01-01', status: 'active' },
        ]
      }
    };
  }
}

export const complianceService = new ComplianceService();
