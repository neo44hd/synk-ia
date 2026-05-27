#!/bin/bash

# SynK-IA Enterprise - Deploy Script
# Versión: 1.0
# Fecha: 2026-05-27

set -e

PROJECT_DIR="/Users/davidnows/sinkia-next"
DEPLOY_LOG="/tmp/synkia-deploy.log"
TIMESTAMP=$(date '+%Y-%m-%d_%H-%M-%S')

echo "🚀 SynK-IA Enterprise - Deploy Script"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Timestamp: $TIMESTAMP"
echo "Project: $PROJECT_DIR"
echo ""

# Inicializar log
cat > "$DEPLOY_LOG" << EOF
=== SynK-IA Enterprise Deploy Log ===
Timestamp: $TIMESTAMP
Project: $PROJECT_DIR
Status: Starting...

EOF

# Función de logging
log_message() {
  echo "$1" | tee -a "$DEPLOY_LOG"
}

# Función de error
error_exit() {
  log_message "❌ Error: $1"
  echo "Deploy FAILED. Logs: $DEPLOY_LOG"
  exit 1
}

# FASE 1: Validación Local
log_message ""
log_message "📋 FASE 1: Validación Local"
log_message "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cd "$PROJECT_DIR"

# Validar build
log_message "✅ Validando build..."
if npm run build >> "$DEPLOY_LOG" 2>&1; then
  log_message "   Build: OK"
else
  error_exit "Build failed"
fi

# Validar sintaxis
log_message "✅ Validando sintaxis del código..."
if node --check server/index.js >> "$DEPLOY_LOG" 2>&1; then
  log_message "   Sintaxis: OK"
else
  error_exit "Syntax check failed"
fi

# Verificar dependencias
log_message "✅ Verificando dependencias..."
if npm list --depth=0 >> "$DEPLOY_LOG" 2>&1; then
  log_message "   Dependencias: OK"
else
  error_exit "Dependency check failed"
fi

# FASE 2: Preparación de Producción
log_message ""
log_message "🔧 FASE 2: Preparación de Producción"
log_message "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Verificar variables de entorno
log_message "✅ Verificando variables de entorno..."
if [ -f ".env" ]; then
  log_message "   .env: Presente"
else
  log_message "   ⚠️  .env no encontrado, usando valores por defecto"
fi

# Crear directorios necesarios
log_message "✅ Creando directorios..."
mkdir -p data/{integrations}
mkdir -p dist
mkdir -p logs
log_message "   Directorios: OK"

# Generar archivo de configuración de producción
log_message "✅ Generando configuración de producción..."
cat > /tmp/synkia-config.json << 'EOFCONFIG'
{
  "environment": "production",
  "server": {
    "port": 3001,
    "host": "0.0.0.0"
  },
  "database": {
    "type": "json",
    "path": "data/"
  },
  "ollama": {
    "enabled": true,
    "url": "http://localhost:11434",
    "model": "llama2",
    "fallbackEnabled": true
  },
  "logging": {
    "level": "info",
    "file": "logs/production.log"
  },
  "security": {
    "adminToken": "sinkia2026",
    "tokenRequired": true
  }
}
EOFCONFIG
log_message "   Configuración: OK"

# FASE 3: Despliegue
log_message ""
log_message "🚀 FASE 3: Despliegue"
log_message "━━━━━━━━━━━━━━━━━━━━"

# Crear archivo de arranque de producción
log_message "✅ Creando script de arranque..."
cat > /tmp/start-production.sh << 'EOFSTART'
#!/bin/bash
cd /Users/davidnows/sinkia-next

# Matar procesos previos
killall node 2>/dev/null || true
sleep 1

# Iniciar servidor con PM2 si está disponible
if command -v pm2 &> /dev/null; then
  pm2 start server/index.js --name "synkia-api" --instances 1
  pm2 save
else
  # Fallback: iniciar con node directamente
  nohup node server/index.js > logs/production.log 2>&1 &
  echo "Servidor iniciado (PID: $!)"
fi
EOFSTART

chmod +x /tmp/start-production.sh
log_message "   Script de arranque: OK"

# Validar que Express está correctamente configurado
log_message "✅ Validando configuración de Express..."
if grep -q "app.listen\|app.use" server/index.js; then
  log_message "   Express: OK"
else
  error_exit "Express configuration not found"
fi

# FASE 4: Validación Pre-Deploy
log_message ""
log_message "✔️  FASE 4: Validación Pre-Deploy"
log_message "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Contar endpoints
ENDPOINT_COUNT=$(grep -r "app\.get\|app\.post\|app\.put\|app\.delete" server/routes/*.js | wc -l)
log_message "✅ Endpoints configurados: $ENDPOINT_COUNT"

# Verificar datos persistentes
if [ -d "data" ]; then
  log_message "✅ Directorio de datos: OK"
else
  log_message "   Creando directorio de datos..."
  mkdir -p data
fi

# FASE 5: Post-Deploy Ready
log_message ""
log_message "✅ DEPLOY LISTO"
log_message "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cat >> "$DEPLOY_LOG" << EOF

=== Deploy Summary ===
Status: READY
Timestamp: $TIMESTAMP
Build: ✅ Passed
Syntax: ✅ Passed
Dependencies: ✅ OK
Configuration: ✅ Prepared
Endpoints: $ENDPOINT_COUNT configured
Database: ✅ Ready

=== Next Steps ===
1. Iniciar servidor: /tmp/start-production.sh
2. Validar endpoints: curl http://localhost:3001/api/learning/metrics
3. Monitorear logs: tail -f /Users/davidnows/sinkia-next/logs/production.log

=== Detalles ===
Project: $PROJECT_DIR
Log file: $DEPLOY_LOG
Config: /tmp/synkia-config.json
Start script: /tmp/start-production.sh

EOF

log_message ""
log_message "📊 Resumen de Deploy"
log_message "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log_message "✅ Build validado"
log_message "✅ Sintaxis validada"
log_message "✅ Dependencias verificadas"
log_message "✅ Configuración lista"
log_message "✅ Endpoints: $ENDPOINT_COUNT"
log_message "✅ Sistema listo para producción"
log_message ""
log_message "📝 Logs: $DEPLOY_LOG"
log_message ""
log_message "🚀 Para iniciar:"
log_message "   /tmp/start-production.sh"
log_message ""
log_message "Status: 🟢 READY FOR DEPLOYMENT"
