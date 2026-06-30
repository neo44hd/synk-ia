/**
 * SINKIA COMMERCE SERVER
 * Tienda online con dashboard, gestión de pedidos y catálogo
 * 
 * APIs:
 * - GET /api/dashboard/stats
 * - GET /api/catalog/menu
 * - GET /api/orders (list)
 * - POST /api/orders (create)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DATA MANAGEMENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class CommerceServer {
  constructor() {
    this.dataDir = path.join(__dirname, '../../data/commerce');
    this.ordersFile = path.join(this.dataDir, 'orders.json');
    this.statsFile = path.join(this.dataDir, 'stats.json');
    
    // Ensure directories exist
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    
    // Initialize data
    this.initializeData();
    this.startTime = Date.now();
  }

  initializeData() {
    // Load or create orders
    if (!fs.existsSync(this.ordersFile)) {
      fs.writeFileSync(this.ordersFile, JSON.stringify([], null, 2));
    }
    
    // Load or create stats
    if (!fs.existsSync(this.statsFile)) {
      fs.writeFileSync(this.statsFile, JSON.stringify({
        system: {
          version: '2.1.0',
          verifactuMode: 'REAL',
          uptimeHuman: '24h 0m'
        }
      }, null, 2));
    }
  }

  // ── Orders Management ──
  getOrders() {
    try {
      const data = fs.readFileSync(this.ordersFile, 'utf8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  saveOrders(orders) {
    fs.writeFileSync(this.ordersFile, JSON.stringify(orders, null, 2));
  }

  createOrder(orderData) {
    const orders = this.getOrders();
    const order = {
      id: `ORD-${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: orderData.type || 'web',
      items: orderData.items || [],
      total: orderData.total || 0,
      status: 'pending',
      customer: orderData.customer || {},
      notes: orderData.notes || ''
    };
    orders.unshift(order);
    this.saveOrders(orders.slice(0, 100)); // Keep last 100 orders
    return order;
  }

  // ── Stats Management ──
  getStats() {
    try {
      const data = fs.readFileSync(this.statsFile, 'utf8');
      return JSON.parse(data);
    } catch {
      return this.getDefaultStats();
    }
  }

  getDefaultStats() {
    const orders = this.getOrders();
    const uptime = Date.now() - this.startTime;
    const hours = Math.floor(uptime / (1000 * 60 * 60));
    const mins = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));

    return {
      success: true,
      data: {
        system: {
          version: '2.1.0',
          verifactuMode: 'REAL',
          uptimeHuman: `${hours}h ${mins}m`,
          status: 'online',
          lastUpdated: new Date().toISOString()
        },
        dashboard: {
          status: 'online',
          orders_open: orders.filter(o => o.status === 'pending').length,
          orders_today: orders.filter(o => {
            const today = new Date().toDateString();
            return new Date(o.timestamp).toDateString() === today;
          }).length,
          total_revenue: orders.reduce((sum, o) => sum + (o.total || 0), 0)
        },
        catalog: {
          products: 152,
          groups: 12,
          last_sync: new Date(Date.now() - 3600000).toISOString()
        },
        sales: {
          today: Math.floor(Math.random() * 2000) + 500,
          this_week: Math.floor(Math.random() * 8000) + 2000,
          this_month: Math.floor(Math.random() * 40000) + 10000
        },
        cash_register: {
          open: true,
          balance: Math.floor(Math.random() * 500) + 100,
          transactions: Math.floor(Math.random() * 50) + 10
        }
      }
    };
  }

  // ── Catalog Management ──
  getMenu() {
    // Real products from Revo - Chicken Palace Ibiza
    const menu = {
      success: true,
      data: {
        groups: [
          {
            id: 'carnes',
            name: '🥩 Carnes a la Parrilla',
            description: 'Selección premium de carnes asadas',
            products: [
              { id: 99, name: 'TIRA ASADO', price: 8.00, image: '🥩', description: 'Tira de asado argentino' },
              { id: 100, name: 'ENTRAÑA', price: 7.00, image: '🥩', description: 'Corte de entraña tierno' },
              { id: 103, name: 'COSTILLAR TERNERA', price: 8.00, image: '🥩', description: 'Costillar de ternera' }
            ]
          },
          {
            id: 'arroces',
            name: '🍚 Arroces y Paellas',
            description: 'Auténticas paellas valencianas',
            products: [
              { id: 105, name: 'PAELLA VALENCIANA RACION', price: 7.50, image: '🍚', description: 'Paella valenciana con conejo y judías verdes' },
              { id: 107, name: 'PAELLA MIXTA RACION', price: 7.80, image: '🍚', description: 'Paella mixta con marisco y carne' },
              { id: 108, name: 'ARROZ A BANDA RACION', price: 7.50, image: '🍚', description: 'Arroz a banda con pescado' },
              { id: 106, name: '1/2 RACION ARROZ', price: 5.50, image: '🍚', description: 'Media ración de arroz' }
            ]
          },
          {
            id: 'pastas',
            name: '🍝 Pastas y Lasañas',
            description: 'Pastas italianas frescas',
            products: [
              { id: 101, name: 'LASAÑA MARISCO Y PESCADO', price: 12.00, image: '🍝', description: 'Lasaña con marisco y pescado fresco' },
              { id: 102, name: 'LASAÑA VEGETAL Y QUESO', price: 10.00, image: '🍝', description: 'Lasaña vegetariana con queso gratinado' },
              { id: 104, name: 'LASAÑA CARNE Y QUESO', price: 11.00, image: '🍝', description: 'Lasaña de carne y queso' }
            ]
          },
          {
            id: 'bebidas',
            name: '🥤 Bebidas',
            description: 'Refrescos y bebidas',
            products: [
              { id: 1, name: 'Agua Mineral', price: 2.00, image: '💧', description: 'Agua mineral sin gas' },
              { id: 2, name: 'Coca Cola', price: 2.50, image: '🥤', description: 'Refresco Coca Cola' },
              { id: 3, name: 'Cerveza Moritz', price: 3.00, image: '🍺', description: 'Cerveza Moritz 33cl' }
            ]
          }
        ]
      }
    };
    return menu;
  }
}

export default CommerceServer;
