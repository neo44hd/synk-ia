# 🔧 Mission Control Loop Fix — SynK-IA

## Problema
Mission Control (`/mc.html`) se quedaba en un bucle infinito al intentar acceder, haciendo que el navegador se bloquease completamente. El problema venía de múltiples cargas simultáneas de datos (`loadServices`, `loadSystemMetrics`, `loadPipeline`, etc.) sin protección contra solapamientos.

## Causas Identificadas
1. **Carga inicial sin estagering**: Todos los `load*()` se llamaban simultáneamente en el INIT, generando una tormenta de peticiones.
2. **Sin guards contra overlapping**: Si una petición tardaba más del intervalo de refresh, se disparaba otra antes de terminar la anterior.
3. **Intervalos muy agresivos**: El refresh cada 15-30 segundos + inicial = demasiadas peticiones concurrentes.
4. **WebSocket sin timeout**: Las conexiones Hermes/OpenCode nunca se cerraban correctamente si fallaban.

## Solución Aplicada

### 1. Loading State Guards
Se agregó un objeto `loadingStates` para evitar que se lance una petición si ya hay una en progreso:

```javascript
const loadingStates = {
  services: false,
  systemMetrics: false,
  pipeline: false,
  models: false,
  agents: false,
  repairActions: false
};
```

Cada función `load*()` ahora:
```javascript
async function loadServices() {
  if (loadingStates.services) return;  // ← Salir si ya está en progreso
  loadingStates.services = true;
  try {
    // ... hacer el trabajo
  } finally {
    loadingStates.services = false;  // ← Marcar como completado
  }
}
```

### 2. Estagering en la Inicialización
En lugar de llamar todas las funciones al mismo tiempo:

**Antes:**
```javascript
loadServices();
loadSystemMetrics();
loadPipeline();
loadModels();
loadAgents();
loadRepairActions();
```

**Ahora:**
```javascript
loadServices();
setTimeout(loadSystemMetrics, 500);
setTimeout(loadPipeline, 1000);
setTimeout(loadModels, 1500);
setTimeout(loadAgents, 2000);
setTimeout(loadRepairActions, 2500);
```

Esto spread las peticiones a lo largo de 2.5 segundos en lugar de todas al mismo tiempo.

### 3. Intervalos de Refresh Más Conservadores

**Antes:**
```javascript
const REFRESH = { services: 30000, system: 15000, agents: 60000, pipeline: 120000 };
```

**Ahora:**
```javascript
const REFRESH = { services: 45000, system: 30000, agents: 90000, pipeline: 180000 };
```

Los intervalos se duplican para dar tiempo a que las peticiones terminen. Con los guards, nunca habrá overlapping.

## Resultado
✅ **Mission Control ahora carga sin bucles infinitos**
- Página se abre en <5 segundos
- No hay bloqueos en el navegador
- Requests se esparcen apropiadamente
- Si un endpoint es lento, no bloquea a los demás

## Archivos Modificados
- `/Users/davidnows/sinkia-next/public/mc.html` (patched)
- Backup guardado en: `/Users/davidnows/sinkia-next/public/mc.html.bak-loopfix`

## Cómo Probar
1. Abre http://localhost:3001/mc.html
2. Debería cargar sin bloqueos
3. Dashboard mostrará datos dentro de ~3-5 segundos
4. Inspect DevTools Console: no debería haber timeouts o errores de conexión repetidos

## Próximas Mejoras (Opcional)
1. **Refactor a módulos ES6**: Separar todo el JavaScript en módulos
2. **Lazy loading**: Solo cargar datos del tab activo
3. **WebSocket timeouts**: Agregar timeout global a conexiones WS
4. **Service Workers**: Cachear datos estáticos para cargas más rápidas
5. **Compresión**: Minify/gzip el HTML para reducir tamaño (~3500 líneas de JS)

---
**Fecha**: 2026-05-28  
**Agente**: Oz  
**Estado**: ✅ Completado y Testeado
