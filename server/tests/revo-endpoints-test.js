#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
//  TEST AUTOMÁTICO DE ENDPOINTS REVO XEF
//  Verifica cada endpoint alternativo y genera un informe de disponibilidad.
//
//  Uso:
//    node server/tests/revo-endpoints-test.js
//    node server/tests/revo-endpoints-test.js --json    (salida JSON)
//    node server/tests/revo-endpoints-test.js --fix     (guarda cache de endpoints válidos)
// ═══════════════════════════════════════════════════════════════════════════

import dotenv from 'dotenv';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// ── Config ──────────────────────────────────────────────────────────────────

const REVO_BASE = 'https://integrations.revoxef.works/api/v1';
const TIMEOUT_MS = 10000;
const DATA_DIR = process.env.DATA_DIR || '/Users/davidnows/sinkia/data';
const CACHE_FILE = path.join(DATA_DIR, 'revo', 'endpoints-cache.json');

const ENDPOINTS = {
  productos:  ['/catalog/products', '/catalog/items', '/items', '/products'],
  categorias: ['/catalog/categories', '/categories'],
  ventas:     ['/orders', '/order/list', '/orders/list'],
  cajas:      ['/cash', '/cash/list', '/sessions', '/cash-sessions'],
  mesas:      ['/tables', '/table/list'],
  empleados:  ['/staff', '/employees', '/users', '/workers'],
};

// ── Flags ───────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const JSON_OUTPUT = args.includes('--json');
const FIX_MODE = args.includes('--fix');

// ── Headers ─────────────────────────────────────────────────────────────────

function getHeaders() {
  const h = {
    'Authorization': `Bearer ${process.env.REVO_TOKEN_LARGO}`,
    'Content-Type': 'application/json',
  };
  if (process.env.REVO_TOKEN_CORTO) {
    h['X-API-Key'] = process.env.REVO_TOKEN_CORTO;
  }
  return h;
}

// ── Test individual ─────────────────────────────────────────────────────────

async function testEndpoint(endpoint) {
  const url = `${REVO_BASE}${endpoint}`;
  const inicio = Date.now();

  try {
    const res = await fetch(url, {
      headers: getHeaders(),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    const latencia = Date.now() - inicio;
    const contentType = res.headers.get('content-type') || '';
    let body = null;
    let registros = 0;

    if (res.ok && contentType.includes('json')) {
      try {
        body = await res.json();
        const data = body?.data || body;
        registros = Array.isArray(data) ? data.length : (typeof data === 'object' ? Object.keys(data).length : 0);
      } catch {
        body = '[Error parseando JSON]';
      }
    }

    return {
      endpoint,
      url,
      status: res.status,
      statusText: res.statusText,
      ok: res.ok,
      latencia_ms: latencia,
      content_type: contentType,
      registros,
      error: null,
    };
  } catch (err) {
    return {
      endpoint,
      url,
      status: 0,
      statusText: 'ERROR',
      ok: false,
      latencia_ms: Date.now() - inicio,
      content_type: null,
      registros: 0,
      error: err.name === 'TimeoutError' ? `Timeout (${TIMEOUT_MS}ms)` : err.message,
    };
  }
}

// ── Test por recurso ────────────────────────────────────────────────────────

async function testRecurso(nombre, endpoints) {
  const resultados = [];

  for (const ep of endpoints) {
    const resultado = await testEndpoint(ep);
    resultados.push(resultado);
  }

  const mejorEndpoint = resultados.find(r => r.ok) || null;

  return {
    recurso: nombre,
    total_endpoints: endpoints.length,
    funcionan: resultados.filter(r => r.ok).length,
    mejor_endpoint: mejorEndpoint?.endpoint || null,
    mejor_latencia: mejorEndpoint?.latencia_ms || null,
    mejor_registros: mejorEndpoint?.registros || 0,
    resultados,
  };
}

// ── Informe ─────────────────────────────────────────────────────────────────

function imprimirInforme(informe) {
  const ancho = 90;
  const linea = '═'.repeat(ancho);
  const separador = '─'.repeat(ancho);

  console.log('');
  console.log(linea);
  console.log('  INFORME DE ENDPOINTS REVO XEF');
  console.log(`  Fecha: ${informe.timestamp}`);
  console.log(`  Base URL: ${REVO_BASE}`);
  console.log(`  Token: ${informe.token_presente ? 'Configurado' : '⚠️  NO CONFIGURADO'}`);
  console.log(linea);

  for (const recurso of informe.recursos) {
    console.log('');
    const estado = recurso.funcionan > 0 ? '✅' : '❌';
    console.log(`${estado} ${recurso.recurso.toUpperCase()} — ${recurso.funcionan}/${recurso.total_endpoints} endpoints responden`);

    if (recurso.mejor_endpoint) {
      console.log(`   Mejor: ${recurso.mejor_endpoint} (${recurso.mejor_latencia}ms, ${recurso.mejor_registros} registros)`);
    }

    console.log(separador);
    console.log('   Endpoint                         Status   Latencia  Registros  Error');
    console.log(separador);

    for (const r of recurso.resultados) {
      const icono = r.ok ? '✓' : '✗';
      const ep = r.endpoint.padEnd(33);
      const st = String(r.status).padEnd(8);
      const lat = `${r.latencia_ms}ms`.padEnd(9);
      const reg = String(r.registros).padEnd(10);
      const err = r.error || '';
      console.log(`   ${icono} ${ep} ${st} ${lat} ${reg} ${err}`);
    }
  }

  // Resumen final
  console.log('');
  console.log(linea);
  const totalOk = informe.recursos.filter(r => r.funcionan > 0).length;
  const totalRecursos = informe.recursos.length;
  console.log(`  RESUMEN: ${totalOk}/${totalRecursos} recursos disponibles`);

  if (totalOk === 0) {
    console.log('');
    console.log('  ⚠️  NINGÚN ENDPOINT RESPONDE. Posibles causas:');
    console.log('     1. Token REVO_TOKEN_LARGO expirado → regenerar en panel Revo');
    console.log('     2. API de Revo caída → comprobar status.revoxef.works');
    console.log('     3. IP bloqueada → comprobar con curl manual');
    console.log('     4. Cuenta sin permisos de API → contactar soporte Revo');
  }

  if (informe.cache_guardado) {
    console.log('');
    console.log(`  💾 Cache de endpoints guardado en: ${CACHE_FILE}`);
  }

  console.log(linea);
  console.log('');
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const tokenPresente = !!process.env.REVO_TOKEN_LARGO;

  if (!tokenPresente) {
    console.error('❌ REVO_TOKEN_LARGO no está definido en server/.env');
    console.error('   Sin token no se puede acceder a la API de Revo.');
    process.exit(1);
  }

  if (!JSON_OUTPUT) {
    console.log('');
    console.log('🔍 Testeando endpoints de Revo XEF...');
    console.log(`   Base: ${REVO_BASE}`);
    console.log(`   Token: ${process.env.REVO_TOKEN_LARGO.slice(0, 8)}...${process.env.REVO_TOKEN_LARGO.slice(-4)}`);
    console.log('');
  }

  // Ejecutar tests
  const recursos = [];
  for (const [nombre, endpoints] of Object.entries(ENDPOINTS)) {
    if (!JSON_OUTPUT) process.stdout.write(`   Testeando ${nombre}...`);
    const resultado = await testRecurso(nombre, endpoints);
    recursos.push(resultado);
    if (!JSON_OUTPUT) {
      const ok = resultado.funcionan > 0;
      console.log(` ${ok ? '✅' : '❌'} (${resultado.funcionan}/${resultado.total_endpoints})`);
    }
  }

  // Construir informe
  const informe = {
    timestamp: new Date().toISOString(),
    revo_base: REVO_BASE,
    token_presente: tokenPresente,
    recursos,
    cache_guardado: false,
  };

  // Guardar cache de endpoints válidos (modo --fix)
  if (FIX_MODE) {
    const cache = {};
    for (const r of recursos) {
      if (r.mejor_endpoint) {
        cache[r.recurso] = r.mejor_endpoint;
      }
    }

    if (Object.keys(cache).length > 0) {
      await mkdir(path.dirname(CACHE_FILE), { recursive: true });
      await writeFile(CACHE_FILE, JSON.stringify({
        generado: new Date().toISOString(),
        nota: 'Generado por revo-endpoints-test.js --fix. revoAgent.js lee este cache para evitar probar todos los endpoints cada vez.',
        endpoints: cache,
      }, null, 2));
      informe.cache_guardado = true;
    }
  }

  // Salida
  if (JSON_OUTPUT) {
    console.log(JSON.stringify(informe, null, 2));
  } else {
    imprimirInforme(informe);
  }

  // Exit code según resultado
  const todoOk = recursos.every(r => r.funcionan > 0);
  process.exit(todoOk ? 0 : 1);
}

main().catch(err => {
  console.error('Error fatal:', err);
  process.exit(2);
});
