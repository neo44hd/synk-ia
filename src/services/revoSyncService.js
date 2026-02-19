/**
 * REVO XEF Synchronization Service
 * 
 * Este servicio gestiona la sincronización con la plataforma REVO XEF
 * para mantener actualizados los productos, precios y disponibilidad.
 */

import productosMapping from '@/data/productosMapping.json';

// Configuración de REVO XEF
const REVO_CONFIG = {
  baseUrl: 'https://api.revoxef.com/v1',
  tenant: 'chickenpalaceibiza2',
  storageUrl: 'https://storage.googleapis.com/revo-cloud-bucket/xef/chickenpalaceibiza2/images',
};

// Cache local para productos
const STORAGE_KEY = 'revo_products_cache';
const SYNC_STATUS_KEY = 'revo_sync_status';

/**
 * Parsea el precio del formato español al número
 */
const parsePrice = (priceStr) => {
  if (!priceStr) return 0;
  
  // Si tiene dos precios (ej: "8,00 € / 11,00 €"), tomar el primero
  const firstPrice = priceStr.split('/')[0].trim();
  
  // Limpiar el precio
  const cleaned = firstPrice
    .replace('€', '')
    .replace(/\s/g, '')
    .replace(',', '.');
  
  return parseFloat(cleaned) || 0;
};

/**
 * Genera un ID único para un producto
 */
const generateProductId = (categoryId, productName) => {
  const normalized = productName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '_');
  return `${categoryId}_${normalized}`;
};

/**
 * Procesa los productos del mapping y los convierte al formato interno
 */
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

/**
 * Servicio principal de sincronización con REVO XEF
 */
const RevoSyncService = {
  /**
   * Obtiene todos los productos procesados
   */
  getProducts: () => {
    try {
      // Intentar obtener del cache local primero
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        const { products, timestamp } = JSON.parse(cached);
        // Cache válido por 5 minutos
        if (Date.now() - timestamp < 5 * 60 * 1000) {
          return products;
        }
      }
    } catch (e) {
      console.warn('Error reading from cache:', e);
    }

    // Procesar productos del mapping
    const products = processProducts();
    
    // Guardar en cache
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        products,
        timestamp: Date.now(),
      }));
    } catch (e) {
      console.warn('Error saving to cache:', e);
    }

    return products;
  },

  /**
   * Obtiene productos por categoría
   */
  getProductsByCategory: (category) => {
    const products = RevoSyncService.getProducts();
    if (!category || category === 'all') return products;
    return products.filter(p => p.category === category);
  },

  /**
   * Obtiene las categorías disponibles
   */
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

  /**
   * Obtiene productos destacados
   */
  getFeaturedProducts: () => {
    const products = RevoSyncService.getProducts();
    return products.filter(p => p.featured);
  },

  /**
   * Busca productos por nombre
   */
  searchProducts: (query) => {
    if (!query || query.length < 2) return [];
    
    const products = RevoSyncService.getProducts();
    const normalizedQuery = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    
    return products.filter(p => {
      const normalizedName = p.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return normalizedName.includes(normalizedQuery);
    });
  },

  /**
   * Actualiza un producto (sincronización local)
   */
  updateProduct: async (productId, updates) => {
    const products = RevoSyncService.getProducts();
    const productIndex = products.findIndex(p => p.id === productId);
    
    if (productIndex === -1) {
      throw new Error('Producto no encontrado');
    }

    products[productIndex] = {
      ...products[productIndex],
      ...updates,
      lastSync: new Date().toISOString(),
    };

    // Guardar en cache
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      products,
      timestamp: Date.now(),
    }));

    // Registrar la actualización para sincronización
    RevoSyncService.logSyncEvent('product_update', { productId, updates });

    return products[productIndex];
  },

  /**
   * Cambia la disponibilidad de un producto
   */
  toggleProductAvailability: async (productId) => {
    const products = RevoSyncService.getProducts();
    const product = products.find(p => p.id === productId);
    
    if (!product) {
      throw new Error('Producto no encontrado');
    }

    return RevoSyncService.updateProduct(productId, { 
      available: !product.available 
    });
  },

  /**
   * Actualiza el precio de un producto
   */
  updateProductPrice: async (productId, newPrice) => {
    return RevoSyncService.updateProduct(productId, {
      price: parseFloat(newPrice),
      priceDisplay: `${parseFloat(newPrice).toFixed(2).replace('.', ',')} €`,
    });
  },

  /**
   * Fuerza la resincronización con REVO XEF
   */
  forceSync: async () => {
    // Limpiar cache
    localStorage.removeItem(STORAGE_KEY);
    
    // Obtener productos frescos
    const products = processProducts();
    
    // Guardar en cache
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      products,
      timestamp: Date.now(),
    }));

    // Actualizar estado de sincronización
    const syncStatus = {
      lastSync: new Date().toISOString(),
      status: 'success',
      productCount: products.length,
    };
    
    localStorage.setItem(SYNC_STATUS_KEY, JSON.stringify(syncStatus));
    
    RevoSyncService.logSyncEvent('force_sync', syncStatus);

    return syncStatus;
  },

  /**
   * Obtiene el estado de la última sincronización
   */
  getSyncStatus: () => {
    try {
      const status = localStorage.getItem(SYNC_STATUS_KEY);
      return status ? JSON.parse(status) : null;
    } catch (e) {
      return null;
    }
  },

  /**
   * Registra eventos de sincronización para auditoría
   */
  logSyncEvent: (eventType, data) => {
    try {
      const events = JSON.parse(localStorage.getItem('revo_sync_events') || '[]');
      events.push({
        type: eventType,
        data,
        timestamp: new Date().toISOString(),
      });
      
      // Mantener solo los últimos 100 eventos
      if (events.length > 100) {
        events.splice(0, events.length - 100);
      }
      
      localStorage.setItem('revo_sync_events', JSON.stringify(events));
    } catch (e) {
      console.warn('Error logging sync event:', e);
    }
  },

  /**
   * Obtiene los eventos de sincronización
   */
  getSyncEvents: (limit = 20) => {
    try {
      const events = JSON.parse(localStorage.getItem('revo_sync_events') || '[]');
      return events.slice(-limit).reverse();
    } catch (e) {
      return [];
    }
  },

  /**
   * Información del negocio
   */
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

  /**
   * Obtiene la metadata del catálogo
   */
  getMetadata: () => productosMapping.metadata,
};

export default RevoSyncService;
