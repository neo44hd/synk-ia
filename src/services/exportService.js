// Servicio de Exportación para Gestoría - SYNK-IA
// Exporta datos a Excel con formatos compatibles

import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

class ExportService {
  
  // Exportar a Excel genérico
  exportToExcel(data, filename, sheetName = 'Datos') {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    
    // Auto-ajustar ancho de columnas
    const colWidths = this.calculateColumnWidths(data);
    ws['!cols'] = colWidths;
    
    XLSX.writeFile(wb, `${filename}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  }
  
  // Calcular anchos de columnas
  calculateColumnWidths(data) {
    if (!data.length) return [];
    
    const keys = Object.keys(data[0]);
    return keys.map(key => {
      const maxLength = Math.max(
        key.length,
        ...data.map(row => String(row[key] || '').length)
      );
      return { wch: Math.min(maxLength + 2, 50) };
    });
  }
  
  // Exportar facturas por período
  exportInvoicesByPeriod(invoices, startDate, endDate) {
    const filtered = invoices.filter(inv => {
      const invDate = new Date(inv.date || inv.created_date);
      return invDate >= startDate && invDate <= endDate;
    });
    
    const data = filtered.map(inv => ({
      'Número': inv.number || inv.invoice_number || '-',
      'Fecha': inv.date ? format(new Date(inv.date), 'dd/MM/yyyy') : '-',
      'Proveedor': inv.provider_name || '-',
      'CIF Proveedor': inv.provider_cif || '-',
      'Concepto': inv.concept || inv.description || '-',
      'Base Imponible': inv.base_amount || 0,
      'IVA (%)': inv.vat_rate || 21,
      'Importe IVA': inv.vat_amount || 0,
      'Total': inv.total_amount || inv.total || 0,
      'Estado': inv.status || 'pendiente',
      'Forma Pago': inv.payment_method || '-',
      'Fecha Vencimiento': inv.due_date ? format(new Date(inv.due_date), 'dd/MM/yyyy') : '-'
    }));
    
    const filename = `facturas_${format(startDate, 'yyyyMMdd')}_${format(endDate, 'yyyyMMdd')}`;
    this.exportToExcel(data, filename, 'Facturas');
    
    return { exported: data.length, filename };
  }
  
  // Exportar gastos por proveedor
  exportExpensesByProvider(invoices, providers) {
    const providerTotals = {};
    
    invoices.forEach(inv => {
      const provName = inv.provider_name || 'Sin proveedor';
      if (!providerTotals[provName]) {
        const provider = providers.find(p => p.name === provName);
        providerTotals[provName] = {
          proveedor: provName,
          cif: provider?.cif || inv.provider_cif || '-',
          facturas: 0,
          total: 0,
          categoria: provider?.category || '-'
        };
      }
      providerTotals[provName].facturas++;
      providerTotals[provName].total += inv.total_amount || inv.total || 0;
    });
    
    const data = Object.values(providerTotals).map(p => ({
      'Proveedor': p.proveedor,
      'CIF': p.cif,
      'Categoría': p.categoria,
      'Nº Facturas': p.facturas,
      'Total Gastado (€)': p.total.toFixed(2)
    }));
    
    const filename = `gastos_por_proveedor_${format(new Date(), 'yyyyMMdd')}`;
    this.exportToExcel(data, filename, 'Gastos por Proveedor');
    
    return { exported: data.length, filename };
  }
  
  // Exportar nóminas del mes
  exportPayrollsByMonth(payrolls, month, year) {
    const filtered = payrolls.filter(p => {
      const period = p.period || '';
      return period.includes(`${year}-${String(month).padStart(2, '0')}`);
    });
    
    const data = filtered.map(p => ({
      'Empleado': p.employee_name || '-',
      'DNI/NIE': p.employee_dni || '-',
      'Período': p.period || '-',
      'Salario Bruto': p.gross_salary || 0,
      'SS Empleado': p.ss_employee || 0,
      'IRPF (%)': p.irpf_rate || 0,
      'Retención IRPF': p.irpf_amount || 0,
      'SS Empresa': p.ss_company || 0,
      'Salario Neto': p.net_salary || 0,
      'Estado': p.status || 'pendiente',
      'Fecha Pago': p.payment_date ? format(new Date(p.payment_date), 'dd/MM/yyyy') : '-'
    }));
    
    const monthName = format(new Date(year, month - 1), 'MMMM_yyyy', { locale: es });
    const filename = `nominas_${monthName}`;
    this.exportToExcel(data, filename, 'Nóminas');
    
    return { exported: data.length, filename };
  }
  
  // Exportar fichajes de empleados
  exportTimesheetsByPeriod(timesheets, employees, startDate, endDate) {
    const filtered = timesheets.filter(t => {
      const tDate = new Date(t.date || t.check_in);
      return tDate >= startDate && tDate <= endDate;
    });
    
    const data = filtered.map(t => {
      const employee = employees.find(e => e.id === t.employee_id);
      return {
        'Empleado': t.employee_name || employee?.full_name || '-',
        'DNI/NIE': employee?.dni || '-',
        'Fecha': t.date ? format(new Date(t.date), 'dd/MM/yyyy') : '-',
        'Entrada': t.check_in ? format(new Date(t.check_in), 'HH:mm') : '-',
        'Salida': t.check_out ? format(new Date(t.check_out), 'HH:mm') : '-',
        'Horas Trabajadas': t.hours_worked || this.calculateHours(t.check_in, t.check_out),
        'Horas Extra': t.overtime || 0,
        'Tipo': t.type || 'normal',
        'Observaciones': t.notes || '-'
      };
    });
    
    const filename = `fichajes_${format(startDate, 'yyyyMMdd')}_${format(endDate, 'yyyyMMdd')}`;
    this.exportToExcel(data, filename, 'Fichajes');
    
    return { exported: data.length, filename };
  }
  
  // Calcular horas entre entrada y salida
  calculateHours(checkIn, checkOut) {
    if (!checkIn || !checkOut) return 0;
    const diff = new Date(checkOut) - new Date(checkIn);
    return (diff / (1000 * 60 * 60)).toFixed(2);
  }
  
  // Exportar listado de empleados para gestoría
  exportEmployeeList(employees) {
    const data = employees.map(e => ({
      'Nombre Completo': e.full_name || '-',
      'DNI/NIE': e.dni || '-',
      'Nº SS': e.ss_number || '-',
      'Email': e.email || '-',
      'Teléfono': e.phone || '-',
      'Puesto': e.position || e.role || '-',
      'Fecha Alta': e.hire_date ? format(new Date(e.hire_date), 'dd/MM/yyyy') : '-',
      'Tipo Contrato': e.contract_type || '-',
      'Jornada': e.work_schedule || 'completa',
      'Salario Bruto Anual': e.annual_salary || '-',
      'IBAN': e.iban || '-',
      'Estado': e.status || 'activo'
    }));
    
    const filename = `listado_empleados_${format(new Date(), 'yyyyMMdd')}`;
    this.exportToExcel(data, filename, 'Empleados');
    
    return { exported: data.length, filename };
  }
  
  // Exportar resumen mensual para gestoría (combinado)
  exportMonthlyReport(invoices, payrolls, timesheets, month, year) {
    const wb = XLSX.utils.book_new();
    
    // Hoja 1: Facturas del mes
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0);
    
    const invoiceData = invoices
      .filter(inv => {
        const invDate = new Date(inv.date || inv.created_date);
        return invDate >= monthStart && invDate <= monthEnd;
      })
      .map(inv => ({
        'Número': inv.number || inv.invoice_number || '-',
        'Fecha': inv.date ? format(new Date(inv.date), 'dd/MM/yyyy') : '-',
        'Proveedor': inv.provider_name || '-',
        'Base': inv.base_amount || 0,
        'IVA': inv.vat_amount || 0,
        'Total': inv.total_amount || inv.total || 0
      }));
    
    const wsInvoices = XLSX.utils.json_to_sheet(invoiceData);
    XLSX.utils.book_append_sheet(wb, wsInvoices, 'Facturas');
    
    // Hoja 2: Nóminas del mes
    const payrollData = payrolls
      .filter(p => p.period?.includes(`${year}-${String(month).padStart(2, '0')}`))
      .map(p => ({
        'Empleado': p.employee_name || '-',
        'Bruto': p.gross_salary || 0,
        'SS Empleado': p.ss_employee || 0,
        'IRPF': p.irpf_amount || 0,
        'Neto': p.net_salary || 0,
        'SS Empresa': p.ss_company || 0
      }));
    
    const wsPayrolls = XLSX.utils.json_to_sheet(payrollData);
    XLSX.utils.book_append_sheet(wb, wsPayrolls, 'Nóminas');
    
    // Hoja 3: Resumen fichajes
    const timesheetData = timesheets
      .filter(t => {
        const tDate = new Date(t.date || t.check_in);
        return tDate >= monthStart && tDate <= monthEnd;
      })
      .map(t => ({
        'Empleado': t.employee_name || '-',
        'Fecha': t.date ? format(new Date(t.date), 'dd/MM/yyyy') : '-',
        'Horas': t.hours_worked || 0
      }));
    
    const wsTimesheets = XLSX.utils.json_to_sheet(timesheetData);
    XLSX.utils.book_append_sheet(wb, wsTimesheets, 'Fichajes');
    
    // Hoja 4: Resumen
    const totalFacturas = invoiceData.reduce((sum, i) => sum + (i.Total || 0), 0);
    const totalNominas = payrollData.reduce((sum, p) => sum + (p.Neto || 0), 0);
    const totalSSEmpresa = payrollData.reduce((sum, p) => sum + (p['SS Empresa'] || 0), 0);
    
    const summaryData = [
      { 'Concepto': 'Total Facturas Gastos', 'Importe': totalFacturas.toFixed(2) },
      { 'Concepto': 'Total Nóminas Netas', 'Importe': totalNominas.toFixed(2) },
      { 'Concepto': 'Total SS Empresa', 'Importe': totalSSEmpresa.toFixed(2) },
      { 'Concepto': 'TOTAL GASTOS MES', 'Importe': (totalFacturas + totalNominas + totalSSEmpresa).toFixed(2) }
    ];
    
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen');
    
    const monthName = format(new Date(year, month - 1), 'MMMM_yyyy', { locale: es });
    const filename = `informe_gestoria_${monthName}.xlsx`;
    XLSX.writeFile(wb, filename);
    
    return { 
      exported: {
        facturas: invoiceData.length,
        nominas: payrollData.length,
        fichajes: timesheetData.length
      },
      filename 
    };
  }
  
  // Exportar listado de proveedores
  exportProviderList(providers, invoices) {
    const data = providers.map(p => {
      const provInvoices = invoices.filter(i => i.provider_name === p.name);
      const total = provInvoices.reduce((sum, i) => sum + (i.total_amount || i.total || 0), 0);
      
      return {
        'Nombre': p.name || '-',
        'CIF': p.cif || '-',
        'Email': p.email || '-',
        'Teléfono': p.phone || '-',
        'Dirección': p.address || '-',
        'Categoría': p.category || '-',
        'Nº Facturas': provInvoices.length,
        'Total Facturado': total.toFixed(2),
        'Estado': p.status || 'activo'
      };
    });
    
    const filename = `listado_proveedores_${format(new Date(), 'yyyyMMdd')}`;
    this.exportToExcel(data, filename, 'Proveedores');
    
    return { exported: data.length, filename };
  }
}

export const exportService = new ExportService();
export default exportService;
