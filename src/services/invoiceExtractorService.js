/**
 * Invoice Data Extractor Service
 * Extracts structured data from invoice text using regex patterns and AI
 */

// Document types
export const DOCUMENT_TYPES = {
  FACTURA: { id: 'factura', label: 'Factura', color: 'orange', icon: 'FileText' },
  NOMINA: { id: 'nomina', label: 'Nómina', color: 'violet', icon: 'User' },
  ALBARAN: { id: 'albaran', label: 'Albarán', color: 'blue', icon: 'Truck' },
  CONTRATO: { id: 'contrato', label: 'Contrato', color: 'emerald', icon: 'FileSignature' },
  LEGAL: { id: 'legal', label: 'Documento Legal', color: 'cyan', icon: 'Scale' },
  OTROS: { id: 'otros', label: 'Otros', color: 'zinc', icon: 'File' }
};

// Regex patterns for Spanish invoices
const PATTERNS = {
  // CIF/NIF patterns - Spanish tax IDs
  CIF: /\b([ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]|[KLMNXYZ]\d{7}[A-Z])\b/gi,
  NIF: /\b(\d{8}[A-Z]|[XYZ]\d{7}[A-Z])\b/gi,
  NIE: /\b([XYZ]\d{7}[A-Z])\b/gi,
  
  // Invoice number patterns
  INVOICE_NUMBER: [
    /(?:factura|fact|fra|invoice|inv|nº?|num\.?|número|n[uú]m)\s*[:\-#]?\s*([A-Z0-9][\w\-\/]{2,20})/gi,
    /(?:documento|doc|ref\.?|referencia)\s*[:\-#]?\s*([A-Z0-9][\w\-\/]{2,20})/gi,
    /\b([A-Z]{1,4}[\-\/]?\d{4,10}[\-\/]?\d{0,4})\b/g
  ],

  // Date patterns - Spanish format
  DATE: [
    /(?:fecha|date|emisi[oó]n|expedici[oó]n)\s*[:\-]?\s*(\d{1,2}[\-\/\.]\d{1,2}[\-\/\.]\d{2,4})/gi,
    /\b(\d{1,2}[\-\/\.]\d{1,2}[\-\/\.]\d{4})\b/g,
    /\b(\d{1,2}\s+(?:de\s+)?(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+(?:de\s+)?\d{4})\b/gi
  ],

  // Amount patterns - Euro format
  AMOUNT: [
    /(?:total|importe\s*total|total\s*factura|amount|suma|total\s*€)\s*[:\-]?\s*€?\s*([\d.,]+)\s*€?/gi,
    /(?:€|EUR)\s*([\d.,]+)/g,
    /([\d.,]+)\s*(?:€|EUR|euros?)/gi,
    /(?:total\s*a\s*pagar|total\s*iva\s*incl\.?)\s*[:\-]?\s*€?\s*([\d.,]+)/gi
  ],

  // Subtotal (base imponible)
  SUBTOTAL: [
    /(?:base\s*imponible|subtotal|importe\s*neto|base)\s*[:\-]?\s*€?\s*([\d.,]+)/gi,
    /(?:antes\s*de\s*iva|sin\s*iva)\s*[:\-]?\s*€?\s*([\d.,]+)/gi
  ],

  // IVA patterns
  IVA: [
    /(?:iva|i\.v\.a\.?|impuesto)\s*(?:\d{1,2}\s*%?)?\s*[:\-]?\s*€?\s*([\d.,]+)/gi,
    /(\d{1,2})\s*%\s*iva/gi
  ],

  // Provider/Company name patterns
  PROVIDER: [
    /^([A-ZÁÉÍÓÚÑ][a-záéíóúñA-ZÁÉÍÓÚÑ\s.,&]{2,50})\s*(?:S\.?L\.?|S\.?A\.?|S\.?L\.?U\.?|S\.?C\.?|SOCIEDAD)/gmi,
    /(?:raz[oó]n\s*social|empresa|proveedor|emisor|vendedor)\s*[:\-]?\s*([A-Za-záéíóúñÁÉÍÓÚÑ\s.,&]{3,60})/gi
  ],

  // Address patterns
  ADDRESS: [
    /(?:direcci[oó]n|domicilio|c\/|calle|avda\.?|avenida|plaza|pza\.?)\s*[:\-]?\s*([A-Za-záéíóúñÁÉÍÓÚÑ0-9\s,.\-º]+?)(?:\d{5}|\n|$)/gi,
    /\b(\d{5})\s*[-–]?\s*([A-Za-záéíóúñÁÉÍÓÚÑ\s]+?)(?:\(|\n|$)/g // Postal code + city
  ],

  // Phone patterns
  PHONE: [
    /(?:tel[eé]fono|tel\.?|tfno\.?|phone|móvil|m[oó]vil)\s*[:\-]?\s*(\+?\d[\d\s\-\.]{7,15})/gi,
    /\b(\+?34\s?)?(?:\d{3}[\s\.\-]?){3}\b/g
  ],

  // Email patterns
  EMAIL: /[\w\.-]+@[\w\.-]+\.\w{2,6}/gi,

  // Payment method
  PAYMENT_METHOD: [
    /(?:forma\s*de\s*pago|m[eé]todo\s*de\s*pago|pago)\s*[:\-]?\s*(transferencia|efectivo|tarjeta|cheque|domiciliaci[oó]n|giro|pagar[eé]|contado)/gi,
    /\b(IBAN|ES\d{2}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{2}[\s\-]?\d{10})\b/gi
  ],

  // Due date
  DUE_DATE: [
    /(?:fecha\s*de?\s*vencimiento|vencimiento|vence|fecha\s*l[ií]mite|pago\s*antes)\s*[:\-]?\s*(\d{1,2}[\-\/\.]\d{1,2}[\-\/\.]\d{2,4})/gi
  ],

  // Concepts/Items - for line items
  LINE_ITEM: [
    /^\s*(\d+)\s+(.+?)\s+([\d.,]+)\s*€?\s*$/gm, // qty description price
    /^(.+?)\s+(\d+)\s*[xX]\s*([\d.,]+)\s*€?\s*=?\s*([\d.,]+)\s*€?\s*$/gm // desc qty x price = total
  ]
};

// Spanish month names to numbers
const SPANISH_MONTHS = {
  'enero': '01', 'febrero': '02', 'marzo': '03', 'abril': '04',
  'mayo': '05', 'junio': '06', 'julio': '07', 'agosto': '08',
  'septiembre': '09', 'octubre': '10', 'noviembre': '11', 'diciembre': '12'
};

class InvoiceExtractorService {
  
  // Main extraction method
  extractInvoiceData(text) {
    if (!text || typeof text !== 'string') {
      return { success: false, error: 'No text provided' };
    }

    const normalizedText = this.normalizeText(text);
    
    const result = {
      success: true,
      documentType: this.detectDocumentType(normalizedText),
      
      // Extracted fields
      invoiceNumber: this.extractInvoiceNumber(normalizedText),
      invoiceDate: this.extractDate(normalizedText, 'invoice'),
      dueDate: this.extractDate(normalizedText, 'due'),
      
      // Provider info
      provider: {
        name: this.extractProviderName(normalizedText),
        cif: this.extractCIF(normalizedText),
        address: this.extractAddress(normalizedText),
        phone: this.extractPhone(normalizedText),
        email: this.extractEmail(normalizedText)
      },
      
      // Financial data
      subtotal: this.extractAmount(normalizedText, 'subtotal'),
      iva: this.extractIVA(normalizedText),
      total: this.extractAmount(normalizedText, 'total'),
      
      // Payment info
      paymentMethod: this.extractPaymentMethod(normalizedText),
      iban: this.extractIBAN(normalizedText),
      
      // Line items
      concepts: this.extractLineItems(normalizedText),
      
      // Metadata
      rawText: text,
      extractedAt: new Date().toISOString()
    };

    // Calculate validation scores
    result.validation = this.validateExtractedData(result);
    result.confidence = this.calculateConfidence(result);

    return result;
  }

  // Normalize text for better extraction
  normalizeText(text) {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\s+/g, ' ')
      .replace(/(\d)\s+(\d)/g, '$1$2') // Join split numbers
      .replace(/€\s+/g, '€')
      .replace(/\s+€/g, '€');
  }

  // Detect document type
  detectDocumentType(text) {
    const lowerText = text.toLowerCase();
    
    if (/factura|invoice|fra\./i.test(lowerText)) return DOCUMENT_TYPES.FACTURA;
    if (/n[oó]mina|salario|n[eé]to\s*a\s*percibir|irpf/i.test(lowerText)) return DOCUMENT_TYPES.NOMINA;
    if (/albar[aá]n|entrega|delivery/i.test(lowerText)) return DOCUMENT_TYPES.ALBARAN;
    if (/contrato|agreement|convenio/i.test(lowerText)) return DOCUMENT_TYPES.CONTRATO;
    if (/escritura|notari|p[oó]der|sociedad/i.test(lowerText)) return DOCUMENT_TYPES.LEGAL;
    
    return DOCUMENT_TYPES.OTROS;
  }

  // Extract invoice number
  extractInvoiceNumber(text) {
    for (const pattern of PATTERNS.INVOICE_NUMBER) {
      const match = pattern.exec(text);
      if (match && match[1]) {
        const num = match[1].trim();
        if (num.length >= 3 && num.length <= 30) {
          return { value: num, confidence: 85 };
        }
      }
      pattern.lastIndex = 0; // Reset regex
    }
    return { value: null, confidence: 0 };
  }

  // Extract dates
  extractDate(text, type = 'invoice') {
    const patterns = type === 'due' ? PATTERNS.DUE_DATE : PATTERNS.DATE;
    
    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches && matches.length > 0) {
        const dateStr = matches[0];
        const parsed = this.parseSpanishDate(dateStr);
        if (parsed) {
          return { value: parsed, confidence: 90, raw: dateStr };
        }
      }
    }
    return { value: null, confidence: 0 };
  }

  // Parse Spanish date formats
  parseSpanishDate(dateStr) {
    // Check for Spanish month names
    for (const [month, num] of Object.entries(SPANISH_MONTHS)) {
      if (dateStr.toLowerCase().includes(month)) {
        const dayMatch = dateStr.match(/(\d{1,2})/);
        const yearMatch = dateStr.match(/(\d{4})/);
        if (dayMatch && yearMatch) {
          const day = dayMatch[1].padStart(2, '0');
          return `${yearMatch[1]}-${num}-${day}`;
        }
      }
    }

    // Standard date format dd/mm/yyyy or dd-mm-yyyy
    const match = dateStr.match(/(\d{1,2})[\-\/\.](\d{1,2})[\-\/\.](\d{2,4})/);
    if (match) {
      let [, day, month, year] = match;
      day = day.padStart(2, '0');
      month = month.padStart(2, '0');
      year = year.length === 2 ? '20' + year : year;
      return `${year}-${month}-${day}`;
    }

    return null;
  }

  // Extract CIF/NIF
  extractCIF(text) {
    const cifMatch = text.match(PATTERNS.CIF);
    const nifMatch = text.match(PATTERNS.NIF);
    
    const match = cifMatch?.[0] || nifMatch?.[0];
    if (match) {
      const cif = match.toUpperCase().replace(/\s/g, '');
      return { 
        value: cif, 
        confidence: this.validateCIF(cif) ? 95 : 60,
        valid: this.validateCIF(cif)
      };
    }
    return { value: null, confidence: 0, valid: false };
  }

  // Validate CIF/NIF format
  validateCIF(cif) {
    if (!cif || cif.length !== 9) return false;
    
    const cifRegex = /^[ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]$/;
    const nifRegex = /^\d{8}[A-Z]$/;
    const nieRegex = /^[XYZ]\d{7}[A-Z]$/;
    
    return cifRegex.test(cif) || nifRegex.test(cif) || nieRegex.test(cif);
  }

  // Extract amounts
  extractAmount(text, type = 'total') {
    const patterns = type === 'subtotal' ? PATTERNS.SUBTOTAL : PATTERNS.AMOUNT;
    
    for (const pattern of patterns) {
      const match = pattern.exec(text);
      if (match) {
        const amount = this.parseSpanishAmount(match[1] || match[0]);
        if (amount !== null && amount > 0) {
          return { value: amount, confidence: 85, raw: match[0] };
        }
      }
      pattern.lastIndex = 0;
    }
    return { value: null, confidence: 0 };
  }

  // Parse Spanish number format (1.234,56 or 1234.56)
  parseSpanishAmount(str) {
    if (!str) return null;
    
    let cleaned = str.replace(/[^\d.,]/g, '');
    
    // Spanish format: 1.234,56
    if (/^\d{1,3}(?:\.\d{3})*,\d{2}$/.test(cleaned)) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    }
    // US format: 1,234.56
    else if (/^\d{1,3}(?:,\d{3})*\.\d{2}$/.test(cleaned)) {
      cleaned = cleaned.replace(/,/g, '');
    }
    // Simple comma decimal: 123,45
    else if (/^\d+,\d{2}$/.test(cleaned)) {
      cleaned = cleaned.replace(',', '.');
    }
    
    const amount = parseFloat(cleaned);
    return isNaN(amount) ? null : Math.round(amount * 100) / 100;
  }

  // Extract IVA
  extractIVA(text) {
    const result = { value: null, percentage: null, confidence: 0 };
    
    // Extract IVA amount
    for (const pattern of PATTERNS.IVA) {
      const match = pattern.exec(text);
      if (match) {
        // Check if it's a percentage or amount
        if (match[0].includes('%')) {
          result.percentage = parseInt(match[1]);
          result.confidence = 80;
        } else {
          const amount = this.parseSpanishAmount(match[1]);
          if (amount !== null) {
            result.value = amount;
            result.confidence = 85;
          }
        }
      }
      pattern.lastIndex = 0;
    }

    // Try to detect IVA percentage from context
    const ivaPercentMatch = text.match(/(\d{1,2})\s*%\s*(?:de\s*)?iva/i);
    if (ivaPercentMatch) {
      result.percentage = parseInt(ivaPercentMatch[1]);
    }

    return result;
  }

  // Extract provider name
  extractProviderName(text) {
    for (const pattern of PATTERNS.PROVIDER) {
      const match = pattern.exec(text);
      if (match && match[1]) {
        const name = match[1].trim().replace(/\s+/g, ' ');
        if (name.length >= 3 && name.length <= 100) {
          return { value: name, confidence: 75 };
        }
      }
      pattern.lastIndex = 0;
    }
    
    // Try to find company-like names at the beginning of text
    const lines = text.split('\n').slice(0, 10);
    for (const line of lines) {
      const cleanLine = line.trim();
      if (cleanLine.length >= 5 && cleanLine.length <= 80) {
        if (/^[A-ZÁÉÍÓÚÑ][a-záéíóúñA-ZÁÉÍÓÚÑ\s.,&-]+(?:S\.?L\.?|S\.?A\.?)?$/i.test(cleanLine)) {
          return { value: cleanLine, confidence: 60 };
        }
      }
    }
    
    return { value: null, confidence: 0 };
  }

  // Extract address
  extractAddress(text) {
    for (const pattern of PATTERNS.ADDRESS) {
      const match = pattern.exec(text);
      if (match) {
        const address = (match[1] || match[0]).trim().replace(/\s+/g, ' ');
        if (address.length >= 10 && address.length <= 200) {
          return { value: address, confidence: 70 };
        }
      }
      pattern.lastIndex = 0;
    }
    return { value: null, confidence: 0 };
  }

  // Extract phone
  extractPhone(text) {
    const matches = text.match(PATTERNS.PHONE[0]) || text.match(PATTERNS.PHONE[1]);
    if (matches) {
      const phone = matches[0].replace(/[^\d+]/g, '');
      if (phone.length >= 9 && phone.length <= 15) {
        return { value: phone, confidence: 85 };
      }
    }
    return { value: null, confidence: 0 };
  }

  // Extract email
  extractEmail(text) {
    const match = text.match(PATTERNS.EMAIL);
    if (match) {
      return { value: match[0].toLowerCase(), confidence: 95 };
    }
    return { value: null, confidence: 0 };
  }

  // Extract payment method
  extractPaymentMethod(text) {
    for (const pattern of PATTERNS.PAYMENT_METHOD) {
      const match = pattern.exec(text);
      if (match) {
        const method = match[1] || match[0];
        return { value: method.trim(), confidence: 80 };
      }
      pattern.lastIndex = 0;
    }
    return { value: null, confidence: 0 };
  }

  // Extract IBAN
  extractIBAN(text) {
    const ibanMatch = text.match(/[A-Z]{2}\d{2}[\s\-]?(?:\d{4}[\s\-]?){5}/gi);
    if (ibanMatch) {
      const iban = ibanMatch[0].replace(/[\s\-]/g, '').toUpperCase();
      return { value: iban, confidence: 90 };
    }
    return { value: null, confidence: 0 };
  }

  // Extract line items
  extractLineItems(text) {
    const items = [];
    const lines = text.split('\n');
    
    for (const line of lines) {
      // Try to match: quantity | description | unit price | total
      const match = line.match(/^\s*(\d+)\s+(.+?)\s+([\d.,]+)\s*€?\s*(?:[\d.,]+\s*€?\s*)?$/);
      if (match) {
        items.push({
          quantity: parseInt(match[1]),
          description: match[2].trim(),
          unitPrice: this.parseSpanishAmount(match[3]),
          confidence: 70
        });
      }
    }
    
    return items;
  }

  // Validate extracted data
  validateExtractedData(data) {
    const validation = {
      hasCIF: data.provider.cif.value !== null,
      cifValid: data.provider.cif.valid || false,
      hasDate: data.invoiceDate.value !== null,
      dateValid: this.isValidDate(data.invoiceDate.value),
      hasTotal: data.total.value !== null && data.total.value > 0,
      totalNumeric: typeof data.total.value === 'number',
      hasProvider: data.provider.name.value !== null,
      hasInvoiceNumber: data.invoiceNumber.value !== null,
      
      // Critical data missing
      missingCritical: [],
      warnings: []
    };

    if (!validation.hasCIF) validation.missingCritical.push('CIF/NIF');
    if (!validation.hasDate) validation.missingCritical.push('Fecha');
    if (!validation.hasTotal) validation.missingCritical.push('Importe total');
    if (!validation.hasProvider) validation.missingCritical.push('Proveedor');

    if (!validation.hasInvoiceNumber) validation.warnings.push('Número de factura no encontrado');
    if (validation.hasCIF && !validation.cifValid) validation.warnings.push('Formato de CIF/NIF posiblemente incorrecto');

    validation.isComplete = validation.missingCritical.length === 0;
    
    return validation;
  }

  // Check if date is valid
  isValidDate(dateStr) {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    return !isNaN(date.getTime()) && date.getFullYear() >= 2000 && date.getFullYear() <= 2100;
  }

  // Calculate overall confidence score
  calculateConfidence(data) {
    const weights = {
      invoiceNumber: 0.1,
      invoiceDate: 0.15,
      provider: 0.2,
      cif: 0.2,
      total: 0.25,
      concepts: 0.1
    };

    let score = 0;
    
    if (data.invoiceNumber.value) score += weights.invoiceNumber * (data.invoiceNumber.confidence / 100);
    if (data.invoiceDate.value) score += weights.invoiceDate * (data.invoiceDate.confidence / 100);
    if (data.provider.name.value) score += weights.provider * (data.provider.name.confidence / 100);
    if (data.provider.cif.value) score += weights.cif * (data.provider.cif.confidence / 100);
    if (data.total.value) score += weights.total * (data.total.confidence / 100);
    if (data.concepts.length > 0) score += weights.concepts * 0.7;

    return Math.round(score * 100);
  }
}

export const invoiceExtractor = new InvoiceExtractorService();
export default invoiceExtractor;
