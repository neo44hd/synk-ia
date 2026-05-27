#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════════
# SynK-IA — Backup & Reinstalación con UN CLICK
# ═══════════════════════════════════════════════════════════════════════════════

set -e

PROJECT_DIR="/Users/davidnows/sinkia-next"
BACKUP_BASE_DIR="/Users/davidnows/sinkia-backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="${BACKUP_BASE_DIR}/backup_${TIMESTAMP}"

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ═══════════════════════════════════════════════════════════════════════════════
# FUNCIONES
# ═══════════════════════════════════════════════════════════════════════════════

print_header() {
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════════════════════${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# ═══════════════════════════════════════════════════════════════════════════════
# BACKUP
# ═══════════════════════════════════════════════════════════════════════════════

backup_application() {
    print_header "📦 INICIANDO BACKUP DE LA APLICACIÓN"
    
    # Crear directorio de backup
    mkdir -p "$BACKUP_DIR"
    print_success "Directorio de backup creado: $BACKUP_DIR"
    
    # Backup de directorios críticos
    print_info "Haciendo backup de directorios..."
    
    if [ -d "$PROJECT_DIR/data" ]; then
        print_info "  → data/"
        cp -r "$PROJECT_DIR/data" "$BACKUP_DIR/" 2>/dev/null || true
    fi
    
    if [ -d "$PROJECT_DIR/uploads" ]; then
        print_info "  → uploads/"
        cp -r "$PROJECT_DIR/uploads" "$BACKUP_DIR/" 2>/dev/null || true
    fi
    
    if [ -d "$PROJECT_DIR/public" ]; then
        print_info "  → public/"
        cp -r "$PROJECT_DIR/public" "$BACKUP_DIR/" 2>/dev/null || true
    fi
    
    # Backup de archivos de configuración
    print_info "Haciendo backup de configuración..."
    
    if [ -f "$PROJECT_DIR/.env" ]; then
        print_info "  → .env"
        cp "$PROJECT_DIR/.env" "$BACKUP_DIR/.env.backup"
    fi
    
    if [ -f "$PROJECT_DIR/pm2.config.cjs" ]; then
        print_info "  → pm2.config.cjs"
        cp "$PROJECT_DIR/pm2.config.cjs" "$BACKUP_DIR/"
    fi
    
    if [ -f "$PROJECT_DIR/vite.config.js" ]; then
        print_info "  → vite.config.js"
        cp "$PROJECT_DIR/vite.config.js" "$BACKUP_DIR/"
    fi
    
    # Backup de package.json y package-lock.json
    print_info "  → package.json"
    cp "$PROJECT_DIR/package.json" "$BACKUP_DIR/"
    
    if [ -f "$PROJECT_DIR/package-lock.json" ]; then
        print_info "  → package-lock.json"
        cp "$PROJECT_DIR/package-lock.json" "$BACKUP_DIR/"
    fi
    
    # Backup de la base de datos (si existe)
    if [ -f "$PROJECT_DIR/data/database.db" ]; then
        print_info "  → database.db"
        cp "$PROJECT_DIR/data/database.db" "$BACKUP_DIR/"
    fi
    
    print_success "Backup completado en: $BACKUP_DIR"
    
    # Mostrar tamaño del backup
    BACKUP_SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)
    print_info "Tamaño del backup: $BACKUP_SIZE"
}

# ═══════════════════════════════════════════════════════════════════════════════
# REINSTALACIÓN
# ═══════════════════════════════════════════════════════════════════════════════

reinstall_application() {
    print_header "🔧 REINSTALANDO APLICACIÓN"
    
    cd "$PROJECT_DIR"
    
    # 1. Detener servicios
    print_info "Deteniendo servicios..."
    pm2 stop sinkia-api 2>/dev/null || true
    pm2 delete sinkia-api 2>/dev/null || true
    
    # 2. Limpiar node_modules y dist
    print_info "Limpiando dependencias antiguas..."
    rm -rf node_modules package-lock.json 2>/dev/null || true
    rm -rf dist 2>/dev/null || true
    rm -rf server/dist 2>/dev/null || true
    
    # 3. Instalar dependencias
    print_info "Instalando dependencias (npm install)..."
    npm install --legacy-peer-deps 2>&1 | grep -E "added|up to date" || true
    
    # 4. Compilar frontend
    print_info "Compilando frontend (npm run build)..."
    npm run build 2>&1 | tail -5
    
    # 5. Restaurar .env si no existe
    if [ ! -f "$PROJECT_DIR/.env" ] && [ -f "$BACKUP_DIR/.env.backup" ]; then
        print_info "Restaurando archivo .env del backup..."
        cp "$BACKUP_DIR/.env.backup" "$PROJECT_DIR/.env"
    fi
    
    # 6. Iniciar servicios con PM2
    print_info "Iniciando servicios con PM2..."
    pm2 start pm2.config.cjs --update-env
    
    print_success "Reinstalación completada"
}

# ═══════════════════════════════════════════════════════════════════════════════
# RESTORE
# ═══════════════════════════════════════════════════════════════════════════════

restore_from_backup() {
    local backup_path="$1"
    
    if [ ! -d "$backup_path" ]; then
        print_error "El backup no existe: $backup_path"
        return 1
    fi
    
    print_header "♻️  RESTAURANDO DESDE BACKUP"
    print_info "Backup: $backup_path"
    
    # Restaurar directorios
    if [ -d "$backup_path/data" ]; then
        print_info "Restaurando data/"
        cp -r "$backup_path/data" "$PROJECT_DIR/"
    fi
    
    if [ -d "$backup_path/uploads" ]; then
        print_info "Restaurando uploads/"
        cp -r "$backup_path/uploads" "$PROJECT_DIR/"
    fi
    
    if [ -d "$backup_path/public" ]; then
        print_info "Restaurando public/"
        cp -r "$backup_path/public" "$PROJECT_DIR/"
    fi
    
    # Restaurar .env
    if [ -f "$backup_path/.env.backup" ]; then
        print_info "Restaurando .env"
        cp "$backup_path/.env.backup" "$PROJECT_DIR/.env"
    fi
    
    print_success "Restauración completada"
}

# ═══════════════════════════════════════════════════════════════════════════════
# LISTAR BACKUPS
# ═══════════════════════════════════════════════════════════════════════════════

list_backups() {
    print_header "📋 BACKUPS DISPONIBLES"
    
    if [ ! -d "$BACKUP_BASE_DIR" ]; then
        print_warning "No hay backups disponibles"
        return
    fi
    
    echo ""
    ls -1d "$BACKUP_BASE_DIR"/backup_* 2>/dev/null | while read backup; do
        backup_name=$(basename "$backup")
        backup_date=$(echo "$backup_name" | sed 's/backup_//' | sed 's/_/ /')
        backup_size=$(du -sh "$backup" | cut -f1)
        echo "  📦 $backup_name — $backup_size"
    done
    echo ""
}

# ═══════════════════════════════════════════════════════════════════════════════
# MENU INTERACTIVO
# ═══════════════════════════════════════════════════════════════════════════════

show_menu() {
    print_header "🎛️  BACKUP & REINSTALACIÓN"
    echo ""
    echo "  1️⃣  Hacer backup ahora"
    echo "  2️⃣  Reinstalar aplicación (limpia)"
    echo "  3️⃣  Backup + Reinstalar (recomendado)"
    echo "  4️⃣  Listar backups"
    echo "  5️⃣  Restaurar desde backup"
    echo "  6️⃣  Salir"
    echo ""
    read -p "Selecciona una opción (1-6): " option
    
    case $option in
        1)
            backup_application
            ;;
        2)
            print_warning "Esto eliminará node_modules y dist. ¿Seguro? (s/n)"
            read -p "Confirma: " confirm
            if [ "$confirm" = "s" ] || [ "$confirm" = "S" ]; then
                reinstall_application
            else
                print_warning "Operación cancelada"
            fi
            ;;
        3)
            backup_application
            echo ""
            print_warning "Esto eliminará node_modules y dist. ¿Seguro? (s/n)"
            read -p "Confirma: " confirm
            if [ "$confirm" = "s" ] || [ "$confirm" = "S" ]; then
                reinstall_application
            else
                print_warning "Operación cancelada"
            fi
            ;;
        4)
            list_backups
            show_menu
            ;;
        5)
            list_backups
            read -p "Ruta del backup a restaurar (o Enter para cancelar): " backup_path
            if [ -n "$backup_path" ]; then
                restore_from_backup "$backup_path"
            fi
            ;;
        6)
            print_success "¡Hasta luego!"
            exit 0
            ;;
        *)
            print_error "Opción inválida"
            show_menu
            ;;
    esac
}

# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════

main() {
    # Si se ejecuta con parámetros
    if [ $# -gt 0 ]; then
        case "$1" in
            backup)
                backup_application
                ;;
            reinstall)
                reinstall_application
                ;;
            full)
                backup_application
                reinstall_application
                ;;
            restore)
                restore_from_backup "$2"
                ;;
            list)
                list_backups
                ;;
            *)
                print_error "Opción desconocida: $1"
                echo "Uso: $0 [backup|reinstall|full|restore <path>|list]"
                exit 1
                ;;
        esac
    else
        # Si no hay parámetros, mostrar menú interactivo
        show_menu
    fi
}

main "$@"
