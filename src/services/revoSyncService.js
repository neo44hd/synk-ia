/**
 * REVO XEF Synchronization Service
 *
 * Gestiona la sincronización con la plataforma REVO XEF
 * para mantener actualizados los productos, precios y disponibilidad.
 *
 * Migrado: localStorage → /api/data (persistencia en servidor)
 * Entidades: revoconfig, revosyncstatus, revosyncevents
 */

import productosMapping from '@/data/productosMapping.json';

// Configuración de REVO XEF
const REVO_CONFIG = {
  baseUrl: 'https://api.revoxef.com/v1',
  tenant: 'chickenpalaceibiza2',
  storageUrl: 'https://storage.googleapis.com/revo-cloud-bucket/xef/chickenpalaceibiza2/images',
};

// Endpoints API para persistencia
const API_CACHE = '/api/data/revoconfig';
const API_STATUS = '/api/data/revosyncstatus';
const API_EVENTS = '/api/data/revosyncevents';

// Caché en memoria para productos (evita llamadas API en cada lectura)
let _productsCache = null;
let _productsCacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

// Helpers API
async function apiFetch(url, options = {}) {
  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[RevoSync] API no disponible:', err.message);
    return null;
  }
}

async function apiBulkReplace(endpoint, records) {
  return apiFetch(`${endpoint}/bulk`, {
    method: 'PUT',
    body: JSON.stringify({ records, merge: false }),
  });
}

const parsePrice = (priceStr) => {
  if (!priceStr) return 0;
  const firstPrice = priceStr.split('/')[0].trim();
  const cleaned = firstPrice
    .replace('€', '')
    .replace(/\s/g, '')
    .replace(',', '.');
  return parseFloat(cleaned) || 0;
};

const generateProductId = (categoryId, productName) => {
  const normalized = productName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '_');
  return `${categoryId}_${normalized}`;
};

const processProducts = () => {
  const products = [];
  const categoryNames = {
    comidas: { name: 'Comidas', icon: '🍗', order: 1 },
    ensaladas: { name: 'Ensaladas', icon: '🥗', order: 2 },
    complementos: { name: 'Complementos', icon: '🍟', order: 3 },
    postres: { name: 'Postres', icon: '🍰', order: 4 },
    bebidas: { name: 'Bebidas', icon: '🥤', order: 5 },
  };

  Object.entries(productosMapping.categorias).forEach(([categoryKey, categoryData]) => {
    const categoryInfo = categoryNames[categoryKey] || { name: categoryKey, icon: '📦', order: 99 };

    categoryData.productos.forEach((producto, index) => {
      const productId = generateProductId(categoryData.category_id, producto.nombre);
      const priceValue = parsePrice(producto.precio);
      const hasMultiplePrices = producto.precio?.includes('/');

      products.push({
        id: productId,
        name: producto.nombre,
        category: categoryKey,
        categoryId: categoryData.category_id,
        categoryName: categoryInfo.name,
        categoryIcon: categoryInfo.icon,
        categoryOrder: categoryInfo.order,
        price: priceValue,
        priceDisplay: producto.precio,
        hasMultiplePrices,
        image: producto.imagen_local ? `/products/${producto.imagen_local}` : null,
        imageUrl: producto.imagen_url || null,
        available: true,
        featured: index < 3 && categoryKey === 'comidas',
        sortOrder: index,
        lastSync: new Date().toISOString(),
      });
    });
  });

  return products.sort((a, b) => {
    if (a.categoryOrder !== b.categoryOrder) return a.categoryOrder - b.categoryOrder;
    return a.sortOrder - b.sortOrder;
  });
};

const RevoSyncService = {
  /**
   * Obtiene todos los productos (caché en memoria + API)
   */
  getProducts: async () => {
    // Comprobar caché en memoria
    if (_productsCache && (Date.now() - _productsCacheTimestamp < CACHE_TTL)) {
      return _productsCache;
    }

    // Intentar cargar del servidor
    try {
      const result = await apiFetch(`${API_CACHE}?sort=-created_date&limit=1`);
      const cached = result?.data?.[0];
      if (cached?.products && cached?.timestamp) {
        if (Date.now() - cached.timestamp < CACHE_TTL) {
          _productsCache = cached.products;
          _productsCacheTimestamp = cached.timestamp;
          return _productsCache;
        }
      }
    } catch (e) {
      console.warn('[RevoSync] Error leyendo caché API:', e.message);
    }

    // Procesar productos del mapping
    const products = processProducts();
    _productsCache = products;
    _productsCacheTimestamp = Date.now();

    // Guardar en API
    await apiBulkReplace(API_CACHE, [{
      id: 'revo_products_cache',
      products,
      timestamp: Date.now(),
    }]);

    return products;
  },

  getProductsByCategory: async (category) => {
    const products = await RevoSyncService.getProducts();
    if (!category || category === 'all') return products;
    return products.filter(p => p.category === category);
  },

  getCategories: () => {
    const categoryNames = {
      comidas: { name: 'Comidas', icon: '🍗', order: 1 },
      ensaladas: { name: 'Ensaladas', icon: '🥗', order: 2 },
      complementos: { name: 'Complementos', icon: '🍟', order: 3 },
      postres: { name: 'Postres', icon: '🍰', order: 4 },
      bebidas: { name: 'Bebidas', icon: '🥤', order: 5 },
    };

    return Object.entries(productosMapping.categorias).map(([key, data]) => ({
      id: key,
      categoryId: data.category_id,
      name: categoryNames[key]?.name || key,
      icon: categoryNames[key]?.icon || '📦',
      order: categoryNames[key]?.order || 99,
      productCount: data.productos.length,
    })).sort((a, b) => a.order - b.order);
  },

  getFeaturedProducts: async () => {
    const products = await RevoSyncService.getProducts();
    return products.filter(p => p.featured);
  },

  searchProducts: async (query) => {
    if (!query || query.length < 2) return [];

    const products = await RevoSyncService.getProducts();
    const normalizedQuery = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    return products.filter(p => {
      const normalizedName = p.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return normalizedName.includes(normalizedQuery);
    });
  },

  updateProduct: async (productId, updates) => {
    const products = await RevoSyncService.getProducts();
    const productIndex = products.findIndex(p => p.id === productId);

    if (productIndex === -1) {
      throw new Error('Producto no encontrado');
    }

    products[productIndex] = {
      ...products[productIndex],
      ...updates,
      lastSync: new Date().toISOString(),
    };

    // Actualizar caché en memoria y API
    _productsCache = products;
    _productsCacheTimestamp = Date.now();
    await apiBulkReplace(API_CACHE, [{
      id: 'revo_products_cache',
      products,
      timestamp: Date.now(),
    }]);

    await RevoSyncService.logSyncEvent('product_update', { productId, updates });

    return products[productIndex];
  },

  toggleProductAvailability: async (productId) => {
    const products = await RevoSyncService.getProducts();
    const product = products.find(p => p.id === productId);

    if (!product) {
      throw new Error('Producto no encontrado');
    }

    return RevoSyncService.updateProduct(productId, {
      available: !product.available
    });
  },

  updateProductPrice: async (productId, newPrice) => {
    return RevoSyncService.updateProduct(productId, {
      price: parseFloat(newPrice),
      priceDisplay: `${parseFloat(newPrice).toFixed(2).replace('.', ',')} €`,
    });
  },

  forceSync: async () => {
    // Limpiar caché
    _productsCache = null;
    _productsCacheTimestamp = 0;

    const products = processProducts();
    _productsCache = products;
    _productsCacheTimestamp = Date.now();

    // Guardar productos en API
    await apiBulkReplace(API_CACHE, [{
      id: 'revo_products_cache',
      products,
      timestamp: Date.now(),
    }]);

    // Guardar estado de sincronización en API
    const syncStatus = {
      id: 'revo_sync_status',
      lastSync: new Date().toISOString(),
      status: 'success',
      productCount: products.length,
    };

    await apiBulkReplace(API_STATUS, [syncStatus]);
    await RevoSyncService.logSyncEvent('force_sync', syncStatus);

    return syncStatus;
  },

  getSyncStatus: async () => {
    try {
      const result = await apiFetch(`${API_STATUS}/revo_sync_status`);
      return result?.data || null;
    } catch (e) {
      console.warn('[RevoSync] Error leyendo estado sync:', e.message);
      return null;
    }
  },

  logSyncEvent: async (eventType, data) => {
    try {
      await apiFetch(API_EVENTS, {
        method: 'POST',
        body: JSON.stringify({
          type: eventType,
          data,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (e) {
      console.warn('[RevoSync] Error registrando evento:', e.message);
    }
  },

  getSyncEvents: async (limit = 20) => {
    try {
      const result = await apiFetch(`${API_EVENTS}?sort=-created_date&limit=${limit}`);
      return result?.data || [];
    } catch (e) {
      console.warn('[RevoSync] Error leyendo eventos:', e.message);
      return [];
    }
  },

  getBusinessInfo: () => ({
    name: 'Chicken Palace',
    address: 'C/ Sant Jaume, 52, 07800 Ibiza',
    phone: '+34 971 39 30 82',
    email: 'info@chickenpalace.es',
    website: 'https://www.chickenpalace.es',
    schedule: {
      weekdays: '12:00 - 23:00',
      saturday: '12:00 - 00:00',
      sunday: '12:00 - 22:00',
    },
    deliveryZones: ['Ibiza centro', 'Playa d\'en Bossa', 'Figueretas', 'Talamanca'],
    minimumOrder: 15,
    deliveryFee: 2.50,
  }),

  getMetadata: () => productosMapping.metadata,
};

export default RevoSyncService;
