# 🔄 SynK-IA — Backup & Reinstalación con UN CLICK

Sistema automático de backup y reinstalación limpia para SynK-IA.

---

## 🚀 Formas de Usar

### **Opción 1: Con Alias (Recomendado)**

```bash
backup              # Menú interactivo completo
backup-now          # Hacer backup ahora
backup-full         # Backup + Reinstalar (la más usada)
backup-restore      # Listar backups disponibles
```

### **Opción 2: Script Directo**

Desde `/sinkia-next/`:

```bash
./backup.sh              # Menú interactivo
./backup.sh backup       # Hacer backup
./backup.sh full         # Backup + Reinstalar
./backup.sh reinstall    # Reinstalar limpio
./backup.sh list         # Listar backups
./backup.sh restore PATH # Restaurar desde PATH
```

### **Opción 3: Script Completo**

```bash
./scripts/backup-restore.sh              # Todas las opciones
./scripts/backup-restore.sh backup       # Backup
./scripts/backup-restore.sh full         # Backup + Reinstalar
```

---

## 📋 Flujos Comunes

### **Escenario 1: Cambios Grandes + Reinstalar Limpio**

```bash
backup-full
```

✅ Hace backup automático  
✅ Limpia `node_modules` y `dist`  
✅ Reinstala dependencias  
✅ Compila frontend  
✅ Reinicia servicios con PM2  

**Tiempo estimado**: 5-10 minutos

---

### **Escenario 2: Solo Hacer Backup (Sin Reinstalar)**

```bash
backup-now
```

✅ Guarda copia de:
- `data/` — Base de datos y documentos
- `uploads/` — Archivos subidos
- `public/` — Archivos estáticos
- `.env` — Configuración
- `package.json` — Dependencias

**Ubicación**: `/Users/davidnows/sinkia-backups/backup_YYYYMMDD_HHMMSS/`

---

### **Escenario 3: Ver Backups Disponibles**

```bash
backup-restore
```

Muestra lista de todos los backups con:
- Fecha y hora
- Tamaño en disco

---

### **Escenario 4: Restaurar desde Backup Específico**

```bash
backup list                                          # Ver lista
backup restore /Users/davidnows/sinkia-backups/backup_20260527_061200
```

✅ Restaura:
- Datos (`data/`)
- Archivos subidos (`uploads/`)
- Configuración (`.env`)

---

## 🔧 Lo que hace cada operación

### **BACKUP**
- ✅ Copia `data/` (base de datos, documentos)
- ✅ Copia `uploads/` (archivos)
- ✅ Copia `public/` (estáticos)
- ✅ Copia `.env` (credenciales)
- ✅ Copia `package.json` y `package-lock.json`
- ✅ Guarda en `/sinkia-backups/backup_TIMESTAMP/`

### **REINSTALAR**
- 🔴 Detiene servicios PM2
- 🔴 Elimina `node_modules` y `dist` (limpia cache)
- ✅ `npm install` con `--legacy-peer-deps`
- ✅ `npm run build` (compila React + Vite)
- ✅ Restaura `.env` si se perdió
- ✅ Inicia servicios con PM2

### **RESTAURAR**
- ✅ Copia `data/` desde backup
- ✅ Copia `uploads/` desde backup
- ✅ Restaura `.env`

---

## 📊 Estructura de Backups

```
/Users/davidnows/sinkia-backups/
├── backup_20260527_061200/
│   ├── data/                 ← Base de datos
│   ├── uploads/              ← Archivos subidos
│   ├── public/               ← Estáticos
│   ├── .env.backup           ← Credenciales
│   ├── package.json
│   ├── package-lock.json
│   ├── pm2.config.cjs
│   └── vite.config.js
├── backup_20260527_055000/
└── backup_20260527_040000/
```

---

## ⚡ Casos de Uso

| Caso | Comando | Tiempo |
|------|---------|--------|
| Cambios grandes + limpiar | `backup-full` | 5-10 min |
| Solo proteger datos | `backup-now` | 30 seg |
| Ver historial de backups | `backup-restore` | 1 seg |
| Volver a estado anterior | `backup restore PATH` | 1 min |
| Solo reinstalar (rápido) | `./backup.sh reinstall` | 3-5 min |

---

## 🛡️ Seguridad

- ✅ Todos los backups se guardan localmente en `/sinkia-backups/`
- ✅ Incluyen `.env` con credenciales (guardar seguro)
- ✅ Se pueden hacer múltiples backups sin conflicto (usa timestamps)
- ✅ Restauración no destructiva (copia, no sobrescribe si no existe)

---

## 🔍 Archivos Involucrados

- **Script principal**: `./scripts/backup-restore.sh`
- **Wrapper**: `./backup.sh`
- **Alias**: `~/.zshrc` (líneas 50-54)
- **Backups**: `/Users/davidnows/sinkia-backups/`

---

## 💡 Tips

1. **Backup antes de cambios grandes**
   ```bash
   backup-now
   ```

2. **Reinstalar después de merge de código**
   ```bash
   backup-full
   ```

3. **Ver qué backups tienes**
   ```bash
   backup-restore
   ```

4. **Recuperar versión anterior**
   ```bash
   backup restore /Users/davidnows/sinkia-backups/backup_20260527_055000
   ```

---

## ❓ Troubleshooting

### El script no se ejecuta
```bash
chmod +x ~/sinkia-next/backup.sh
chmod +x ~/sinkia-next/scripts/backup-restore.sh
```

### El alias no funciona
```bash
source ~/.zshrc
```

### Reinstalación lenta
- Normal: depende de internet y máquina
- Comprueba: `npm install` descargando desde npm registry

### Restauración falla
- Verifica ruta: `backup restore /Users/davidnows/sinkia-backups/backup_XXXX`
- Comprueba: directorio existe y tiene `data/` o `uploads/`

---

## 📞 Soporte

Si algo no funciona:
1. Mira los logs: `./backup.sh` muestra colores y detalles
2. Verifica permisos: `ls -la scripts/backup-restore.sh`
3. Confirma rutas: el script usa `/Users/davidnows/sinkia-next` fijo

---

**¡Disfruta de backups sin estrés!** 🎉
