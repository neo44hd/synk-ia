import React, { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Store Page
 * Redirects to the functional Sinkia Commerce tienda at /commerce
 */
export default function Store() {
  useEffect(() => {
    // Auto-redirect to Sinkia Commerce store (outside React Router)
    const timer = setTimeout(() => {
      // Use window.location to break out of React Router
      window.location.assign(window.location.origin + "/commerce.html");
    }, 1500);
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
            <h1 className="text-2xl font-bold text-white mb-2">🛒 Tienda Sinkia</h1>
            <p className="text-zinc-400">Cargando tienda en vivo con catálogo, fotos y WhatsApp...</p>
          </div>
          <button
            onClick={() => window.location.assign(window.location.origin + "/commerce.html")}
            className="w-full inline-flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white py-3 px-4 rounded-lg font-medium transition-colors"
          >
            <span>→ Abrir Tienda</span>
          </button>
          <p className="text-xs text-zinc-500">
            Si no se carga automáticamente, haz clic en el botón anterior.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
