/**
 * SYNK-IA - Entidades del Sistema
 * © 2024 David Roldan - Chicken Palace Ibiza
 * Futuro: SYNK-IA LABS
 * 
 * Sistema de gestión integral usando almacenamiento local
 */

import {
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
  UploadedFile
} from '../services/dataService';

import { authService } from '../services/authService';

// Re-exportar todas las entidades
export {
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
  UploadedFile
};

// Auth SDK - usando servicio local
export const User = authService;
