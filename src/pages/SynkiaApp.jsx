import React, { useEffect } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

/**
 * SynK-IA App
 * - Si está en localhost, intenta cargar desde puerto alternativo
 * - Si no, abre en nueva ventana o iframe
 */
export default function SynkiaApp() {
  useEffect(() => {
    // Intentar redirigir a SynK-IA App si existe en diferente puerto
    // Por ahora: mostrar loader + botón para abrir manualmente
    const timer = setTimeout(() => {
      const appUrl = "http://localhost:3002"; // o la URL que corresponda
      window.open(appUrl, "_blank");
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-neutral-900 to-zinc-950 p-8 flex items-center justify-center">
      <Card className="border-none shadow-2xl bg-black border border-cyan-500/50 w-full max-w-md">
        <CardContent className="p-8 text-center space-y-6">
          <div className="w-16 h-16 bg-cyan-900/30 rounded-2xl flex items-center justify-center mx-auto border border-cyan-500/30">
            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white mb-2">SynK-IA App</h1>
            <p className="text-zinc-400">Abriendo aplicación...</p>
          </div>
          <button
            onClick={() => window.open("http://localhost:3002", "_blank")}
            className="w-full flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white py-3 px-4 rounded-lg font-medium transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Abrir SynK-IA App
          </button>
          <p className="text-xs text-zinc-500">
            Si no se abre automáticamente, haz clic en el botón anterior.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
