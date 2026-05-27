#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════════
# SynK-IA — Acceso rápido: Backup & Reinstalación
# ═══════════════════════════════════════════════════════════════════════════════
# 
# Uso desde el directorio raíz:
#   ./backup.sh              → Menú interactivo
#   ./backup.sh backup       → Hacer backup ahora
#   ./backup.sh full         → Backup + Reinstalar (recomendado)
#   ./backup.sh reinstall    → Reinstalar limpio
#   ./backup.sh list         → Listar backups
#   ./backup.sh restore PATH → Restaurar desde backup
#
# ═══════════════════════════════════════════════════════════════════════════════

/Users/davidnows/sinkia-next/scripts/backup-restore.sh "$@"
