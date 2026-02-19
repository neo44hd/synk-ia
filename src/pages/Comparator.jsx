import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter 
} from "@/components/ui/dialog";
import { 
  TrendingDown, 
  TrendingUp,
  Award, 
  Plus,
  AlertTriangle,
  Sparkles,
  DollarSign
} from "lucide-react";
import { toast } from "sonner";

export default function Comparator() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    product_name: '',
    category: ''
  });

  const queryClient = useQueryClient();

  const { data: comparisons = [], isLoading } = useQuery({
    queryKey: ['price-comparisons'],
    queryFn: () => base44.entities.PriceComparison.list('-savings_potential'),
    initialData: [],
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => base44.entities.Invoice.list(),
    initialData: [],
  });

  const createComparisonMutation = useMutation({
    mutationFn: async (productName) => {
      // Usar IA para analizar precios de las facturas
      const prompt = `
Analiza las facturas disponibles y encuentra información de precios para el producto: "${productName}".

Facturas: ${JSON.stringify(invoices.slice(0, 20))}

Devuelve un análisis de precios con:
- Lista de proveedores que tienen este producto
- Precio de cada proveedor
- Mejor precio
- Ahorro potencial
`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            providers_data: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  provider_name: { type: "string" },
                  price: { type: "number" }
                }
              }
            },
            best_price: { type: "number" },
            best_provider: { type: "string" },
            savings_potential: { type: "number" }
          }
        }
      });

      return base44.entities.PriceComparison.create({
        product_name: productName,
        category: formData.category,
        providers_data: result.providers_data || [],
        best_price: result.best_price || 0,
        best_provider: result.best_provider || '',
        savings_potential: result.savings_potential || 0
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['price-comparisons'] });
      toast.success('Comparación creada con IA');
      setIsDialogOpen(false);
      setFormData({ product_name: '', category: '' });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    createComparisonMutation.mutate(formData.product_name);
  };

  const totalSavings = comparisons.reduce((sum, comp) => sum + (comp.savings_potential || 0), 0);
  const avgSavings = comparisons.length > 0 ? totalSavings / comparisons.length : 0;

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Sparkles className="w-8 h-8 text-yellow-500" />
              Comparador IA de Precios
            </h1>
            <p className="text-gray-600 mt-1">
              Encuentra el mejor precio y ahorra dinero automáticamente
            </p>
          </div>
          <Button
            onClick={() => setIsDialogOpen(true)}
            className="bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800"
          >
            <Plus className="w-5 h-5 mr-2" />
            Analizar Producto
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="border-none shadow-lg bg-gradient-to-br from-green-500 to-green-700 text-white">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <TrendingDown className="w-6 h-6" />
                <p className="text-sm opacity-90">Ahorro Total Detectado</p>
              </div>
              <p className="text-4xl font-bold">{totalSavings.toFixed(2)}€</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <Award className="w-5 h-5 text-blue-600" />
                <p className="text-sm text-gray-600">Productos Analizados</p>
              </div>
              <p className="text-3xl font-bold">{comparisons.length}</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <DollarSign className="w-5 h-5 text-orange-600" />
                <p className="text-sm text-gray-600">Ahorro Medio</p>
              </div>
              <p className="text-3xl font-bold">{avgSavings.toFixed(2)}€</p>
            </CardContent>
          </Card>
        </div>

        {/* AI Banner */}
        <Card className="border-none shadow-lg mb-8 bg-gradient-to-r from-purple-500 to-indigo-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg mb-2">¿Cómo funciona la IA?</h3>
                <p className="text-sm opacity-90">
                  SYNK-IA analiza automáticamente todas tus facturas, identifica productos similares,
                  compara precios entre proveedores y te muestra dónde puedes ahorrar. 
                  Todo en segundos.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Comparisons List */}
        {isLoading ? (
          <Card className="border-none shadow-lg">
            <CardContent className="p-12 text-center">
              <p className="text-gray-600">Cargando comparaciones...</p>
            </CardContent>
          </Card>
        ) : comparisons.length === 0 ? (
          <Card className="border-none shadow-lg">
            <CardContent className="p-12 text-center">
              <Sparkles className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">Empieza a ahorrar</h3>
              <p className="text-gray-600 mb-6">
                Añade un producto para que la IA compare precios entre tus proveedores
              </p>
              <Button
                onClick={() => setIsDialogOpen(true)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Analizar primer producto
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {comparisons.map((comparison) => (
              <Card key={comparison.id} className="border-none shadow-lg hover:shadow-xl transition-all">
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <h3 className="text-xl font-bold">{comparison.product_name}</h3>
                        {comparison.category && (
                          <Badge className="bg-blue-100 text-blue-800">
                            {comparison.category}
                          </Badge>
                        )}
                      </div>
                      
                      {comparison.providers_data && comparison.providers_data.length > 0 && (
                        <div className="space-y-2">
                          {comparison.providers_data.map((provider, idx) => (
                            <div key={idx} className="flex items-center gap-3">
                              <div className={`w-2 h-2 rounded-full ${
                                provider.provider_name === comparison.best_provider 
                                  ? 'bg-green-500' 
                                  : 'bg-gray-300'
                              }`} />
                              <span className="text-sm text-gray-700 font-medium">
                                {provider.provider_name}
                              </span>
                              <span className="text-sm text-gray-600">
                                {provider.price?.toFixed(2)}€
                              </span>
                              {provider.provider_name === comparison.best_provider && (
                                <Badge className="bg-green-100 text-green-800 text-xs">
                                  <Award className="w-3 h-3 mr-1" />
                                  Mejor precio
                                </Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-3">
                      <div className="text-right">
                        <p className="text-sm text-gray-600 mb-1">Mejor precio encontrado</p>
                        <p className="text-3xl font-bold text-green-600">
                          {comparison.best_price?.toFixed(2)}€
                        </p>
                      </div>
                      
                      {comparison.savings_potential > 0 && (
                        <div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-2">
                          <div className="flex items-center gap-2">
                            <TrendingDown className="w-5 h-5 text-orange-600" />
                            <div>
                              <p className="text-xs text-orange-600 font-medium">
                                Ahorro potencial
                              </p>
                              <p className="text-xl font-bold text-orange-700">
                                {comparison.savings_potential?.toFixed(2)}€
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-yellow-500" />
                Analizar Producto con IA
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="product_name">Nombre del Producto *</Label>
                  <Input
                    id="product_name"
                    placeholder="Ej: Café en grano, Aceite de oliva..."
                    value={formData.product_name}
                    onChange={(e) => setFormData({...formData, product_name: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="category">Categoría (opcional)</Label>
                  <Input
                    id="category"
                    placeholder="Ej: Alimentación, Bebidas..."
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                  />
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-700">
                    💡 La IA analizará todas tus facturas para encontrar este producto
                    y comparar precios automáticamente
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  className="bg-blue-600 hover:bg-blue-700"
                  disabled={createComparisonMutation.isPending}
                >
                  {createComparisonMutation.isPending ? 'Analizando...' : 'Analizar con IA'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}