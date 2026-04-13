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
  // 0. Limpiar markdown fences y thinking blocks
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/,  '').trim();
  // 1. Parse directo
  try { return JSON.parse(text); } catch {}
  // 2. Extraer bloque JSON (el más grande)
  const m = text.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  // 3. Reparar errores comunes
  let fixed = (m?.[0] || text)
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/([{,]\s*)(\w+)\s*:/g, '$1"$2":')
    .replace(/:\s*'([^']*)'/g, ': "$1"')
    .replace(/""\s*([,}\]])/g, 'null$1');  // "" → null
  try { return JSON.parse(fixed); } catch {}
  // 4. JSON truncado — intentar cerrar llaves
  if (m) {
    let truncated = m[0];
    const opens = (truncated.match(/\{/g) || []).length;
    const closes = (truncated.match(/\}/g) || []).length;
    if (opens > closes) {
      // Cortar en la última coma/llave válida y cerrar
      truncated = truncated.replace(/,\s*"[^"]*"?\s*:?\s*[^,}]*$/, '');
      truncated += '}'.repeat(opens - closes);
      try { return JSON.parse(truncated); } catch {}
    }
  }
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

// ── Prompt universal (idéntico a documentProcessor v3) ──────────────
const UNIVERSAL_PROMPT = `Eres el motor de inteligencia de SynK-IA, una aplicación de gestión documental.

CONTEXTO:
Esta es la bandeja de entrada de ${MI_EMPRESA.nombre} (CIF: ${MI_EMPRESA.cif}), un restaurante en Ibiza.
TODOS los documentos que procesas son GASTOS de esta empresa: facturas de proveedores, nóminas de empleados, recibos, etc.
${MI_EMPRESA.nombre} SIEMPRE es quien PAGA. NUNCA es el proveedor en estos documentos.

REGLAS FIJAS PARA FACTURAS:
- tipo = "factura_recibida" (SIEMPRE, salvo que sea claramente otra cosa como nómina o finiquito)
- emisor = el PROVEEDOR (la empresa/persona que vende el producto o servicio)
- receptor = ${MI_EMPRESA.nombre} (quien paga)
- emisor.rol = "proveedor"
- receptor.rol = "empresa"
- CUIDADO: muchos PDFs tienen el nombre "${MI_EMPRESA.nombre}" o "CHICKEN PALACE" en la cabecera.
  Eso NO significa que Chicken Palace sea el emisor. El PROVEEDOR es la OTRA empresa/persona del documento.
  Busca la entidad que NO es ${MI_EMPRESA.nombre}. Esa es el proveedor.
  Ejemplo: si el PDF dice "CHICKEN PALACE" arriba e "INOT & INAD" abajo, el proveedor es INOT & INAD.

REGLAS PARA NÓMINAS:
- tipo = "nomina"
- emisor = ${MI_EMPRESA.nombre} con rol "empleador"
- receptor = el TRABAJADOR con rol "empleado"

REGLAS PARA FINIQUITOS:
- tipo = "finiquito", igual que nómina

OTROS DOCUMENTOS: clasifica libremente (ticket, contrato, certificado, extracto_bancario, etc.)

INSTRUCCIONES:
1. LEE el documento completo
2. Identifica al PROVEEDOR (la entidad que NO es Chicken Palace)
3. EXTRAE todos los datos: importes, fechas, conceptos, referencias
4. Si hay datos laborales (NSS, categoría profesional, antigüedad), extráelos

DEVUELVE EXACTAMENTE ESTE JSON (rellena lo que encuentres, null lo que no):
{
  "tipo": "el tipo real del documento (factura_recibida, factura_emitida, nomina, finiquito, albaran, presupuesto, contrato, ticket, extracto_bancario, certificado, otro)",
  "subtipo": "más detalle si aplica (ej: liquidacion, carta_despido, factura_proforma, recibo_autonomo...)",
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
    "nombre_completo": null,
    "dni": null,
    "nss": "número Seguridad Social si aparece (Nº Afiliación, N.A.F., Nº S.S.)",
    "categoria_profesional": null,
    "grupo_cotizacion": null,
    "antiguedad": "fecha alta YYYY-MM-DD",
    "tipo_contrato": null,
    "puesto": null
  },
  "conceptos": [
    { "descripcion": null, "cantidad": 1, "precio_unitario": 0.0, "iva_porcentaje": null, "total": 0.0 }
  ],
  "base_imponible": null,
  "iva_total": null,
  "total": null,
  "moneda": "EUR",
  "forma_pago": null,
  "cuenta_bancaria": null,
  "resumen": "una frase describiendo el documento",
  "datos_extra": {},
  "confianza": 0.9
}

REGLAS:
- Si NO es una nómina/finiquito/liquidación, pon "trabajador": null
- Si es una nómina: total = líquido a percibir (neto), base_imponible = salario bruto
- "conceptos" son las líneas del documento: productos en facturas, devengos/deducciones en nóminas
- Importes como número decimal (21.50, no "21,50")
- Fechas en YYYY-MM-DD
- null para lo que no encuentres, NUNCA string vacío
- "datos_extra" para cualquier dato interesante que no encaje arriba (ej: periodo_liquidacion, dias_vacaciones, indemnizacion)
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
