#!/bin/bash
# Espera a que termine el pase completo (reprocess-fresh.mjs) y entonces
# reprocesa automáticamente los documentos fallidos con el OCR de visión NVIDIA.
cd /Users/davidnows/sinkia-next || exit 1
while pgrep -f "reprocess-fresh.mjs" >/dev/null 2>&1; do
  sleep 60
done
echo "[CHAIN] Pase completo terminado → lanzando reprocess-failed con OCR visión NVIDIA"
node scripts/reprocess-failed.mjs
echo "[CHAIN] Reproceso de fallidos completado"
