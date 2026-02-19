import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Zap,
  Upload,
  Brain,
  Shield,
  Mail,
  TrendingDown,
  ShoppingCart,
  Calendar,
  FileText,
  Users
} from "lucide-react";

const actions = [
  {
    title: "Subir Factura",
    description: "OCR + IA instantáneo",
    icon: Upload,
    color: "from-blue-600 to-blue-700",
    link: "Invoices"
  },
  {
    title: "IA Central",
    description: "Asistente inteligente",
    icon: Brain,
    color: "from-purple-600 to-purple-700",
    link: "CentralAgent"
  },
  {
    title: "Nuevo Pedido",
    description: "Sistema POS",
    icon: ShoppingCart,
    color: "from-orange-600 to-orange-700",
    link: "OrdersDashboard"
  },
  {
    title: "Comparar Precios",
    description: "Ahorro automático",
    icon: TrendingDown,
    color: "from-green-600 to-green-700",
    link: "Comparator"
  },
  {
    title: "Seguridad",
    description: "Cámaras + Facial",
    icon: Shield,
    color: "from-red-600 to-red-700",
    link: "SecurityCameras"
  },
  {
    title: "Emails IA",
    description: "Auto-clasificación",
    icon: Mail,
    color: "from-cyan-600 to-cyan-700",
    link: "EmailTriage"
  },
  {
    title: "Vacaciones",
    description: "Gestionar solicitudes",
    icon: Calendar,
    color: "from-pink-600 to-pink-700",
    link: "VacationRequests"
  },
  {
    title: "Documentos",
    description: "LegalVault",
    icon: FileText,
    color: "from-yellow-600 to-yellow-700",
    link: "LegalVault"
  }
];

export default function QuickActions() {
  return (
    <Card className="border-none shadow-2xl bg-gradient-to-br from-slate-800 to-slate-900">
      <CardHeader className="bg-gradient-to-r from-yellow-600 to-orange-600 text-white rounded-t-xl">
        <CardTitle className="flex items-center gap-3">
          <Zap className="w-7 h-7" />
          ⚡ ACCIONES RÁPIDAS
        </CardTitle>
      </CardHeader>
      
      <CardContent className="p-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {actions.map((action, idx) => {
            const Icon = action.icon;
            return (
              <Link key={idx} to={createPageUrl(action.link)}>
                <div className={`group cursor-pointer bg-gradient-to-br ${action.color} p-5 rounded-xl text-white hover:scale-105 transition-all shadow-lg`}>
                  <Icon className="w-10 h-10 mb-3 opacity-90" />
                  <p className="font-bold text-lg mb-1">{action.title}</p>
                  <p className="text-xs opacity-80">{action.description}</p>
                  <div className="mt-3 flex items-center gap-1 text-xs opacity-70">
                    <span>Abrir</span>
                    <svg className="w-3 h-3 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}