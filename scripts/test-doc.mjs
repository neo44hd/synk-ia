// Prueba processDocument (el que usa el flujo de email) como script de archivo.
import '../server/env-loader.mjs';
import path from 'path';

const file = process.argv[2];
if (!file) { console.error('Uso: node scripts/test-doc.mjs <ruta>'); process.exit(1); }

const { processDocument } = await import('../server/services/documentProcessor.js');
const doc = await processDocument(file, 'application/pdf', path.basename(file));
console.log('\n── processDocument RESULTADO ──');
console.log('estado:           ', doc.estado, '| metodo:', doc.metodo_extraccion);
console.log('tipo:             ', doc.analisis?.tipo, '| emisor:', doc.analisis?.emisor?.nombre);
console.log('total:            ', doc.analisis?.total, doc.analisis?.moneda);
console.log('organizacion:     ', JSON.stringify(doc.organizacion));
