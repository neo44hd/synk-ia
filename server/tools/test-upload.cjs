const path = require('path');
const fs = require('fs');
const http = require('http');

// Leer el PDF de uploads
const pdfPath = path.join(__dirname, 'uploads', 'PORTAL_EMPLEADO_PWA.pdf');
const pdfData = fs.readFileSync(pdfPath);

// Preparar multipart form data manualmente
const boundary = '----Boundary' + Date.now();
const body = Buffer.concat([
  Buffer.from(`--${boundary}\r\n`),
  Buffer.from('Content-Disposition: form-data; name="file"; filename="PORTAL_EMPLEADO_PWA.pdf"\r\n'),
  Buffer.from('Content-Type: application/pdf\r\n\r\n'),
  pdfData,
  Buffer.from('\r\n'),
  Buffer.from(`--${boundary}--\r\n`),
]);

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/filemanager/upload',
  method: 'POST',
  headers: {
    'X-Admin-Token': 'sinkia2026',
    'Content-Type': `multipart/form-data; boundary=${boundary}`,
    'Content-Length': body.length,
  },
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    const obj = JSON.parse(data);
    if (obj.success) {
      console.log('Documento:', obj.document.original_name);
      console.log('ID:', obj.document.id);
      console.log('Tipo:', obj.document.analysis?.tipo || 'pending');
      console.log('Procesado:', obj.document.status);
      console.log('Agentes completados:', obj.document.agents_completed?.join(', '));
    } else {
      console.log('Error:', obj.error || 'Unknown');
    }
  });
});

req.write(body);
req.end();