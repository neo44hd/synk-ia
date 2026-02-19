import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Mic, 
  Volume2,
  Zap,
  FileText,
  Package,
  Users,
  TrendingDown,
  MessageSquare,
  Sparkles,
  CheckCircle2,
  PlayCircle
} from "lucide-react";
import { format } from "date-fns";

export default function VoiceCommands() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        console.error('Error loading user:', error);
      }
    };
    loadUser();
  }, []);

  // Comandos de ejemplo organizados por categoría
  const commandCategories = [
    {
      name: "Crear Documentos",
      icon: FileText,
      color: "from-blue-500 to-blue-700",
      commands: [
        {
          text: "Crear factura de Makro con 20 kilos de pollo a 8 euros",
          result: "✅ Factura creada: Makro, 20kg pollo, 160€ + IVA"
        },
        {
          text: "Nuevo albarán para cliente García con 5 mesas modelo Roma",
          result: "✅ Albarán ALB-20250115-001 creado para García"
        },
        {
          text: "Factura de Ibersol con 10 sacos de patatas a 12 euros",
          result: "✅ Factura Ibersol: 10 sacos, 120€"
        }
      ]
    },
    {
      name: "Navegación",
      icon: Sparkles,
      color: "from-purple-500 to-purple-700",
      commands: [
        {
          text: "Ir al dashboard",
          result: "🧭 Abriendo Dashboard"
        },
        {
          text: "Ver facturas",
          result: "📄 Módulo de facturas abierto"
        },
        {
          text: "Mostrar proveedores",
          result: "🏢 Lista de proveedores"
        },
        {
          text: "Abrir albaranes",
          result: "📦 Gestión de albaranes"
        }
      ]
    },
    {
      name: "Consultas",
      icon: TrendingDown,
      color: "from-green-500 to-green-700",
      commands: [
        {
          text: "Cuánto gasto este mes",
          result: "💰 Este mes: 12,450€ en 23 facturas"
        },
        {
          text: "Últimas facturas",
          result: "📊 Mostrando últimas 10 facturas"
        },
        {
          text: "Proveedores activos",
          result: "🏢 15 proveedores activos"
        },
        {
          text: "Ahorros detectados",
          result: "💡 Ahorro potencial: 2,340€"
        }
      ]
    },
    {
      name: "Gestión",
      icon: Package,
      color: "from-orange-500 to-orange-700",
      commands: [
        {
          text: "Crear proveedor nuevo llamado Distribuciones López",
          result: "✅ Proveedor López registrado"
        },
        {
          text: "Ver nóminas",
          result: "💼 Módulo de nóminas"
        },
        {
          text: "Solicitar vacaciones",
          result: "🏖️ Formulario de vacaciones"
        }
      ]
    }
  ];

  const whatsappURL = base44.agents.getWhatsAppConnectURL('voice_assistant');

  return (
    <div className="p-4 md:p-8 min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="max-w-7xl mx-auto">
        {/* Hero Header */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-full px-6 py-3 mb-6">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
            <span className="text-white text-sm font-medium">Sistema de Voz Activo</span>
          </div>
          
          <h1 className="text-5xl font-bold text-white mb-4 flex items-center justify-center gap-4">
            <Mic className="w-12 h-12 text-cyan-400 animate-pulse" />
            Control por Voz
          </h1>
          <p className="text-cyan-300 text-xl">
            Controla SYNK-IA con tu voz • Crea facturas y albaranes hablando
          </p>
        </div>

        {/* CTA Banner */}
        <Card className="border-none shadow-2xl mb-8 bg-gradient-to-r from-cyan-600 via-blue-600 to-purple-600 text-white">
          <CardContent className="p-8">
            <div className="flex items-start gap-6">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center flex-shrink-0">
                <Volume2 className="w-10 h-10 animate-pulse" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-2xl mb-3">🎤 ¿Cómo funciona?</h3>
                <div className="space-y-2 text-sm text-cyan-100">
                  <p>1. <strong>Haz click en el botón flotante</strong> (abajo a la derecha)</p>
                  <p>2. <strong>Di tu comando</strong> en español</p>
                  <p>3. <strong>La IA procesa</strong> y ejecuta la acción</p>
                  <p>4. <strong>Confirmas</strong> o corriges si es necesario</p>
                </div>
                <div className="mt-6 flex items-center gap-4">
                  <Badge className="bg-yellow-400 text-yellow-900 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Con IA + Normativa SS
                  </Badge>
                  <a 
                    href={whatsappURL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 rounded-lg transition-colors"
                  >
                    <MessageSquare className="w-4 h-4" />
                    También en WhatsApp
                  </a>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Command Categories */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {commandCategories.map((category, idx) => {
            const Icon = category.icon;
            return (
              <Card key={idx} className="border-none shadow-2xl bg-slate-800 border border-slate-700">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3 text-white">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br ${category.color}`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    {category.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {category.commands.map((cmd, cmdIdx) => (
                    <div
                      key={cmdIdx}
                      className="bg-slate-900 rounded-lg p-4 border border-slate-700 hover:border-cyan-500/50 transition-all"
                    >
                      <div className="flex items-start gap-3">
                        <Mic className="w-5 h-5 text-cyan-400 mt-1 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="text-white text-sm font-medium mb-2">
                            "{cmd.text}"
                          </p>
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-green-400" />
                            <p className="text-green-400 text-xs">{cmd.result}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          <Card className="border-none shadow-2xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white">
            <CardContent className="p-6">
              <FileText className="w-10 h-10 mb-3" />
              <h3 className="font-bold text-lg mb-2">Facturas Instantáneas</h3>
              <p className="text-sm text-cyan-100">
                Crea facturas completas solo diciendo el proveedor y productos
              </p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-2xl bg-gradient-to-br from-purple-500 to-pink-600 text-white">
            <CardContent className="p-6">
              <Package className="w-10 h-10 mb-3" />
              <h3 className="font-bold text-lg mb-2">Albaranes SS</h3>
              <p className="text-sm text-purple-100">
                Genera albaranes con TODA la normativa de Seguridad Social automáticamente
              </p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-2xl bg-gradient-to-br from-green-500 to-emerald-600 text-white">
            <CardContent className="p-6">
              <Zap className="w-10 h-10 mb-3" />
              <h3 className="font-bold text-lg mb-2">IA que Entiende</h3>
              <p className="text-sm text-green-100">
                Habla natural - la IA interpreta contexto, cantidades y precios
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Technical Info */}
        <Card className="border-none shadow-2xl bg-slate-800 border border-cyan-500/20 mt-8">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-cyan-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-6 h-6 text-cyan-400" />
              </div>
              <div>
                <h3 className="font-bold text-white text-lg mb-3">🔧 Tecnología</h3>
                <div className="grid md:grid-cols-2 gap-4 text-sm text-gray-300">
                  <div>
                    <p className="font-semibold text-cyan-400 mb-1">Reconocimiento de Voz:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Web Speech API (navegador)</li>
                      <li>Español nativo</li>
                      <li>Sin internet para captura</li>
                    </ul>
                  </div>
                  <div>
                    <p className="font-semibold text-cyan-400 mb-1">Procesamiento IA:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>InvokeLLM avanzado</li>
                      <li>Extracción automática de datos</li>
                      <li>Validación normativa SS</li>
                    </ul>
                  </div>
                </div>
                <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <p className="text-yellow-400 text-sm">
                    <strong>💡 Tip:</strong> Habla claro y pausado. Di nombres de proveedores completos y cantidades exactas para mejores resultados.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}