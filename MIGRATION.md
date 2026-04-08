# Migración: Ollama → node-llama-cpp

> **Sin cambios en el frontend.** Los endpoints `/api/ollama/*` pasan a ser `/api/ai/*`  
> con la misma estructura de request/response.

---

## 1. Instalar dependencia

```bash
cd server
npm install node-llama-cpp
```

node-llama-cpp descarga automáticamente el binario precompilado para tu plataforma:
- Mac Mini M4 Pro → Metal (GPU Apple Silicon)
- Oracle Cloud ARM64 → CPU optimizado (no necesita GPU)

---

## 2. Descargar el modelo

```bash
# Desde la raíz del proyecto
node scripts/download-model.js           # qwen2.5-7b (mismo que usabas en Ollama)
node scripts/download-model.js qwen-3b   # versión 3B más ligera (Oracle Cloud Free)
node scripts/download-model.js phi       # Phi-3.5-mini alternativa
```

El modelo se guarda en `models/` (carpeta nueva en la raíz del proyecto).  
Añade `models/` a tu `.gitignore`.

---

## 3. Añadir variables de entorno

Añade a `server/.env`:

```env
# Nombre del archivo GGUF descargado
AI_MODEL_NAME=qwen2.5-7b-instruct-q4_k_m.gguf

# GPU: 'auto' (detecta Metal/CUDA/Vulkan), 'cpu' (fuerza CPU), 'metal', 'cuda'
AI_GPU_MODE=auto

# Ruta absoluta opcional (si quieres el modelo en otro lugar)
# AI_MODEL_PATH=/ruta/al/modelo.gguf
```

---

## 4. Copiar los archivos nuevos

```
server/
├── services/
│   └── llamaService.js     ← NUEVO (singleton model manager)
└── routes/
    └── ai.js               ← NUEVO (reemplaza ollama.js)
```

---

## 5. Actualizar server/index.js

Cambia el bloque dinámico de Ollama (líneas ~30-36) por este:

```js
// ANTES:
try {
  const { ollamaRouter } = await import('./routes/ollama.js');
  app.use('/api/ollama', ollamaRouter);
  console.log('[SERVER] Ollama route registered');
} catch (e) {
  console.error('[SERVER] Ollama route failed to load:', e.message);
}

// DESPUÉS:
try {
  const { aiRouter } = await import('./routes/ai.js');
  app.use('/api/ollama', aiRouter);   // ← mismo path, cero cambios en frontend
  app.use('/api/ai', aiRouter);       // ← nuevo path con /status extra
  console.log('[SERVER] AI Engine (node-llama-cpp) registered');

  // Pre-carga el modelo al arrancar (evita cold start en la primera request)
  import('./services/llamaService.js').then(({ llamaService }) => {
    llamaService.init().catch(err =>
      console.warn('[SERVER] Modelo no disponible:', err.message)
    );
  });
} catch (e) {
  console.error('[SERVER] AI route failed to load:', e.message);
}
```

---

## 6. Actualizar server/package.json

```json
{
  "dependencies": {
    "node-llama-cpp": "^3.0.0",
    ...
  },
  "scripts": {
    "start":          "node index.js",
    "dev":            "node --watch index.js",
    "download-model": "node ../scripts/download-model.js"
  }
}
```

---

## 7. Añadir models/ al .gitignore

```
# Modelos GGUF (varios GB, no versionar)
models/
*.gguf
```

---

## Comparativa de endpoints

| Endpoint antiguo          | Endpoint nuevo              | ¿Cambio en frontend? |
|---------------------------|-----------------------------|-----------------------|
| `GET  /api/ollama/test`   | `GET  /api/ollama/test`     | ❌ Ninguno             |
| `GET  /api/ollama/models` | `GET  /api/ollama/models`   | ❌ Ninguno             |
| `POST /api/ollama/generate`| `POST /api/ollama/generate`| ❌ Ninguno             |
| `POST /api/ollama/classify`| `POST /api/ollama/classify`| ❌ Ninguno             |
| `POST /api/ollama/classify-email`| `POST /api/ollama/classify-email`| ❌ Ninguno |
| —                         | `GET  /api/ai/status`       | ✅ Nuevo endpoint extra|

---

## Verificar que funciona

```bash
# Test de conexión
curl http://localhost:3001/api/ai/test

# Clasificar un documento
curl -X POST http://localhost:3001/api/ai/classify \
  -H "Content-Type: application/json" \
  -d '{"text": "Factura num 2025-001\nProveedor: Makro\nTotal: 1.250,00€", "filename": "factura_makro.pdf"}'

# Estado del motor
curl http://localhost:3001/api/ai/status
```

---

## Resolución de problemas

### "Modelo no encontrado"
```bash
node scripts/download-model.js
```

### Error de compilación al instalar node-llama-cpp
```bash
# Asegúrate de tener cmake y build tools
# macOS:
xcode-select --install

# Ubuntu/Debian:
sudo apt install -y cmake build-essential
```

### Muy lento en Oracle Cloud (CPU sin GPU)
Prueba el modelo de 3B:
```bash
node scripts/download-model.js qwen-3b
# En .env:
AI_MODEL_NAME=qwen2.5-3b-instruct-q4_k_m.gguf
```

### El modelo tarda en cargar la primera vez
Normal. El modelo se carga en memoria RAM al arrancar el servidor (~10-20 segundos).  
Las requests posteriores son instantáneas (el modelo ya está en RAM).  
El `init()` en `index.js` hace preload al arranque para evitar el cold start.
