import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Search,
  Phone,
  MapPin,
  Clock,
  ChevronRight,
  X,
  Star,
  Filter,
  ChefHat,
  Utensils,
  Coffee,
  IceCream,
  Salad,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Send,
  User,
  Home,
  MessageSquare,
  Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import RevoSyncService from "@/services/revoSyncService";
import whatsappService from "@/services/whatsappService";

// Placeholder image component
const ProductImage = ({ src, alt, className }) => {
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  if (error || !src) {
    return (
      <div className={`${className} bg-gradient-to-br from-orange-100 to-orange-200 dark:from-orange-900/30 dark:to-orange-800/30 flex items-center justify-center`}>
        <ChefHat className="w-12 h-12 text-orange-400 dark:text-orange-500" />
      </div>
    );
  }

  return (
    <div className={`${className} relative overflow-hidden`}>
      {!loaded && (
        <div className="absolute inset-0 bg-gradient-to-br from-orange-100 to-orange-200 dark:from-orange-900/30 dark:to-orange-800/30 animate-pulse" />
      )}
      <img
        src={src}
        alt={alt}
        className={`w-full h-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        onError={() => setError(true)}
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
};

// Category icons
const categoryIcons = {
  comidas: <Utensils className="w-5 h-5" />,
  ensaladas: <Salad className="w-5 h-5" />,
  complementos: <ChefHat className="w-5 h-5" />,
  postres: <IceCream className="w-5 h-5" />,
  bebidas: <Coffee className="w-5 h-5" />,
};

export default function OrderPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCheckout, setShowCheckout] = useState(false);
  const [businessInfo, setBusinessInfo] = useState(null);
  const [orderType, setOrderType] = useState('pickup'); // pickup or delivery
  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    phone: '',
    whatsapp: '',
    address: '',
    notes: '',
    wantsWhatsAppConfirmation: true,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(null);
  const [phoneError, setPhoneError] = useState('');
  const [whatsappConfig, setWhatsappConfig] = useState(null);

  // Load data on mount
  useEffect(() => {
    const loadData = () => {
      const allProducts = RevoSyncService.getProducts();
      const allCategories = RevoSyncService.getCategories();
      const info = RevoSyncService.getBusinessInfo();
      const waConfig = whatsappService.getConfig();
      
      setProducts(allProducts);
      setCategories(allCategories);
      setBusinessInfo(info);
      setWhatsappConfig(waConfig);
    };

    loadData();
  }, []);

  // Filter products
  const filteredProducts = useMemo(() => {
    let result = products.filter(p => p.available);
    
    if (selectedCategory !== 'all') {
      result = result.filter(p => p.category === selectedCategory);
    }
    
    if (searchQuery.length >= 2) {
      const normalized = searchQuery.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      result = result.filter(p => {
        const name = p.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return name.includes(normalized);
      });
    }
    
    return result;
  }, [products, selectedCategory, searchQuery]);

  // Cart operations
  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.id === product.id 
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId) => {
    setCart(prev => prev.filter(item => item.id !== productId));
  };

  const updateQuantity = (productId, delta) => {
    setCart(prev => prev.map(item => {
      if (item.id === productId) {
        const newQuantity = item.quantity + delta;
        return newQuantity > 0 ? { ...item, quantity: newQuantity } : item;
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }, [cart]);

  const cartItemCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  // Validate phone number
  const validatePhone = (phone) => {
    const validation = whatsappService.validatePhoneNumber(phone);
    if (!validation.valid) {
      setPhoneError(validation.error);
      return false;
    }
    setPhoneError('');
    return true;
  };

  const handleSubmitOrder = async () => {
    // Validate WhatsApp number if customer wants confirmation
    const whatsappNumber = customerInfo.whatsapp || customerInfo.phone;
    if (customerInfo.wantsWhatsAppConfirmation && !validatePhone(whatsappNumber)) {
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Calculate delivery fee if applicable
      const deliveryFee = orderType === 'delivery' && businessInfo ? businessInfo.deliveryFee : 0;
      const totalWithDelivery = cartTotal + deliveryFee;

      // Prepare order data for WhatsApp service
      const orderData = {
        items: cart,
        customer: {
          name: customerInfo.name,
          phone: whatsappNumber,
          notes: customerInfo.notes,
        },
        orderType,
        total: totalWithDelivery,
        deliveryAddress: orderType === 'delivery' ? customerInfo.address : null,
        pickupTime: '30-45 minutos',
      };

      // Process order through WhatsApp service (sends notifications)
      const result = await whatsappService.processNewOrder(orderData);

      console.log('Order processed:', result);

      // Show success
      setOrderSuccess({
        orderNumber: result.orderNumber,
        whatsappSent: result.customerNotification?.status === 'sent',
      });

      // Reset cart after delay
      setTimeout(() => {
        setCart([]);
        setShowCheckout(false);
        setIsCartOpen(false);
        setOrderSuccess(null);
        setCustomerInfo({
          name: '',
          phone: '',
          whatsapp: '',
          address: '',
          notes: '',
          wantsWhatsAppConfirmation: true,
        });
      }, 5000);

    } catch (error) {
      console.error('Error submitting order:', error);
      alert('Error al procesar el pedido. Por favor, inténtalo de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const featuredProducts = products.filter(p => p.featured && p.available);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-r from-orange-500 via-orange-600 to-red-600 text-white">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'https://i.pinimg.com/736x/10/bd/31/10bd311c73bc353cbb6df1835552cde9.jpg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.4\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
          }} />
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <h1 className="text-4xl md:text-6xl font-bold mb-4">
              🍗 Chicken Palace
            </h1>
            <p className="text-xl md:text-2xl opacity-90 mb-8">
              El mejor pollo asado de Ibiza, ahora a domicilio
            </p>
            
            {businessInfo && (
              <div className="flex flex-wrap justify-center gap-6 text-sm md:text-base">
                <div className="flex items-center gap-2 bg-white/20 px-4 py-2 rounded-full">
                  <MapPin className="w-5 h-5" />
                  <span>{businessInfo.address}</span>
                </div>
                <div className="flex items-center gap-2 bg-white/20 px-4 py-2 rounded-full">
                  <Phone className="w-5 h-5" />
                  <span>{businessInfo.phone}</span>
                </div>
                <div className="flex items-center gap-2 bg-white/20 px-4 py-2 rounded-full">
                  <Clock className="w-5 h-5" />
                  <span>L-V: {businessInfo.schedule.weekdays}</span>
                </div>
              </div>
            )}
          </motion.div>
        </div>

        {/* Wave decoration */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 120L60 110C120 100 240 80 360 70C480 60 600 60 720 65C840 70 960 80 1080 85C1200 90 1320 90 1380 90L1440 90V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z" 
              fill="currentColor" className="text-gray-50 dark:text-gray-900" />
          </svg>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 -mt-6">
        {/* Search Bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <div className="relative max-w-xl mx-auto">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              type="text"
              placeholder="Buscar productos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 pr-4 py-6 text-lg rounded-2xl border-2 border-gray-200 dark:border-gray-700 focus:border-orange-500 dark:focus:border-orange-500 bg-white dark:bg-gray-800"
            />
          </div>
        </motion.div>

        {/* Categories */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-8"
        >
          <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`flex items-center gap-2 px-6 py-3 rounded-full font-medium whitespace-nowrap transition-all ${
                selectedCategory === 'all'
                  ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
              }`}
            >
              <Filter className="w-5 h-5" />
              Todos
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex items-center gap-2 px-6 py-3 rounded-full font-medium whitespace-nowrap transition-all ${
                  selectedCategory === cat.id
                    ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
                }`}
              >
                {categoryIcons[cat.id] || <Utensils className="w-5 h-5" />}
                {cat.name}
                <Badge variant="secondary" className="ml-1 bg-gray-100 dark:bg-gray-700">
                  {cat.productCount}
                </Badge>
              </button>
            ))}
          </div>
        </motion.div>

        {/* Featured Products */}
        {selectedCategory === 'all' && !searchQuery && featuredProducts.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mb-12"
          >
            <div className="flex items-center gap-2 mb-6">
              <Star className="w-6 h-6 text-yellow-500" />
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Productos Destacados</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {featuredProducts.map((product, index) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1 * index }}
                >
                  <Card className="group overflow-hidden hover:shadow-2xl transition-all duration-300 border-0 bg-white dark:bg-gray-800 h-full">
                    <div className="relative">
                      <ProductImage
                        src={product.image}
                        alt={product.name}
                        className="w-full h-56"
                      />
                      <div className="absolute top-4 left-4">
                        <Badge className="bg-yellow-500 text-white border-0 shadow-lg">
                          <Star className="w-3 h-3 mr-1" /> Destacado
                        </Badge>
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <CardContent className="p-6">
                      <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
                        {product.name}
                      </h3>
                      <div className="flex items-center justify-between">
                        <p className="text-2xl font-bold text-orange-500">
                          {product.priceDisplay}
                        </p>
                        <Button
                          onClick={() => addToCart(product)}
                          className="bg-orange-500 hover:bg-orange-600 text-white rounded-full px-6"
                        >
                          <Plus className="w-5 h-5 mr-1" /> Añadir
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.section>
        )}

        {/* Products Grid */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
              {selectedCategory === 'all' ? 'Nuestra Carta' : categories.find(c => c.id === selectedCategory)?.name}
            </h2>
            <span className="text-gray-500 dark:text-gray-400">
              {filteredProducts.length} productos
            </span>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-2xl">
              <Search className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
              <p className="text-xl text-gray-500 dark:text-gray-400">
                No se encontraron productos
              </p>
              <p className="text-gray-400 dark:text-gray-500 mt-2">
                Prueba con otro término de búsqueda
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              <AnimatePresence mode="popLayout">
                {filteredProducts.map((product, index) => {
                  const cartItem = cart.find(item => item.id === product.id);
                  return (
                    <motion.div
                      key={product.id}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Card className="group overflow-hidden hover:shadow-xl transition-all duration-300 border-0 bg-white dark:bg-gray-800 h-full flex flex-col">
                        <div className="relative">
                          <ProductImage
                            src={product.image}
                            alt={product.name}
                            className="w-full h-44"
                          />
                          <div className="absolute top-3 left-3">
                            <Badge className="bg-gray-900/70 text-white border-0 text-xs">
                              {product.categoryIcon} {product.categoryName}
                            </Badge>
                          </div>
                          {cartItem && (
                            <div className="absolute top-3 right-3">
                              <Badge className="bg-orange-500 text-white border-0">
                                {cartItem.quantity} en carrito
                              </Badge>
                            </div>
                          )}
                        </div>
                        <CardContent className="p-4 flex flex-col flex-grow">
                          <h3 className="font-semibold text-gray-800 dark:text-white mb-2 line-clamp-2 flex-grow">
                            {product.name}
                          </h3>
                          <div className="flex items-center justify-between mt-auto">
                            <p className="text-xl font-bold text-orange-500">
                              {product.priceDisplay}
                            </p>
                            {cartItem ? (
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => updateQuantity(product.id, -1)}
                                  className="rounded-full w-8 h-8 p-0"
                                >
                                  <Minus className="w-4 h-4" />
                                </Button>
                                <span className="font-bold text-lg w-6 text-center">
                                  {cartItem.quantity}
                                </span>
                                <Button
                                  size="sm"
                                  onClick={() => updateQuantity(product.id, 1)}
                                  className="rounded-full w-8 h-8 p-0 bg-orange-500 hover:bg-orange-600"
                                >
                                  <Plus className="w-4 h-4" />
                                </Button>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => addToCart(product)}
                                className="bg-orange-500 hover:bg-orange-600 text-white rounded-full"
                              >
                                <Plus className="w-4 h-4 mr-1" /> Añadir
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </motion.section>
      </div>

      {/* Floating Cart Button */}
      <AnimatePresence>
        {cart.length > 0 && !isCartOpen && (
          <motion.button
            initial={{ scale: 0, y: 50 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0, y: 50 }}
            onClick={() => setIsCartOpen(true)}
            className="fixed bottom-6 right-6 bg-orange-500 hover:bg-orange-600 text-white p-4 rounded-full shadow-2xl shadow-orange-500/40 flex items-center gap-3 z-50"
          >
            <ShoppingCart className="w-6 h-6" />
            <span className="font-bold">{cartItemCount}</span>
            <div className="w-px h-6 bg-white/30" />
            <span className="font-bold">{cartTotal.toFixed(2)} €</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Cart Drawer */}
      <AnimatePresence>
        {isCartOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCartOpen(false)}
              className="fixed inset-0 bg-black/50 z-50"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white dark:bg-gray-900 shadow-2xl z-50 flex flex-col"
            >
              {/* Cart Header */}
              <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ShoppingCart className="w-6 h-6 text-orange-500" />
                  <h2 className="text-xl font-bold text-gray-800 dark:text-white">Tu Pedido</h2>
                  <Badge className="bg-orange-500 text-white">{cartItemCount}</Badge>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setIsCartOpen(false)}>
                  <X className="w-6 h-6" />
                </Button>
              </div>

              {/* Cart Content */}
              <div className="flex-grow overflow-auto p-6">
                {orderSuccess ? (
                  /* Success Screen */
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-8"
                  >
                    <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-500/20 flex items-center justify-center">
                      <CheckCircle2 className="w-10 h-10 text-green-500" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
                      ¡Pedido Confirmado!
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      Nº de Pedido: <span className="font-bold text-orange-500">#{orderSuccess.orderNumber}</span>
                    </p>
                    {orderSuccess.whatsappSent && (
                      <div className="flex items-center justify-center gap-2 text-green-600 dark:text-green-400 mb-4">
                        <MessageSquare className="w-5 h-5" />
                        <span>Confirmación enviada por WhatsApp</span>
                      </div>
                    )}
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Te contactaremos pronto para confirmar tu pedido.
                    </p>
                    {whatsappConfig?.businessPhone && (
                      <div className="mt-6 p-4 bg-green-50 dark:bg-green-500/10 rounded-xl">
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                          ¿Tienes alguna pregunta? Contáctanos por WhatsApp:
                        </p>
                        <a
                          href={whatsappService.getWhatsAppLink(whatsappConfig.businessPhone)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-green-600 hover:text-green-700 font-medium"
                        >
                          <MessageSquare className="w-5 h-5" />
                          {whatsappConfig.businessPhone}
                        </a>
                      </div>
                    )}
                  </motion.div>
                ) : showCheckout ? (
                  /* Checkout Form */
                  <div className="space-y-6">
                    <div>
                      <h3 className="font-semibold mb-4 text-gray-800 dark:text-white">Tipo de pedido</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <button
                          onClick={() => setOrderType('pickup')}
                          className={`p-4 rounded-xl border-2 transition-all ${
                            orderType === 'pickup'
                              ? 'border-orange-500 bg-orange-50 dark:bg-orange-500/10'
                              : 'border-gray-200 dark:border-gray-700'
                          }`}
                        >
                          <Home className="w-6 h-6 mx-auto mb-2 text-orange-500" />
                          <span className="font-medium">Recoger</span>
                        </button>
                        <button
                          onClick={() => setOrderType('delivery')}
                          className={`p-4 rounded-xl border-2 transition-all ${
                            orderType === 'delivery'
                              ? 'border-orange-500 bg-orange-50 dark:bg-orange-500/10'
                              : 'border-gray-200 dark:border-gray-700'
                          }`}
                        >
                          <MapPin className="w-6 h-6 mx-auto mb-2 text-orange-500" />
                          <span className="font-medium">Domicilio</span>
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                        <User className="w-4 h-4 inline mr-2" />
                        Nombre
                      </label>
                      <Input
                        value={customerInfo.name}
                        onChange={(e) => setCustomerInfo(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Tu nombre"
                        className="rounded-xl"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                        <Phone className="w-4 h-4 inline mr-2" />
                        Teléfono
                      </label>
                      <Input
                        value={customerInfo.phone}
                        onChange={(e) => setCustomerInfo(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder="+34 600 000 000"
                        className="rounded-xl"
                      />
                    </div>

                    {/* WhatsApp Section */}
                    <div className="p-4 bg-green-50 dark:bg-green-500/10 rounded-xl border border-green-200 dark:border-green-500/30">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-green-500 rounded-lg">
                          <MessageSquare className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-800 dark:text-white mb-1">
                            Confirmación por WhatsApp
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                            Recibe la confirmación de tu pedido directamente en WhatsApp
                          </p>
                          
                          <label className="flex items-center gap-3 cursor-pointer mb-3">
                            <input
                              type="checkbox"
                              checked={customerInfo.wantsWhatsAppConfirmation}
                              onChange={(e) => setCustomerInfo(prev => ({ ...prev, wantsWhatsAppConfirmation: e.target.checked }))}
                              className="w-5 h-5 rounded border-green-500 text-green-500 focus:ring-green-500"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                              Quiero recibir confirmación por WhatsApp
                            </span>
                          </label>

                          {customerInfo.wantsWhatsAppConfirmation && (
                            <div>
                              <Input
                                value={customerInfo.whatsapp}
                                onChange={(e) => {
                                  setCustomerInfo(prev => ({ ...prev, whatsapp: e.target.value }));
                                  setPhoneError('');
                                }}
                                placeholder="WhatsApp (dejar vacío si es el mismo que teléfono)"
                                className="rounded-xl bg-white dark:bg-gray-800"
                              />
                              {phoneError && (
                                <p className="text-sm text-red-500 mt-1 flex items-center gap-1">
                                  <AlertCircle className="w-4 h-4" />
                                  {phoneError}
                                </p>
                              )}
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                Si lo dejas vacío, usaremos tu número de teléfono
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Business WhatsApp Contact */}
                    {whatsappConfig?.businessPhone && (
                      <div className="flex items-center gap-2 p-3 bg-gray-100 dark:bg-gray-800 rounded-xl">
                        <MessageSquare className="w-5 h-5 text-green-500" />
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          Nuestro WhatsApp:
                        </span>
                        <a
                          href={whatsappService.getWhatsAppLink(whatsappConfig.businessPhone)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-green-600 hover:text-green-700"
                        >
                          {whatsappConfig.businessPhone}
                        </a>
                      </div>
                    )}

                    {orderType === 'delivery' && (
                      <div>
                        <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                          <MapPin className="w-4 h-4 inline mr-2" />
                          Dirección de entrega
                        </label>
                        <Input
                          value={customerInfo.address}
                          onChange={(e) => setCustomerInfo(prev => ({ ...prev, address: e.target.value }))}
                          placeholder="Calle, número, piso..."
                          className="rounded-xl"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                        <MessageSquare className="w-4 h-4 inline mr-2" />
                        Notas del pedido
                      </label>
                      <Textarea
                        value={customerInfo.notes}
                        onChange={(e) => setCustomerInfo(prev => ({ ...prev, notes: e.target.value }))}
                        placeholder="Instrucciones especiales, alergias..."
                        className="rounded-xl"
                        rows={3}
                      />
                    </div>

                    <Button
                      variant="outline"
                      className="w-full rounded-xl"
                      onClick={() => setShowCheckout(false)}
                    >
                      ← Volver al carrito
                    </Button>
                  </div>
                ) : (
                  /* Cart Items */
                  <div className="space-y-4">
                    {cart.length === 0 ? (
                      <div className="text-center py-12">
                        <ShoppingCart className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                        <p className="text-gray-500 dark:text-gray-400">Tu carrito está vacío</p>
                      </div>
                    ) : (
                      cart.map((item) => (
                        <motion.div
                          key={item.id}
                          layout
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          className="flex gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl"
                        >
                          <ProductImage
                            src={item.image}
                            alt={item.name}
                            className="w-20 h-20 rounded-lg flex-shrink-0"
                          />
                          <div className="flex-grow">
                            <h4 className="font-medium text-gray-800 dark:text-white">
                              {item.name}
                            </h4>
                            <p className="text-orange-500 font-bold">
                              {(item.price * item.quantity).toFixed(2)} €
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateQuantity(item.id, -1)}
                                className="rounded-full w-7 h-7 p-0"
                              >
                                <Minus className="w-3 h-3" />
                              </Button>
                              <span className="font-bold w-6 text-center">{item.quantity}</span>
                              <Button
                                size="sm"
                                onClick={() => updateQuantity(item.id, 1)}
                                className="rounded-full w-7 h-7 p-0 bg-orange-500 hover:bg-orange-600"
                              >
                                <Plus className="w-3 h-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => removeFromCart(item.id)}
                                className="ml-auto text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </motion.div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Cart Footer */}
              {cart.length > 0 && !orderSuccess && (
                <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                  {orderType === 'delivery' && businessInfo && (
                    <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
                      <span>Envío a domicilio</span>
                      <span>{businessInfo.deliveryFee.toFixed(2)} €</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xl font-bold text-gray-800 dark:text-white mb-4">
                    <span>Total</span>
                    <span>
                      {(cartTotal + (orderType === 'delivery' && businessInfo ? businessInfo.deliveryFee : 0)).toFixed(2)} €
                    </span>
                  </div>
                  
                  {showCheckout && !orderSuccess ? (
                    <Button
                      onClick={handleSubmitOrder}
                      disabled={isSubmitting || !customerInfo.name || !customerInfo.phone || (orderType === 'delivery' && !customerInfo.address)}
                      className="w-full bg-orange-500 hover:bg-orange-600 text-white py-6 rounded-xl text-lg font-bold disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          Procesando...
                        </>
                      ) : (
                        <>
                          <Send className="w-5 h-5 mr-2" />
                          Confirmar Pedido
                        </>
                      )}
                    </Button>
                  ) : !orderSuccess ? (
                    <Button
                      onClick={() => setShowCheckout(true)}
                      className="w-full bg-orange-500 hover:bg-orange-600 text-white py-6 rounded-xl text-lg font-bold"
                    >
                      Continuar
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>
                  ) : null}

                  {businessInfo && businessInfo.minimumOrder > cartTotal && !orderSuccess && (
                    <p className="mt-3 text-center text-sm text-yellow-600 dark:text-yellow-400 flex items-center justify-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      Pedido mínimo: {businessInfo.minimumOrder} €
                    </p>
                  )}
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h3 className="text-2xl font-bold mb-4">🍗 Chicken Palace</h3>
              <p className="text-gray-400">
                El mejor pollo asado de Ibiza desde 2010. Elaborado con ingredientes frescos y recetas tradicionales.
              </p>
            </div>
            {businessInfo && (
              <>
                <div>
                  <h4 className="font-semibold mb-4">Horarios</h4>
                  <ul className="space-y-2 text-gray-400">
                    <li className="flex justify-between">
                      <span>Lunes - Viernes</span>
                      <span>{businessInfo.schedule.weekdays}</span>
                    </li>
                    <li className="flex justify-between">
                      <span>Sábado</span>
                      <span>{businessInfo.schedule.saturday}</span>
                    </li>
                    <li className="flex justify-between">
                      <span>Domingo</span>
                      <span>{businessInfo.schedule.sunday}</span>
                    </li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-4">Contacto</h4>
                  <ul className="space-y-3 text-gray-400">
                    <li className="flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-orange-500" />
                      {businessInfo.address}
                    </li>
                    <li className="flex items-center gap-2">
                      <Phone className="w-5 h-5 text-orange-500" />
                      {businessInfo.phone}
                    </li>
                  </ul>
                </div>
              </>
            )}
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400 text-sm">
            © 2026 Chicken Palace. Powered by SYNK-IA
          </div>
        </div>
      </footer>
    </div>
  );
}
