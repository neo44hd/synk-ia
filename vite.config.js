import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// FIXES aplicados:
// 1. server.proxy → las llamadas /api/* en dev van a Express en :3001
//    Sin esto, fetch('/api/revo/products') da 404 en desarrollo
// 2. allowedHosts: true → eliminado (riesgo DNS rebinding)
//    Reemplazado por allowedHosts específicos
// 3. build.rollupOptions → code splitting manual (chunks más pequeños)
// 4. build.chunkSizeWarningLimit aumentado para evitar falsos avisos

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  server: {
    port: 5173,

    // FIX 1: Proxy API calls al backend Express
    proxy: {
      '/api': {
        target:       'http://localhost:3001',
        changeOrigin: true,
        secure:       false,
        // Opcional: logging de proxied requests en dev
        configure: (proxy) => {
          proxy.on('error', (err) => console.error('[proxy]', err.message));
        },
      },
    },

    // FIX 2: allowedHosts específicos (no 'true')
    // Añade aquí tus dominios de staging si los tienes
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      'sinkialabs.com',
      '.sinkialabs.com',    // subdomains
    ],

    // HMR a través de Tailscale o SSH tunnel
    hmr: { overlay: true },
  },

  build: {
    outDir:   'dist',
    sourcemap: false,  // true en staging, false en producción

    rollupOptions: {
      output: {
        // FIX 3: Code splitting → chunks más pequeños, carga más rápida
        manualChunks: {
          // React core
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],

          // UI components
          'ui-vendor': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-accordion',
            '@radix-ui/react-select',
            '@radix-ui/react-tabs',
          ],

          // Charts
          'charts': ['recharts'],

          // Animations
          'motion': ['framer-motion'],

          // Forms
          'forms': ['react-hook-form', 'zod'],

          // Utils
          'utils': ['dayjs', 'clsx', 'class-variance-authority'],
        },
      },
    },

    // FIX 4: Aviso de chunk grande (el proyecto tiene chunks legítimamente grandes)
    chunkSizeWarningLimit: 600,
  },

  // Optimización de dependencias prebuilding
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@tanstack/react-query',
      'dayjs',
    ],
    // Excluir las librerías de fecha redundantes para que no se pre-bundlen
    exclude: ['moment'],
  },
});
