/**
 * SYNK-IA - Servicio de Almacenamiento de Datos Local
 * © 2024 David Roldan - Chicken Palace Ibiza
 * Futuro: SYNK-IA LABS
 * 
 * Reemplaza la funcionalidad de Base44 SDK con almacenamiento local
 */

const STORAGE_PREFIX = 'synkia_data_';

/**
 * Genera un ID único
 */
function generateId() {
  return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

/**
 * Clase que simula una entidad de Base44
 */
class LocalEntity {
  constructor(entityName) {
    this.entityName = entityName;
    this.storageKey = STORAGE_PREFIX + entityName.toLowerCase();
  }

  /**
   * Obtiene todos los registros del storage
   */
  _getAll() {
    const data = localStorage.getItem(this.storageKey);
    return data ? JSON.parse(data) : [];
  }

  /**
   * Guarda todos los registros en storage
   */
  _saveAll(records) {
    localStorage.setItem(this.storageKey, JSON.stringify(records));
  }

  /**
   * Lista todos los registros, opcionalmente ordenados
   * @param {string} sortBy - Campo por el que ordenar (prefijo '-' para descendente)
   * @param {number} limit - Límite de registros a retornar
   */
  async list(sortBy = '-created_date', limit = null) {
    let records = this._getAll();
    
    if (sortBy) {
      const desc = sortBy.startsWith('-');
      const field = desc ? sortBy.slice(1) : sortBy;
      
      records.sort((a, b) => {
        const aVal = a[field] || '';
        const bVal = b[field] || '';
        
        if (desc) {
          return bVal > aVal ? 1 : bVal < aVal ? -1 : 0;
        }
        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      });
    }
    
    if (limit) {
      records = records.slice(0, limit);
    }
    
    return records;
  }

  /**
   * Filtra registros por campo y valor
   * @param {string} field - Campo a filtrar
   * @param {any} value - Valor a buscar
   */
  async filter(filters) {
    let records = this._getAll();
    
    if (typeof filters === 'object') {
      for (const [field, value] of Object.entries(filters)) {
        records = records.filter(r => r[field] === value);
      }
    }
    
    return records;
  }

  /**
   * Obtiene un registro por ID
   * @param {string} id - ID del registro
   */
  async get(id) {
    const records = this._getAll();
    return records.find(r => r.id === id) || null;
  }

  /**
   * Crea un nuevo registro
   * @param {object} data - Datos del registro
   */
  async create(data) {
    const records = this._getAll();
    const newRecord = {
      id: generateId(),
      ...data,
      created_date: new Date().toISOString(),
      updated_date: new Date().toISOString()
    };
    records.push(newRecord);
    this._saveAll(records);
    return newRecord;
  }

  /**
   * Actualiza un registro existente
   * @param {string} id - ID del registro
   * @param {object} data - Datos a actualizar
   */
  async update(id, data) {
    const records = this._getAll();
    const idx = records.findIndex(r => r.id === id);
    
    if (idx === -1) {
      throw new Error(`Registro ${id} no encontrado en ${this.entityName}`);
    }
    
    records[idx] = {
      ...records[idx],
      ...data,
      updated_date: new Date().toISOString()
    };
    
    this._saveAll(records);
    return records[idx];
  }

  /**
   * Elimina un registro
   * @param {string} id - ID del registro
   */
  async delete(id) {
    const records = this._getAll();
    const filteredRecords = records.filter(r => r.id !== id);
    this._saveAll(filteredRecords);
    return true;
  }
}

/**
 * Factory para crear entidades
 */
function createEntity(name) {
  return new LocalEntity(name);
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
  createEntity // Para crear entidades personalizadas
};

export default dataService;
