#!/usr/bin/env node

/**
 * Script para cargar datos de prueba en SynK-IA
 */

const BASE_URL = 'http://localhost:3001/api/data';

async function loadData(entity, records) {
  try {
    const response = await fetch(`${BASE_URL}/${entity.toLowerCase()}/bulk`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records, merge: true }),
    });
    const result = await response.json();
    console.log(`✓ ${entity}: ${records.length} registros cargados`);
    return result;
  } catch (err) {
    console.error(`✗ ${entity}: ${err.message}`);
    return null;
  }
}

// Datos de prueba
const providers = [
  { id: 'prov_001', name: 'SEAT S.A.', email: 'compras@seat.es', category: 'Automoción', created_date: new Date().toISOString() },
  { id: 'prov_002', name: 'Telefónica', email: 'contacto@telefonica.es', category: 'Telecomunicaciones', created_date: new Date().toISOString() },
  { id: 'prov_003', name: 'Iberdrola', email: 'negocios@iberdrola.es', category: 'Energía', created_date: new Date().toISOString() },
];

const invoices = [
  { id: 'inv_001', provider_id: 'prov_001', provider_name: 'SEAT S.A.', total: 2500.50, status: 'pagada', invoice_date: '2026-05-15', created_date: new Date().toISOString() },
  { id: 'inv_002', provider_id: 'prov_002', provider_name: 'Telefónica', total: 450.00, status: 'pendiente', invoice_date: '2026-05-20', created_date: new Date().toISOString() },
  { id: 'inv_003', provider_id: 'prov_003', provider_name: 'Iberdrola', total: 1200.00, status: 'vencida', invoice_date: '2026-04-10', created_date: new Date().toISOString() },
  { id: 'inv_004', provider_id: 'prov_001', provider_name: 'SEAT S.A.', total: 3200.75, status: 'pendiente', invoice_date: '2026-05-25', created_date: new Date().toISOString() },
];

const salesInvoices = [
  { id: 'sales_001', client_id: 'client_001', client_name: 'Chicken Palace Ibiza', total: 5000.00, invoice_date: '2026-05-20', status: 'pagada', created_date: new Date().toISOString() },
  { id: 'sales_002', client_id: 'client_002', client_name: 'Restaurant ABC', total: 2500.00, invoice_date: '2026-05-25', status: 'pendiente', created_date: new Date().toISOString() },
  { id: 'sales_003', client_id: 'client_001', client_name: 'Chicken Palace Ibiza', total: 3200.00, invoice_date: '2026-05-26', status: 'pagada', created_date: new Date().toISOString() },
];

const products = [
  { id: 'prod_001', name: 'Pollo Fresh Kilo', sku: 'POLLO-1K', price: 12.50, stock: 45, category: 'Alimentos', created_date: new Date().toISOString() },
  { id: 'prod_002', name: 'Aceite de Oliva Virgen', sku: 'ACEITE-5L', price: 35.00, stock: 12, category: 'Aceites', created_date: new Date().toISOString() },
  { id: 'prod_003', name: 'Especias Variadas Mix', sku: 'ESPECIAS-MIX', price: 8.75, stock: 25, category: 'Condimentos', created_date: new Date().toISOString() },
];

const employees = [
  { id: 'emp_001', name: 'Juan García', email: 'juan@sinkia.local', role: 'chef', status: 'activo', created_date: new Date().toISOString() },
  { id: 'emp_002', name: 'María López', email: 'maria@sinkia.local', role: 'camarero', status: 'activo', created_date: new Date().toISOString() },
  { id: 'emp_003', name: 'Pedro Martínez', email: 'pedro@sinkia.local', role: 'cocinero', status: 'activo', created_date: new Date().toISOString() },
];

const orders = [
  { id: 'ord_001', customer: 'Chicken Palace Ibiza', total: 1250.00, status: 'entregado', order_date: '2026-05-20', created_date: new Date().toISOString() },
  { id: 'ord_002', customer: 'Restaurant ABC', total: 890.50, status: 'pendiente', order_date: '2026-05-25', created_date: new Date().toISOString() },
  { id: 'ord_003', customer: 'Catering XYZ', total: 2100.00, status: 'en_preparacion', order_date: '2026-05-26', created_date: new Date().toISOString() },
];

const documents = [
  { id: 'doc_001', filename: 'Factura_A295.pdf', type: 'factura', status: 'procesado', created_date: new Date().toISOString() },
  { id: 'doc_002', filename: 'Nómina_Mayo_2026.pdf', type: 'nomina', status: 'procesado', created_date: new Date().toISOString() },
  { id: 'doc_003', filename: 'Albarán_INT-001.pdf', type: 'albaran', status: 'procesado', created_date: new Date().toISOString() },
];

async function main() {
  console.log('📦 Cargando datos de prueba en SynK-IA...\n');
  
  await loadData('Provider', providers);
  await loadData('Invoice', invoices);
  await loadData('SalesInvoice', salesInvoices);
  await loadData('Product', products);
  await loadData('Employee', employees);
  await loadData('Order', orders);
  await loadData('Document', documents);
  
  console.log('\n✅ Datos de prueba cargados correctamente');
}

main().catch(console.error);
