#!/bin/bash

# SynK-IA Enterprise - Desarrollo Local
# Script de inicio automático para Express + Vite

set -e

PROJECT_DIR="/Users/davidnows/sinkia-next"
cd "$PROJECT_DIR"

echo "🚀 SynK-IA Enterprise - Iniciando ambiente de desarrollo..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Matar procesos previos
echo "🧹 Limpiando procesos previos..."
killall node 2>/dev/null || true
sleep 1

# Verificar puerto disponible
echo "🔍 Verificando puerto 3001..."
if lsof -i :3001 > /dev/null 2>&1; then
  echo "⚠️  Puerto 3001 en uso, liberando..."
  lsof -i :3001 | grep -v COMMAND | awk '{print $2}' | xargs -r kill -9 2>/dev/null || true
  sleep 1
fi

# Iniciar servidor Express en background
echo "✅ Iniciando servidor Express (puerto 3001)..."
nohup node server/index.js > server.log 2>&1 &
EXPRESS_PID=$!
echo "   Servidor Express iniciado (PID: $EXPRESS_PID)"

# Esperar a que el servidor inicie
sleep 3

# Validar que el servidor está corriendo
if ! kill -0 $EXPRESS_PID 2>/dev/null; then
  echo "❌ Error: Servidor Express no inició correctamente"
  echo "Último error:"
  tail -20 server.log
  exit 1
fi

echo "✅ Servidor Express está corriendo"

# Mostrar instrucciones
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 AMBIENTE LISTO"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 SERVIDORES ACTIVOS:"
echo "  • Express API:  http://localhost:3001"
echo "  • Logs:         tail -f server.log"
echo ""
echo "📚 DOCUMENTACIÓN:"
echo "  • Estado:       LIVE_TESTING_RESULTS.md"
echo "  • Inicio rápido: QUICK_START.md"
echo "  • Validación:   FINAL_VALIDATION.md"
echo ""
echo "🧪 TESTS RÁPIDOS:"
echo "  # Clasificar documento"
echo "  curl -X POST http://localhost:3001/api/classify \\"
echo "    -H 'X-Admin-Token: sinkia2026' \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"text\":\"Factura INV-2024-001\"}'"
echo ""
echo "  # Ver métricas de aprendizaje"
echo "  curl -H 'X-Admin-Token: sinkia2026' http://localhost:3001/api/learning/metrics"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✨ Servidor listo. Presiona Ctrl+C para detener."
echo ""

# Mantener el script activo
wait $EXPRESS_PID
