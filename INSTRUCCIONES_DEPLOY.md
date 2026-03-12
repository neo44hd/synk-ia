# 🚀 SYNK-IA - Guía de Despliegue

> **Proyecto:** SYNK-IA - Sistema de Gestión Integral  
> **Empresa:** Chicken Palace Ibiza  
> **Autor:** David Roldan

---

## 📋 Resumen

Esta guía explica cómo desplegar SYNK-IA en diferentes plataformas:
1. **Vercel** (desde GitHub)
2. **Netlify** (desde GitHub)
3. **Despliegue Manual** (usando el ZIP)

---

## 🔧 Variables de Entorno

Esta aplicación **no requiere variables de entorno adicionales** para el despliegue básico.

La aplicación utiliza almacenamiento local (localStorage) para persistir datos, sin necesidad de backend externo.

---

## 📁 Estructura del Build

```
dist/
├── index.html          # Página principal
├── assets/
│   ├── index-*.css     # Estilos compilados
│   └── index-*.js      # JavaScript compilado
└── products/           # Imágenes de productos (si aplica)
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
Ya existe un archivo `vercel.json` en la raíz del proyecto con la configuración correcta.

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

Ya existe `netlify.toml` y `public/_redirects` configurados para SPA.

---

## 📦 Opción 3: Despliegue Manual con ZIP

### Para hosting estático (Apache, Nginx, etc.)

#### Paso 1: Construir el proyecto
```bash
npm install
npm run build
```

#### Paso 2: Subir contenido de `dist/`
Sube TODO el contenido de la carpeta `dist/` a tu servidor web.

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

---

## ⚠️ Notas Importantes

1. **SPA Routing:** Esta es una Single Page Application. SIEMPRE configura las redirecciones para evitar errores 404 en rutas directas.

2. **Datos Locales:** Los datos se almacenan en localStorage del navegador. Se persisten entre sesiones pero son específicos por navegador/dispositivo.

3. **Caché:** Después de actualizar, puede ser necesario limpiar la caché del navegador (Ctrl+F5).

4. **SSL/HTTPS:** Se recomienda usar HTTPS. Tanto Vercel como Netlify lo proporcionan automáticamente.

---

## 📞 Soporte

Para soporte técnico contactar con:

**David Roldan**  
Chicken Palace Ibiza

---

## 🎯 Resumen Rápido

| Plataforma | Build Command | Output | Tiempo estimado |
|------------|---------------|--------|-----------------|
| Vercel | `npm run build` | `dist` | 2-3 min |
| Netlify | `npm run build` | `dist` | 2-3 min |
| Manual | `npm run build` | `dist/` | 1 min |

---

© 2024 David Roldan - Chicken Palace Ibiza  
*Futuro: SYNK-IA LABS*
