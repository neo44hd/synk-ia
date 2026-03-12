# 🚀 SYNK-IA - Guía de Despliegue

> **Fecha de actualización:** 12 de Marzo de 2026  
> **Versión:** 2.0 (con correcciones aplicadas)

---

## 📋 Resumen

Esta guía explica cómo desplegar SYNK-IA en diferentes plataformas:
1. **Vercel** (desde GitHub)
2. **Netlify** (desde GitHub)
3. **Despliegue Manual** (usando el ZIP)

---

## 🔧 Variables de Entorno

Esta aplicación **no requiere variables de entorno adicionales** para el despliegue básico.

La configuración de Base44 SDK ya está integrada en el código:
```javascript
// src/api/base44Client.js
appId: "6909eb511f749a49b63df48c"
```

---

## 📁 Estructura del Build

```
dist/
├── index.html          # Página principal
├── assets/
│   ├── index-*.css     # Estilos compilados
│   └── index-*.js      # JavaScript compilado
└── products/           # Imágenes de productos
```

---

## 🟣 Opción 1: Desplegar en Vercel (desde GitHub)

### Paso 1: Preparar el Repositorio
1. Sube el proyecto a un repositorio de GitHub
2. Asegúrate de incluir los archivos:
   - `package.json`
   - `vite.config.js`
   - `src/` (código fuente)
   - `public/` (archivos estáticos)

### Paso 2: Conectar con Vercel
1. Ve a [vercel.com](https://vercel.com) e inicia sesión
2. Haz clic en **"Add New Project"**
3. Importa tu repositorio de GitHub
4. Selecciona el repositorio de SYNK-IA

### Paso 3: Configurar el Build
| Configuración | Valor |
|---------------|-------|
| **Framework Preset** | Vite |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |
| **Install Command** | `npm install` |

### Paso 4: Desplegar
1. Haz clic en **"Deploy"**
2. Espera a que termine el build (aproximadamente 2-3 minutos)
3. ¡Listo! Tu aplicación estará disponible en `tu-proyecto.vercel.app`

### Configuración para SPA (Single Page Application)
Crea un archivo `vercel.json` en la raíz del proyecto:
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

---

## 🟢 Opción 2: Desplegar en Netlify (desde GitHub)

### Paso 1: Preparar el Repositorio
Similar a Vercel, sube el proyecto a GitHub.

### Paso 2: Conectar con Netlify
1. Ve a [netlify.com](https://netlify.com) e inicia sesión
2. Haz clic en **"Add new site"** → **"Import an existing project"**
3. Selecciona GitHub y autoriza el acceso
4. Elige tu repositorio de SYNK-IA

### Paso 3: Configurar el Build
| Configuración | Valor |
|---------------|-------|
| **Build Command** | `npm run build` |
| **Publish Directory** | `dist` |

### Paso 4: Desplegar
1. Haz clic en **"Deploy site"**
2. Netlify construirá y desplegará automáticamente
3. Obtendrás una URL como `random-name.netlify.app`

### Configuración para SPA (Single Page Application)
Crea un archivo `netlify.toml` en la raíz del proyecto:
```toml
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

O crea un archivo `public/_redirects`:
```
/*    /index.html   200
```

---

## 📦 Opción 3: Despliegue Manual con ZIP

### Archivos disponibles:
- **ZIP de despliegue:** `/home/ubuntu/synkia_deploy_v2.zip`
- **Tamaño:** ~19 MB

### Para hosting estático (Apache, Nginx, etc.)

#### Paso 1: Extraer el ZIP
```bash
unzip synkia_deploy_v2.zip
```

#### Paso 2: Subir contenido de `dist/`
Sube TODO el contenido de la carpeta `dist/` a tu servidor web:
- `index.html`
- `assets/` (carpeta completa)
- `products/` (carpeta completa)

#### Paso 3: Configurar redirecciones SPA

**Para Apache** (`.htaccess` en la raíz):
```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

**Para Nginx** (en la configuración del servidor):
```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

### Para Netlify Drop (sin GitHub)
1. Ve a [app.netlify.com/drop](https://app.netlify.com/drop)
2. Extrae el ZIP localmente
3. Arrastra la carpeta `dist/` a la página
4. ¡Listo! Obtendrás una URL inmediatamente

### Para Vercel CLI
```bash
# Instalar Vercel CLI
npm install -g vercel

# Extraer el ZIP
unzip synkia_deploy_v2.zip

# Desplegar
cd dist
vercel --prod
```

---

## 🔄 Actualizar Despliegue Existente

### En Vercel/Netlify (con GitHub)
- Simplemente haz push de los cambios a GitHub
- El despliegue se actualiza automáticamente

### Manualmente
1. Ejecuta el build: `npm run build`
2. Sube el nuevo contenido de `dist/` al servidor

---

## ⚠️ Notas Importantes

1. **SPA Routing:** Esta es una Single Page Application. SIEMPRE configura las redirecciones para evitar errores 404 en rutas directas.

2. **CORS:** Si experimentas problemas de CORS con la API de Base44, verifica que tu dominio esté autorizado en el dashboard de Base44.

3. **Caché:** Después de actualizar, puede ser necesario limpiar la caché del navegador (Ctrl+F5).

4. **SSL/HTTPS:** Se recomienda usar HTTPS. Tanto Vercel como Netlify lo proporcionan automáticamente.

---

## 📞 Soporte

- **Base44 Dashboard:** [app.base44.com](https://app.base44.com)
- **Documentación Base44:** [docs.base44.com](https://docs.base44.com)
- **Soporte:** support@base44.com

---

## 🎯 Resumen Rápido

| Plataforma | Build Command | Output | Tiempo estimado |
|------------|---------------|--------|-----------------|
| Vercel | `npm run build` | `dist` | 2-3 min |
| Netlify | `npm run build` | `dist` | 2-3 min |
| Manual | ZIP ya listo | `dist/` | 1 min |
