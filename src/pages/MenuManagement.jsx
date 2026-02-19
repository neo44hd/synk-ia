import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChefHat,
  Search,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Edit3,
  Save,
  X,
  Filter,
  Image,
  DollarSign,
  ToggleLeft,
  ToggleRight,
  Upload,
  AlertCircle,
  Clock,
  Package,
  TrendingUp,
  Utensils,
  Salad,
  Coffee,
  IceCream,
  ExternalLink,
  Trash2,
  Eye,
  EyeOff,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import RevoSyncService from "@/services/revoSyncService";

// Category icons
const categoryIcons = {
  comidas: <Utensils className="w-4 h-4" />,
  ensaladas: <Salad className="w-4 h-4" />,
  complementos: <ChefHat className="w-4 h-4" />,
  postres: <IceCream className="w-4 h-4" />,
  bebidas: <Coffee className="w-4 h-4" />,
};

// Product Image component
const ProductImage = ({ src, alt, className }) => {
  const [error, setError] = useState(false);

  if (error || !src) {
    return (
      <div className={`${className} bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center rounded-lg`}>
        <Image className="w-6 h-6 text-gray-400" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={`${className} object-cover rounded-lg`}
      onError={() => setError(true)}
    />
  );
};

// Edit Product Dialog
const EditProductDialog = ({ product, onSave, onClose }) => {
  const [editData, setEditData] = useState({
    name: product.name,
    price: product.price,
    available: product.available,
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(product.id, editData);
      onClose();
    } catch (error) {
      console.error('Error saving product:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Edit3 className="w-5 h-5 text-orange-500" />
          Editar Producto
        </DialogTitle>
        <DialogDescription>
          Modifica los datos del producto. Los cambios se sincronizarán con Revo XEF.
        </DialogDescription>
      </DialogHeader>
      
      <div className="space-y-4 py-4">
        <div className="flex items-center gap-4">
          <ProductImage 
            src={product.image} 
            alt={product.name}
            className="w-20 h-20"
          />
          <div className="flex-grow">
            <Label>Nombre del producto</Label>
            <Input
              value={editData.name}
              onChange={(e) => setEditData(prev => ({ ...prev, name: e.target.value }))}
              className="mt-1"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Precio (€)</Label>
            <Input
              type="number"
              step="0.01"
              value={editData.price}
              onChange={(e) => setEditData(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
              className="mt-1"
            />
          </div>
          <div>
            <Label>Categoría</Label>
            <Input
              value={product.categoryName}
              disabled
              className="mt-1 bg-gray-100 dark:bg-gray-800"
            />
          </div>
        </div>

        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div>
            <Label>Disponibilidad</Label>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {editData.available ? 'Visible en la carta' : 'Oculto de la carta'}
            </p>
          </div>
          <Switch
            checked={editData.available}
            onCheckedChange={(checked) => setEditData(prev => ({ ...prev, available: checked }))}
          />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button 
          onClick={handleSave} 
          disabled={saving}
          className="bg-orange-500 hover:bg-orange-600"
        >
          {saving ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Guardando...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Guardar Cambios
            </>
          )}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
};

export default function MenuManagement() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [syncStatus, setSyncStatus] = useState(null);
  const [syncEvents, setSyncEvents] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [showOnlyAvailable, setShowOnlyAvailable] = useState(false);

  // Load data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    const allProducts = RevoSyncService.getProducts();
    const allCategories = RevoSyncService.getCategories();
    const status = RevoSyncService.getSyncStatus();
    const events = RevoSyncService.getSyncEvents(10);

    setProducts(allProducts);
    setCategories(allCategories);
    setSyncStatus(status);
    setSyncEvents(events);
  };

  // Filter products
  const filteredProducts = products.filter(p => {
    if (selectedCategory !== 'all' && p.category !== selectedCategory) return false;
    if (showOnlyAvailable && !p.available) return false;
    if (searchQuery.length >= 2) {
      const normalized = searchQuery.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const name = p.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (!name.includes(normalized)) return false;
    }
    return true;
  });

  // Handle sync
  const handleSync = async () => {
    setSyncing(true);
    try {
      const status = await RevoSyncService.forceSync();
      setSyncStatus(status);
      loadData();
    } catch (error) {
      console.error('Sync error:', error);
    } finally {
      setSyncing(false);
    }
  };

  // Handle product update
  const handleProductUpdate = async (productId, updates) => {
    try {
      await RevoSyncService.updateProduct(productId, updates);
      loadData();
    } catch (error) {
      console.error('Update error:', error);
      throw error;
    }
  };

  // Handle toggle availability
  const handleToggleAvailability = async (productId) => {
    try {
      await RevoSyncService.toggleProductAvailability(productId);
      loadData();
    } catch (error) {
      console.error('Toggle error:', error);
    }
  };

  // Stats
  const stats = {
    total: products.length,
    available: products.filter(p => p.available).length,
    unavailable: products.filter(p => !p.available).length,
    categories: categories.length,
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <ChefHat className="w-8 h-8 text-orange-500" />
              Gestión de Carta
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Administra los productos de tu carta digital
            </p>
          </div>
          
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => window.open('/pedir', '_blank')}
            >
              <Eye className="w-4 h-4 mr-2" />
              Ver Carta
            </Button>
            <Button 
              onClick={handleSync}
              disabled={syncing}
              className="bg-orange-500 hover:bg-orange-600"
            >
              {syncing ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Sincronizando...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Sincronizar Revo
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-white dark:bg-gray-800 border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Package className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Total Productos</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-gray-800 border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.available}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Disponibles</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-gray-800 border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                  <XCircle className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.unavailable}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Ocultos</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-gray-800 border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                  <Filter className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.categories}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Categorías</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sync Status */}
        {syncStatus && (
          <Card className="bg-white dark:bg-gray-800 border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
                    syncStatus.status === 'success' 
                      ? 'bg-green-100 dark:bg-green-900/30' 
                      : 'bg-yellow-100 dark:bg-yellow-900/30'
                  }`}>
                    {syncStatus.status === 'success' ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-yellow-500" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      Última sincronización
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {new Date(syncStatus.lastSync).toLocaleString('es-ES')} • {syncStatus.productCount} productos
                    </p>
                  </div>
                </div>
                <Badge variant={syncStatus.status === 'success' ? 'default' : 'warning'} className="bg-green-500 text-white">
                  {syncStatus.status === 'success' ? 'Sincronizado' : 'Pendiente'}
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Content */}
        <Tabs defaultValue="products" className="space-y-6">
          <TabsList className="bg-white dark:bg-gray-800 p-1">
            <TabsTrigger value="products" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white">
              <Package className="w-4 h-4 mr-2" />
              Productos
            </TabsTrigger>
            <TabsTrigger value="categories" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white">
              <Filter className="w-4 h-4 mr-2" />
              Categorías
            </TabsTrigger>
            <TabsTrigger value="activity" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white">
              <Clock className="w-4 h-4 mr-2" />
              Actividad
            </TabsTrigger>
          </TabsList>

          {/* Products Tab */}
          <TabsContent value="products" className="space-y-4">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-grow">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  placeholder="Buscar productos..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-white dark:bg-gray-800"
                />
              </div>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-full sm:w-48 bg-white dark:bg-gray-800">
                  <SelectValue placeholder="Categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las categorías</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>
                      <span className="flex items-center gap-2">
                        {categoryIcons[cat.id]}
                        {cat.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2 bg-white dark:bg-gray-800 px-4 py-2 rounded-lg">
                <Switch
                  id="show-available"
                  checked={showOnlyAvailable}
                  onCheckedChange={setShowOnlyAvailable}
                />
                <Label htmlFor="show-available" className="text-sm whitespace-nowrap">
                  Solo disponibles
                </Label>
              </div>
            </div>

            {/* Products Table */}
            <Card className="bg-white dark:bg-gray-800 border-0 shadow-sm overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-200 dark:border-gray-700">
                    <TableHead className="w-16">Foto</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead className="text-right">Precio</TableHead>
                    <TableHead className="text-center">Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => (
                    <TableRow 
                      key={product.id}
                      className={`border-gray-200 dark:border-gray-700 ${!product.available ? 'opacity-60' : ''}`}
                    >
                      <TableCell>
                        <ProductImage
                          src={product.image}
                          alt={product.name}
                          className="w-12 h-12"
                        />
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {product.name}
                          </p>
                          {product.featured && (
                            <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 text-xs mt-1">
                              Destacado
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {categoryIcons[product.category]}
                          <span className="text-gray-600 dark:text-gray-400">
                            {product.categoryName}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium text-gray-900 dark:text-white">
                        {product.priceDisplay}
                      </TableCell>
                      <TableCell className="text-center">
                        <button
                          onClick={() => handleToggleAvailability(product.id)}
                          className="inline-flex items-center"
                        >
                          {product.available ? (
                            <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 cursor-pointer hover:bg-green-200">
                              <Eye className="w-3 h-3 mr-1" />
                              Visible
                            </Badge>
                          ) : (
                            <Badge className="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 cursor-pointer hover:bg-gray-200">
                              <EyeOff className="w-3 h-3 mr-1" />
                              Oculto
                            </Badge>
                          )}
                        </button>
                      </TableCell>
                      <TableCell className="text-right">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingProduct(product)}
                            >
                              <Edit3 className="w-4 h-4" />
                            </Button>
                          </DialogTrigger>
                          {editingProduct?.id === product.id && (
                            <EditProductDialog
                              product={editingProduct}
                              onSave={handleProductUpdate}
                              onClose={() => setEditingProduct(null)}
                            />
                          )}
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              {filteredProducts.length === 0 && (
                <div className="text-center py-12">
                  <Package className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                  <p className="text-gray-500 dark:text-gray-400">No se encontraron productos</p>
                </div>
              )}
            </Card>
          </TabsContent>

          {/* Categories Tab */}
          <TabsContent value="categories">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categories.map((category) => {
                const categoryProducts = products.filter(p => p.category === category.id);
                const availableCount = categoryProducts.filter(p => p.available).length;
                
                return (
                  <Card key={category.id} className="bg-white dark:bg-gray-800 border-0 shadow-sm">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                          <span className="text-2xl">{category.icon}</span>
                          {category.name}
                        </CardTitle>
                        <Badge variant="secondary">
                          {categoryProducts.length} productos
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500 dark:text-gray-400">Visibles</span>
                          <span className="font-medium text-green-500">{availableCount}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500 dark:text-gray-400">Ocultos</span>
                          <span className="font-medium text-gray-400">{categoryProducts.length - availableCount}</span>
                        </div>
                        <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-green-500 transition-all"
                            style={{ width: `${(availableCount / categoryProducts.length) * 100}%` }}
                          />
                        </div>
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => setSelectedCategory(category.id)}
                        >
                          Ver productos
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* Activity Tab */}
          <TabsContent value="activity">
            <Card className="bg-white dark:bg-gray-800 border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-orange-500" />
                  Historial de Sincronización
                </CardTitle>
              </CardHeader>
              <CardContent>
                {syncEvents.length === 0 ? (
                  <div className="text-center py-8">
                    <Clock className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                    <p className="text-gray-500 dark:text-gray-400">No hay eventos recientes</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {syncEvents.map((event, index) => (
                      <div 
                        key={index}
                        className="flex items-start gap-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
                      >
                        <div className={`p-2 rounded-lg ${
                          event.type === 'force_sync' 
                            ? 'bg-blue-100 dark:bg-blue-900/30' 
                            : 'bg-orange-100 dark:bg-orange-900/30'
                        }`}>
                          {event.type === 'force_sync' ? (
                            <RefreshCw className="w-5 h-5 text-blue-500" />
                          ) : (
                            <Edit3 className="w-5 h-5 text-orange-500" />
                          )}
                        </div>
                        <div className="flex-grow">
                          <p className="font-medium text-gray-900 dark:text-white">
                            {event.type === 'force_sync' ? 'Sincronización completa' : 'Actualización de producto'}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {new Date(event.timestamp).toLocaleString('es-ES')}
                          </p>
                          {event.data.productId && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                              ID: {event.data.productId}
                            </p>
                          )}
                        </div>
                        <Badge variant="secondary">
                          {event.type === 'force_sync' ? event.data.productCount + ' productos' : 'Cambio local'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
