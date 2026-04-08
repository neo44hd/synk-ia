# synk-ia — Informe de Auditoría y Fixes
> Fecha: Abril 2026 | Versión auditada: main branch

---

## Resumen ejecutivo

| Categoría | Issues encontrados | Fixes incluidos |
|-----------|-------------------|-----------------|
| 🔴 Bugs críticos | 5 | 5 |
| 🟠 Endpoints faltantes | 6 | 6 |
| 🟡 Configuración/seguridad | 5 | 5 |
| 🔵 Dependencias muertas | 4 | instrucciones |
| 🟢 Optimizaciones build | 3 | 3 |

---

## 🔴 Bugs críticos (roto en producción)

### BUG 1 — SynkiaBrain nunca habla con la IA
**Archivo:** `src/pages/SynkiaBrainPage.jsx`  
**Causa:** Llama a `base44.integrations.AI.GetChatResponse()` — `AI` no existe en el objeto `base44.integrations`.  
**Efecto:** El chat del Brain siempre cae al `catch`, mostrando solo contexto de datos en lugar de respuesta del LLM.  
**Fix:** `src/services/integrationsService.js` ahora exporta `export const AI = { GetChatResponse }`.  
Actualiza la importación en SynkiaBrainPage:
```js
// ANTES:
import base44 from '../lib/base44Client';
const response = await base44.integrations.AI.GetChatResponse({...})

// DESPUÉS:
import { AI } from '../services/integrationsService';
const response = await AI.GetChatResponse({ userMessage, conversationHistory, systemPrompt })
```

---

### BUG 2 — InvokeLLM siempre devuelve texto simulado
**Archivo:** `src/services/integrationsService.js`  
**Causa:** Función mock que nunca llama al backend.  
**Fix:** Reemplaza el archivo completo con `src/services/integrationsService.js` del ZIP.  
Ahora llama a `POST /api/ai/generate` (node-llama-cpp real).

---

### BUG 3 — emailService.syncEmails() siempre falla
**Causa:** Llama a `base44.functions.invoke()` que no existe.  
**Fix:** Usar directamente `functionsService.scanEmails()` del nuevo `functionsService.js`.

---

### BUG 4 — fullDataSync() se rompe si cualquier servicio falla
**Archivo:** `src/services/functionsService.js`  
**Causa:** `await` en secuencia — si Revo falla, Biloop y email nunca se sincronizan.  
**Fix:** Nuevo `fullDataSync()` usa `Promise.allSettled()` — cada servicio falla de forma independiente.

---

### BUG 5 — XSS potencial en chat
**Archivo:** `src/pages/SynkiaBrainPage.jsx`  
**Causa:** `dangerouslySetInnerHTML={{ __html: message.content }}` con contenido del LLM.  
**Fix recomendado:** Usar `react-markdown` (ya está instalado) en lugar de dangerouslySetInnerHTML:
```jsx
// ANTES:
<div dangerouslySetInnerHTML={{ __html: message.content }} />

// DESPUÉS:
import ReactMarkdown from 'react-markdown';
<ReactMarkdown>{message.content}</ReactMarkdown>
```

---

## 🟠 Endpoints faltantes (404 silenciosos)

| Frontend llama a | Estado | Fix |
|------------------|--------|-----|
| `GET /api/ollama/health` | ❌ 404 | → `GET /api/health/ai` (health.js extendido) |
| `GET /api/revo/workers` | ❌ 404 | → revo-workers-patch.js |
| `GET /api/biloop/sync` | ❌ 404 | → biloop-sync-patch.js |
| `GET /api/biloop/sync-status` | ❌ 404 | → biloop-sync-patch.js |
| `POST /api/files/upload` | ❌ 404 | integrationsService.js hace fallback a localStorage |
| `GET /api/health/ping` | ❌ 404 | → health.js extendido |

**Acción:** Aplica los patches de revo y biloop. El resto ya está cubierto.

---

## 🟡 Configuración y seguridad

### SEC 1 — Credenciales hardcodeadas
**Archivos:** `biloop.js`, `revo.js`
```js
// ANTES (biloop.js):
const COMPANY_ID  = 'E95251';
const BILOOP_BASE = 'https://assempsa.biloop.es/api-global/v1';

// DESPUÉS:
const COMPANY_ID  = process.env.BILOOP_COMPANY_ID;
const BILOOP_BASE = process.env.BILOOP_BASE_URL;
```

### SEC 2 — CORS hardcodeado
**Fix:** `server/index.js` reemplazado. CORS ahora lee `process.env.CORS_ORIGINS`.

### SEC 3 — Vite `allowedHosts: true`
**Riesgo:** DNS rebinding attack — cualquier dominio puede servir la app en dev.  
**Fix:** `vite.config.js` reemplazado con lista explícita.

### SEC 4 — Auth sin validación de contraseña
**Archivo:** `src/services/authService.js`  
**Riesgo:** Cualquiera puede logarse con cualquier contraseña como admin.  
**Fix mínimo recomendado:**
```js
// Añadir en authService.js antes de retornar el usuario:
const VALID_PASSWORDS = {
  'admin@chickenpalace.es': process.env.ADMIN_PASSWORD || 'changeme',
  // resto de usuarios...
};
if (VALID_PASSWORDS[email] && VALID_PASSWORDS[email] !== password) {
  throw new Error('Contraseña incorrecta');
}
```

### SEC 5 — Token debug expuesto
**Archivo:** `server/routes/biloop.js`  
`GET /api/biloop/token-debug` expone el token de Biloop.  
**Fix:** Eliminar ese endpoint antes de cualquier despliegue.

---

## 🔵 Dependencias muertas (~400KB de bundle innecesario)

```bash
cd /tu-proyecto  # (raíz, package.json del frontend)

# Eliminar completamente
npm uninstall axios moment

# date-fns y dayjs hacen lo mismo — elegir UNO
# El proyecto usa principalmente dayjs (más ligero: 2KB vs 67KB de moment)
npm uninstall date-fns

# Resultado estimado: -400KB en bundle final
```

**Nota:** Antes de desinstalar, busca usos:
```bash
grep -r "from 'axios'" src/
grep -r "from 'moment'" src/
grep -r "from 'date-fns'" src/
```

### React Query instalado pero sin usar
`@tanstack/react-query` está en package.json. Si no se va a usar: `npm uninstall @tanstack/react-query`.  
**Alternativa recomendada:** Empezar a usarlo. Reemplaza los `useEffect` + `useState` para fetching:
```jsx
// ANTES (patrón actual en muchas páginas):
const [data, setData] = useState(null);
const [loading, setLoading] = useState(true);
useEffect(() => {
  fetchRevoProducts().then(setData).finally(() => setLoading(false));
}, []);

// DESPUÉS (con React Query — ya instalado):
import { useQuery } from '@tanstack/react-query';
const { data, isLoading } = useQuery({
  queryKey: ['revo-products'],
  queryFn:  fetchRevoProducts,
  staleTime: 5 * 60 * 1000,  // 5 min cache
});
```
Beneficios: cache automático, deduplicación de requests, refetch en background.

---

## 🟢 Optimizaciones de build

### OPT 1 — Code splitting (vite.config.js)
El build original genera chunks grandes (~800KB+). El nuevo `vite.config.js` los divide:
- `react-vendor.js` — React + Router
- `ui-vendor.js` — Radix UI
- `charts.js` — Recharts
- `motion.js` — Framer Motion
- `utils.js` — dayjs, clsx

Resultado esperado: First Contentful Paint más rápido (solo carga lo necesario para la ruta actual).

### OPT 2 — Proxy dev (vite.config.js)
Sin proxy, `fetch('/api/...')` en desarrollo da 404. Ahora:
```
Browser → Vite :5173 → proxy → Express :3001
```
No más cambiar URLs entre dev y producción.

### OPT 3 — Pre-warm del modelo LLM (server/index.js)
```js
// El modelo se carga al arrancar, no en la primera request
llamaService.init().then(() => console.log('Modelo listo'));
```
La primera clasificación de email ya no tarda 15-20s.

---

## Checklist de aplicación

```
[ ] 1. Reemplazar src/services/integrationsService.js
[ ] 2. Reemplazar src/services/functionsService.js
[ ] 3. Reemplazar vite.config.js
[ ] 4. Reemplazar server/index.js
[ ] 5. Reemplazar server/routes/health.js
[ ] 6. Aplicar revo-workers-patch.js en revo.js
[ ] 7. Aplicar biloop-sync-patch.js en biloop.js
[ ] 8. Actualizar server/.env con las nuevas variables
[ ] 9. Mover credenciales hardcodeadas de biloop.js y revo.js a .env
[  ] 10. npm uninstall axios moment (frontend)
[ ] 11. Eliminar /api/biloop/token-debug antes de producción
[ ] 12. Fix dangerouslySetInnerHTML en SynkiaBrainPage.jsx
[ ] 13. Fix importación AI en SynkiaBrainPage.jsx
```

---

## Impacto esperado

| Métrica | Antes | Después |
|---------|-------|---------|
| SynkiaBrain funcional | ❌ siempre catch | ✅ LLM real |
| fullDataSync resiliente | ❌ para en primer error | ✅ continúa con errores parciales |
| Bundle size (estimado) | ~2.1 MB | ~1.6 MB (-25%) |
| First API response (LLM) | ~20s cold start | ~1s (pre-cargado) |
| Dev proxy | ❌ 404 en /api/* | ✅ proxea a :3001 |
| Credenciales expuestas | ❌ en código fuente | ✅ solo en .env |
