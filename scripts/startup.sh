#!/bin/bash
# ── SYNK-IA Startup + Health Monitor ──────────────────────────────────────────
# Levanta servicios en PM2 y monitoriza con alertas por email.
# Uso:
#   bash ~/sinkia/scripts/startup.sh           → arrancar servicios
#   bash ~/sinkia/scripts/startup.sh --watch   → arrancar + health monitor
# ──────────────────────────────────────────────────────────────────────────────

set -e

SINKIA_DIR="$HOME/sinkia"
cd "$SINKIA_DIR"

# ── Config de alertas ────────────────────────────────────────────────────────
ENV_FILE="$SINKIA_DIR/server/.env"
EMAIL_USER=$(grep '^EMAIL_USER=' "$ENV_FILE" 2>/dev/null | cut -d'=' -f2)
EMAIL_PASS=$(grep '^EMAIL_APP_PASSWORD=' "$ENV_FILE" 2>/dev/null | cut -d'=' -f2)
ALERT_TO="${EMAIL_USER}"
HEALTH_CHECK_INTERVAL=120
HEALTH_LOG="$SINKIA_DIR/logs/health.log"
COOLDOWN_FILE="/tmp/sinkia-alert-cooldown"
COOLDOWN_SECONDS=900  # No repetir la misma alerta en 15 min
mkdir -p "$SINKIA_DIR/logs"

# ── Función: enviar alerta por Gmail ─────────────────────────────────────────
send_alert() {
  local subject="$1"
  local body="$2"
  local timestamp
  timestamp=$(date '+%Y-%m-%d %H:%M:%S')

  # Cooldown: no spamear
  if [ -f "$COOLDOWN_FILE" ]; then
    local last_alert
    last_alert=$(cat "$COOLDOWN_FILE")
    local now
    now=$(date +%s)
    local diff=$(( now - last_alert ))
    if [ "$diff" -lt "$COOLDOWN_SECONDS" ]; then
      echo "[$timestamp] Alerta suprimida (cooldown ${diff}s/${COOLDOWN_SECONDS}s)" >> "$HEALTH_LOG"
      return
    fi
  fi

  # Enviar con Python (smtplib + Gmail App Password)
  python3 << PYEOF
import smtplib
from email.mime.text import MIMEText

msg = MIMEText("""${body}

---
Timestamp: ${timestamp}
Host: $(hostname)
Enviado automáticamente por SYNK-IA Health Monitor
""")
msg['Subject'] = "${subject}"
msg['From'] = "${EMAIL_USER}"
msg['To'] = "${ALERT_TO}"

try:
    with smtplib.SMTP_SSL('smtp.gmail.com', 465) as s:
        s.login("${EMAIL_USER}", "${EMAIL_PASS}")
        s.send_message(msg)
    print("Email enviado OK")
except Exception as e:
    print(f"Error enviando email: {e}")
PYEOF

  date +%s > "$COOLDOWN_FILE"
  echo "[$timestamp] ALERTA ENVIADA: $subject" >> "$HEALTH_LOG"
}

# ── Función: health check ────────────────────────────────────────────────────
run_health_check() {
  local timestamp
  timestamp=$(date '+%Y-%m-%d %H:%M:%S')
  local failed_services=""
  local details=""

  # Comprobar cada proceso en PM2
  for svc in sinkia-api cloudflared-tunnel litellm-proxy; do
    local status
    status=$(pm2 jlist 2>/dev/null | python3 -c "
import sys, json
try:
    procs = json.load(sys.stdin)
    match = [p for p in procs if p['name'] == '${svc}']
    if match:
        print(match[0]['pm2_env']['status'])
    else:
        print('not_found')
except:
    print('error')
" 2>/dev/null)

    if [ "$status" != "online" ]; then
      failed_services="$failed_services $svc($status)"
      details="$details\n- $svc: $status"

      # Intentar rearrancar
      echo "[$timestamp] $svc caido ($status) — reintentando..." >> "$HEALTH_LOG"
      pm2 restart "$svc" 2>/dev/null || true
    fi
  done

  # Health check HTTP del backend
  local http_ok
  http_ok=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/health 2>/dev/null || echo "000")
  if [ "$http_ok" != "200" ]; then
    failed_services="$failed_services backend-http($http_ok)"
    details="$details\n- Backend HTTP: respondio $http_ok (esperado 200)"
  fi

  # Si hay fallos, enviar alerta
  if [ -n "$failed_services" ]; then
    send_alert \
      "[SYNK-IA ALERTA] Servicios caidos:$failed_services" \
      "Se han detectado servicios caidos en SYNK-IA:\n$details\n\nSe ha intentado rearrancar automaticamente.\nRevisa con: pm2 list && pm2 logs\n\nURL: https://sinkialabs.com"
    echo "[$timestamp] FALLO:$failed_services" >> "$HEALTH_LOG"
  else
    echo "[$timestamp] OK — todos los servicios online (HTTP $http_ok)" >> "$HEALTH_LOG"
  fi
}

# ══════════════════════════════════════════════════════════════════════════════
# ARRANQUE DE SERVICIOS
# ══════════════════════════════════════════════════════════════════════════════

echo "🔧 Arrancando servicios SYNK-IA..."

# ── 1. Esperar a que Ollama esté listo (arranca con macOS) ───────────────────
echo "⏳ Esperando a Ollama..."
for i in {1..30}; do
  if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo "✅ Ollama listo"
    break
  fi
  [ "$i" -eq 30 ] && echo "⚠️  Ollama no responde — continúo sin él"
  sleep 2
done

# ── 2. Limpiar procesos PM2 anteriores ──────────────────────────────────────
pm2 delete all 2>/dev/null || true

# ── 3. Levantar servicios ───────────────────────────────────────────────────
# Backend API
pm2 start "$SINKIA_DIR/server/index.js" \
  --name sinkia-api \
  --cwd "$SINKIA_DIR/server" \
  --node-args="--experimental-vm-modules"

# Cloudflare Tunnel
pm2 start cloudflared \
  --name cloudflared-tunnel \
  -- tunnel run sinkia

# LiteLLM Proxy (solo si existe el script)
if [ -f "$SINKIA_DIR/scripts/start-litellm.sh" ]; then
  pm2 start "$SINKIA_DIR/scripts/start-litellm.sh" \
    --name litellm-proxy
else
  echo "⏭️  start-litellm.sh no encontrado — omitiendo litellm-proxy"
fi

# ── 4. Guardar estado para pm2 resurrect ────────────────────────────────────
pm2 save

# ── 5. Verificar ────────────────────────────────────────────────────────────
sleep 3
echo ""
echo "📊 Estado de los servicios:"
pm2 list

# Health check del backend
echo ""
echo "🏥 Health check:"
curl -s http://localhost:3001/api/health 2>/dev/null || echo "⚠️  Backend aún arrancando..."

echo ""
echo "🚀 SYNK-IA lista → https://sinkialabs.com"

# ══════════════════════════════════════════════════════════════════════════════
# HEALTH MONITOR (solo con --watch)
# ══════════════════════════════════════════════════════════════════════════════

if [ "${1}" = "--watch" ]; then
  echo ""
  echo "👁️  Health monitor activo — comprobando cada ${HEALTH_CHECK_INTERVAL}s"
  echo "    Alertas por email a: ${ALERT_TO}"
  echo "    Log: ${HEALTH_LOG}"
  echo "    Ctrl+C para detener"
  echo ""

  # Primer check
  run_health_check

  # Bucle infinito
  while true; do
    sleep "$HEALTH_CHECK_INTERVAL"
    run_health_check
  done
fi
