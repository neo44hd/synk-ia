/**
 * SINKIA COMMERCE API ROUTES
 * Endpoints for dashboard, catalog, and orders
 */

import express from 'express';
import CommerceServer from '../services/commerceServer.js';

const router = express.Router();

const commerce = new CommerceServer();

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DASHBOARD ENDPOINTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * GET /api/commerce/dashboard/stats
 * Returns real-time dashboard statistics
 */
router.get('/dashboard/stats', (req, res) => {
  try {
    const stats = commerce.getDefaultStats();
    res.json(stats);
  } catch (err) {
    console.error('Commerce stats error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CATALOG ENDPOINTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * GET /api/commerce/catalog/menu
 * Returns product catalog with groups and items
 */
router.get('/catalog/menu', (req, res) => {
  try {
    const menu = commerce.getMenu();
    res.json(menu);
  } catch (err) {
    console.error('Commerce menu error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ORDERS ENDPOINTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * GET /api/commerce/orders
 * Returns list of recent orders
 */
router.get('/orders', (req, res) => {
  try {
    const orders = commerce.getOrders();
    res.json({
      success: true,
      total: orders.length,
      data: orders.slice(0, 20) // Return last 20 orders
    });
  } catch (err) {
    console.error('Commerce orders list error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/commerce/orders
 * Create a new order
 * Body: { type, items, total, customer, notes }
 */
router.post('/orders', express.json(), (req, res) => {
  try {
    const orderData = req.body;
    
    // Validation
    if (!orderData.items || !Array.isArray(orderData.items) || orderData.items.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'items is required and must be a non-empty array' 
      });
    }
    
    if (!orderData.total || orderData.total <= 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'total must be a positive number' 
      });
    }

    const order = commerce.createOrder(orderData);
    res.status(201).json({
      success: true,
      data: order,
      message: 'Order created successfully'
    });
  } catch (err) {
    console.error('Commerce order creation error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/commerce/orders/:id
 * Get a specific order by ID
 */
router.get('/orders/:id', (req, res) => {
  try {
    const orders = commerce.getOrders();
    const order = orders.find(o => o.id === req.params.id);
    
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    res.json({ success: true, data: order });
  } catch (err) {
    console.error('Commerce order get error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PATCH /api/commerce/orders/:id
 * Update order status
 * Body: { status: 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled' }
 */
router.patch('/orders/:id', express.json(), (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'preparing', 'ready', 'completed', 'cancelled'];
    
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ 
        success: false, 
        error: `status must be one of: ${validStatuses.join(', ')}` 
      });
    }

    const orders = commerce.getOrders();
    const index = orders.findIndex(o => o.id === req.params.id);
    
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    orders[index].status = status;
    orders[index].updated_at = new Date().toISOString();
    commerce.saveOrders(orders);

    res.json({ 
      success: true, 
      data: orders[index],
      message: `Order status updated to ${status}` 
    });
  } catch (err) {
    console.error('Commerce order update error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/commerce/health
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    version: '2.1.0'
  });
});

export default router;
