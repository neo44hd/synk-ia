/**
 * WhatsApp Business Service for SYNK-IA
 * Gestiona mensajería WhatsApp, notificaciones y comunicaciones de pedidos
 * Migrado: localStorage → /api/data (persistencia en servidor)
 * Entidades: whatsappconfig, whatsappmessage, order (existente)
 */

const API_CONFIG = '/api/data/whatsappconfig';
const API_MESSAGES = '/api/data/whatsappmessage';
const API_ORDERS = '/api/data/order';

// Caché en memoria
let _configCache = null;
let _messagesCache = null;

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
    console.warn('[WhatsApp] API no disponible:', err.message);
    return null;
  }
}

async function apiBulkReplace(endpoint, records) {
  return apiFetch(`${endpoint}/bulk`, {
    method: 'PUT',
    body: JSON.stringify({ records, merge: false }),
  });
}

// Configuración por defecto
const defaultConfig = {
  businessPhone: '+34 600 000 000',
  businessName: 'Chicken Palace',
  ceoPhone: '',
  kitchenPhone: '',
  apiProvider: 'whatsapp-web',
  twilioAccountSid: '',
  twilioAuthToken: '',
  metaAccessToken: '',
  metaPhoneNumberId: '',
  autoNotifyCustomer: true,
  autoNotifyCeo: true,
  autoNotifyKitchen: true,
  welcomeMessage: '¡Gracias por tu pedido en {businessName}! 🍗',
  pickupMessage: 'Tu pedido estará listo para recoger en nuestra dirección: {address}',
  deliveryMessage: 'Tu pedido llegará a tu dirección aproximadamente en {estimatedTime} minutos.',
  orderConfirmTemplate: `🍗 *{businessName}*\n\n¡Hola {customerName}!\n\n✅ *PEDIDO CONFIRMADO*\nNº Pedido: #{orderNumber}\n\n📋 *Tu pedido:*\n{products}\n\n💰 *Total: {total}€*\n\n⏰ Hora estimada: {pickupTime}\n📍 Tipo: {orderType}\n{deliveryAddress}\n\n¡Gracias por confiar en nosotros! 🙏`,
  ceoAlertTemplate: `🚨 *NUEVO PEDIDO* 🚨\n\nNº Pedido: #{orderNumber}\n\n👤 Cliente: {customerName}\n📞 Teléfono: {customerPhone}\n\n📋 *Productos:*\n{products}\n\n💰 *Total: {total}€*\n\n📍 Tipo: {orderType}\n⏰ Hora: {pickupTime}\n{deliveryAddress}\n\n🔗 Ver en SYNK-IA: {orderLink}`,
  kitchenAlertTemplate: `🔔 *PEDIDO #{orderNumber}*\n\n📋 *Preparar:*\n{products}\n\n⏰ Para: {pickupTime}\n📍 Tipo: {orderType}`,
};

class WhatsAppService {
  constructor() {
    this.config = { ...defaultConfig };
    this.messages = [];
    this._initialized = false;
  }

  async _ensureLoaded() {
    if (this._initialized) return;
    this._initialized = true;
    this.config = await this.loadConfig();
    this.messages = await this.loadMessages();
  }

  // ============ Configuration Management ============

  async loadConfig() {
    if (_configCache) return _configCache;
    try {
      const result = await apiFetch(`${API_CONFIG}/wa_config`);
      if (result?.data) {
        _configCache = { ...defaultConfig, ...result.data };
        return _configCache;
      }
    } catch (e) {
      console.warn('[WhatsApp] Error cargando config:', e.message);
    }
    return { ...defaultConfig };
  }

  async saveConfig(config) {
    this.config = { ...this.config, ...config };
    _configCache = this.config;
    await apiBulkReplace(API_CONFIG, [{ id: 'wa_config', ...this.config }]);
    return this.config;
  }

  async getConfig() {
    await this._ensureLoaded();
    return { ...this.config };
  }

  // ============ Message History ============

  async loadMessages() {
    if (_messagesCache) return _messagesCache;
    try {
      const result = await apiFetch(`${API_MESSAGES}?sort=-created_date&limit=500`);
      _messagesCache = result?.data || [];
      return _messagesCache;
    } catch (e) {
      console.warn('[WhatsApp] Error cargando mensajes:', e.message);
      return [];
    }
  }

  async saveMessage(message) {
    await this._ensureLoaded();
    this.messages.unshift(message);
    this.messages = this.messages.slice(0, 500);
    _messagesCache = this.messages;

    // Guardar mensaje individual en API
    await apiFetch(API_MESSAGES, {
      method: 'POST',
      body: JSON.stringify(message),
    });
    return message;
  }

  async getMessages(filters = {}) {
    await this._ensureLoaded();
    let filtered = [...this.messages];

    if (filters.phone) {
      filtered = filtered.filter(m => m.to === filters.phone || m.from === filters.phone);
    }
    if (filters.orderId) {
      filtered = filtered.filter(m => m.orderId === filters.orderId);
    }
    if (filters.status) {
      filtered = filtered.filter(m => m.status === filters.status);
    }
    if (filters.type) {
      filtered = filtered.filter(m => m.type === filters.type);
    }
    if (filters.dateFrom) {
      filtered = filtered.filter(m => new Date(m.timestamp) >= new Date(filters.dateFrom));
    }
    if (filters.dateTo) {
      filtered = filtered.filter(m => new Date(m.timestamp) <= new Date(filters.dateTo));
    }

    return filtered;
  }

  // ============ Phone Number Utilities ============

  formatPhoneNumber(phone) {
    if (!phone) return null;
    let cleaned = phone.replace(/[^\d+]/g, '');
    if (!cleaned.startsWith('+')) {
      if (cleaned.startsWith('34')) {
        cleaned = '+' + cleaned;
      } else {
        cleaned = '+34' + cleaned;
      }
    }
    return cleaned;
  }

  validatePhoneNumber(phone) {
    const formatted = this.formatPhoneNumber(phone);
    if (!formatted) return { valid: false, error: 'Número de teléfono requerido' };

    const digits = formatted.replace(/\D/g, '');
    if (digits.length < 9) {
      return { valid: false, error: 'Número de teléfono muy corto' };
    }
    if (digits.length > 15) {
      return { valid: false, error: 'Número de teléfono muy largo' };
    }

    return { valid: true, formatted };
  }

  // ============ Message Formatting ============

  formatOrderProducts(items) {
    return items.map(item =>
      `• ${item.quantity}x ${item.name} - ${(item.price * item.quantity).toFixed(2)}€`
    ).join('\n');
  }

  generateOrderNumber() {
    const now = new Date();
    const dateStr = now.toISOString().slice(0,10).replace(/-/g, '');
    const timeStr = now.getHours().toString().padStart(2, '0') + now.getMinutes().toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 100).toString().padStart(2, '0');
    return `${dateStr}${timeStr}${random}`;
  }

  formatMessage(template, data) {
    let message = template;

    Object.keys(data).forEach(key => {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      message = message.replace(regex, data[key] || '');
    });

    return message;
  }

  // ============ WhatsApp API Integration ============

  async sendMessage(to, body, options = {}) {
    await this._ensureLoaded();
    const formattedPhone = this.formatPhoneNumber(to);
    if (!formattedPhone) {
      return { success: false, error: 'Número de teléfono inválido' };
    }

    const message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      to: formattedPhone,
      from: this.config.businessPhone,
      body,
      type: options.type || 'outbound',
      orderId: options.orderId,
      status: 'pending',
      timestamp: new Date().toISOString(),
      attempts: 0,
      lastAttempt: null,
    };

    try {
      let result;
      switch (this.config.apiProvider) {
        case 'twilio':
          result = await this.sendViaTwilio(formattedPhone, body);
          break;
        case 'meta-api':
          result = await this.sendViaMetaApi(formattedPhone, body);
          break;
        case 'whatsapp-web':
        default:
          result = await this.sendViaWhatsAppWeb(formattedPhone, body);
      }

      message.status = result.success ? 'sent' : 'failed';
      message.externalId = result.messageId;
      message.error = result.error;
      message.lastAttempt = new Date().toISOString();
      message.attempts = 1;

    } catch (error) {
      message.status = 'failed';
      message.error = error.message;
      message.lastAttempt = new Date().toISOString();
      message.attempts = 1;
    }

    await this.saveMessage(message);
    return message;
  }

  async sendViaWhatsAppWeb(phone, body) {
    const encodedMessage = encodeURIComponent(body);
    const cleanPhone = phone.replace(/[^\d]/g, '');
    const waLink = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;

    console.log('WhatsApp Web Link:', waLink);

    return {
      success: true,
      messageId: `wa_${Date.now()}`,
      link: waLink
    };
  }

  async sendViaTwilio(phone, body) {
    const { twilioAccountSid, twilioAuthToken, businessPhone } = this.config;

    if (!twilioAccountSid || !twilioAuthToken) {
      return { success: false, error: 'Credenciales de Twilio no configuradas' };
    }

    try {
      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + btoa(`${twilioAccountSid}:${twilioAuthToken}`),
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            From: `whatsapp:${this.formatPhoneNumber(businessPhone)}`,
            To: `whatsapp:${phone}`,
            Body: body,
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        return { success: true, messageId: data.sid };
      } else {
        return { success: false, error: data.message || 'Error de Twilio' };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async sendViaMetaApi(phone, body) {
    const { metaAccessToken, metaPhoneNumberId } = this.config;

    if (!metaAccessToken || !metaPhoneNumberId) {
      return { success: false, error: 'Credenciales de Meta API no configuradas' };
    }

    try {
      const response = await fetch(
        `https://graph.facebook.com/v18.0/${metaPhoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${metaAccessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: phone.replace(/[^\d]/g, ''),
            type: 'text',
            text: { body },
          }),
        }
      );

      const data = await response.json();

      if (response.ok && data.messages?.[0]?.id) {
        return { success: true, messageId: data.messages[0].id };
      } else {
        return { success: false, error: data.error?.message || 'Error de Meta API' };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ============ Order Notifications ============

  async sendOrderConfirmation(order) {
    await this._ensureLoaded();
    const {
      orderNumber, customer, items, total, orderType, pickupTime, deliveryAddress,
    } = order;

    const messageData = {
      businessName: this.config.businessName,
      customerName: customer.name,
      orderNumber,
      products: this.formatOrderProducts(items),
      total: total.toFixed(2),
      orderType: orderType === 'delivery' ? '🛵 Entrega a domicilio' : '🏪 Recogida en local',
      pickupTime: pickupTime || '30-45 minutos',
      deliveryAddress: orderType === 'delivery' ? `📍 Dirección: ${deliveryAddress}` : '',
    };

    const body = this.formatMessage(this.config.orderConfirmTemplate, messageData);

    return await this.sendMessage(customer.phone, body, {
      type: 'order_confirmation',
      orderId: orderNumber,
    });
  }

  async sendCeoNotification(order) {
    await this._ensureLoaded();
    if (!this.config.ceoPhone || !this.config.autoNotifyCeo) {
      return { success: false, error: 'Notificación CEO desactivada o número no configurado' };
    }

    const {
      orderNumber, customer, items, total, orderType, pickupTime, deliveryAddress,
    } = order;

    const baseUrl = window.location.origin;
    const orderLink = `${baseUrl}/OrdersDashboard?order=${orderNumber}`;

    const messageData = {
      orderNumber,
      customerName: customer.name,
      customerPhone: customer.phone,
      products: this.formatOrderProducts(items),
      total: total.toFixed(2),
      orderType: orderType === 'delivery' ? '🛵 Entrega a domicilio' : '🏪 Recogida en local',
      pickupTime: pickupTime || 'Lo antes posible',
      deliveryAddress: orderType === 'delivery' ? `📍 Dirección: ${deliveryAddress}` : '',
      orderLink,
    };

    const body = this.formatMessage(this.config.ceoAlertTemplate, messageData);

    return await this.sendMessage(this.config.ceoPhone, body, {
      type: 'ceo_notification',
      orderId: orderNumber,
    });
  }

  async sendKitchenNotification(order) {
    await this._ensureLoaded();
    if (!this.config.kitchenPhone || !this.config.autoNotifyKitchen) {
      return { success: false, error: 'Notificación cocina desactivada o número no configurado' };
    }

    const { orderNumber, items, orderType, pickupTime } = order;

    const messageData = {
      orderNumber,
      products: this.formatOrderProducts(items),
      orderType: orderType === 'delivery' ? 'DOMICILIO' : 'RECOGIDA',
      pickupTime: pickupTime || 'ASAP',
    };

    const body = this.formatMessage(this.config.kitchenAlertTemplate, messageData);

    return await this.sendMessage(this.config.kitchenPhone, body, {
      type: 'kitchen_notification',
      orderId: orderNumber,
    });
  }

  // ============ Complete Order Processing ============

  async processNewOrder(orderData) {
    const orderNumber = this.generateOrderNumber();
    const order = { ...orderData, orderNumber };

    await this.saveOrder(order);

    const results = {
      orderNumber,
      customerNotification: null,
      ceoNotification: null,
      kitchenNotification: null,
    };

    if (this.config.autoNotifyCustomer && order.customer.phone) {
      results.customerNotification = await this.sendOrderConfirmation(order);
    }

    if (this.config.autoNotifyCeo) {
      results.ceoNotification = await this.sendCeoNotification(order);
    }

    if (this.config.autoNotifyKitchen) {
      results.kitchenNotification = await this.sendKitchenNotification(order);
    }

    return results;
  }

  // ============ Order Management (API) ============

  async saveOrder(order) {
    try {
      await apiFetch(API_ORDERS, {
        method: 'POST',
        body: JSON.stringify({
          ...order,
          createdAt: new Date().toISOString(),
          status: 'pending',
          whatsappConfirmed: true,
        }),
      });
      return order;
    } catch (e) {
      console.warn('[WhatsApp] Error guardando pedido:', e.message);
      return null;
    }
  }

  async getOrders(filters = {}) {
    try {
      const result = await apiFetch(`${API_ORDERS}?sort=-created_date&limit=1000`);
      let orders = result?.data || [];

      if (filters.status) {
        orders = orders.filter(o => o.status === filters.status);
      }
      if (filters.orderNumber) {
        orders = orders.filter(o => (o.orderNumber || '').includes(filters.orderNumber));
      }
      if (filters.customerPhone) {
        orders = orders.filter(o => o.customer?.phone?.includes(filters.customerPhone));
      }
      if (filters.dateFrom) {
        orders = orders.filter(o => new Date(o.createdAt) >= new Date(filters.dateFrom));
      }
      if (filters.dateTo) {
        orders = orders.filter(o => new Date(o.createdAt) <= new Date(filters.dateTo));
      }

      return orders;
    } catch (e) {
      console.warn('[WhatsApp] Error obteniendo pedidos:', e.message);
      return [];
    }
  }

  async updateOrderStatus(orderNumber, status) {
    try {
      const result = await apiFetch(`${API_ORDERS}?sort=-created_date&limit=1000`);
      const orders = result?.data || [];
      const order = orders.find(o => o.orderNumber === orderNumber);
      if (order) {
        await apiFetch(`${API_ORDERS}/${order.id}`, {
          method: 'PUT',
          body: JSON.stringify({ status, updatedAt: new Date().toISOString() }),
        });
        return { ...order, status, updatedAt: new Date().toISOString() };
      }
      return null;
    } catch (e) {
      console.warn('[WhatsApp] Error actualizando pedido:', e.message);
      return null;
    }
  }

  // ============ Retry Failed Messages ============

  async retryFailedMessage(messageId) {
    await this._ensureLoaded();
    const message = this.messages.find(m => m.id === messageId);
    if (!message || message.status !== 'failed') {
      return { success: false, error: 'Mensaje no encontrado o no fallido' };
    }

    if (message.attempts >= 3) {
      return { success: false, error: 'Máximo de reintentos alcanzado' };
    }

    return await this.sendMessage(message.to, message.body, {
      type: message.type,
      orderId: message.orderId,
    });
  }

  // ============ Statistics ============

  async getStatistics(days = 30) {
    await this._ensureLoaded();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const recentMessages = this.messages.filter(
      m => new Date(m.timestamp) >= cutoffDate
    );

    const orders = await this.getOrders();
    const recentOrders = orders.filter(
      o => new Date(o.createdAt) >= cutoffDate
    );

    return {
      totalMessages: recentMessages.length,
      sentMessages: recentMessages.filter(m => m.status === 'sent').length,
      failedMessages: recentMessages.filter(m => m.status === 'failed').length,
      pendingMessages: recentMessages.filter(m => m.status === 'pending').length,
      totalOrders: recentOrders.length,
      ordersByType: {
        pickup: recentOrders.filter(o => o.orderType === 'pickup').length,
        delivery: recentOrders.filter(o => o.orderType === 'delivery').length,
      },
      totalRevenue: recentOrders.reduce((sum, o) => sum + (o.total || 0), 0),
    };
  }

  getWhatsAppLink(phone, message = '') {
    const cleanPhone = this.formatPhoneNumber(phone)?.replace(/[^\d]/g, '');
    if (!cleanPhone) return null;

    const encodedMessage = encodeURIComponent(message);
    return `https://wa.me/${cleanPhone}${message ? `?text=${encodedMessage}` : ''}`;
  }
}

const whatsappService = new WhatsAppService();
export default whatsappService;
