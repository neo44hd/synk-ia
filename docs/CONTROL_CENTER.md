# Control Center - Centro de Control

## Visión General

El **Control Center** (Centro de Control) es un módulo centralizado de administración de trabajos, sincronización y mantenimiento del sistema SynK-IA. Permite a usuarios con rol **CEO/Admin** ejecutar operaciones críticas desde la UI sin necesidad de acceder a la terminal.

## Ubicación

- **Interfaz**: `/controlcenter` (dentro de menú Control → 🛠️ Centro de Control)
- **API Backend**: `/api/control/{endpoint}`
- **Acceso**: Solo para usuarios con role `ceo` o permission_level `admin`/`super_admin`

## Características Principales

### 1. Dashboard de Estado
Muestra en tiempo real:
- **Estado del Sistema**: Disponible / Procesando
- **Documentos**: Total, procesados, fallidos
- **Facturas**: Cantidad identificadas
- **Proveedores**: Cantidad detectados
- **Correos**: Total sincronizados
- **Auto-refresh**: Cada 2 segundos

### 2. Operaciones Disponibles

#### 💙 Sincronización de Correos
**Función**: Sincroniza manualmente los correos desde todas las cuentas IMAP configuradas.

```
POST /api/control/sync-emails
```

**Cuándo usar**:
- Necesitas sincronizar urgentemente emails nuevos
- No quieres esperar al worker automático (que corre cada 5 min)

**Respuesta**:
```json
{
  "success": true,
  "message": "Email sync completed"
}
```

#### 🟨 Reprocesar Fallidos
**Función**: Reintenta procesar únicamente los documentos que tienen estado `error` o `failed`.

```
POST /api/control/reprocess-failed
```

**Cuándo usar**:
- Algunos PDFs fallaron en la extracción inicial
- Quieres reintentar sin tocar documentos ya procesados
- Mucho más rápido que reprocesar todo

**Duración**: Minutos a pocas horas (depende de cantidad de errores)

#### 🟧 Reprocesar TODO
**Función**: Reintenta procesar TODOS los documentos con la pipeline actual.

```
POST /api/control/reprocess-all
```

**Cuándo usar**:
- Actualizaste el modelo de extracción y quieres mejorar resultados anteriores
- Migraste a una nueva versión de la pipeline
- Quieres máxima precisión en toda la base

**⚠️ Advertencia**: Operación PESADA y lenta
- Duración: 30-60+ minutos (depende de 200+ documentos)
- Sistema estará bajo carga
- Solo un job a la vez

#### 🟩 Verificar Integridad
**Función**: Valida que todos los archivos JSON de datos sean válidos y coherentes.

```
POST /api/control/verify
```

**Cuándo usar**:
- Después de grandes cambios
- Si sospechas que hay datos corruptos
- Como verificación de seguridad

**Salida**: Reporte detallado en logs

#### 🔴 Reconstruir desde Cero
**Función**: Operación DESTRUCTIVA que:
1. Hace backup automático en `data_backup_[timestamp]/`
2. Limpia todas las tiendas JSON (documents, invoices, providers, etc.)
3. Reprocesa todos los archivos desde la carpeta `/uploads`

```
POST /api/control/rebuild
{
  "confirm": "RECONSTRUIR"
}
```

**Cuándo usar**:
- Estado corrupto no recuperable
- Migración a nueva infraestructura
- Limpieza completa antes de cambio de arquitectura

**⚠️ CRÍTICO**:
- No se puede deshacer fácilmente (requiere restauración del backup)
- Requiere confirmación textual: escribir "RECONSTRUIR"
- Duración: 60-120+ minutos
- Durante este tiempo, todos los datos antiguos son inaccesibles

## API Reference

### GET /api/control/status
Obtiene el estado actual del sistema.

**Response**:
```json
{
  "success": true,
  "busy": false,
  "currentJob": null,
  "data": {
    "documents": 50,
    "processed": 45,
    "failed": 2,
    "invoices": 25,
    "providers": 8,
    "emails": 679,
    "uploads": 50
  },
  "lastIntegrityCheck": null
}
```

### GET /api/control/jobs/:jobId
Obtiene el estado detallado de un job específico.

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "reprocess-failed-1719704723042",
    "type": "reprocess-failed",
    "status": "running",
    "progress": "23/50",
    "startTime": "2026-06-30T02:05:23.042Z",
    "endTime": null,
    "error": null
  }
}
```

### GET /api/control/logs/:jobName?lines=50
Obtiene las últimas N líneas de logs de un job.

**Response**:
```json
{
  "success": true,
  "logs": [
    "[EXTRACTOR] Processing doc 1/50...",
    "[ANALYZER] Analyzing content...",
    "[ORGANIZER] Organizing data..."
  ]
}
```

## Sistema de Bloqueo (Locking)

**Regla fundamental**: Solo un job pesado puede ejecutarse a la vez.

El sistema detecta automáticamente:
- Jobs lanzados desde la UI (file lock + memory)
- Jobs lanzados desde terminal (via `pgrep`)
- Procesos stale (elimina locks de procesos muertos)

Si intentas lanzar un job mientras otro está corriendo:
```json
{
  "success": false,
  "error": "Another job is already running. Please wait for it to complete."
}
```

## Comportamiento UI

### Mientras hay proceso activo:
1. **Todos los botones se deshabilitan** (no se pueden lanzar nuevos jobs)
2. Muestra **card de "Proceso en Curso"** con:
   - Nombre del job
   - Barra de progreso (estimada)
   - Aviso: "No cierre esta página ni reinicie el servidor"
3. **Auto-refresh cada 2 segundos** del estado

### Después de completar:
1. Status vuelve a "Disponible"
2. Botones se habilitan nuevamente
3. Logs disponibles en `/api/control/logs/{jobType}`

## Permisos y Seguridad

### Control de Acceso
- Solo usuarios con `role === 'ceo'` o `permission_level === 'admin'/'super_admin'`
- Otros usuarios obtienen error 403 al acceder

### Confirmación Destructiva
- **Rebuild** requiere confirmación textual: escribir "RECONSTRUIR"
- Protege contra clicks accidentales

### Backup Automático
- Toda operación **rebuild** crea backup automático en `data_backup_[timestamp]/`
- Formato: `data_backup_20260630020500/` (date-based naming)
- Contiene copias de todos los JSON files

## Troubleshooting

### "Proceso ocupado" pero nada está ejecutando
**Solución**: 
```bash
# Limpia el lock file manualmente
rm /Users/davidnows/sinkia-next/data/job.lock
```

### Job se congela o nunca termina
**Síntomas**: Status muestra "Procesando" pero sin progreso
**Solución**:
1. Esperar máximo 2 horas (muy largo pero posible)
2. Si realmente congela, matar el proceso:
   ```bash
   pkill -f "reprocess-fresh|reprocess-failed|verify-integrity"
   ```

### Datos corruptos después de rebuild
**Solución**: Restaurar del backup:
```bash
# Listar backups disponibles
ls -1d /Users/davidnows/data_backup_* | tail -1

# Restaurar
cp -r /Users/davidnows/data_backup_20260630020500/* /Users/davidnows/sinkia-next/data/
```

## Logs y Debugging

Todos los logs se guardan en:
- `/Users/davidnows/sinkia-next/data/job-{jobType}.log`

Ejemplos:
- `job-reprocess-failed.log`
- `job-verify.log`
- `job-rebuild.log`

Acceso vía UI:
```
GET /api/control/logs/reprocess-failed?lines=100
```

## Integración con Scripts

El Control Center ejecuta estos scripts:
- `scripts/manual-email-sync.mjs` - Sync emails
- `scripts/reprocess-failed.mjs` - Reprocess failed
- `scripts/reprocess-all.mjs` - Reprocess all
- `scripts/reprocess-fresh.mjs` - Rebuild
- `scripts/verify-integrity.mjs` - Verify

**Nota**: Los scripts pueden ejecutarse también directamente desde terminal:
```bash
cd /Users/davidnows/sinkia-next
node scripts/reprocess-failed.mjs
```

Esto es útil para debugging pero `pgrep` lo detectará y mostrará "Ocupado" en la UI.

## Roadmap Futuro (Phase 2)

- [ ] Progress bar real (no estimada)
- [ ] Live log streaming via WebSocket
- [ ] Cancelar job en progreso
- [ ] Scheduling de jobs automáticos
- [ ] Email notifications al completar
- [ ] Export de logs a archivo
- [ ] Histórico de jobs persistente (últimos 100)
- [ ] Métricas de performance (tiempo/docs)

---

**Última actualización**: 2026-06-30  
**Versión**: 1.0  
**Estado**: Production Ready ✓
