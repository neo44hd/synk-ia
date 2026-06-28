/**
 * Prueba End-to-End de Pipeline de Procesamiento de Facturas
 * 
 * Valida el flujo completo:
 * JSON → Normalize → Markdown → Analyze → Results
 */

import InvoiceProcessingPipeline from '../services/invoiceProcessingPipeline.js';
import * as generator from '../services/invoiceMarkdownGenerator.js';
import * as analyzer from '../services/invoiceMarkdownAnalyzer.js';

// Factura de prueba real
const testInvoice = {
  id: 'id_1782563212778_i55x9vs1b',
  source_id: 'doc_1777532493257_dc13s',
  provider_name: 'JOSE RIQUER 7 BJ 3',
  provider_cif: '',
  invoice_number: '30/04/26A295',
  invoice_date: '2026-04-30',
  due_date: null,
  subtotal: 94.7,
  iva: 3.79,
  total: 99.58,
  currency: 'EUR',
  category: 'otros',
  status: 'pagada',
  file_name: 'Factura_A295.pdf',
  items: [
    {
      description: 'PATATA BLANCA',
      quantity: 430,
      unit_price: 0.96,
      vat: 4,
      total: 411.84
    },
    {
      description: 'CEBOLLA MORADA',
      quantity: 410,
      unit_price: 1.39,
      vat: 10,
      total: 569.9
    },
    {
      description: 'BERENJENAS CAT. EXT',
      quantity: 44.35,
      unit_price: 7.61,
      vat: 10,
      total: 337.4035
    }
  ],
  summary: 'Factura de compra de productos frescos a Jose Riquer para Chicken Palace Ibiza, S.L.',
  created_date: '2026-04-30T07:01:33.257Z',
  updated_date: '2026-06-27T12:26:52.778Z'
};

// Proveedor de prueba
const testProvider = {
  id: 'prov_1782648302397_4lak',
  nombre: 'DISTRIBUCIONES PINEDAS MONTIEL, S.L.',
  cif_nif: '84504064A',
  direccion: 'POU DE NACIANA, 14-16',
  email: 'info@distribucionesmontiel.com',
  telefono: '+34 971 39 65 10',
  status: 'pending_review',
  approved_by_user: false,
  tipo_entidad: 'empresa',
  deduplication_key: 'tax:84504064A',
  creado: '2026-06-28T12:05:02.397Z'
};

/**
 * Test 1: Procesar factura individual
 */
async function testProcessSingleInvoice() {
  console.log('\n' + '='.repeat(60));
  console.log('TEST 1: Procesar Factura Individual');
  console.log('='.repeat(60));

  const pipeline = new InvoiceProcessingPipeline();

  // Escuchar eventos
  pipeline.on('stage:start', (data) => {
    console.log(`📋 Etapa iniciada: ${data.stage}`);
  });

  pipeline.on('stage:complete', (data) => {
    console.log(`✅ Etapa completada: ${data.stage}`);
  });

  pipeline.on('stage:error', (data) => {
    console.log(`❌ Error: ${data.error}`);
  });

  try {
    const result = await pipeline.processInvoice(testInvoice, {
      generator,
      analyzer
    });

    if (result.success) {
      console.log('\n📊 RESULTADO:');
      console.log(`- Invoice ID: ${result.invoice_id}`);
      console.log(`- Markdown generado: ${result.markdown.lines} líneas`);
      console.log(`- Alertas generadas: ${result.analysis.alerts.length}`);
      console.log(`- Score de calidad: ${(result.analysis.analysis.score_calidad * 100).toFixed(0)}%`);

      console.log('\n🔍 MARKDOWN (primeras 500 caracteres):');
      console.log(result.markdown.markdown.substring(0, 500) + '...\n');

      console.log('🎯 ALERTAS GENERADAS:');
      result.analysis.alerts.forEach((alert, idx) => {
        console.log(`  ${idx + 1}. [${alert.type}] ${alert.message}`);
      });

      return true;
    } else {
      console.error('❌ Procesamiento fallido:', result.error);
      return false;
    }
  } catch (error) {
    console.error('❌ Error en prueba:', error.message);
    return false;
  }
}

/**
 * Test 2: Procesar proveedor completo
 */
async function testProcessProvider() {
  console.log('\n' + '='.repeat(60));
  console.log('TEST 2: Procesar Proveedor Completo con Facturas');
  console.log('='.repeat(60));

  const pipeline = new InvoiceProcessingPipeline();

  pipeline.on('stage:start', (data) => {
    console.log(`📋 Etapa iniciada: ${data.stage}`);
  });

  pipeline.on('stage:complete', (data) => {
    console.log(`✅ Etapa completada: ${data.stage}`);
  });

  try {
    const result = await pipeline.processProvider(testProvider, [testInvoice], {
      generator,
      analyzer
    });

    if (result.success) {
      console.log('\n📊 RESULTADO:');
      console.log(`- Provider ID: ${result.provider_id}`);
      console.log(`- Facturas procesadas: ${result.invoices_processed}`);
      console.log(`- Markdown generado: ${result.markdown.lines} líneas`);
      console.log(`- Alertas generadas: ${result.analysis.alerts.length}`);
      console.log(`- Score de relación: ${(result.analysis.analysis.score_relacion * 100).toFixed(0)}%`);

      console.log('\n🔍 MARKDOWN (primeras 800 caracteres):');
      console.log(result.markdown.markdown.substring(0, 800) + '...\n');

      console.log('🎯 ANÁLISIS GENERADO:');
      console.log(`- Importancia: ${result.analysis.analysis.clasificacion.importancia}`);
      console.log(`- Riesgo: ${result.analysis.analysis.clasificacion.riesgo_general}`);
      console.log(`- Recomendación: ${result.analysis.analysis.clasificacion.recomendacion_estado}`);

      if (result.analysis.analysis.recomendaciones_estrategicas.length > 0) {
        console.log('\n💡 RECOMENDACIONES:');
        result.analysis.analysis.recomendaciones_estrategicas.forEach((rec, idx) => {
          console.log(`  ${idx + 1}. [${rec.prioridad}] ${rec.descripcion}`);
        });
      }

      return true;
    } else {
      console.error('❌ Procesamiento fallido:', result.error);
      return false;
    }
  } catch (error) {
    console.error('❌ Error en prueba:', error.message);
    return false;
  }
}

/**
 * Test 3: Validar estructura de Markdown
 */
async function testMarkdownStructure() {
  console.log('\n' + '='.repeat(60));
  console.log('TEST 3: Validar Estructura de Markdown');
  console.log('='.repeat(60));

  try {
    const markdown = generator.generateInvoiceMarkdown(testInvoice);

    // Validar secciones clave
    const sections = [
      '# Factura',
      '## Proveedor',
      '## Información de la Factura',
      '## Líneas de Producto/Servicio',
      '## Desglose Financiero',
      '## Calidad de Datos',
      '## Auditoría'
    ];

    console.log('\n✅ Validación de Secciones:');
    let allPresent = true;
    sections.forEach((section) => {
      const present = markdown.includes(section);
      console.log(`  ${present ? '✅' : '❌'} ${section}`);
      if (!present) allPresent = false;
    });

    // Validar datos
    console.log('\n✅ Validación de Datos:');
    console.log(`  ${markdown.includes('PATATA BLANCA') ? '✅' : '❌'} Productos extraídos`);
    console.log(`  ${markdown.includes('99,58 €') ? '✅' : '❌'} Totales calculados`);
    console.log(`  ${markdown.includes('pagada') ? '✅' : '❌'} Estado registrado`);

    console.log(`\n📊 Estadísticas del Markdown:`);
    console.log(`  - Total de caracteres: ${markdown.length}`);
    console.log(`  - Total de líneas: ${markdown.split('\n').length}`);
    console.log(`  - Tablas detectadas: ${(markdown.match(/\|/g) || []).length / 6}`);

    return allPresent;
  } catch (error) {
    console.error('❌ Error en validación:', error.message);
    return false;
  }
}

/**
 * Test 4: Validar prompts para LLM
 */
async function testLLMPrompts() {
  console.log('\n' + '='.repeat(60));
  console.log('TEST 4: Validar Prompts para LLM');
  console.log('='.repeat(60));

  try {
    const invoiceMarkdown = generator.generateInvoiceMarkdown(testInvoice);
    const prompt = analyzer.generateInvoiceAnalysisPrompt(invoiceMarkdown);

    console.log('\n✅ Prompt para análisis de factura:');
    console.log(`  - Largo total: ${prompt.length} caracteres`);
    console.log(`  - Contiene markdown: ${prompt.includes(invoiceMarkdown.substring(0, 100))}`);
    console.log(`  - Contiene instrucciones: ${prompt.includes('TAREAS A REALIZAR')}`);
    console.log(`  - Solicita JSON: ${prompt.includes('JSON')}`);

    const providerMarkdown = generator.generateProviderMarkdown(testProvider, [testInvoice]);
    const providerPrompt = analyzer.generateProviderAnalysisPrompt(providerMarkdown);

    console.log('\n✅ Prompt para análisis de proveedor:');
    console.log(`  - Largo total: ${providerPrompt.length} caracteres`);
    console.log(`  - Contiene markdown: ${providerPrompt.includes(providerMarkdown.substring(0, 100))}`);
    console.log(`  - Contiene instrucciones: ${providerPrompt.includes('Tendencias')}`);

    return true;
  } catch (error) {
    console.error('❌ Error en validación de prompts:', error.message);
    return false;
  }
}

/**
 * Ejecutar todas las pruebas
 */
async function runAllTests() {
  console.log('\n' + '#'.repeat(60));
  console.log('# PRUEBAS END-TO-END: Pipeline de Procesamiento de Facturas');
  console.log('#'.repeat(60));

  const results = {};

  results.test1 = await testProcessSingleInvoice();
  results.test2 = await testProcessProvider();
  results.test3 = await testMarkdownStructure();
  results.test4 = await testLLMPrompts();

  // Resumen
  console.log('\n' + '#'.repeat(60));
  console.log('# RESUMEN DE PRUEBAS');
  console.log('#'.repeat(60));

  const passed = Object.values(results).filter((r) => r).length;
  const total = Object.values(results).length;

  console.log(`\n✅ Pruebas pasadas: ${passed}/${total}`);
  console.log(
    passed === total
      ? '\n🎉 ¡TODAS LAS PRUEBAS PASARON!\n'
      : '\n⚠️  Algunas pruebas fallaron. Revisa arriba para detalles.\n'
  );

  process.exit(passed === total ? 0 : 1);
}

// Ejecutar
runAllTests().catch(console.error);
