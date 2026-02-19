import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, User, ArrowRight, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { createPageUrl } from "@/utils";

export default function PortalLogin() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [pin, setPin] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  React.useEffect(() => {
    // Check for magic token in URL
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    
    if (token) {
      handleMagicLogin(token);
    }
  }, []);

  const handleMagicLogin = async (token) => {
    setIsLoading(true);
    try {
      const response = await base44.functions.invoke('employeeAuth', { token });
      
      if (response.data.success) {
        localStorage.setItem('portal_employee', JSON.stringify(response.data.employee));
        toast.success(`✨ Acceso mágico concedido: ${response.data.employee.full_name}`);
        navigate(createPageUrl('WorkerInterface'));
      } else {
        toast.error(response.data.error || "Enlace inválido");
      }
    } catch (error) {
      toast.error("Error de conexión: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await base44.functions.invoke('employeeAuth', {
        identifier,
        pin
      });

      if (response.data.success) {
        localStorage.setItem('portal_employee', JSON.stringify(response.data.employee));
        toast.success(`Bienvenido, ${response.data.employee.full_name}`);
        navigate(createPageUrl('WorkerInterface'));
      } else {
        toast.error(response.data.error || "Credenciales incorrectas");
      }
    } catch (error) {
      toast.error("Error de conexión: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-cyan-900/20 via-black to-black"></div>
      <div className="absolute inset-0" style={{
        backgroundImage: 'linear-gradient(rgba(6, 182, 212, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(6, 182, 212, 0.1) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
        opacity: 0.2
      }}></div>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo / Header */}
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-cyan-500/10 rounded-2xl border border-cyan-500/50 flex items-center justify-center mx-auto mb-4 shadow-[0_0_30px_rgba(6,182,212,0.3)] animate-pulse">
            <ShieldCheck className="w-10 h-10 text-cyan-400" />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight mb-2">PORTAL EMPLEADO</h1>
          <p className="text-cyan-400/60 font-mono text-sm">SECURE ACCESS GATEWAY</p>
        </div>

        {/* Login Form */}
        <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">
                Identificación (DNI)
              </label>
              <div className="relative group">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-cyan-400 transition-colors" />
                <Input 
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="pl-12 h-14 bg-black/50 border-white/10 text-white text-lg rounded-xl focus:border-cyan-500/50 focus:ring-cyan-500/20 transition-all"
                  placeholder="Introduce tu DNI"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">
                PIN de Acceso
              </label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-cyan-400 transition-colors" />
                <Input 
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="pl-12 h-14 bg-black/50 border-white/10 text-white text-lg rounded-xl focus:border-cyan-500/50 focus:ring-cyan-500/20 transition-all tracking-widest"
                  placeholder="••••"
                  maxLength={6}
                  required
                />
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full h-14 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-lg rounded-xl shadow-lg shadow-cyan-900/20 transition-all active:scale-[0.98] mt-4"
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <div className="flex items-center gap-2">
                  ACCEDER AL PORTAL
                  <ArrowRight className="w-5 h-5" />
                </div>
              )}
            </Button>
          </form>
        </div>

        <div className="mt-8 text-center">
          <p className="text-gray-500 text-sm">
            ¿No tienes tu PIN? Contacta con RRHH
          </p>
        </div>
      </div>
    </div>
  );
}