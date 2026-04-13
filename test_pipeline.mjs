// ═══════════════════════════════════════════════════════════════════════
//  TEST PIPELINE — Procesa PDFs reales contra documentProcessor
//  
//  Uso local (Mac Mini con Ollama):
//    node test_pipeline.mjs [carpeta_pdfs]
//  
//  Ejemplos:
//    node test_pipeline.mjs                      # usa ./test_pdfs o ./uploads
//    node test_pipeline.mjs ~/facturas            # carpeta custom
//    NO_LLM=1 node test_pipeline.mjs              # sin Ollama (solo texto)
// ═══════════════════════════════════════════════════════════════════════

import { readFile, writeFile, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';

// Carpeta de PDFs: argumento CLI > ./test_pdfs > ./uploads
const customDir = process.argv[2];
const TEST_DIR  = customDir
  ? path.resolve(customDir)
  : existsSync(path.resolve('test_pdfs'))
    ? path.resolve('test_pdfs')
    : path.resolve('uploads');
const RESULTS   = path.resolve('test_results.json');
const NO_LLM    = process.env.NO_LLM === '1';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const MODEL      = process.env.MODEL || 'qwen3.5';

// ── Heuristic classifier (same logic as documentProcessor) ──────────
function classifyHeuristic(text, filename) {
  const t = (text + ' ' + filename).toLowerCase();
  if (t.includes('nomina') || t.includes('nómina') || t.includes('hoja de salario') || t.includes('hojas de salario'))
    return 'nomina';
  if (t.includes('finiquito') || t.includes('liquidación') || t.includes('liquidacion'))
    return 'nomina'; // finiquitos/liquidaciones van como nómina
  if (t.includes('albarán') || t.includes('albaran') || t.includes('nota de entrega'))
    return 'albaran';
  if (t.includes('presupuesto') || t.includes('oferta'))
    return 'presupuesto';
  if (t.includes('factura') || t.includes('invoice') || t.includes('fra.'))
    return 'factura_recibida';
  if (t.includes('contrato'))
    return 'contrato';
  return 'otro';
}

// ── LLM call (only when Ollama is available) ────────────────────────
async function llmCall(messages, maxTokens = 1600) {
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

// ── Strip <think>...</think> de modelos Qwen3 thinking ─────────────────────
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

// ── Extraction schema + type prompts (from documentProcessor) ───────
const BASE_SCHEMA = `{
  "numero_documento": null,
  "fecha": null, "fecha_vencimiento": null,
  "emisor": { "nombre": null, "cif_nif": null, "direccion": null, "email": null, "telefono": null },
  "receptor": { "nombre": null, "cif_nif": null, "direccion": null, "email": null, "telefono": null },
  "lineas": [{ "descripcion": null, "cantidad": 1.0, "precio_unitario": 0.0, "iva_porcentaje": 21.0, "total_linea": 0.0 }],
  "base_imponible": null, "iva_total": null, "total": null,
  "moneda": "EUR", "forma_pago": null, "notas": null,
  "confianza": 0.9, "resumen": null, "accion_recomendada": null
}`;

const TYPE_INSTRUCTIONS = {
  factura_recibida: `Es una FACTURA RECIBIDA (proveedor → empresa).
- emisor = el PROVEEDOR que emite la factura
- receptor = TU EMPRESA que recibe la factura
- accion_recomendada = "registrar_gasto"`,

  nomina: `Es una NÓMINA / HOJA DE SALARIO / FINIQUITO / LIQUIDACIÓN.
- emisor = empresa empleadora
- receptor = el EMPLEADO (nombre y apellidos, DNI/NIF en cif_nif)
- accion_recomendada = "registrar_gasto"
- total = salario neto (líquido a percibir). base_imponible = salario bruto
- Extrae SIEMPRE el campo "trabajador" con datos laborales:
  "trabajador": {
    "nss": "número Seguridad Social (formato XX/XXXXXXXX-XX)",
    "categoria_profesional": "categoría o grupo profesional",
    "antiguedad": "fecha antigüedad/alta en empresa (YYYY-MM-DD)",
    "tipo_contrato": "indefinido/temporal/etc",
    "grupo_cotizacion": "grupo de cotización"
  }
- Las líneas son conceptos salariales: salario base, complementos, deducciones, IRPF, SS
- Busca el NSS cerca de "Nº Afiliación", "N.A.F.", "Nº S.S."`,

  otro: 'Extrae toda la información que puedas del documento.',
};

// ── Smart truncate ──────────────────────────────────────────────────
function smartTruncate(text, maxChars = 5500) {
  if (text.length <= maxChars) return text;
  const head = Math.floor(maxChars * 0.7);
  const tail = maxChars - head;
  return text.slice(0, head) + '\n\n[...texto truncado...]\n\n' + text.slice(-tail);
}

// ── Main ────────────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  SynK-IA Pipeline Test — PDFs reales desde Gmail');
  console.log(`  Ollama: ${NO_LLM ? 'DESACTIVADO (solo texto+heurística)' : OLLAMA_URL}`);
  console.log('═══════════════════════════════════════════════════════\n');

  const files = (await readdir(TEST_DIR)).filter(f => f.toLowerCase().endsWith('.pdf'));
  console.log(`📂 ${files.length} PDFs en ${TEST_DIR}\n`);

  const results = [];

  for (const file of files) {
    const filePath = path.join(TEST_DIR, file);
    const t0 = Date.now();
    console.log(`\n── ${file} ──────────────────────────────────`);

    try {
      // 1. Extract text
      const buffer = await readFile(filePath);
      const pdf = await pdfParse(buffer);
      const text = pdf.text || '';
      console.log(`  📝 Texto extraído: ${text.length} chars, ${pdf.numpages} páginas`);

      if (text.length < 20) {
        console.log('  ⚠ Texto insuficiente — necesitaría OCR (Tesseract)');
        results.push({ file, status: 'needs_ocr', chars: text.length, pages: pdf.numpages });
        continue;
      }

      // 2. Classify
      const tipo = classifyHeuristic(text, file);
      console.log(`  🏷  Tipo (heurística): ${tipo}`);

      // 3. Preview text
      const preview = text.slice(0, 500).replace(/\s+/g, ' ');
      console.log(`  📋 Preview: ${preview.slice(0, 200)}...`);

      // 4. LLM extraction (if available)
      let llmResult = null;
      if (!NO_LLM) {
        const instructions = TYPE_INSTRUCTIONS[tipo] || TYPE_INSTRUCTIONS.otro;
        const truncated = smartTruncate(text, 5500);

        const userPrompt = `TIPO DE DOCUMENTO: ${tipo}\n${instructions}\n\nTEXTO DEL DOCUMENTO:\n${truncated}\n\nDevuelve este JSON rellenado con los datos reales:\n${BASE_SCHEMA}`;

        console.log('  🤖 Llamando a LLM...');
        try {
          const raw = await llmCall([
            { role: 'system', content: 'Eres un experto en extracción de datos de documentos financieros y laborales españoles. Responde SOLO con el JSON pedido, sin explicaciones.' },
            { role: 'user', content: userPrompt },
          ]);
          console.log(`  📦 Raw LLM (first 500): ${raw.slice(0, 500)}`);
          llmResult = parseJSON(raw);
          if (llmResult) {
            console.log(`  ✓ LLM respondió — emisor: ${llmResult.emisor?.nombre || 'n/a'}, total: ${llmResult.total || 'n/a'}`);
            if (llmResult.trabajador) {
              console.log(`  👤 Trabajador: NSS=${llmResult.trabajador.nss || 'n/a'}, categoría=${llmResult.trabajador.categoria_profesional || 'n/a'}`);
            }
          } else {
            console.log('  ⚠ LLM respondió pero no pudo parsear JSON');
            console.log(`  🔍 Full raw response (${raw.length} chars): ${raw.slice(0, 1000)}`);
          }
        } catch (err) {
          console.log(`  ✗ LLM error: ${err.message}`);
        }
      }

      results.push({
        file,
        status: 'ok',
        chars: text.length,
        pages: pdf.numpages,
        tipo_heuristico: tipo,
        text_preview: text.slice(0, 800),
        llm_result: llmResult,
        tiempo_ms: Date.now() - t0,
      });

    } catch (err) {
      console.log(`  ✗ Error: ${err.message}`);
      results.push({ file, status: 'error', error: err.message });
    }
  }

  // Save results
  await writeFile(RESULTS, JSON.stringify(results, null, 2));
  console.log(`\n═══════════════════════════════════════════════════════`);
  console.log(`  Resultados guardados en ${RESULTS}`);
  console.log(`  ${results.filter(r => r.status === 'ok').length}/${results.length} procesados OK`);
  console.log('═══════════════════════════════════════════════════════');
}

main().catch(console.error);
