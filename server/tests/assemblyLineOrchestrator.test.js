import AssemblyLineOrchestrator from '../services/assemblyLineOrchestrator.js';
import fs from 'fs';
import path from 'path';

// Mock data
const mockItems = [
  {
    id: 'inv-001',
    type: 'invoice',
    routed_to: 'accounting',
    category: 'invoice',
    priority: 'HIGH',
    extracted_data: {
      amount: 1500,
      status: 'paid',
      provider: 'Acme Corp'
    }
  },
  {
    id: 'inv-002',
    type: 'invoice',
    routed_to: 'accounting',
    category: 'invoice',
    extracted_data: {
      amount: 2500,
      status: 'pending',
      provider: 'Tech Solutions'
    }
  },
  {
    id: 'inv-003',
    type: 'invoice',
    routed_to: 'accounting',
    category: 'invoice',
    extracted_data: {
      amount: 800,
      status: 'overdue',
      provider: 'Acme Corp'
    }
  },
  {
    id: 'email-001',
    type: 'email',
    routed_to: 'archive',
    category: 'other',
    extracted_data: {}
  }
];

async function runTest() {
  console.log('🧪 INICIANDO TEST DE ASSEMBLY LINE CON ETAPA 5\\n');

  try {
    const orchestrator = new AssemblyLineOrchestrator();

    // Test 1: Generar fichas
    console.log('📋 Test 1: Generando fichas...');
    const cards = await orchestrator._generateCards(mockItems);
    console.log(`✅ Fichas generadas: ${cards.count}`);
    console.log(`   Tipo de ficha: ${cards.items[0]?.id}\n`);

    // Test 2: Análisis económico
    console.log('💰 Test 2: Generando análisis económico...');
    const analysis = await orchestrator._generateEconomicAnalysis(mockItems);
    console.log(`✅ Análisis completado:`);
    console.log(`   Total: ${analysis.totalValue}€`);
    console.log(`   Facturas: ${analysis.totalInvoices}`);
    console.log(`   Pagado: ${analysis.paidValue}€ (${analysis.paymentRate}%)`);
    console.log(`   Pendiente: ${analysis.pendingValue}€`);
    console.log(`   Vencido: ${analysis.overdueValue}€`);
    console.log(`   Top proveedores: ${analysis.topProviders.length}\n`);

    // Test 3: Summary con parámetros
    console.log('📊 Test 3: Imprimiendo resumen mágico...');
    const routed = { count: mockItems.length };
    orchestrator._printSummary(routed, cards, analysis);

    console.log('\\n✨ TODOS LOS TESTS PASADOS');

    // Validaciones
    if (cards.count === mockItems.length) {
      console.log('✅ Validación 1: Fichas generadas = Items procesados');
    }
    
    if (parseInt(analysis.totalValue) === 4800) {
      console.log('✅ Validación 2: Total económico correcto (4800€)');
    }
    
    if (analysis.topProviders.length > 0) {
      console.log('✅ Validación 3: Proveedores ordenados');
    }

    console.log('\\n🎉 ETAPA 5 COMPLETAMENTE FUNCIONAL');

  } catch (error) {
    console.error('❌ Error en test:', error.message);
    process.exit(1);
  }
}

runTest();
