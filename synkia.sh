#!/bin/bash

#  ╔════════════════════════════════════════════════════════════════════════╗
#  ║                    SynK-IA Server Control Script                       ║
#  ║                   Automatic Startup & Monitoring                       ║
#  ╚════════════════════════════════════════════════════════════════════════╝

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$HOME/.synkia/logs"
PLIST_FILE="$HOME/Library/LaunchAgents/com.synkia.server.plist"
SERVICE_NAME="com.synkia.server"
PORT=3001

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
print_header() {
    echo -e "\n${BLUE}╔════════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC} $1"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════════════════╝${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_info() {
    echo -e "${BLUE}→${NC} $1"
}

# Check if server is running
is_server_running() {
    if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Start server
start_server() {
    print_header "Starting SynK-IA Server"
    
    if is_server_running; then
        print_warning "Server is already running on port $PORT"
        return 0
    fi
    
    mkdir -p "$LOG_DIR"
    
    print_info "Starting Node.js server..."
    cd "$SCRIPT_DIR"
    
    if launchctl load "$PLIST_FILE" 2>/dev/null; then
        sleep 2
        if is_server_running; then
            print_success "Server started successfully!"
            print_info "Access it at: http://localhost:$PORT"
            return 0
        else
            print_error "Server failed to start"
            print_info "Check logs: tail -f $LOG_DIR/server.error.log"
            return 1
        fi
    else
        print_warning "Service already loaded or error occurred"
        return 0
    fi
}

# Stop server
stop_server() {
    print_header "Stopping SynK-IA Server"
    
    if ! is_server_running; then
        print_warning "Server is not running"
        return 0
    fi
    
    print_info "Stopping Node.js server..."
    if launchctl unload "$PLIST_FILE" 2>/dev/null; then
        sleep 1
        print_success "Server stopped successfully!"
        return 0
    else
        print_error "Failed to stop server"
        return 1
    fi
}

# Restart server
restart_server() {
    print_header "Restarting SynK-IA Server"
    stop_server
    sleep 2
    start_server
}

# Check status
status_server() {
    print_header "SynK-IA Server Status"
    
    if is_server_running; then
        print_success "Server is RUNNING on port $PORT"
        
        echo -e "\n${BLUE}Active Connections:${NC}"
        lsof -i :$PORT | tail -n +2
        
        echo -e "\n${BLUE}Server Info:${NC}"
        print_info "URL: http://localhost:$PORT"
        print_info "Dashboard: http://localhost:$PORT/ultimate-panel.html"
        print_info "Advanced: http://localhost:$PORT/advanced-dashboard.html"
        print_info "Command Center: http://localhost:$PORT/command-center.html"
        
    else
        print_error "Server is NOT running"
        print_info "Start it with: $0 start"
    fi
}

# View logs
view_logs() {
    print_header "SynK-IA Server Logs"
    
    if [ ! -d "$LOG_DIR" ]; then
        print_error "Log directory not found: $LOG_DIR"
        return 1
    fi
    
    echo -e "${BLUE}Output Log:${NC}"
    if [ -f "$LOG_DIR/server.out.log" ]; then
        tail -f "$LOG_DIR/server.out.log"
    else
        print_warning "No output log found yet"
    fi
}

# View error logs
view_error_logs() {
    print_header "SynK-IA Server Error Logs"
    
    echo -e "${BLUE}Error Log:${NC}"
    if [ -f "$LOG_DIR/server.error.log" ]; then
        tail -f "$LOG_DIR/server.error.log"
    else
        print_warning "No error log found"
    fi
}

# Install service
install_service() {
    print_header "Installing SynK-IA Auto-Startup Service"
    
    if [ ! -f "$PLIST_FILE" ]; then
        print_error "PLIST file not found: $PLIST_FILE"
        print_info "Please ensure the service is properly installed"
        return 1
    fi
    
    mkdir -p "$LOG_DIR"
    
    if launchctl load "$PLIST_FILE" 2>/dev/null; then
        print_success "Service installed and loaded!"
        print_info "Server will start automatically on login"
    else
        print_warning "Service already installed"
    fi
}

# Uninstall service
uninstall_service() {
    print_header "Uninstalling SynK-IA Auto-Startup Service"
    
    print_warning "This will remove automatic startup on login"
    read -p "Are you sure? (y/n) " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        if launchctl unload "$PLIST_FILE" 2>/dev/null; then
            print_success "Service uninstalled!"
        else
            print_warning "Service was not loaded"
        fi
    else
        print_info "Cancelled"
    fi
}

# Open dashboard
open_dashboard() {
    print_header "Opening SynK-IA Dashboard"
    
    if ! is_server_running; then
        print_warning "Server is not running. Starting it now..."
        start_server
        sleep 3
    fi
    
    print_info "Opening Ultimate Panel..."
    open "http://localhost:$PORT/ultimate-panel.html"
    print_success "Dashboard opened in browser!"
}

# System info
system_info() {
    print_header "SynK-IA System Information"
    
    echo -e "${BLUE}System:${NC}"
    print_info "macOS $(sw_vers -productVersion)"
    print_info "Shell: $(basename $SHELL) $($SHELL --version | head -1)"
    print_info "Node: $(node -v 2>/dev/null || echo 'not installed')"
    print_info "npm: $(npm -v 2>/dev/null || echo 'not installed')"
    
    echo -e "\n${BLUE}SynK-IA Setup:${NC}"
    print_info "Project: $SCRIPT_DIR"
    print_info "Port: $PORT"
    print_info "Service: $SERVICE_NAME"
    print_info "Logs: $LOG_DIR"
    
    echo -e "\n${BLUE}Gateways:${NC}"
    print_info "OpenClaw: http://localhost:18789"
    print_info "Ollama: http://localhost:11434"
    print_info "Pipeline: http://localhost:$PORT/api/ai/status"
    
    echo -e "\n${BLUE}Token:${NC}"
    print_info "Admin Token: sinkia2026"
}

# Help
show_help() {
    cat << 'HELP'
╔════════════════════════════════════════════════════════════════════════╗
║              SynK-IA Server Control - Help & Commands                   ║
╚════════════════════════════════════════════════════════════════════════╝

USAGE: ./synkia.sh [COMMAND]

COMMANDS:

  start         Start the SynK-IA server
  stop          Stop the SynK-IA server
  restart       Restart the SynK-IA server
  status        Check server status
  logs          View server output logs (tail)
  errors        View server error logs (tail)
  install       Install auto-startup service
  uninstall     Remove auto-startup service
  dashboard     Open dashboard in browser
  info          Show system & configuration info
  help          Show this help message

EXAMPLES:

  ./synkia.sh start          # Start server
  ./synkia.sh status         # Check if running
  ./synkia.sh logs           # View logs
  ./synkia.sh dashboard      # Open in browser
  ./synkia.sh install        # Auto-start on login

AUTOMATIC STARTUP:

  The service is configured to:
  ✓ Start automatically when you log in
  ✓ Restart if it crashes
  ✓ Run in the background
  ✓ Log output to ~/.synkia/logs/

QUICK ACCESS:

  Open dashboard: ~/Desktop/SynK-IA-Ultimate.command
  View logs:      tail -f ~/.synkia/logs/server.out.log

HELP
}

# Main script logic
case "${1:-help}" in
    start)
        start_server
        ;;
    stop)
        stop_server
        ;;
    restart)
        restart_server
        ;;
    status)
        status_server
        ;;
    logs)
        view_logs
        ;;
    errors)
        view_error_logs
        ;;
    install)
        install_service
        ;;
    uninstall)
        uninstall_service
        ;;
    dashboard)
        open_dashboard
        ;;
    info)
        system_info
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        print_error "Unknown command: $1"
        echo ""
        show_help
        exit 1
        ;;
esac
