#!/bin/bash
# Espera a que TODO el reproceso termine (marca final del encadenado de fallidos)
# y ejecuta la verificación de integridad, dejando el informe en /tmp/integrity-report.txt
cd /Users/davidnows/sinkia-next || exit 1
# Espera a la marca final inequívoca del encadenado de fallidos
# (chain-failed.sh imprime esta línea al terminar TODO el reproceso).
while ! grep -q "Reproceso de fallidos completado" /tmp/reprocess-failed.log 2>/dev/null; do
  sleep 120
done
sleep 5
echo "[VERIFY] Reproceso completo. Verificando integridad de datos..."
node scripts/verify-integrity.mjs > /tmp/integrity-report.txt 2>&1
echo "[VERIFY] Informe escrito en /tmp/integrity-report.txt"
cat /tmp/integrity-report.txt
