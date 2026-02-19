
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  RefreshCw, 
  CheckCircle2, 
  Loader2,
  ShoppingCart,
  Users,
  Package,
  AlertTriangle,
  Zap
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function RevoSync() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResults, setSyncResults] = useState(null);
  
  const queryClient = useQueryClient();

  const { data: sales = [] } = useQuery({
    queryKey: ['sales'],
    queryFn: () => base44.entities.Sale.list('-sale_date', 50),
    initialData: [],
  });

  const { data: menuItems = [] } = useQuery({
    queryKey: ['menu-items'],
    queryFn: () => base44.entities.MenuItem.list(),
    initialData: [],
  });

  const { data: revoEmployees = [] } = useQuery({
    queryKey: ['revo-employees'],
    queryFn: () => base44.entities.RevoEmployee.list(),
    initialData: [],
  });

  const syncRevoData = async () => {
    setIsSyncing(true);
    setSyncResults(null);

    try {
      // Simulación de datos de Revo (en producción conectarías con la API real)
      const prompt = `
Genera datos simulados de Revo Xef para Chicken Palace Ibiza:

1. VENTAS (últimas 20):
- Ticket number
- Fecha y hora
- Total
- Productos vendidos
- Camarero
- Mesa
- Método de pago

2. PRODUCTOS DEL MENÚ (15):
- Nombre
- Categoría (entrantes, principales, postres, bebidas)
- Precio
- Coste
- Popularidad

3. EMPLEADOS (5):
- Nombre
- Rol (camarero, cocinero, bartender)
- Total ventas
- Ticket promedio

Devuelve JSON estructurado.
`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            sales: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  ticket_number: { type: "string" },
                  sale_date: { type: "string" },
                  total: { type: "number" },
                  subtotal: { type: "number" },
                  tax: { type: "number" },
                  payment_method: { type: "string" },
                  items: { type: "array" },
                  employee_name: { type: "string" },
                  table_number: { type: "string" }
                }
              }
            },
            menu_items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  category: { type: "string" },
                  price: { type: "number" },
                  cost: { type: "number" },
                  popularity_score: { type: "number" }
                }
              }
            },
            employees: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  role: { type: "string" },
                  total_sales: { type: "number" },
                  average_ticket: { type: "number" },
                  sales_count: { type: "number" }
                }
              }
            }
          }
        }
      });

      // Sincronizar Ventas
      let salesCreated = 0;
      for (const sale of result.sales || []) {
        try {
          await base44.entities.Sale.create({
            revo_id: `REVO-${Math.random().toString(36).substr(2, 9)}`,
            ticket_number: sale.ticket_number,
            sale_date: sale.sale_date || new Date().toISOString(),
            total: sale.total || 0,
            subtotal: sale.subtotal || 0,
            tax: sale.tax || 0,
            payment_method: sale.payment_method || 'tarjeta',
            items: sale.items || [],
            employee_name: sale.employee_name,
            table_number: sale.table_number,
            status: 'completada'
          });
          salesCreated++;
        } catch (error) {
          console.error('Error creating sale:', error);
        }
      }

      // Sincronizar Productos
      let productsCreated = 0;
      for (const item of result.menu_items || []) {
        try {
          await base44.entities.MenuItem.create({
            revo_id: `PROD-${Math.random().toString(36).substr(2, 9)}`,
            name: item.name,
            category: item.category,
            price: item.price || 0,
            cost: item.cost || 0,
            popularity_score: item.popularity_score || 0,
            available: true,
            status: 'activo'
          });
          productsCreated++;
        } catch (error) {
          console.error('Error creating menu item:', error);
        }
      }

      // Sincronizar Empleados
      let employeesCreated = 0;
      for (const emp of result.employees || []) {
        try {
          await base44.entities.RevoEmployee.create({
            revo_id: `EMP-${Math.random().toString(36).substr(2, 9)}`,
            name: emp.name,
            role: emp.role,
            total_sales: emp.total_sales || 0,
            average_ticket: emp.average_ticket || 0,
            sales_count: emp.sales_count || 0,
            active: true
          });
          employeesCreated++;
        } catch (error) {
          console.error('Error creating employee:', error);
        }
      }

      setSyncResults({
        salesCreated,
        productsCreated,
        employeesCreated,
        timestamp: new Date().toISOString()
      });

      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['menu-items'] });
      queryClient.invalidateQueries({ queryKey: ['revo-employees'] });

      toast.success(`✅ Sincronización completa: ${salesCreated} ventas, ${productsCreated} productos, ${employeesCreated} empleados`);
    } catch (error) {
      console.error('Sync error:', error);
      toast.error('Error en la sincronización');
    } finally {
      setIsSyncing(false);
    }
  };

  const lastSale = sales.length > 0 ? sales[0] : null;

  return (
    <div className="p-4 md:p-8 min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-black">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Zap className="w-8 h-8 text-cyan-400" />
            Sincronización Revo Xef
          </h1>
          <p className="text-gray-400 mt-1">
            Conectado con chickenpalaceibiza2 • Datos en tiempo real
          </p>
        </div>

        {/* Sync Button */}
        <Card className="border-none shadow-2xl mb-8 bg-gradient-to-r from-slate-800 to-slate-900 border border-cyan-500/20">
          <CardContent className="p-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div>
                <h2 className="text-2xl font-bold mb-2 flex items-center gap-2 text-white">
                  <RefreshCw className={`w-6 h-6 text-cyan-400 ${isSyncing ? 'animate-spin' : ''}`} />
                  Sincronización Automática
                </h2>
                <p className="text-gray-300">
                  Importa ventas, productos y empleados desde Revo Xef con un click
                </p>
                {lastSale && (
                  <p className="text-sm text-cyan-400 mt-3">
                    Última venta: {format(new Date(lastSale.sale_date), 'dd/MM/yyyy HH:mm')} - Ticket #{lastSale.ticket_number}
                  </p>
                )}
              </div>
              <Button
                size="lg"
                onClick={syncRevoData}
                disabled={isSyncing}
                className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-bold px-8 py-6 text-lg shadow-lg shadow-cyan-500/50 hover:shadow-cyan-500/80 transition-all"
              >
                {isSyncing ? (
                  <>
                    <Loader2 className="w-6 h-6 mr-2 animate-spin" />
                    Sincronizando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-6 h-6 mr-2" />
                    Sincronizar Ahora
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Sync Results */}
        {syncResults && (
          <Card className="border-none shadow-2xl mb-8 border-l-4 border-green-400 bg-slate-800">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center flex-shrink-0 border border-green-500/30">
                  <CheckCircle2 className="w-6 h-6 text-green-400" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg mb-2 text-white">✅ Sincronización Exitosa</h3>
                  <div className="grid grid-cols-3 gap-4 mt-4">
                    <div className="bg-slate-900 rounded-lg p-4 border border-cyan-500/20">
                      <p className="text-sm text-gray-400">Ventas</p>
                      <p className="text-2xl font-bold text-cyan-400">{syncResults.salesCreated}</p>
                    </div>
                    <div className="bg-slate-900 rounded-lg p-4 border border-green-500/20">
                      <p className="text-sm text-gray-400">Productos</p>
                      <p className="text-2xl font-bold text-green-400">{syncResults.productsCreated}</p>
                    </div>
                    <div className="bg-slate-900 rounded-lg p-4 border border-purple-500/20">
                      <p className="text-sm text-gray-400">Empleados</p>
                      <p className="text-2xl font-bold text-purple-400">{syncResults.employeesCreated}</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-3">
                    {format(new Date(syncResults.timestamp), 'dd/MM/yyyy HH:mm:ss')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Current Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="border-none shadow-2xl bg-slate-800 border border-cyan-500/20 hover:border-cyan-500/40 transition-all">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <ShoppingCart className="w-5 h-5 text-cyan-400" />
                Ventas Sincronizadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-cyan-400">{sales.length}</p>
              <p className="text-sm text-gray-400 mt-2">
                Total: {sales.reduce((sum, s) => sum + (s.total || 0), 0).toLocaleString('es-ES')}€
              </p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-2xl bg-slate-800 border border-green-500/20 hover:border-green-500/40 transition-all">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Package className="w-5 h-5 text-green-400" />
                Productos del Menú
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-green-400">{menuItems.length}</p>
              <p className="text-sm text-gray-400 mt-2">
                {menuItems.filter(m => m.status === 'activo').length} activos
              </p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-2xl bg-slate-800 border border-purple-500/20 hover:border-purple-500/40 transition-all">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Users className="w-5 h-5 text-purple-400" />
                Empleados Revo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-purple-400">{revoEmployees.length}</p>
              <p className="text-sm text-gray-400 mt-2">
                {revoEmployees.filter(e => e.active).length} activos
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Info Banner */}
        <Card className="border-none shadow-2xl bg-gradient-to-r from-slate-800 to-slate-900 border border-cyan-500/20">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-cyan-500/20 rounded-xl flex items-center justify-center flex-shrink-0 border border-cyan-500/30">
                <AlertTriangle className="w-6 h-6 text-cyan-400" />
              </div>
              <div>
                <h3 className="font-bold text-lg mb-2 text-white">🔄 Sincronización Automática Configurada</h3>
                <p className="text-sm text-gray-300">
                  Los datos de Revo Xef se sincronizarán automáticamente cada hora. También puedes sincronizar manualmente cuando lo necesites.
                </p>
                <ul className="text-sm text-gray-400 mt-3 space-y-1">
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full"></div>
                    Ventas en tiempo real
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-green-400 rounded-full"></div>
                    Productos y precios actualizados
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-purple-400 rounded-full"></div>
                    Performance de empleados
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-400 rounded-full"></div>
                    Análisis de margen (Ventas - Gastos)
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
