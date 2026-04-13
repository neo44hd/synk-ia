#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
//  SynK-IA — Test del pipeline v3 (motor universal)
//
//  Uso:
//    node test_pipeline.mjs ./uploads          # procesa todos los PDFs
//    node test_pipeline.mjs ./uploads 5        # solo los primeros 5
//    NO_LLM=1 node test_pipeline.mjs           # sin Ollama (solo texto)
// ═══════════════════════════════════════════════════════════════════════════
import { readFile, writeFile, readdir } from 'fs/promises';
import path from 'path';
import pdfParse from 'pdf-parse';

// ── Config ──────────────────────────────────────────────────────────
const TEST_DIR  = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.resolve('uploads');
const MAX_FILES = parseInt(process.argv[3]) || 0; // 0 = todos
const RESULTS   = path.resolve('test_results.json');
const NO_LLM    = process.env.NO_LLM === '1';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const MODEL      = process.env.MODEL || 'phi4-mini';

// ── LLM call ────────────────────────────────────────────────────────
async function llmCall(messages, maxTokens = 2000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 180_000);
  try {
    const res = await fetch(`${OLLAMA_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({ model: MODEL, messages, temperature: 0.05, max_tokens: maxTokens, stream: false }),
    });
    if (!res.ok) throw new Error(`Ollama ${res.status}`);
    const d = await res.json();
    const raw = d.choices?.[0]?.message?.content?.trim() || '';
    return stripThinking(raw);
  } finally {
    clearTimeout(timer);
  }
}

function stripThinking(text) {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

function parseJSON(text) {
  try { return JSON.parse(text); } catch {}
  const m = text.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  const fixed = (m?.[0] || text)
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/([{,]\s*)(\w+)\s*:/g, '$1"$2":')
    .replace(/:\s*'([^']*)'/g, ': "$1"');
  try { return JSON.parse(fixed); } catch {}
  return null;
}

// ── Truncado inteligente ────────────────────────────────────────────
function smartTruncate(text, maxChars = 6000) {
  if (text.length <= maxChars) return text;
  const head = Math.floor(maxChars * 0.6);
  const tail = maxChars - head;
  return text.slice(0, head) + '\n\n[...documento truncado...]\n\n' + text.slice(-tail);
}

// ── Config empresa (mismo que documentProcessor v3) ────────────────
const MI_EMPRESA = {
  nombre: process.env.EMPRESA_NOMBRE || 'CHICKEN PALACE IBIZA, S.L.',
  cif:    process.env.EMPRESA_CIF    || 'B56908486',
  email:  process.env.EMAIL_USER     || 'info@chickenpalace.es',
};

// ── Prompt universal (mismo que documentProcessor v3) ───────────────
const UNIVERSAL_PROMPT = `Eres el motor de inteligencia de SynK-IA, una aplicación de gestión documental.

IMPORTANTE — CONTEXTO DE NEGOCIO:
La empresa que usa este sistema es ${MI_EMPRESA.nombre} (CIF: ${MI_EMPRESA.cif}).
Todos los documentos que procesas llegan al correo de esta empresa.
Por lo tanto, EN LA MAYORÍA DE CASOS:
- ${MI_EMPRESA.nombre} es quien RECIBE y PAGA. Es el RECEPTOR/CLIENTE/EMPLEADOR.
- La otra empresa o persona que aparece en el documento es el PROVEEDOR o TRABAJADOR.

REGLAS DE CLASIFICACIÓN:
- Factura/albarán donde alguien vende algo a ${MI_EMPRESA.nombre} → tipo="factura_recibida", emisor=PROVEEDOR, receptor=${MI_EMPRESA.nombre}
- Nómina/hoja de salario → tipo="nomina", emisor=${MI_EMPRESA.nombre} (empleador), receptor=TRABAJADOR (el empleado)
- Finiquito/liquidación → tipo="finiquito", emisor=${MI_EMPRESA.nombre}, receptor=TRABAJADOR
- Factura donde ${MI_EMPRESA.nombre} cobra a un cliente → tipo="factura_emitida" (esto es RARO en este correo)
- Si ves "CHICKEN PALACE" en una factura, NO es el proveedor. Es MI EMPRESA. El proveedor es LA OTRA empresa.

Tu trabajo: leer el texto de un documento y devolver un JSON con TODA la información que encuentres.
NO tienes categorías fijas. TÚ decides qué es el documento y qué datos contiene.

INSTRUCCIONES:
1. LEE el documento completo con atención
2. DECIDE qué tipo de documento es (factura_recibida, factura_emitida, nomina, finiquito, liquidacion, albaran, contrato, presupuesto, ticket, extracto_bancario, certificado, carta, o lo que sea)
3. IDENTIFICA a todas las personas y empresas que aparecen y su ROL:
   - ¿Quién emite? ¿Quién recibe?
   - Si alguien vende algo a ${MI_EMPRESA.nombre} → ese es el PROVEEDOR
   - Si ${MI_EMPRESA.nombre} vende a alguien → ese es el CLIENTE
   - Si ${MI_EMPRESA.nombre} paga a una persona → esa persona es un TRABAJADOR
4. EXTRAE todos los datos relevantes: importes, fechas, conceptos, referencias, etc.
5. Si hay datos laborales (NSS, categoría profesional, antigüedad, grupo cotización, tipo contrato), extráelos SIEMPRE

DEVUELVE EXACTAMENTE ESTE JSON (rellena lo que encuentres, null lo que no):
{
  "tipo": "el tipo real del documento",
  "subtipo": "más detalle si aplica",
  "numero_documento": null,
  "fecha": "YYYY-MM-DD",
  "fecha_vencimiento": "YYYY-MM-DD o null",
  "emisor": {
    "nombre": null, "cif_nif": null, "direccion": null, "email": null, "telefono": null,
    "rol": "proveedor | empleador | banco | administracion | otro"
  },
  "receptor": {
    "nombre": null, "cif_nif": null, "direccion": null, "email": null, "telefono": null,
    "rol": "cliente | empleado | empresa | particular | otro"
  },
  "trabajador": {
    "nombre_completo": null, "dni": null,
    "nss": "número Seguridad Social si aparece",
    "categoria_profesional": null, "grupo_cotizacion": null,
    "antiguedad": "fecha alta YYYY-MM-DD", "tipo_contrato": null, "puesto": null
  },
  "conceptos": [
    { "descripcion": null, "cantidad": 1, "precio_unitario": 0.0, "iva_porcentaje": null, "total": 0.0 }
  ],
  "base_imponible": null, "iva_total": null, "total": null,
  "moneda": "EUR", "forma_pago": null, "cuenta_bancaria": null,
  "resumen": "una frase describiendo el documento",
  "datos_extra": {},
  "confianza": 0.9
}

REGLAS:
- Si NO es nómina/finiquito/liquidación, pon "trabajador": null
- Si es nómina: total = líquido a percibir (neto), base_imponible = salario bruto
- Importes como número decimal (21.50, no "21,50")
- Fechas en YYYY-MM-DD
- null para lo que no encuentres, NUNCA string vacío
- Responde SOLO con el JSON, sin explicaciones, sin markdown`;

// ── Main ────────────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  SynK-IA Pipeline Test v3 — Motor Universal');
  console.log(`  Modelo: ${NO_LLM ? 'DESACTIVADO' : MODEL}`);
  console.log(`  Ollama: ${NO_LLM ? 'n/a' : OLLAMA_URL}`);
  console.log('═══════════════════════════════════════════════════════\n');

  let files = (await readdir(TEST_DIR)).filter(f => f.toLowerCase().endsWith('.pdf'));
  if (MAX_FILES > 0) files = files.slice(0, MAX_FILES);
  console.log(`📂 ${files.length} PDFs en ${TEST_DIR}\n`);

  const results = [];
  let okCount = 0, failCount = 0;
  const entidades = { proveedores: new Set(), trabajadores: new Set(), clientes: new Set() };

  for (const file of files) {
    const filePath = path.join(TEST_DIR, file);
    const t0 = Date.now();
    console.log(`\n── ${file} ${'─'.repeat(Math.max(0, 60 - file.length))}`);

    try {
      // 1. Extraer texto
      const buffer = await readFile(filePath);
      const pdf = await pdfParse(buffer);
      const text = pdf.text || '';
      console.log(`  📝 ${text.length} chars, ${pdf.numpages} pág`);

      if (text.length < 20) {
        console.log('  ⚠ Texto insuficiente — necesitaría OCR');
        results.push({ file, status: 'needs_ocr', chars: text.length, pages: pdf.numpages });
        failCount++;
        continue;
      }

      let llmResult = null;

      // 2. Llamada LLM universal (una sola llamada: clasifica + extrae)
      if (!NO_LLM) {
        console.log('  🤖 Analizando...');
        try {
          const truncated = smartTruncate(text, 6000);
          const raw = await llmCall([
            { role: 'system', content: UNIVERSAL_PROMPT },
            { role: 'user',   content: `DOCUMENTO:\n${truncated}` },
          ]);

          llmResult = parseJSON(raw);
          if (llmResult) {
            const tipo   = llmResult.tipo || '?';
            const emisor = llmResult.emisor?.nombre || 'n/a';
            const total  = llmResult.total != null ? `${llmResult.total}€` : 'n/a';
            console.log(`  ✓ ${tipo} | ${emisor} → ${llmResult.receptor?.nombre || 'n/a'} | ${total}`);

            // Tracking entidades
            if (llmResult.emisor?.nombre && llmResult.emisor?.rol === 'proveedor') {
              entidades.proveedores.add(llmResult.emisor.nombre);
            }
            if (llmResult.receptor?.nombre && llmResult.receptor?.rol === 'cliente') {
              entidades.clientes.add(llmResult.receptor.nombre);
            }
            if (llmResult.trabajador?.nombre_completo) {
              entidades.trabajadores.add(llmResult.trabajador.nombre_completo);
              console.log(`  👤 Trabajador: ${llmResult.trabajador.nombre_completo} | DNI: ${llmResult.trabajador.dni || 'n/a'} | NSS: ${llmResult.trabajador.nss || 'n/a'}`);
            }
            if (llmResult.datos_extra && Object.keys(llmResult.datos_extra).length > 0) {
              console.log(`  📎 Extra: ${JSON.stringify(llmResult.datos_extra)}`);
            }
            okCount++;
          } else {
            console.log('  ⚠ No se pudo parsear el JSON');
            console.log(`  🔍 Raw: ${raw.slice(0, 300)}`);
            failCount++;
          }
        } catch (err) {
          console.log(`  ✗ Error LLM: ${err.message}`);
          failCount++;
        }
      } else {
        okCount++;
      }

      results.push({
        file,
        status: 'ok',
        chars: text.length,
        pages: pdf.numpages,
        tiempo_ms: Date.now() - t0,
        analisis: llmResult,
      });

    } catch (err) {
      console.log(`  ✗ Error: ${err.message}`);
      results.push({ file, status: 'error', error: err.message, tiempo_ms: Date.now() - t0 });
      failCount++;
    }
  }

  // Resumen final
  await writeFile(RESULTS, JSON.stringify(results, null, 2));

  const tiempos = results.filter(r => r.tiempo_ms).map(r => r.tiempo_ms);
  const avgTime = tiempos.length ? (tiempos.reduce((a,b) => a+b, 0) / tiempos.length / 1000).toFixed(1) : 0;
  const totalTime = tiempos.length ? (tiempos.reduce((a,b) => a+b, 0) / 60000).toFixed(1) : 0;

  // Contar tipos
  const tipos = {};
  results.forEach(r => {
    const t = r.analisis?.tipo || 'sin_analisis';
    tipos[t] = (tipos[t] || 0) + 1;
  });

  console.log('\n\n═══════════════════════════════════════════════════════');
  console.log('  RESUMEN');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Total: ${files.length} | OK: ${okCount} | Fallos: ${failCount}`);
  console.log(`  Tiempo: ${avgTime}s/doc, ${totalTime} min total`);
  console.log(`\n  Tipos detectados:`);
  for (const [t, c] of Object.entries(tipos).sort((a,b) => b[1] - a[1])) {
    console.log(`    ${t}: ${c}`);
  }
  console.log(`\n  Entidades detectadas:`);
  console.log(`    Proveedores: ${entidades.proveedores.size} — ${[...entidades.proveedores].join(', ') || 'ninguno'}`);
  console.log(`    Trabajadores: ${entidades.trabajadores.size} — ${[...entidades.trabajadores].join(', ') || 'ninguno'}`);
  console.log(`    Clientes: ${entidades.clientes.size} — ${[...entidades.clientes].join(', ') || 'ninguno'}`);
  console.log(`\n  Resultados: ${RESULTS}`);
  console.log('═══════════════════════════════════════════════════════\n');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
