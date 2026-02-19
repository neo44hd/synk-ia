import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { 
  Plus, 
  ShoppingCart, 
  Package,
  Euro,
  Trash2,
  Search,
  Calendar,
  TrendingUp,
  Edit,
  Receipt
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function RevoManual() {
  const [showSaleDialog, setShowSaleDialog] = useState(false);
  const [showProductDialog, setShowProductDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingProduct, setEditingProduct] = useState(null);
  
  const [saleForm, setSaleForm] = useState({
    sale_date: new Date().toISOString().slice(0, 16),
    total: "",
    payment_method: "efectivo",
    table_number: "",
    employee_name: "",
    notes: "",
    items: []
  });

  const [productForm, setProductForm] = useState({
    name: "",
    category: "principales",
    price: "",
    cost: "",
    description: "",
    available: true
  });

  const [newItem, setNewItem] = useState({ product_name: "", quantity: 1, price: "" });

  const queryClient = useQueryClient();

  const { data: sales = [] } = useQuery({
    queryKey: ['sales'],
    queryFn: () => base44.entities.Sale.list('-sale_date', 100),
  });

  const { data: menuItems = [] } = useQuery({
    queryKey: ['menu-items'],
    queryFn: () => base44.entities.MenuItem.list('-created_date'),
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['revo-employees'],
    queryFn: () => base44.entities.RevoEmployee.list(),
  });

  const createSaleMutation = useMutation({
    mutationFn: (data) => {
      const items = data.items.map(item => ({
        ...item,
        total: item.quantity * item.price
      }));
      const total = parseFloat(data.total) || items.reduce((sum, i) => sum + i.total, 0);
      
      return base44.entities.Sale.create({
        ticket_number: `TK-${Date.now().toString().slice(-6)}`,
        sale_date: data.sale_date,
        total,
        subtotal: total / 1.10, // IVA 10%
        tax: total - (total / 1.10),
        payment_method: data.payment_method,
        table_number: data.table_number,
        employee_name: data.employee_name,
        items,
        status: 'completada',
        notes: data.notes
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      toast.success('Venta registrada correctamente');
      setShowSaleDialog(false);
      resetSaleForm();
    }
  });

  const createProductMutation = useMutation({
    mutationFn: (data) => {
      if (editingProduct) {
        return base44.entities.MenuItem.update(editingProduct.id, {
          name: data.name,
          category: data.category,
          price: parseFloat(data.price) || 0,
          cost: parseFloat(data.cost) || 0,
          description: data.description,
          available: data.available,
          status: 'activo'
        });
      }
      return base44.entities.MenuItem.create({
        name: data.name,
        category: data.category,
        price: parseFloat(data.price) || 0,
        cost: parseFloat(data.cost) || 0,
        description: data.description,
        available: data.available,
        status: 'activo'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-items'] });
      toast.success(editingProduct ? 'Producto actualizado' : 'Producto añadido');
      setShowProductDialog(false);
      setEditingProduct(null);
      resetProductForm();
    }
  });

  const deleteSaleMutation = useMutation({
    mutationFn: (id) => base44.entities.Sale.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      toast.success('Venta eliminada');
    }
  });

  const deleteProductMutation = useMutation({
    mutationFn: (id) => base44.entities.MenuItem.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-items'] });
      toast.success('Producto eliminado');
    }
  });

  const resetSaleForm = () => {
    setSaleForm({
      sale_date: new Date().toISOString().slice(0, 16),
      total: "",
      payment_method: "efectivo",
      table_number: "",
      employee_name: "",
      notes: "",
      items: []
    });
    setNewItem({ product_name: "", quantity: 1, price: "" });
  };

  const resetProductForm = () => {
    setProductForm({
      name: "",
      category: "principales",
      price: "",
      cost: "",
      description: "",
      available: true
    });
  };

  const addItemToSale = () => {
    if (!newItem.product_name || !newItem.price) return;
    setSaleForm({
      ...saleForm,
      items: [...saleForm.items, { ...newItem, total: newItem.quantity * parseFloat(newItem.price) }]
    });
    setNewItem({ product_name: "", quantity: 1, price: "" });
  };

  const removeItemFromSale = (idx) => {
    setSaleForm({
      ...saleForm,
      items: saleForm.items.filter((_, i) => i !== idx)
    });
  };

  const openEditProduct = (product) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      category: product.category,
      price: product.price?.toString() || "",
      cost: product.cost?.toString() || "",
      description: product.description || "",
      available: product.available !== false
    });
    setShowProductDialog(true);
  };

  // Stats
  const todaySales = sales.filter(s => {
    const today = format(new Date(), 'yyyy-MM-dd');
    return s.sale_date?.startsWith(today);
  });
  const todayTotal = todaySales.reduce((sum, s) => sum + (s.total || 0), 0);
  const totalSales = sales.reduce((sum, s) => sum + (s.total || 0), 0);

  const categoryColors = {
    entrantes: 'bg-green-100 text-green-800',
    principales: 'bg-blue-100 text-blue-800',
    postres: 'bg-pink-100 text-pink-800',
    bebidas: 'bg-cyan-100 text-cyan-800',
    vinos: 'bg-purple-100 text-purple-800',
    cervezas: 'bg-yellow-100 text-yellow-800',
    cafes: 'bg-orange-100 text-orange-800',
    otros: 'bg-gray-100 text-gray-800'
  };

  const filteredSales = sales.filter(s =>
    s.ticket_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.employee_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredProducts = menuItems.filter(p =>
    p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-4 md:p-8 min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-3 h-3 bg-cyan-500 rounded-full animate-pulse" />
            <span className="text-sm font-medium text-cyan-400">
              Entrada Manual de Datos
            </span>
          </div>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <h1 className="text-4xl font-black text-white mb-2 flex items-center gap-4">
                <div className="w-14 h-14 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-2xl flex items-center justify-center shadow-2xl shadow-cyan-500/30">
                  <ShoppingCart className="w-8 h-8 text-white" />
                </div>
                REVO MANUAL
              </h1>
              <p className="text-gray-400">
                Ventas diarias, carta y productos - Entrada manual
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={() => {
                  setEditingProduct(null);
                  resetProductForm();
                  setShowProductDialog(true);
                }}
                variant="outline"
                className="border-cyan-500 text-cyan-400 hover:bg-cyan-500/20"
              >
                <Package className="w-4 h-4 mr-2" />
                Nuevo Producto
              </Button>
              <Button
                onClick={() => setShowSaleDialog(true)}
                className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Registrar Venta
              </Button>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-gradient-to-br from-green-900/30 to-emerald-900/30 border-green-600/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
                  <Euro className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">Hoy</p>
                  <p className="text-2xl font-bold text-white">{todayTotal.toFixed(2)}€</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-cyan-900/30 to-blue-900/30 border-cyan-600/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-cyan-600 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">Total Ventas</p>
                  <p className="text-2xl font-bold text-white">{totalSales.toFixed(2)}€</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 border-purple-600/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
                  <Receipt className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">Tickets</p>
                  <p className="text-2xl font-bold text-white">{sales.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-900/30 to-yellow-900/30 border-orange-600/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-600 rounded-lg flex items-center justify-center">
                  <Package className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">Productos</p>
                  <p className="text-2xl font-bold text-white">{menuItems.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar..."
              className="pl-10 bg-slate-800 border-slate-700 text-white"
            />
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="sales" className="space-y-6">
          <TabsList className="bg-slate-800 border border-slate-700">
            <TabsTrigger value="sales" className="data-[state=active]:bg-cyan-600">
              🧾 Ventas ({sales.length})
            </TabsTrigger>
            <TabsTrigger value="products" className="data-[state=active]:bg-cyan-600">
              📦 Carta / Productos ({menuItems.length})
            </TabsTrigger>
          </TabsList>

          {/* Ventas */}
          <TabsContent value="sales">
            <Card className="bg-slate-900 border-slate-700">
              <CardContent className="p-0">
                {filteredSales.length === 0 ? (
                  <div className="p-12 text-center">
                    <ShoppingCart className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400 mb-4">No hay ventas registradas</p>
                    <Button onClick={() => setShowSaleDialog(true)} className="bg-cyan-600 hover:bg-cyan-700">
                      <Plus className="w-4 h-4 mr-2" />
                      Registrar primera venta
                    </Button>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-700">
                    {filteredSales.map((sale) => (
                      <div key={sale.id} className="p-4 hover:bg-slate-800/50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-gradient-to-br from-cyan-600 to-blue-600 rounded-lg flex items-center justify-center">
                              <Receipt className="w-6 h-6 text-white" />
                            </div>
                            <div>
                              <p className="font-bold text-white">{sale.ticket_number}</p>
                              <p className="text-sm text-gray-400">
                                {sale.sale_date && format(new Date(sale.sale_date), 'dd/MM/yyyy HH:mm')}
                                {sale.table_number && ` • Mesa ${sale.table_number}`}
                              </p>
                              {sale.employee_name && (
                                <p className="text-xs text-gray-500">👤 {sale.employee_name}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="text-xl font-bold text-white">{sale.total?.toFixed(2)}€</p>
                              <Badge className="bg-green-100 text-green-800">
                                {sale.payment_method}
                              </Badge>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteSaleMutation.mutate(sale.id)}
                              className="text-red-400 hover:text-red-300 hover:bg-red-500/20"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        {sale.items?.length > 0 && (
                          <div className="mt-3 ml-16 flex flex-wrap gap-2">
                            {sale.items.map((item, idx) => (
                              <span key={idx} className="text-xs bg-slate-800 text-gray-300 px-2 py-1 rounded">
                                {item.quantity}x {item.product_name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Productos */}
          <TabsContent value="products">
            <Card className="bg-slate-900 border-slate-700">
              <CardContent className="p-0">
                {filteredProducts.length === 0 ? (
                  <div className="p-12 text-center">
                    <Package className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400 mb-4">No hay productos en la carta</p>
                    <Button onClick={() => setShowProductDialog(true)} className="bg-cyan-600 hover:bg-cyan-700">
                      <Plus className="w-4 h-4 mr-2" />
                      Añadir producto
                    </Button>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-700">
                    {filteredProducts.map((product) => (
                      <div key={product.id} className="p-4 hover:bg-slate-800/50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-gradient-to-br from-orange-600 to-yellow-600 rounded-lg flex items-center justify-center">
                              <Package className="w-6 h-6 text-white" />
                            </div>
                            <div>
                              <p className="font-bold text-white">{product.name}</p>
                              <div className="flex gap-2 mt-1">
                                <Badge className={categoryColors[product.category] || 'bg-gray-100 text-gray-800'}>
                                  {product.category}
                                </Badge>
                                {!product.available && (
                                  <Badge className="bg-red-100 text-red-800">No disponible</Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="text-xl font-bold text-white">{product.price?.toFixed(2)}€</p>
                              {product.cost > 0 && (
                                <p className="text-xs text-gray-500">
                                  Coste: {product.cost?.toFixed(2)}€ • Margen: {((1 - product.cost / product.price) * 100).toFixed(0)}%
                                </p>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openEditProduct(product)}
                                className="border-slate-600"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => deleteProductMutation.mutate(product.id)}
                                className="text-red-400 hover:text-red-300 hover:bg-red-500/20"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Dialog Nueva Venta */}
        <Dialog open={showSaleDialog} onOpenChange={setShowSaleDialog}>
          <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-cyan-400" />
                Registrar Venta / Caja
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Fecha y Hora</Label>
                  <Input
                    type="datetime-local"
                    value={saleForm.sale_date}
                    onChange={(e) => setSaleForm({...saleForm, sale_date: e.target.value})}
                    className="bg-slate-800 border-slate-700"
                  />
                </div>
                <div>
                  <Label>Método de Pago</Label>
                  <Select value={saleForm.payment_method} onValueChange={(v) => setSaleForm({...saleForm, payment_method: v})}>
                    <SelectTrigger className="bg-slate-800 border-slate-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="efectivo">Efectivo</SelectItem>
                      <SelectItem value="tarjeta">Tarjeta</SelectItem>
                      <SelectItem value="bizum">Bizum</SelectItem>
                      <SelectItem value="transferencia">Transferencia</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Mesa (opcional)</Label>
                  <Input
                    value={saleForm.table_number}
                    onChange={(e) => setSaleForm({...saleForm, table_number: e.target.value})}
                    className="bg-slate-800 border-slate-700"
                    placeholder="5"
                  />
                </div>
                <div>
                  <Label>Empleado</Label>
                  <Select value={saleForm.employee_name} onValueChange={(v) => setSaleForm({...saleForm, employee_name: v})}>
                    <SelectTrigger className="bg-slate-800 border-slate-700">
                      <SelectValue placeholder="Seleccionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map(emp => (
                        <SelectItem key={emp.id} value={emp.name}>{emp.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Items */}
              <div className="bg-slate-800 rounded-lg p-4">
                <Label className="mb-2 block">Productos vendidos</Label>
                <div className="flex gap-2 mb-3">
                  <Select value={newItem.product_name} onValueChange={(v) => {
                    const product = menuItems.find(p => p.name === v);
                    setNewItem({...newItem, product_name: v, price: product?.price?.toString() || ""});
                  }}>
                    <SelectTrigger className="bg-slate-700 border-slate-600 flex-1">
                      <SelectValue placeholder="Producto..." />
                    </SelectTrigger>
                    <SelectContent>
                      {menuItems.map(p => (
                        <SelectItem key={p.id} value={p.name}>{p.name} ({p.price}€)</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min="1"
                    value={newItem.quantity}
                    onChange={(e) => setNewItem({...newItem, quantity: parseInt(e.target.value) || 1})}
                    className="bg-slate-700 border-slate-600 w-16"
                  />
                  <Input
                    type="number"
                    step="0.01"
                    value={newItem.price}
                    onChange={(e) => setNewItem({...newItem, price: e.target.value})}
                    className="bg-slate-700 border-slate-600 w-20"
                    placeholder="€"
                  />
                  <Button onClick={addItemToSale} size="sm" className="bg-cyan-600">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                {saleForm.items.length > 0 && (
                  <div className="space-y-2">
                    {saleForm.items.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-slate-700 rounded px-3 py-2">
                        <span>{item.quantity}x {item.product_name}</span>
                        <div className="flex items-center gap-2">
                          <span>{item.total?.toFixed(2)}€</span>
                          <button onClick={() => removeItemFromSale(idx)} className="text-red-400">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="text-right font-bold text-cyan-400 pt-2 border-t border-slate-600">
                      Total: {saleForm.items.reduce((sum, i) => sum + (i.total || 0), 0).toFixed(2)}€
                    </div>
                  </div>
                )}
              </div>

              <div>
                <Label>O introduce el total directamente (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={saleForm.total}
                  onChange={(e) => setSaleForm({...saleForm, total: e.target.value})}
                  className="bg-slate-800 border-slate-700"
                  placeholder="125.50"
                />
              </div>

              <div>
                <Label>Notas</Label>
                <Textarea
                  value={saleForm.notes}
                  onChange={(e) => setSaleForm({...saleForm, notes: e.target.value})}
                  className="bg-slate-800 border-slate-700"
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSaleDialog(false)} className="border-slate-600">
                Cancelar
              </Button>
              <Button
                onClick={() => createSaleMutation.mutate(saleForm)}
                disabled={createSaleMutation.isPending || (!saleForm.total && saleForm.items.length === 0)}
                className="bg-cyan-600 hover:bg-cyan-700"
              >
                Registrar Venta
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog Producto */}
        <Dialog open={showProductDialog} onOpenChange={(open) => {
          setShowProductDialog(open);
          if (!open) setEditingProduct(null);
        }}>
          <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Package className="w-5 h-5 text-orange-400" />
                {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nombre *</Label>
                <Input
                  value={productForm.name}
                  onChange={(e) => setProductForm({...productForm, name: e.target.value})}
                  className="bg-slate-800 border-slate-700"
                  placeholder="Pollo asado"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Categoría</Label>
                  <Select value={productForm.category} onValueChange={(v) => setProductForm({...productForm, category: v})}>
                    <SelectTrigger className="bg-slate-800 border-slate-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="entrantes">Entrantes</SelectItem>
                      <SelectItem value="principales">Principales</SelectItem>
                      <SelectItem value="postres">Postres</SelectItem>
                      <SelectItem value="bebidas">Bebidas</SelectItem>
                      <SelectItem value="vinos">Vinos</SelectItem>
                      <SelectItem value="cervezas">Cervezas</SelectItem>
                      <SelectItem value="cafes">Cafés</SelectItem>
                      <SelectItem value="otros">Otros</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Precio (€) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={productForm.price}
                    onChange={(e) => setProductForm({...productForm, price: e.target.value})}
                    className="bg-slate-800 border-slate-700"
                    placeholder="12.50"
                  />
                </div>
              </div>

              <div>
                <Label>Coste (€) - para calcular margen</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={productForm.cost}
                  onChange={(e) => setProductForm({...productForm, cost: e.target.value})}
                  className="bg-slate-800 border-slate-700"
                  placeholder="4.00"
                />
              </div>

              <div>
                <Label>Descripción</Label>
                <Textarea
                  value={productForm.description}
                  onChange={(e) => setProductForm({...productForm, description: e.target.value})}
                  className="bg-slate-800 border-slate-700"
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowProductDialog(false)} className="border-slate-600">
                Cancelar
              </Button>
              <Button
                onClick={() => createProductMutation.mutate(productForm)}
                disabled={createProductMutation.isPending || !productForm.name || !productForm.price}
                className="bg-orange-600 hover:bg-orange-700"
              >
                {editingProduct ? 'Actualizar' : 'Guardar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}