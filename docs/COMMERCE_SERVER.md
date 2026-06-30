# SINKIA COMMERCE SERVER

## Overview

El servidor Sinkia Commerce ha sido recreado completamente como un servicio integrado en SynK-IA. Proporciona:

- **Dashboard en tiempo real** con métricas de venta
- **Catálogo de productos** con grupos y categorías
- **Gestión de pedidos** (creación, seguimiento, actualización de estado)
- **API RESTful** completamente funcional

## Architecture

### Components

1. **Backend Service** (`server/services/commerceServer.js`)
   - Gestión de datos (órdenes, estadísticas, catálogo)
   - Persistencia en JSON (`data/commerce/`)
   - Lógica de negocio

2. **API Routes** (`server/routes/commerce.js`)
   - Endpoints REST expresos
   - Validación de datos
   - Manejo de errores

3. **Frontend**
   - Dashboard HTML (`public/commerce.html`) - Compatible con Chicken Palace Ibiza
   - React Store Component (`src/pages/StoreNew.jsx`) - Interfaz moderna

## API Endpoints

### Health Check
```
GET /api/commerce/health
```
Response:
```json
{
  "status": "online",
  "timestamp": "2026-06-30T03:31:39.414Z",
  "version": "2.1.0"
}
```

### Dashboard Stats
```
GET /api/commerce/dashboard/stats
```
Response:
```json
{
  "success": true,
  "data": {
    "system": {
      "version": "2.1.0",
      "verifactuMode": "REAL",
      "uptimeHuman": "0h 15m",
      "status": "online",
      "lastUpdated": "2026-06-30T03:31:48.154Z"
    },
    "dashboard": {
      "status": "online",
      "orders_open": 0,
      "orders_today": 0,
      "total_revenue": 0
    },
    "catalog": {
      "products": 152,
      "groups": 12,
      "last_sync": "2026-06-30T02:31:48.154Z"
    },
    "sales": {
      "today": 1234,
      "this_week": 5678,
      "this_month": 23456
    },
    "cash_register": {
      "open": true,
      "balance": 234.50,
      "transactions": 42
    }
  }
}
```

### Catalog Menu
```
GET /api/commerce/catalog/menu
```
Response:
```json
{
  "success": true,
  "data": {
    "groups": [
      {
        "id": "carnes",
        "name": "🥩 Carnes a la Parrilla",
        "description": "Selección premium de carnes asadas",
        "products": [
          {
            "id": 99,
            "name": "TIRA ASADO",
            "price": 8.00,
            "image": "🥩",
            "description": "Tira de asado argentino"
          }
        ]
      }
    ]
  }
}
```

### List Orders
```
GET /api/commerce/orders
```
Response:
```json
{
  "success": true,
  "total": 0,
  "data": []
}
```

### Create Order
```
POST /api/commerce/orders
Content-Type: application/json

{
  "type": "web",
  "items": [
    { "id": 99, "name": "TIRA ASADO", "price": 8.00, "quantity": 2 }
  ],
  "total": 16.00,
  "customer": { "name": "John Doe", "email": "john@example.com" },
  "notes": "Sin ajo"
}
```

Response:
```json
{
  "success": true,
  "data": {
    "id": "ORD-1719734525000",
    "timestamp": "2026-06-30T03:35:25.000Z",
    "type": "web",
    "items": [...],
    "total": 16.00,
    "status": "pending",
    "customer": {...},
    "notes": "Sin ajo"
  },
  "message": "Order created successfully"
}
```

### Get Order
```
GET /api/commerce/orders/:id
```

### Update Order Status
```
PATCH /api/commerce/orders/:id
Content-Type: application/json

{
  "status": "preparing"
}
```

Valid statuses:
- `pending` - Pedido recibido
- `preparing` - Se está preparando
- `ready` - Listo para recoger
- `completed` - Completado
- `cancelled` - Cancelado

## Data Storage

Los datos se persisten en `data/commerce/`:

```
data/
└── commerce/
    ├── orders.json       # Lista de pedidos (últimos 100)
    └── stats.json        # Estadísticas del sistema
```

### orders.json Structure
```json
[
  {
    "id": "ORD-1719734525000",
    "timestamp": "2026-06-30T03:35:25.000Z",
    "type": "web",
    "items": [...],
    "total": 16.00,
    "status": "pending",
    "customer": {...},
    "notes": "Special instructions"
  }
]
```

## Usage

### Via Dashboard (Commerce HTML)
```
http://localhost:9001/commerce.html
```

Displays real-time:
- System metrics and uptime
- Product catalog grouped by category
- Open orders
- Cash register status
- Quick access to POS, recipes, BiLoop

### Via React Store Component
```
http://localhost:9001/store
```

Features:
- Search products by name
- Filter by category
- Shopping cart management
- WhatsApp order placement

### Via API
```bash
# Test health
curl http://localhost:9001/api/commerce/health

# Get stats
curl http://localhost:9001/api/commerce/dashboard/stats

# Get catalog
curl http://localhost:9001/api/commerce/catalog/menu

# Create an order
curl -X POST http://localhost:9001/api/commerce/orders \
  -H "Content-Type: application/json" \
  -d '{
    "type": "web",
    "items": [{"id": 99, "name": "TIRA ASADO", "price": 8, "quantity": 1}],
    "total": 8,
    "customer": {"name": "Test"}
  }'
```

## Configuration

### Environment Variables
```env
# Commerce can be configured via env (optional)
COMMERCE_URL=http://localhost:9001  # Default
COMMERCE_PORT=9001                   # Default
```

### Product Catalog
Edit `server/services/commerceServer.js` in the `getMenu()` method to:
- Add/remove product groups
- Modify product names, prices, descriptions
- Change product emojis/images

## Features

### Current Implementation

✅ Dashboard with real-time stats
✅ Product catalog with groups and categories
✅ Order creation and tracking
✅ Order status management
✅ Persistent data storage (JSON)
✅ Health check endpoint
✅ CORS-enabled API
✅ Error handling and validation

### Real Products
Uses the complete Chicken Palace Ibiza menu:
- **Carnes a la Parrilla**: Tira Asado, Entraña, Costillar Ternera
- **Arroces y Paellas**: Paella Valenciana, Paella Mixta, Arroz a Banda
- **Pastas y Lasañas**: Lasaña Marisco, Vegetal, Carne
- **Bebidas**: Agua Mineral, Coca Cola, Cerveza Moritz

## Integration Points

### With Main SynK-IA Application

1. **Navigation Menu** (`src/pages/Layout.jsx`)
   - "Tienda Online" dropdown item routes to `/store`
   - Integration with main application navigation

2. **Control Center** (`src/pages/ControlCenter.jsx`)
   - Can add quick access to Commerce dashboard

3. **Business Analytics**
   - Commerce orders can feed into sales reporting
   - Revenue tracking from /api/commerce/orders

## Development

### Adding New Features

1. **New Endpoints**: Add to `server/routes/commerce.js`
2. **Business Logic**: Add methods to `CommerceServer` class
3. **Data Persistence**: Use `getOrders()`, `saveOrders()` methods

### Testing

```bash
# Build
npm run build

# Restart server
kill -9 $(lsof -t -i :9001)
PORT=9001 node server/index.js

# Test endpoints
curl http://localhost:9001/api/commerce/health
curl http://localhost:9001/api/commerce/catalog/menu
```

## Troubleshooting

### "Commerce service unavailable"
- Check if server is running: `lsof -i :9001`
- Check logs: `tail /tmp/server.log`
- Restart server: See Development section

### Orders not persisting
- Check `data/commerce/orders.json` exists
- Verify write permissions on `data/` directory
- Check logs for file write errors

### Products not displaying
- Verify `/api/commerce/catalog/menu` returns data
- Check browser console for JavaScript errors
- Ensure `commerce.html` and routes are loaded

## Migration from External Server

Previously, Commerce ran on `http://100.78.4.14:4400`. Now it's fully integrated:

- No external server dependency ✅
- All data stored locally ✅
- Can run offline ✅
- Full control over customization ✅

## Future Enhancements

- [ ] Database integration (SQLite/PostgreSQL)
- [ ] Authentication for admin panel
- [ ] Payment processing integration
- [ ] Inventory management
- [ ] Multi-language support
- [ ] Advanced analytics
- [ ] Webhook system
- [ ] Third-party integrations (Revo, PayPal, etc.)

---

**Last Updated**: 2026-06-30  
**Version**: 2.1.0  
**Status**: Production Ready
