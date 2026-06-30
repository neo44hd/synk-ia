import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  ShoppingCart, 
  Search, 
  Star, 
  Heart, 
  MessageCircle,
  Phone,
  MapPin,
  Clock,
  Loader2 
} from "lucide-react";
import { toast } from "sonner";

/**
 * Tienda Online - Nueva versión integrada
 * Sin dependencias externas, funciona con datos demo y WhatsApp
 */
export default function Store() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [cartItems, setCartItems] = useState([]);
  const [showCart, setShowCart] = useState(false);

  // Demo products
  const allProducts = [
    {
      id: 1,
      name: "Agua Mineral",
      category: "bebidas",
      price: 2.50,
      image: "💧",
      description: "Agua mineral sin gas",
      rating: 5
    },
    {
      id: 2,
      name: "Coca Cola",
      category: "bebidas",
      price: 3.00,
      image: "🥤",
      description: "Bebida refrescante",
      rating: 4.8
    },
    {
      id: 3,
      name: "Café Espresso",
      category: "bebidas",
      price: 2.00,
      image: "☕",
      description: "Café recién hecho",
      rating: 4.9
    },
    {
      id: 4,
      name: "Hamburguesa",
      category: "comida",
      price: 8.50,
      image: "🍔",
      description: "Hamburguesa de res con queso",
      rating: 4.7
    },
    {
      id: 5,
      name: "Pizza Margarita",
      category: "comida",
      price: 10.00,
      image: "🍕",
      description: "Pizza clásica italiana",
      rating: 4.9
    },
    {
      id: 6,
      name: "Ensalada César",
      category: "comida",
      price: 7.00,
      image: "🥗",
      description: "Ensalada fresca con pollo",
      rating: 4.6
    },
    {
      id: 7,
      name: "Postre Chocolate",
      category: "postres",
      price: 5.50,
      image: "🍰",
      description: "Brownie de chocolate",
      rating: 4.8
    },
    {
      id: 8,
      name: "Helado",
      category: "postres",
      price: 4.00,
      image: "🍦",
      description: "Helado de vainilla",
      rating: 4.7
    },
  ];

  const categories = [
    { id: "all", name: "Todos" },
    { id: "bebidas", name: "🥤 Bebidas" },
    { id: "comida", name: "🍽️ Comida" },
    { id: "postres", name: "🍰 Postres" },
  ];

  // Filter products
  const filteredProducts = allProducts.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "all" || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleAddToCart = (product) => {
    const existing = cartItems.find(item => item.id === product.id);
    if (existing) {
      setCartItems(cartItems.map(item =>
        item.id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCartItems([...cartItems, { ...product, quantity: 1 }]);
    }
    toast.success(`${product.name} agregado al carrito`);
  };

  const cartTotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const handleOrderWhatsApp = () => {
    const items = cartItems
      .map(item => `${item.quantity}x ${item.name} - €${(item.price * item.quantity).toFixed(2)}`)
      .join("\n");
    const total = `\nTotal: €${cartTotal.toFixed(2)}`;
    const message = `Hola! Me gustaría pedir:\n\n${items}${total}`;
    const whatsappUrl = `https://wa.me/34123456789?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, "_blank");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white py-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <ShoppingCart className="w-10 h-10" />
              <h1 className="text-4xl font-bold">Tienda Online</h1>
            </div>
            <Button
              onClick={() => setShowCart(!showCart)}
              className="relative bg-white text-blue-600 hover:bg-slate-100"
            >
              <ShoppingCart className="w-5 h-5 mr-2" />
              Carrito
              {cartItems.length > 0 && (
                <Badge className="absolute -top-2 -right-2 bg-red-500 rounded-full px-2">
                  {cartItems.length}
                </Badge>
              )}
            </Button>
          </div>

          {/* Search and Filters */}
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-4 top-3 text-slate-300 w-5 h-5" />
              <Input
                placeholder="Buscar productos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-12 py-2 bg-white/10 border-white/20 text-white placeholder:text-slate-300"
              />
            </div>

            <div className="flex gap-2 flex-wrap">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    selectedCategory === cat.id
                      ? "bg-white text-blue-600"
                      : "bg-white/10 border border-white/20 text-white hover:bg-white/20"
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Cart Sidebar */}
        {showCart && (
          <div className="mb-8 bg-slate-800/50 border border-slate-700 rounded-lg p-6">
            <h2 className="text-xl font-bold text-white mb-4">🛒 Tu Carrito</h2>
            {cartItems.length === 0 ? (
              <p className="text-slate-400">El carrito está vacío</p>
            ) : (
              <>
                <div className="space-y-3 mb-4">
                  {cartItems.map(item => (
                    <div key={item.id} className="flex justify-between items-center text-white">
                      <span>
                        {item.quantity}x {item.name}
                      </span>
                      <span className="font-semibold">€{(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-slate-600 pt-4 mb-4">
                  <div className="flex justify-between text-white text-lg font-bold">
                    <span>Total:</span>
                    <span>€{cartTotal.toFixed(2)}</span>
                  </div>
                </div>
                <Button
                  onClick={handleOrderWhatsApp}
                  className="w-full bg-green-600 hover:bg-green-700 text-white py-3"
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Pedir por WhatsApp
                </Button>
              </>
            )}
          </div>
        )}

        {/* Products Grid */}
        <div>
          <h2 className="text-2xl font-bold text-white mb-6">
            {selectedCategory === "all" ? "Todos los productos" : categories.find(c => c.id === selectedCategory)?.name}
          </h2>

          {filteredProducts.length === 0 ? (
            <div className="text-center py-12">
              <Loader2 className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-400">No hay productos en esta categoría</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {filteredProducts.map(product => (
                <Card key={product.id} className="bg-slate-800/50 border-slate-700 hover:border-blue-500 transition-colors">
                  <CardContent className="p-4">
                    <div className="text-5xl mb-3 text-center">{product.image}</div>
                    <h3 className="font-semibold text-white mb-1">{product.name}</h3>
                    <p className="text-sm text-slate-400 mb-3">{product.description}</p>
                    
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-lg font-bold text-cyan-400">€{product.price.toFixed(2)}</span>
                      <div className="flex items-center gap-1 text-yellow-400">
                        <Star className="w-4 h-4 fill-current" />
                        <span className="text-xs">{product.rating}</span>
                      </div>
                    </div>

                    <Button
                      onClick={() => handleAddToCart(product)}
                      className="w-full bg-blue-600 hover:bg-blue-700"
                    >
                      <ShoppingCart className="w-4 h-4 mr-2" />
                      Añadir al carrito
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Contact Info */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-6 text-center">
              <Phone className="w-8 h-8 text-blue-400 mx-auto mb-3" />
              <h3 className="font-semibold text-white mb-1">Teléfono</h3>
              <p className="text-slate-400 text-sm">+34 123 456 789</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-6 text-center">
              <MapPin className="w-8 h-8 text-green-400 mx-auto mb-3" />
              <h3 className="font-semibold text-white mb-1">Ubicación</h3>
              <p className="text-slate-400 text-sm">Ibiza, España</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-6 text-center">
              <Clock className="w-8 h-8 text-orange-400 mx-auto mb-3" />
              <h3 className="font-semibold text-white mb-1">Horario</h3>
              <p className="text-slate-400 text-sm">12:00 - 23:00</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
