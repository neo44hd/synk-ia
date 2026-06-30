import React, { useEffect } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

/**
 * SynK-IA Main
 * - Acceso a la aplicación principal de SynK-IA
 */
export default function SynkiaMain() {
  useEffect(() => {
    // Redirigir a SynK-IA Main
    // Nota: cambia la URL según dónde esté alojada tu app principal
    const timer = setTimeout(() => {
      const mainUrl = "http://localhost:9001"; // App principal de Sinkia
      window.location.href = mainUrl;
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-neutral-900 to-zinc-950 p-8 flex items-center justify-center">
      <Card className="border-none shadow-2xl bg-black border border-purple-500/50 w-full max-w-md">
        <CardContent className="p-8 text-center space-y-6">
          <div className="w-16 h-16 bg-purple-900/30 rounded-2xl flex items-center justify-center mx-auto border border-purple-500/30">
            <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white mb-2">SynK-IA Main</h1>
            <p className="text-zinc-400">Abriendo aplicación principal...</p>
          </div>
          <a
            href="http://localhost:9001"
            className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 text-white py-3 px-4 rounded-lg font-medium transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Abrir SynK-IA Main
          </a>
          <p className="text-xs text-zinc-500">
            Si no se abre automáticamente, haz clic en el botón anterior.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
