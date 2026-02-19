import React, { useState } from "react";
import { X, Share, MoreVertical, PlusSquare, Smartphone, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";

export default function InstallTutorial({ onClose }) {
  const [activeTab, setActiveTab] = useState("ios");

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border-2 border-cyan-500/30 rounded-3xl max-w-md w-full overflow-hidden shadow-[0_0_50px_rgba(6,182,212,0.2)]">
        
        {/* Header */}
        <div className="bg-slate-950 p-6 flex items-center justify-between border-b border-cyan-500/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-cyan-500/10 rounded-xl flex items-center justify-center border border-cyan-500/50">
              <Smartphone className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Instalar App</h2>
              <p className="text-cyan-400 text-xs font-mono">TUTORIAL RÁPIDO</p>
            </div>
          </div>
          <Button
            onClick={onClose}
            variant="ghost"
            size="icon"
            className="text-slate-400 hover:text-white hover:bg-slate-800 rounded-full"
          >
            <X className="w-6 h-6" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6">
          <Tabs defaultValue="ios" value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6 bg-slate-950 border border-slate-800">
              <TabsTrigger 
                value="ios" 
                className="data-[state=active]:bg-cyan-900/30 data-[state=active]:text-cyan-400 font-bold"
              >
                iPhone (iOS)
              </TabsTrigger>
              <TabsTrigger 
                value="android" 
                className="data-[state=active]:bg-green-900/30 data-[state=active]:text-green-400 font-bold"
              >
                Android
              </TabsTrigger>
            </TabsList>

            <TabsContent value="ios" className="space-y-4">
              <Step 
                number="1" 
                text="Abre esta página en SAFARI" 
                icon={<img src="https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Safari_browser_logo.svg/1024px-Safari_browser_logo.svg.png" className="w-6 h-6" alt="Safari"/>}
              />
              <Step 
                number="2" 
                text="Toca el botón 'Compartir' abajo" 
                icon={<Share className="w-5 h-5 text-blue-400" />}
              />
              <Step 
                number="3" 
                text="Baja y busca 'Añadir a inicio'" 
                icon={<PlusSquare className="w-5 h-5 text-white" />}
              />
              <Step 
                number="4" 
                text="Toca 'Añadir' arriba a la derecha" 
                icon={<span className="text-cyan-400 font-bold text-xs">Añadir</span>}
              />
            </TabsContent>

            <TabsContent value="android" className="space-y-4">
              <Step 
                number="1" 
                text="Abre esta página en CHROME" 
                icon={<img src="https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/Google_Chrome_icon_%28February_2022%29.svg/1024px-Google_Chrome_icon_%28February_2022%29.svg.png" className="w-6 h-6" alt="Chrome"/>}
              />
              <Step 
                number="2" 
                text="Toca los 3 puntos arriba derecha" 
                icon={<MoreVertical className="w-5 h-5 text-white" />}
              />
              <Step 
                number="3" 
                text="Toca 'Instalar aplicación' o 'Añadir a pantalla de inicio'" 
                icon={<Smartphone className="w-5 h-5 text-green-400" />}
              />
              <Step 
                number="4" 
                text="Confirma tocando 'Instalar'" 
                icon={<Check className="w-5 h-5 text-green-400" />}
              />
            </TabsContent>
          </Tabs>
        </div>

        <div className="p-6 bg-slate-950/50 border-t border-slate-800 text-center">
          <p className="text-slate-400 text-sm">
            Esto creará un icono en tu móvil como una App normal.
          </p>
        </div>
      </div>
    </div>
  );
}

function Step({ number, text, icon }) {
  return (
    <div className="flex items-center gap-4 bg-slate-800/50 p-4 rounded-xl border border-slate-700">
      <div className="w-8 h-8 bg-slate-900 rounded-full flex items-center justify-center border border-slate-600 font-bold text-white flex-shrink-0">
        {number}
      </div>
      <p className="text-slate-200 text-sm flex-1 font-medium">{text}</p>
      <div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center border border-slate-700 flex-shrink-0">
        {icon}
      </div>
    </div>
  );
}