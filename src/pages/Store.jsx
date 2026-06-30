import React, { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Store Page
 * Redirects to the functional Sinkia Commerce tienda at /commerce
 */
export default function Store() {
  // Redirect immediately to commerce.html
  React.useEffect(() => {
    window.location.href = "/commerce.html";
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
            <p className="text-zinc-400">Abriendo tienda en vivo...</p>
          </div>
          <a
            href="/commerce.html"
            target="_self"
            className="w-full inline-flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white py-3 px-4 rounded-lg font-medium transition-colors"
          >
            <span>→ Abrir Tienda</span>
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
