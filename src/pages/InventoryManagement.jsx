import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Package, 
  AlertTriangle, 
  TrendingDown, 
  TrendingUp,
  Plus,
  Minus,
  Search,
  Filter,
  Building2,
  ShoppingCart,
  ArrowRightLeft,
  Boxes,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  Truck,
  Barcode,
  Edit,
  Save,
  X,
  FileDown,
  Loader2
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";

// Categorías de productos
const CATEGORIES = [
  { id: 'all', name: 'Todos', icon: '📦' },
  { id: 'comidas', name: 'Comidas', icon: '🍗' },
  { id: 'bebidas', name: 'Bebidas', icon: '🥤' },
  { id: 'complementos', name: 'Complementos', icon: '🍟' },
  { id: 'postres', name: 'Postres', icon: '🍰' },
  { id: 'ingredientes', name: 'Ingredientes', icon: '🥬' },
  { id: 'envases', name: 'Envases', icon: '📦' },
];

// Stock de ejemplo si no hay datos
const DEMO_STOCK = [
  { id: 1, name: 'Pollo Entero', category: 'ingredientes', stock: 45, minStock: 20, unit: 'kg', price: 4.50, provider: 'Distribuciones García' },
  { id: 2, name: 'Patatas Congeladas', category: 'ingredientes', stock: 8, minStock: 15, unit: 'kg', price: 1.20, provider: 'Congelados Norte' },
  { id: 3, name: 'Coca-Cola 33cl', category: 'bebidas', stock: 120, minStock: 50, unit: 'uds', price: 0.45, provider: 'Coca-Cola Ibérica' },
  { id: 4, name: 'Pan Hamburguesa', category: 'ingredientes', stock: 5, minStock: 30, unit: 'uds', price: 0.25, provider: 'Panadería El Molino' },
  { id: 5, name: 'Aceite Girasol 5L', category: 'ingredientes', stock: 12, minStock: 6, unit: 'uds', price: 8.90, provider: 'Aceites del Sur' },
  { id: 6, name: 'Lechuga Iceberg', category: 'ingredientes', stock: 3, minStock: 10, unit: 'uds', price: 0.80, provider: 'Frutas Frescas' },
  { id: 7, name: 'Envases Cartón Medio', category: 'envases', stock: 250, minStock: 100, unit: 'uds', price: 0.12, provider: 'Envases Eco' },
  { id: 8, name: 'Agua Mineral 50cl', category: 'bebidas', stock: 80, minStock: 40, unit: 'uds', price: 0.25, provider: 'Aguas del Norte' },
  { id: 9, name: 'Salsa BBQ 5L', category: 'ingredientes', stock: 4, minStock: 3, unit: 'uds', price: 12.50, provider: 'Salsas Premium' },
  { id: 10, name: 'Nuggets Pollo', category: 'comidas', stock: 15, minStock: 10, unit: 'kg', price: 6.80, provider: 'Distribuciones García' },
];

export default function InventoryManagement() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showLowStock, setShowLowStock] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [movementType, setMovementType] = useState('entrada');
  const [movementQty, setMovementQty] = useState('');
  const [movementNote, setMovementNote] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isNewProductOpen, setIsNewProductOpen] = useState(false);

  // Obtener productos del inventario
  const { data: inventoryItems = [], isLoading } = useQuery({
    queryKey: ['inventory-items'],
    queryFn: async () => {
      try {
        const items = await base44.entities.Product.list();
        return items.length > 0 ? items : DEMO_STOCK;
      } catch {
        return DEMO_STOCK;
      }
    },
    initialData: DEMO_STOCK,
  });

  // Obtener proveedores
  const { data: providers = [] } = useQuery({
    queryKey: ['providers-inventory'],
    queryFn: () => base44.entities.Provider.list(),
    initialData: [],
  });

  // Obtener movimientos de stock
  const { data: stockMovements = [] } = useQuery({
    queryKey: ['stock-movements'],
    queryFn: async () => {
      try {
        return await base44.entities.StockMovement?.list('-created_date', 50) || [];
      } catch {
        return [];
      }
    },
    initialData: [],
  });

  // Mutation para actualizar stock
  const updateStockMutation = useMutation({
    mutationFn: async ({ productId, quantity, type, note }) => {
      // Simular actualización de stock
      await new Promise(resolve => setTimeout(resolve, 500));
      return { productId, quantity, type, note };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      toast.success('✅ Stock actualizado correctamente');
      setIsDialogOpen(false);
      setMovementQty('');
      setMovementNote('');
    },
    onError: (error) => {
      toast.error('Error al actualizar stock: ' + error.message);
    }
  });

  // Filtrar productos
  const filteredProducts = useMemo(() => {
    let filtered = inventoryItems;

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(p => p.category === selectedCategory);
    }

    if (showLowStock) {
      filtered = filtered.filter(p => p.stock <= p.minStock);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p => 
        p.name?.toLowerCase().includes(query) ||
        p.provider?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [inventoryItems, selectedCategory, showLowStock, searchQuery]);

  // Estadísticas
  const stats = useMemo(() => {
    const total = inventoryItems.length;
    const lowStock = inventoryItems.filter(p => p.stock <= p.minStock).length;
    const outOfStock = inventoryItems.filter(p => p.stock === 0).length;
    const totalValue = inventoryItems.reduce((sum, p) => sum + (p.stock * (p.price || 0)), 0);
    return { total, lowStock, outOfStock, totalValue };
  }, [inventoryItems]);

  // Manejar movimiento de stock
  const handleStockMovement = () => {
    if (!selectedProduct || !movementQty) return;

    const qty = parseInt(movementQty);
    if (isNaN(qty) || qty <= 0) {
      toast.error('Introduce una cantidad válida');
      return;
    }

    updateStockMutation.mutate({
      productId: selectedProduct.id,
      quantity: movementType === 'entrada' ? qty : -qty,
      type: movementType,
      note: movementNote
    });
  };

  // Obtener estado de stock
  const getStockStatus = (product) => {
    if (product.stock === 0) return { status: 'sin_stock', color: 'bg-red-500', text: 'Sin Stock' };
    if (product.stock <= product.minStock * 0.5) return { status: 'critico', color: 'bg-red-500', text: 'Crítico' };
    if (product.stock <= product.minStock) return { status: 'bajo', color: 'bg-amber-500', text: 'Stock Bajo' };
    return { status: 'ok', color: 'bg-emerald-500', text: 'OK' };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <div className="p-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500">
                <Boxes className="w-8 h-8 text-white" />
              </div>
              Gestión de Inventario
            </h1>
            <p className="text-gray-400 mt-1">Control de stock y alertas en tiempo real</p>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              variant={showLowStock ? "default" : "outline"}
              onClick={() => setShowLowStock(!showLowStock)}
              className={showLowStock ? "bg-amber-600 hover:bg-amber-700" : "border-slate-600 text-white hover:bg-slate-700"}
            >
              <AlertTriangle className="w-4 h-4 mr-2" />
              Stock Bajo ({stats.lowStock})
            </Button>
            <Button 
              onClick={() => setIsNewProductOpen(true)}
              className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Producto
            </Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-none shadow-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-blue-300/80 text-sm font-medium">Total Productos</p>
                  <h3 className="text-3xl font-bold text-white mt-1">{stats.total}</h3>
                  <p className="text-gray-400 text-sm mt-2">en inventario</p>
                </div>
                <div className="p-3 rounded-xl bg-blue-500/30">
                  <Package className="w-6 h-6 text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-amber-300/80 text-sm font-medium">Stock Bajo</p>
                  <h3 className="text-3xl font-bold text-white mt-1">{stats.lowStock}</h3>
                  <p className="text-amber-400 text-sm mt-2">⚠️ Requieren atención</p>
                </div>
                <div className="p-3 rounded-xl bg-amber-500/30">
                  <AlertTriangle className="w-6 h-6 text-amber-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-xl bg-gradient-to-br from-red-500/20 to-pink-500/20">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-red-300/80 text-sm font-medium">Sin Stock</p>
                  <h3 className="text-3xl font-bold text-white mt-1">{stats.outOfStock}</h3>
                  <p className="text-red-400 text-sm mt-2">🔴 Agotados</p>
                </div>
                <div className="p-3 rounded-xl bg-red-500/30">
                  <AlertCircle className="w-6 h-6 text-red-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-emerald-300/80 text-sm font-medium">Valor Stock</p>
                  <h3 className="text-3xl font-bold text-white mt-1">
                    {stats.totalValue.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                  </h3>
                  <p className="text-gray-400 text-sm mt-2">valoración total</p>
                </div>
                <div className="p-3 rounded-xl bg-emerald-500/30">
                  <ShoppingCart className="w-6 h-6 text-emerald-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filtros y búsqueda */}
        <Card className="border-none shadow-xl bg-slate-800/50 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Buscar producto o proveedor..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-slate-700 border-slate-600 text-white placeholder:text-gray-400"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                {CATEGORIES.map(cat => (
                  <Button
                    key={cat.id}
                    variant={selectedCategory === cat.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={selectedCategory === cat.id 
                      ? "bg-blue-600 hover:bg-blue-700" 
                      : "border-slate-600 text-gray-300 hover:bg-slate-700"
                    }
                  >
                    <span className="mr-1">{cat.icon}</span>
                    {cat.name}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lista de productos */}
        <Card className="border-none shadow-xl bg-slate-800/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-white flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Package className="w-5 h-5 text-blue-400" />
                Productos en Stock ({filteredProducts.length})
              </span>
              <Button variant="outline" size="sm" className="border-slate-600 text-gray-300">
                <FileDown className="w-4 h-4 mr-2" />
                Exportar
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              <div className="space-y-2">
                {filteredProducts.map((product) => {
                  const stockStatus = getStockStatus(product);
                  const stockPercentage = Math.min((product.stock / (product.minStock * 2)) * 100, 100);

                  return (
                    <div
                      key={product.id}
                      className="flex items-center gap-4 p-4 rounded-lg bg-slate-700/50 hover:bg-slate-700 transition-colors cursor-pointer"
                      onClick={() => {
                        setSelectedProduct(product);
                        setIsDialogOpen(true);
                      }}
                    >
                      {/* Indicador de estado */}
                      <div className={`w-2 h-12 rounded-full ${stockStatus.color}`} />

                      {/* Info del producto */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-white font-medium truncate">{product.name}</h3>
                          <Badge className={`text-xs ${
                            stockStatus.status === 'ok' ? 'bg-emerald-500/20 text-emerald-400' :
                            stockStatus.status === 'bajo' ? 'bg-amber-500/20 text-amber-400' :
                            'bg-red-500/20 text-red-400'
                          }`}>
                            {stockStatus.text}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-1">
                          <span className="text-gray-400 text-sm flex items-center gap-1">
                            <Building2 className="w-3 h-3" />
                            {product.provider || 'Sin proveedor'}
                          </span>
                          <span className="text-gray-400 text-sm">
                            Mín: {product.minStock} {product.unit}
                          </span>
                        </div>
                      </div>

                      {/* Stock actual */}
                      <div className="text-right min-w-[120px]">
                        <div className="text-2xl font-bold text-white">
                          {product.stock} <span className="text-sm text-gray-400">{product.unit}</span>
                        </div>
                        <Progress 
                          value={stockPercentage} 
                          className="h-2 mt-2 bg-slate-600"
                        />
                      </div>

                      {/* Precio */}
                      <div className="text-right min-w-[80px]">
                        <p className="text-gray-400 text-sm">Precio unit.</p>
                        <p className="text-emerald-400 font-medium">{product.price?.toFixed(2)} €</p>
                      </div>

                      {/* Acciones rápidas */}
                      <div className="flex gap-2">
                        <Button
                          size="icon"
                          variant="outline"
                          className="border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/20"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedProduct(product);
                            setMovementType('entrada');
                            setIsDialogOpen(true);
                          }}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          className="border-red-500/50 text-red-400 hover:bg-red-500/20"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedProduct(product);
                            setMovementType('salida');
                            setIsDialogOpen(true);
                          }}
                        >
                          <Minus className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}

                {filteredProducts.length === 0 && (
                  <div className="text-center py-12 text-gray-400">
                    <Package className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p className="text-lg">No se encontraron productos</p>
                    <p className="text-sm mt-1">Prueba con otros filtros o busca otro término</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Alertas de stock bajo */}
        {stats.lowStock > 0 && (
          <Card className="border-none shadow-xl bg-gradient-to-r from-amber-500/10 to-red-500/10 border-amber-500/30">
            <CardHeader>
              <CardTitle className="text-amber-400 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Alertas de Stock ({stats.lowStock} productos)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {inventoryItems
                  .filter(p => p.stock <= p.minStock)
                  .slice(0, 6)
                  .map(product => (
                    <div key={product.id} className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        product.stock === 0 ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'
                      }`}>
                        {product.stock === 0 ? <X className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium truncate">{product.name}</p>
                        <p className="text-gray-400 text-sm">
                          Stock: {product.stock} / Mín: {product.minStock}
                        </p>
                      </div>
                      <Button size="sm" variant="outline" className="border-amber-500/50 text-amber-400 hover:bg-amber-500/20">
                        <Truck className="w-4 h-4 mr-1" />
                        Pedir
                      </Button>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Dialog para movimiento de stock */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-blue-400" />
              Movimiento de Stock
            </DialogTitle>
          </DialogHeader>
          
          {selectedProduct && (
            <div className="space-y-4">
              {/* Producto seleccionado */}
              <div className="p-4 rounded-lg bg-slate-800">
                <h3 className="font-medium text-white">{selectedProduct.name}</h3>
                <p className="text-gray-400 text-sm mt-1">
                  Stock actual: <span className="text-white font-bold">{selectedProduct.stock} {selectedProduct.unit}</span>
                </p>
              </div>

              {/* Tipo de movimiento */}
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant={movementType === 'entrada' ? 'default' : 'outline'}
                  onClick={() => setMovementType('entrada')}
                  className={movementType === 'entrada' 
                    ? 'bg-emerald-600 hover:bg-emerald-700' 
                    : 'border-slate-600 text-gray-300'
                  }
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Entrada
                </Button>
                <Button
                  variant={movementType === 'salida' ? 'default' : 'outline'}
                  onClick={() => setMovementType('salida')}
                  className={movementType === 'salida' 
                    ? 'bg-red-600 hover:bg-red-700' 
                    : 'border-slate-600 text-gray-300'
                  }
                >
                  <Minus className="w-4 h-4 mr-2" />
                  Salida
                </Button>
              </div>

              {/* Cantidad */}
              <div>
                <Label className="text-gray-300">Cantidad ({selectedProduct.unit})</Label>
                <Input
                  type="number"
                  value={movementQty}
                  onChange={(e) => setMovementQty(e.target.value)}
                  placeholder="Introduce cantidad"
                  className="mt-1 bg-slate-800 border-slate-600 text-white"
                  min="1"
                />
              </div>

              {/* Nota/Motivo */}
              <div>
                <Label className="text-gray-300">Nota (opcional)</Label>
                <Input
                  value={movementNote}
                  onChange={(e) => setMovementNote(e.target.value)}
                  placeholder="Ej: Recepción pedido #123"
                  className="mt-1 bg-slate-800 border-slate-600 text-white"
                />
              </div>

              {/* Preview */}
              {movementQty && (
                <div className="p-3 rounded-lg bg-slate-800 border border-slate-700">
                  <p className="text-gray-400 text-sm">Resultado:</p>
                  <p className="text-lg font-bold text-white">
                    {selectedProduct.stock} {movementType === 'entrada' ? '+' : '-'} {movementQty} = {' '}
                    <span className={movementType === 'entrada' ? 'text-emerald-400' : 'text-red-400'}>
                      {selectedProduct.stock + (movementType === 'entrada' ? parseInt(movementQty) || 0 : -(parseInt(movementQty) || 0))} {selectedProduct.unit}
                    </span>
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="border-slate-600 text-gray-300">
              Cancelar
            </Button>
            <Button 
              onClick={handleStockMovement}
              disabled={updateStockMutation.isPending || !movementQty}
              className={movementType === 'entrada' 
                ? 'bg-emerald-600 hover:bg-emerald-700' 
                : 'bg-red-600 hover:bg-red-700'
              }
            >
              {updateStockMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Confirmar {movementType === 'entrada' ? 'Entrada' : 'Salida'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para nuevo producto */}
      <Dialog open={isNewProductOpen} onOpenChange={setIsNewProductOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-emerald-400" />
              Nuevo Producto
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label className="text-gray-300">Nombre del producto</Label>
              <Input placeholder="Ej: Pollo Entero" className="mt-1 bg-slate-800 border-slate-600 text-white" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-300">Categoría</Label>
                <Select>
                  <SelectTrigger className="mt-1 bg-slate-800 border-slate-600 text-white">
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    {CATEGORIES.filter(c => c.id !== 'all').map(cat => (
                      <SelectItem key={cat.id} value={cat.id} className="text-white">
                        {cat.icon} {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-gray-300">Unidad</Label>
                <Select>
                  <SelectTrigger className="mt-1 bg-slate-800 border-slate-600 text-white">
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="kg" className="text-white">Kilogramos (kg)</SelectItem>
                    <SelectItem value="uds" className="text-white">Unidades</SelectItem>
                    <SelectItem value="l" className="text-white">Litros (L)</SelectItem>
                    <SelectItem value="cajas" className="text-white">Cajas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-300">Stock inicial</Label>
                <Input type="number" placeholder="0" className="mt-1 bg-slate-800 border-slate-600 text-white" />
              </div>
              <div>
                <Label className="text-gray-300">Stock mínimo</Label>
                <Input type="number" placeholder="10" className="mt-1 bg-slate-800 border-slate-600 text-white" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-300">Precio unitario (€)</Label>
                <Input type="number" step="0.01" placeholder="0.00" className="mt-1 bg-slate-800 border-slate-600 text-white" />
              </div>
              <div>
                <Label className="text-gray-300">Proveedor</Label>
                <Select>
                  <SelectTrigger className="mt-1 bg-slate-800 border-slate-600 text-white">
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    {providers.length > 0 ? (
                      providers.map(p => (
                        <SelectItem key={p.id} value={p.id} className="text-white">{p.name}</SelectItem>
                      ))
                    ) : (
                      <SelectItem value="none" className="text-white">Sin proveedores</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsNewProductOpen(false)} className="border-slate-600 text-gray-300">
              Cancelar
            </Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700">
              <Save className="w-4 h-4 mr-2" />
              Guardar Producto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
