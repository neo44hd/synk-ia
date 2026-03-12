# ⚡ Comandos Rápidos - SYNK-IA Agents

## 🚀 Desarrollo

### Iniciar el proyecto
```bash
cd /home/ubuntu/synk-ia
npm install
npm run dev
```

El proyecto estará disponible en: `http://localhost:5173`

### Ver logs en tiempo real
```bash
# Terminal 1: Servidor
npm run dev

# Terminal 2: Logs
tail -f ~/.npm/_logs/*.log
```

---

## 🧪 Testing Rápido

### Test Manual de Agentes

#### 1. CEO Brain Agent
```bash
# Abrir en navegador
http://localhost:5173/ceo-brain

# Usuario autorizado para testing:
# Email: ruben@loffresco.com
```

**Pruebas sugeridas:**
```
1. "Dame un resumen ejecutivo del negocio"
2. "¿Cuántas facturas pendientes tengo?"
3. "Analiza la facturación del último mes"
4. Probar reconocimiento de voz
5. Verificar panel de métricas
```

#### 2. HR Agent
```bash
# Abrir en navegador
http://localhost:5173/hr-agent
```

**Pruebas sugeridas:**
```
1. "Muéstrame mi última nómina"
2. "¿Qué es el IRPF?"
3. "¿Cuántos días de vacaciones me quedan?"
4. Verificar panel de nómina
5. Verificar privacidad de datos
```

#### 3. Central Agent
```bash
# Abrir en navegador
http://localhost:5173/central-agent
```

**Pruebas sugeridas:**
```
1. "Analiza todo el sistema"
2. "Busca facturas de enero"
3. "¿Qué oportunidades de ahorro hay?"
4. Subir un archivo de prueba
5. "Dame un resumen del negocio"
```

#### 4. Biloop Agent
```bash
# Abrir en navegador
http://localhost:5173/biloop-agent
```

**Pruebas sugeridas:**
```
1. Subir archivo CSV de facturas
2. Subir PDF de factura
3. "Analiza las últimas facturas"
4. "Compara precios de suministros"
5. "Dame un resumen de gastos"
```

---

## 🔍 Debugging

### Ver console.log en navegador
```bash
# Abrir Chrome DevTools
F12 o Cmd+Option+I (Mac)

# Filtrar logs por agente
[CEOBrain]
[HRAgent]
[CentralAgent]
[BiloopAgent]
```

### Ver errores de SYNK-IA
```javascript
// En browser console
localStorage.getItem('SYNK-IA_debug')
```

### Limpiar caché de conversaciones
```javascript
// En browser console
localStorage.clear()
sessionStorage.clear()
location.reload()
```

---

## 📦 Build y Deploy

### Build de producción
```bash
cd /home/ubuntu/synk-ia

# Build
npm run build

# Preview del build
npm run preview

# El build estará en: dist/
```

### Deploy rápido con rsync
```bash
# A servidor remoto
rsync -avz --delete dist/ usuario@servidor:/var/www/synk-ia/

# Local a carpeta
cp -r dist/* /var/www/html/synk-ia/
```

### Deploy con Docker (opcional)
```bash
# Build imagen
docker build -t synk-ia-agents .

# Run contenedor
docker run -d -p 80:80 synk-ia-agents

# Ver logs
docker logs -f <container-id>
```

---

## 🔧 Mantenimiento

### Actualizar dependencias
```bash
npm outdated
npm update
```

### Verificar errores de ESLint
```bash
npm run lint
```

### Formatear código
```bash
# Si tienes prettier configurado
npm run format
```

---

## 📊 Verificación de Servicios

### Test de CEO Brain Service
```javascript
// En browser console (después de autenticación)
import { CEOBrainService } from '/src/services/agents/ceoBrainService.js';

// Test métricas
const metrics = await CEOBrainService.getBusinessMetrics();
console.log('Metrics:', metrics);

// Test enriquecimiento
const enriched = await CEOBrainService.enrichMessageWithContext('análisis');
console.log('Enriched:', enriched);
```

### Test de HR Service
```javascript
import { HRAgentService } from '/src/services/agents/hrAgentService.js';

// Test nómina
const payroll = await HRAgentService.analyzeLatestPayroll('email@ejemplo.com');
console.log('Payroll:', payroll);

// Test anomalías
const anomalies = await HRAgentService.detectPayrollAnomalies('email@ejemplo.com');
console.log('Anomalies:', anomalies);
```

### Test de Central Service
```javascript
import { CentralAgentService } from '/src/services/agents/centralAgentService.js';

// Test búsqueda
const results = await CentralAgentService.searchAll('cliente');
console.log('Search:', results);

// Test ahorros
const savings = await CentralAgentService.analyzeSavingsOpportunities();
console.log('Savings:', savings);
```

### Test de Biloop Service
```javascript
import { BiloopAgentService } from '/src/services/agents/biloopAgentService.js';

// Test tipo de archivo
const type = BiloopAgentService.detectFileType('factura.pdf');
console.log('File type:', type);

// Test análisis de gastos
const expenses = await BiloopAgentService.analyzeRecentExpenses(30);
console.log('Expenses:', expenses);
```

---

## 🐛 Troubleshooting Rápido

### Error: "Cannot connect to SYNK-IA"
```bash
# Verificar appId en SYNK-IAClient.js
cat src/api/SYNK-IAClient.js | grep appId

# Debería ser: 6909eb511f749a49b63df48c
```

### Error: "Agent not found"
```bash
# Verificar nombres de agentes
cat src/services/agents/*.js | grep agentName

# Deberían ser:
# ceo_brain
# hr_assistant
# central_coordinator
# biloop_assistant
```

### Error: "User not authorized" (CEO Brain)
```bash
# Verificar email en CEOBrain.jsx
cat src/pages/CEOBrain.jsx | grep CEO_EMAILS

# Añadir tu email si es necesario
```

### Error: "Cannot read metrics"
```bash
# Verificar permisos de entidades en SYNK-IA
# Asegurarse de tener acceso a:
# - Invoice
# - Client
# - Provider
# - Payroll
```

---

## 📱 Acceso Rápido a URLs

### Desarrollo (localhost)
```
Dashboard:      http://localhost:5173/
CEO Brain:      http://localhost:5173/ceo-brain
HR Agent:       http://localhost:5173/hr-agent
Central Agent:  http://localhost:5173/central-agent
Biloop Agent:   http://localhost:5173/biloop-agent
```

### Producción (ejemplo)
```
Dashboard:      https://app.synk-ia.com/
CEO Brain:      https://app.synk-ia.com/ceo-brain
HR Agent:       https://app.synk-ia.com/hr-agent
Central Agent:  https://app.synk-ia.com/central-agent
Biloop Agent:   https://app.synk-ia.com/biloop-agent
```

---

## 🎯 Checklist de Testing Completo

### Pre-deploy
- [ ] Build sin errores
- [ ] Todos los agentes cargan
- [ ] Autenticación funciona
- [ ] Métricas se cargan
- [ ] Mensajes se envían
- [ ] Respuestas se reciben
- [ ] Upload de archivos funciona
- [ ] No hay errores en console
- [ ] UI responsive en móvil
- [ ] Todos los servicios responden

### Post-deploy
- [ ] URLs accesibles
- [ ] SSL/HTTPS activo
- [ ] SYNK-IA conectado
- [ ] Logs sin errores críticos
- [ ] Performance aceptable
- [ ] Usuarios pueden autenticarse
- [ ] Datos se cargan correctamente
- [ ] Conversaciones persisten
- [ ] Notificaciones funcionan
- [ ] WhatsApp conecta (si aplica)

---

## 💾 Backup y Restore

### Backup del proyecto
```bash
# Backup completo
tar -czf synk-ia-backup-$(date +%Y%m%d).tar.gz /home/ubuntu/synk-ia

# Backup solo src
tar -czf synk-ia-src-$(date +%Y%m%d).tar.gz /home/ubuntu/synk-ia/src

# Backup solo servicios
tar -czf synk-ia-services-$(date +%Y%m%d).tar.gz /home/ubuntu/synk-ia/src/services
```

### Restore
```bash
# Descomprimir backup
tar -xzf synk-ia-backup-20250109.tar.gz -C /home/ubuntu/

# Reinstalar dependencias
cd /home/ubuntu/synk-ia
npm install
```

---

## 📝 Logs Útiles

### Ver logs de desarrollo
```bash
# Logs de Vite
npm run dev 2>&1 | tee dev.log

# Ver últimas 50 líneas
tail -50 dev.log

# Seguir logs en tiempo real
tail -f dev.log
```

### Buscar errores
```bash
# Buscar errores en logs
grep -i "error" dev.log

# Buscar warnings
grep -i "warn" dev.log

# Buscar por agente
grep -i "\[CEOBrain\]" dev.log
```

---

## 🔑 Variables de Entorno

### Crear .env.local
```bash
cat > .env.local << EOF
VITE_BASE44_APP_ID=6909eb511f749a49b63df48c
VITE_ENV=development
VITE_DEBUG=true
EOF
```

### Verificar variables
```bash
cat .env.local
```

---

## 🚨 Comandos de Emergencia

### Reinicio completo
```bash
# Limpiar todo y reinstalar
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### Restaurar configuración original
```bash
# Deshacer cambios locales (¡CUIDADO!)
git reset --hard HEAD
git clean -fd
npm install
```

### Verificar integridad
```bash
# Verificar archivos modificados
find src -name "*.jsx" -newer /tmp/timestamp
find src -name "*.js" -newer /tmp/timestamp

# Contar líneas de código
find src -name "*.jsx" -o -name "*.js" | xargs wc -l
```

---

## 📚 Documentación Rápida

### Ver estructura del proyecto
```bash
tree -L 3 -I 'node_modules|dist' /home/ubuntu/synk-ia
```

### Generar documentación de servicios
```bash
# Si tienes jsdoc instalado
npx jsdoc src/services/agents/*.js -d docs/services
```

### Buscar TODOs pendientes
```bash
grep -r "TODO" src/
grep -r "FIXME" src/
```

---

## ✅ Verificación Final

### Antes de commit
```bash
# 1. Lint
npm run lint

# 2. Build
npm run build

# 3. Test local
npm run preview

# 4. Verificar archivos
git status

# 5. Commit
git add .
git commit -m "feat: Implementación completa de 4 agentes de IA"
git push
```

---

## 📞 Soporte

Si necesitas ayuda:
1. Revisa la documentación en `GUIA_AGENTES_IA.md`
2. Consulta el README técnico en `AGENTES_README_TECNICO.md`
3. Verifica el resumen en `IMPLEMENTACION_AGENTES_RESUMEN.md`
4. Contacta a soporte@synk-ia.com

---

**Última actualización**: 9 de Enero de 2025  
**Versión**: 1.0.0
