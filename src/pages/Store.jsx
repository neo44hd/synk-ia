import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ShoppingCart,
  Search,
  Filter,
  Star,
  Heart,
  ChevronRight,
  AlertCircle,
  Loader2,
  Package,
  DollarSign,
  Truck,
  Shield,
} from "lucide-react";
import { toast } from "sonner";

export default function Store() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [sortBy, setSortBy] = useState("featured");
  const [cartItems, setCartItems] = useState([]);
  const [showCart, setShowCart] = useState(false);

  // Fetch products from Sinkia Commerce API
  const { data: products = [], isLoading, error } = useQuery({
    queryKey: ["store-products", selectedCategory, searchTerm],
    queryFn: async () => {
      try {
        const response = await fetch("/api/commerce/products");
        if (!response.ok) throw new Error("Failed to fetch products");
        const data = await response.json();
        return data.products || [];
      } catch (err) {
        console.error("Error fetching products:", err);
        toast.error("Error cargando productos");
        return [];
      }
    },
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ["store-categories"],
    queryFn: async () => {
      try {
        const response = await fetch("/api/commerce/categories");
        if (!response.ok) return [];
        const data = await response.json();
        return data.categories || [];
      } catch (err) {
        return [];
      }
    },
    staleTime: 60000,
  });

  // Filter and sort products
  const filteredProducts = products
    .filter(p => {
      const matchesSearch = p.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           p.description?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === "all" || p.category === selectedCategory;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "price-low":
          return (a.price || 0) - (b.price || 0);
        case "price-high":
          return (b.price || 0) - (a.price || 0);
        case "newest":
          return new Date(b.created_at) - new Date(a.created_at);
        case "featured":
        default:
          return (b.featured ? 1 : 0) - (a.featured ? 1 : 0);
      }
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white py-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <ShoppingCart className="w-10 h-10" />
              <h1 className="text-4xl font-bold">Tienda Sinkia</h1>
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

            <div className="flex gap-3 flex-wrap">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-4 py-2 bg-white/10 border border-white/20 rounded text-white"
              >
                <option value="all">Todas las categorías</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-4 py-2 bg-white/10 border border-white/20 rounded text-white"
              >
                <option value="featured">Destacados</option>
                <option value="newest">Más nuevo</option>
                <option value="price-low">Precio menor</option>
                <option value="price-high">Precio mayor</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-3">
            {/* Features */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <Card className="bg-slate-800 border-slate-700">
                <CardContent className="p-6 flex items-center gap-3">
                  <Truck className="w-8 h-8 text-blue-400 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-white text-sm">Envío Rápido</p>
                    <p className="text-xs text-slate-400">En 24-48 horas</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-slate-800 border-slate-700">
                <CardContent className="p-6 flex items-center gap-3">
                  <Shield className="w-8 h-8 text-green-400 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-white text-sm">100% Seguro</p>
                    <p className="text-xs text-slate-400">Pago protegido</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-slate-800 border-slate-700">
                <CardContent className="p-6 flex items-center gap-3">
                  <Package className="w-8 h-8 text-purple-400 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-white text-sm">Garantía</p>
                    <p className="text-xs text-slate-400">Satisfacción 100%</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Products Grid */}
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />
              </div>
            ) : error ? (
              <Alert className="bg-red-900/20 border-red-800">
                <AlertCircle className="w-4 h-4 text-red-400" />
                <AlertDescription className="text-red-400">
                  Error cargando productos. Por favor intenta más tarde.
                </AlertDescription>
              </Alert>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-20">
                <Package className="w-16 h-16 text-slate-600 mx-auto mb-4 opacity-50" />
                <p className="text-slate-400 text-lg">No se encontraron productos</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredProducts.map(product => (
                  <Card key={product.id} className="bg-slate-800 border-slate-700 hover:border-blue-500 transition overflow-hidden group">
                    {/* Product Image */}
                    {product.image_url && (
                      <div className="relative h-48 bg-slate-700 overflow-hidden">
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-110 transition duration-300"
                        />
                        {product.discount && (
                          <Badge className="absolute top-3 right-3 bg-red-500">
                            -{product.discount}%
                          </Badge>
                        )}
                      </div>
                    )}

                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-white text-lg line-clamp-2">
                            {product.name}
                          </CardTitle>
                          {product.rating && (
                            <div className="flex items-center gap-1 mt-2">
                              <div className="flex text-yellow-400">
                                {[...Array(5)].map((_, i) => (
                                  <Star
                                    key={i}
                                    className={`w-4 h-4 ${i < Math.round(product.rating) ? "fill-current" : "text-slate-600"}`}
                                  />
                                ))}
                              </div>
                              <span className="text-xs text-slate-400">({product.reviews || 0})</span>
                            </div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-slate-400 hover:text-red-400"
                        >
                          <Heart className="w-5 h-5" />
                        </Button>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      <p className="text-slate-400 text-sm line-clamp-2">
                        {product.description}
                      </p>

                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-white">
                          ${product.price?.toFixed(2)}
                        </span>
                        {product.original_price && (
                          <span className="text-sm text-slate-500 line-through">
                            ${product.original_price?.toFixed(2)}
                          </span>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleAddToCart(product)}
                          className="flex-1 bg-blue-600 hover:bg-blue-700"
                        >
                          <ShoppingCart className="w-4 h-4 mr-2" />
                          Agregar
                        </Button>
                        <Button
                          variant="outline"
                          className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700"
                          onClick={() => {
                            // Could navigate to product detail page
                            toast.info("Detalles del producto: " + product.name);
                          }}
                        >
                          <ChevronRight className="w-4 h-4 mr-2" />
                          Ver
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Cart Sidebar */}
          {showCart && (
            <div className="lg:col-span-1">
              <Card className="bg-slate-800 border-slate-700 sticky top-4">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <ShoppingCart className="w-5 h-5" />
                    Tu Carrito
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {cartItems.length === 0 ? (
                    <p className="text-slate-400 text-sm text-center py-8">
                      Carrito vacío
                    </p>
                  ) : (
                    <>
                      <div className="space-y-3 max-h-96 overflow-y-auto">
                        {cartItems.map(item => (
                          <div key={item.id} className="bg-slate-700/50 p-3 rounded flex justify-between items-start">
                            <div className="flex-1">
                              <p className="text-white text-sm font-semibold line-clamp-1">
                                {item.name}
                              </p>
                              <p className="text-slate-400 text-xs">
                                ${item.price?.toFixed(2)} x {item.quantity}
                              </p>
                            </div>
                            <p className="text-blue-400 font-semibold text-sm">
                              ${(item.price * item.quantity).toFixed(2)}
                            </p>
                          </div>
                        ))}
                      </div>

                      <div className="border-t border-slate-600 pt-4 space-y-3">
                        <div className="flex justify-between items-center text-white">
                          <span>Subtotal:</span>
                          <span>${cartTotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center text-white">
                          <span>Envío:</span>
                          <span>Gratis</span>
                        </div>
                        <div className="border-t border-slate-600 pt-3 flex justify-between items-center text-lg font-bold text-blue-400">
                          <span>Total:</span>
                          <span>${cartTotal.toFixed(2)}</span>
                        </div>
                      </div>

                      <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2">
                        Procesar Compra
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full border-slate-600 text-slate-300 hover:bg-slate-700"
                        onClick={() => setCartItems([])}
                      >
                        Limpiar Carrito
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
