/**
 * Generador de Markdown Estructurado para Facturas
 * 
 * Convierte invoice.json a markdown normalizado con schema consistente
 * para mejor entendimiento por modelos de IA y análisis inteligente.
 */

const formatCurrency = (value) => {
  const n = Number(value) || 0;
  return n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
};

const formatDate = (dateStr) => {
  if (!dateStr) return 'Fecha desconocida';
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('es-ES');
};

const normalizeText = (text) => {
  return (text || '').trim();
};

/**
 * Genera markdown estructurado de una factura
 * @param {Object} invoice - Objeto factura JSON
 * @param {Object} provider - Objeto proveedor asociado (opcional)
 * @returns {string} Markdown estructurado
 */
function generateInvoiceMarkdown(invoice, provider = null) {
  const inv = invoice;
  
  // Identificadores y referencias
  const invoiceId = inv.id || 'sin-id';
  const invoiceNumber = inv.invoice_number || 'S/N';
  const providerName = inv.provider_name || provider?.nombre || 'Proveedor desconocido';
  const providerCif = inv.provider_cif || provider?.cif_nif || '—';
  
  // Fechas
  const invoiceDate = formatDate(inv.invoice_date);
  const dueDate = inv.due_date ? formatDate(inv.due_date) : '—';
  
  // Totales
  const subtotal = Number(inv.subtotal) || Number(inv.base) || 0;
  const ivaAmount = Number(inv.iva) || 0;
  const total = Number(inv.total) || 0;
  const ivaRate = inv.iva_rate || (subtotal > 0 ? Math.round((ivaAmount / subtotal) * 100) : 21);
  
  // Líneas de productos/servicios
  const items = inv.items || [];
  const hasItems = items.length > 0;
  
  // Metadata
  const fileName = inv.file_name || 'Sin archivo';
  const status = inv.status || 'desconocido';
  const extractionMethod = inv.extraction_method || 'OCR/IA';
  const sourceId = inv.source_id || '—';
  
  // Construcción del markdown
  let markdown = '';
  
  // CABECERA
  markdown += `# Factura ${invoiceNumber}\n`;
  markdown += `**ID Sistema**: \`${invoiceId}\`\n`;
  markdown += `**ID Documento**: \`${sourceId}\`\n\n`;
  
  // INFORMACIÓN DEL PROVEEDOR
  markdown += `## Proveedor\n`;
  markdown += `**Nombre**: ${providerName}\n`;
  markdown += `**CIF/NIF**: ${providerCif}\n`;
  if (provider?.direccion) {
    markdown += `**Dirección**: ${provider.direccion}\n`;
  }
  if (provider?.email) {
    markdown += `**Email**: ${provider.email}\n`;
  }
  if (provider?.telefono) {
    markdown += `**Teléfono**: ${provider.telefono}\n`;
  }
  markdown += '\n';
  
  // INFORMACIÓN DE LA FACTURA
  markdown += `## Información de la Factura\n`;
  markdown += `- **Fecha de emisión**: ${invoiceDate}\n`;
  markdown += `- **Fecha de vencimiento**: ${dueDate}\n`;
  markdown += `- **Estado**: ${status.toUpperCase()}\n`;
  markdown += `- **Método de extracción**: ${extractionMethod}\n`;
  markdown += `- **Archivo fuente**: ${fileName}\n`;
  markdown += '\n';
  
  // LÍNEAS DE PRODUCTOS/SERVICIOS
  if (hasItems) {
    markdown += `## Líneas de Producto/Servicio (${items.length} línea(s))\n`;
    markdown += '| Descripción | Qty | Unidad | Precio Unitario | IVA% | Total |\n';
    markdown += '|---|---|---|---|---|---|\n';
    
    items.forEach((item, idx) => {
      const desc = (item.description || item.concepto || 'Producto').substring(0, 40);
      const qty = Number(item.quantity) || 0;
      const unit = item.unit || 'ud';
      const unitPrice = Number(item.unit_price) || Number(item.price) || 0;
      const itemIva = item.vat || ivaRate;
      const itemTotal = Number(item.total) || (qty * unitPrice);
      
      markdown += `| ${desc} | ${qty} | ${unit} | ${formatCurrency(unitPrice)} | ${itemIva}% | ${formatCurrency(itemTotal)} |\n`;
    });
    markdown += '\n';
  } else {
    markdown += `## Líneas de Producto/Servicio\n`;
    markdown += `⚠️ No hay líneas de detalle extraídas\n\n`;
  }
  
  // DESGLOSE FINANCIERO
  markdown += `## Desglose Financiero\n`;
  markdown += `| Concepto | Importe |\n`;
  markdown += `|---|---|\n`;
  markdown += `| **Base Imponible** | ${formatCurrency(subtotal)} |\n`;
  markdown += `| **IVA (${ivaRate}%)** | ${formatCurrency(ivaAmount)} |\n`;
  markdown += `| **Total** | **${formatCurrency(total)}** |\n`;
  markdown += '\n';
  
  // METADATA DE CALIDAD Y CONFIANZA
  markdown += `## Calidad de Datos\n`;
  const confidence = inv.confidence || inv.extraction_confidence || '—';
  markdown += `- **Confianza de extracción**: ${confidence}%\n`;
  
  const missingFields = [];
  if (!inv.provider_cif || inv.provider_cif === '') missingFields.push('CIF/NIF del proveedor');
  if (!inv.invoice_date || inv.invoice_date === '') missingFields.push('Fecha de factura');
  if (!inv.total || Number(inv.total) === 0) missingFields.push('Total de factura');
  if (!hasItems) missingFields.push('Líneas de producto');
  
  if (missingFields.length > 0) {
    markdown += `- **Campos faltantes**: ${missingFields.join(', ')}\n`;
  } else {
    markdown += `- **Campos faltantes**: Ninguno\n`;
  }
  
  markdown += `- **Estado de procesamiento**: ${status}\n`;
  markdown += '\n';
  
  // NOTAS Y OBSERVACIONES
  if (inv.summary) {
    markdown += `## Resumen\n`;
    markdown += `${inv.summary}\n\n`;
  }
  
  if (inv.notes) {
    markdown += `## Notas Internas\n`;
    markdown += `${inv.notes}\n\n`;
  }
  
  // AUDITORÍA
  markdown += `## Auditoría\n`;
  markdown += `- **Creado**: ${formatDate(inv.created_date)}\n`;
  markdown += `- **Actualizado**: ${formatDate(inv.updated_date)}\n`;
  markdown += `- **Categoría**: ${inv.category || 'otros'}\n`;
  markdown += '\n';
  
  return markdown;
}

/**
 * Genera markdown estructurado de un proveedor con todas sus facturas
 * @param {Object} provider - Objeto proveedor
 * @param {Array} invoices - Array de facturas del proveedor
 * @returns {string} Markdown estructurado del proveedor
 */
function generateProviderMarkdown(provider, invoices = []) {
  let markdown = '';
  
  // CABECERA DEL PROVEEDOR
  markdown += `# Ficha de Proveedor: ${provider.nombre || 'Desconocido'}\n`;
  markdown += `**ID**: \`${provider.id || 'sin-id'}\`\n`;
  markdown += `**Deduplication Key**: \`${provider.deduplication_key || '—'}\`\n\n`;
  
  // INFORMACIÓN GENERAL
  markdown += `## Información General\n`;
  markdown += `- **Nombre Legal**: ${provider.nombre || '—'}\n`;
  markdown += `- **CIF/NIF**: ${provider.cif_nif || '—'}\n`;
  markdown += `- **Tipo Entidad**: ${provider.tipo_entidad || 'empresa'}\n`;
  markdown += `- **Estado**: ${provider.status || 'activo'}\n`;
  markdown += '\n';
  
  // CONTACTO
  markdown += `## Contacto\n`;
  markdown += `- **Dirección**: ${provider.direccion || '—'}\n`;
  markdown += `- **Email**: ${provider.email || '—'}\n`;
  markdown += `- **Teléfono**: ${provider.telefono || '—'}\n`;
  markdown += '\n';
  
  // RESUMEN FINANCIERO
  if (invoices.length > 0) {
    const totalSpend = invoices.reduce((s, inv) => s + (Number(inv.total) || 0), 0);
    const avgInvoice = invoices.length > 0 ? totalSpend / invoices.length : 0;
    const lastInvoiceDate = invoices.length > 0
      ? formatDate(Math.max(...invoices.map(inv => new Date(inv.invoice_date).getTime())))
      : '—';
    
    markdown += `## Resumen Financiero\n`;
    markdown += `- **Total facturado**: ${formatCurrency(totalSpend)}\n`;
    markdown += `- **Número de facturas**: ${invoices.length}\n`;
    markdown += `- **Factura promedio**: ${formatCurrency(avgInvoice)}\n`;
    markdown += `- **Última factura**: ${lastInvoiceDate}\n`;
    markdown += '\n';
  }
  
  // FACTURAS ASOCIADAS
  markdown += `## Facturas Asociadas (${invoices.length})\n\n`;
  
  if (invoices.length === 0) {
    markdown += `⚠️ No hay facturas asociadas a este proveedor\n\n`;
  } else {
    // Tabla resumen de facturas
    markdown += `### Resumen de Facturas\n`;
    markdown += `| Factura | Fecha | Base | IVA | Total | Estado |\n`;
    markdown += `|---|---|---|---|---|---|\n`;
    
    invoices
      .sort((a, b) => (b.invoice_date || '').localeCompare(a.invoice_date || ''))
      .slice(0, 50) // Limitar a últimas 50 para no inflar markdown
      .forEach((inv) => {
        const num = inv.invoice_number || 'S/N';
        const date = formatDate(inv.invoice_date);
        const base = formatCurrency(Number(inv.base) || Number(inv.subtotal) || 0);
        const iva = formatCurrency(Number(inv.iva) || 0);
        const total = formatCurrency(Number(inv.total) || 0);
        const st = inv.status || '—';
        
        markdown += `| ${num} | ${date} | ${base} | ${iva} | ${total} | ${st} |\n`;
      });
    
    if (invoices.length > 50) {
      markdown += `\n*... y ${invoices.length - 50} facturas más*\n`;
    }
    markdown += '\n';
  }
  
  // ANÁLISIS POR MES
  if (invoices.length > 0) {
    markdown += `### Gasto Mensual\n`;
    const monthlyData = {};
    invoices.forEach((inv) => {
      const date = new Date(inv.invoice_date);
      const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthlyData[month] = (monthlyData[month] || 0) + (Number(inv.total) || 0);
    });
    
    Object.entries(monthlyData)
      .sort(([a], [b]) => b.localeCompare(a))
      .forEach(([month, total]) => {
        markdown += `- **${month}**: ${formatCurrency(total)}\n`;
      });
    markdown += '\n';
  }
  
  // AUDITORÍA
  markdown += `## Auditoría\n`;
  markdown += `- **Creado**: ${formatDate(provider.creado)}\n`;
  markdown += `- **Aprobado por usuario**: ${provider.approved_by_user ? 'Sí' : 'No'}\n`;
  markdown += `- **Estado aprobación**: ${provider.status || 'pendiente'}\n`;
  markdown += '\n';
  
  return markdown;
}

export {
  generateInvoiceMarkdown,
  generateProviderMarkdown,
  formatCurrency,
  formatDate,
  normalizeText,
};
