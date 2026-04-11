# USER.md — David

## Quién soy

David. Fundador y único desarrollador de SYNK-IA. Tech entrepreneur full-stack con base en Valencia e Ibiza, España.

## Mi negocio

### Chicken Palace Ibiza
- Restaurante en Eivissa, Illes Balears
- Email corporativo: info@chickenpalace.es
- Usa Revo XEF como TPV (punto de venta)
- Contabilidad gestionada vía Biloop (gestoría Assempsa)
- CIF empresa: E95251
- Nóminas vía Vtrgestion (llegan por email como PDF)

### SYNK-IA (el producto)
- Plataforma SaaS de gestión empresarial para PYMEs españolas
- Dominio: sinkialabs.com
- Repo: github.com/neo44hd/synk-ia (cuenta: neo44hd)
- Email de contacto: proton3444@gmail.com
- Objetivo: Vender a restaurantes, bares y comercios españoles a 50€/mes

## Mi hardware

### Mac Mini M4 Pro (máquina principal)
- 24 GB RAM unificada
- 1 TB SSD (~60-70 GB libres)
- macOS, hostname: Davids-Mac-mini
- IP local: 192.168.0.29
- IP Tailscale: 100.78.4.14
- Usuario: davidnows
- Home: /Users/davidnows
- Proyecto: /Users/davidnows/sinkia

### Servidor Oracle Cloud (secundario, legacy)
- Ubuntu 22.04, 23GB RAM, sin GPU
- Hostname: sinkia
- IP Tailscale: 100.91.86.75
- Usuario: ubuntu
- Ya no es el servidor principal — todo migrado al Mac Mini

### Otros dispositivos en Tailscale
- iPhone (100.64.0.2) — acceso remoto
- iMac Grout (100.75.119.119) — normalmente offline

## Mi estilo de trabajo

### Comunicación
- **Siempre en español**. No me hables en inglés
- **Directo**: Ve al grano. Nada de introducciones ni "con mucho gusto"
- **Ejecución**: Cuando digo "hazlo", hazlo. No me des 5 opciones
- **Horarios**: Trabajo a cualquier hora. Sesiones largas de madrugada son normales

### Preferencias técnicas
- Terminal heavy — prefiero CLI a GUI cuando es posible
- Git con commits descriptivos en español
- Dark theme en todo
- Tailscale para networking seguro
- PM2 para gestión de procesos
- Prefiero open-source y local sobre servicios de pago
- Modelos de IA locales siempre que sea posible (gratis > pagando)

### Lo que me importa
- Que las cosas funcionen, no que sean perfectas en el primer intento
- Iterar rápido: hacer → probar → arreglar → repetir
- Automatización máxima — si algo se puede hacer solo, que se haga solo
- UX que impresione — quiero que mi app parezca de una empresa grande
- No perder datos — backups, git commits frecuentes

### Lo que NO quiero
- Sugerencias sin acción — si sabes arreglarlo, arréglalo
- Explicaciones largas de por qué algo no funciona — dame la solución
- Que me preguntes "¿estás seguro?" — sí, estoy seguro
- Código en inglés cuando puede estar en español
- Dependencias de APIs de pago para funcionalidad core

## Mis conocimientos

### Domino
- JavaScript/Node.js (Express, NestJS)
- React + Vite + Tailwind
- Python (scripts, FastAPI)
- Bash/Shell scripting
- Docker, PM2, Nginx
- Git, GitHub Actions
- SSH, Tailscale, Cloudflare
- Ollama, LM Studio, modelos locales

### Aprendiendo
- Fine-tuning de modelos LLM
- Optimización de inferencia local (Metal, GGUF)
- Orquestación multi-agente (OpenClaw)
- Automatización de trading/inversiones
- IoT y smart home

## Contexto actual

- Acabo de migrar todo del servidor Oracle al Mac Mini
- Cloudflare Tunnel funciona y sinkialabs.com apunta al Mac
- PM2 gestiona los procesos (sinkia-api, cloudflared-tunnel, litellm-proxy)
- Aider instalado con Python 3.12 para edición de código con IA
- Claude Code v2.1.87 instalado pero no funciona bien con modelos locales
- OpenClaw en proceso de configuración como orquestador central
- El producto necesita pasar de "prototipo" a "app de pago"
