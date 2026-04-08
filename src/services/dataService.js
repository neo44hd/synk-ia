/**
 * SYNK-IA - Servicio de Datos (API Backend)
 * © 2024 David Roldan - Chicken Palace Ibiza
 * Futuro: SYNK-IA LABS
 *
 * Conecta con el backend /api/data/:entity para persistencia real
 * Mantiene compatibilidad con la interfaz Base44 SDK
 */

const API_BASE = '/api/data';

async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

class ApiEntity {
  constructor(entityName) {
    this.entityName = entityName;
    this.endpoint = `${API_BASE}/${entityName.toLowerCase()}`;
  }

  async list(sortBy = '-created_date', limit = null) {
    const params = new URLSearchParams();
    if (sortBy) params.set('sort', sortBy);
    if (limit) params.set('limit', String(limit));
    const result = await apiFetch(`${this.endpoint}?${params}`);
    return result.data || [];
  }

  async filter(filters) {
    const result = await apiFetch(`${this.endpoint}/filter`, {
      method: 'POST',
      body: JSON.stringify(filters),
    });
    return result.data || [];
  }

  async get(id) {
    const result = await apiFetch(`${this.endpoint}/${id}`);
    return result.data || null;
  }

  async create(data) {
    const result = await apiFetch(this.endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return result.data;
  }

  async update(id, data) {
    const result = await apiFetch(`${this.endpoint}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return result.data;
  }

  async delete(id) {
    await apiFetch(`${this.endpoint}/${id}`, { method: 'DELETE' });
    return true;
  }

  async bulkReplace(records) {
    const result = await apiFetch(`${this.endpoint}/bulk`, {
      method: 'PUT',
      body: JSON.stringify({ records, merge: false }),
    });
    return result;
  }

  async bulkMerge(records) {
    const result = await apiFetch(`${this.endpoint}/bulk`, {
      method: 'PUT',
      body: JSON.stringify({ records, merge: true }),
    });
    return result;
  }
}

function createEntity(name) {
  return new ApiEntity(name);
}

// Exportar todas las entidades que estaban en Base44
export const Provider = createEntity('Provider');
export const Invoice = createEntity('Invoice');
export const PriceComparison = createEntity('PriceComparison');
export const Document = createEntity('Document');
export const Timesheet = createEntity('Timesheet');
export const Contract = createEntity('Contract');
export const Payroll = createEntity('Payroll');
export const VacationRequest = createEntity('VacationRequest');
export const EmailIntegration = createEntity('EmailIntegration');
export const Notification = createEntity('Notification');
export const Report = createEntity('Report');
export const MutuaIncident = createEntity('MutuaIncident');
export const RGPDCompliance = createEntity('RGPDCompliance');
export const CompanyDocument = createEntity('CompanyDocument');
export const Sale = createEntity('Sale');
export const MenuItem = createEntity('MenuItem');
export const RevoEmployee = createEntity('RevoEmployee');
export const WebSync = createEntity('WebSync');
export const Albaran = createEntity('Albaran');
export const VeriFactu = createEntity('VeriFactu');
export const EmailAccount = createEntity('EmailAccount');
export const Order = createEntity('Order');
export const EmailMessage = createEntity('EmailMessage');
export const EmailContact = createEntity('EmailContact');
export const Quote = createEntity('Quote');
export const Client = createEntity('Client');
export const SalesInvoice = createEntity('SalesInvoice');
export const Product = createEntity('Product');
export const ProductPurchase = createEntity('ProductPurchase');
export const Employee = createEntity('Employee');
export const UploadedFile = createEntity('UploadedFile');

// Exportar el servicio completo
export const dataService = {
  Provider,
  Invoice,
  PriceComparison,
  Document,
  Timesheet,
  Contract,
  Payroll,
  VacationRequest,
  EmailIntegration,
  Notification,
  Report,
  MutuaIncident,
  RGPDCompliance,
  CompanyDocument,
  Sale,
  MenuItem,
  RevoEmployee,
  WebSync,
  Albaran,
  VeriFactu,
  EmailAccount,
  Order,
  EmailMessage,
  EmailContact,
  Quote,
  Client,
  SalesInvoice,
  Product,
  ProductPurchase,
  Employee,
  UploadedFile,
  createEntity
};

export default dataService;
