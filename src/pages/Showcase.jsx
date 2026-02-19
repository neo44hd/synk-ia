
import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Brain, 
  Zap, 
  TrendingDown, 
  FileText, 
  Users,
  Shield,
  Smartphone,
  Globe,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Rocket,
  BarChart3,
  Lock,
  Clock,
  DollarSign,
  MessageSquare,
  Calendar
} from "lucide-react";

export default function Showcase() {
  const [currentFeature, setCurrentFeature] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
    const interval = setInterval(() => {
      setCurrentFeature((prev) => (prev + 1) % features.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const features = [
    {
      icon: Brain,
      title: "IA que piensa por ti",
      description: "Procesa emails, crea facturas, detecta proveedores. Todo automático.",
      color: "from-blue-600 to-purple-600",
      stats: "99% precisión"
    },
    {
      icon: TrendingDown,
      title: "Ahorra dinero real",
      description: "Compara precios entre proveedores y te muestra dónde ahorrar.",
      color: "from-green-600 to-emerald-600",
      stats: "Hasta 15K€/año"
    },
    {
      icon: Rocket,
      title: "Automatización total",
      description: "Workflows inteligentes, notificaciones smart, cero trabajo manual.",
      color: "from-orange-600 to-red-600",
      stats: "80% menos tiempo"
    },
    {
      icon: Shield,
      title: "100% seguro y legal",
      description: "RGPD, mutua, documentación empresa. Todo bajo control.",
      color: "from-indigo-600 to-purple-600",
      stats: "Certificado"
    }
  ];

  const modules = [
    { icon: FileText, name: "Facturas IA", description: "OCR automático" },
    { icon: TrendingDown, name: "Comparador", description: "Mejores precios" },
    { icon: Users, name: "Proveedores", description: "Red optimizada" },
    { icon: Brain, name: "IA Central", description: "Coordinador" },
    { icon: DollarSign, name: "Nóminas", description: "RRHH completo" },
    { icon: Calendar, name: "Vacaciones", description: "Auto-aprobación" },
    { icon: Clock, name: "Fichajes", description: "Control horario" },
    { icon: Shield, name: "RGPD", description: "Cumplimiento" },
    { icon: Lock, name: "LegalVault", description: "Docs seguros" },
    { icon: MessageSquare, name: "WhatsApp IA", description: "Chats inteligentes" }
  ];

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden">
      {/* Hero Section - IMPACTANTE */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-900 via-purple-900 to-pink-900 opacity-50"></div>
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 20% 50%, rgba(59, 130, 246, 0.3) 0%, transparent 50%),
                             radial-gradient(circle at 80% 80%, rgba(168, 85, 247, 0.3) 0%, transparent 50%),
                             radial-gradient(circle at 40% 20%, rgba(236, 72, 153, 0.3) 0%, transparent 50%)`
          }}></div>
          
          {/* Particles */}
          <div className="absolute inset-0">
            {[...Array(50)].map((_, i) => (
              <div
                key={i}
                className="absolute w-1 h-1 bg-white rounded-full animate-pulse"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 3}s`,
                  opacity: Math.random() * 0.5
                }}
              />
            ))}
          </div>
        </div>

        {/* Hero Content */}
        <div className={`relative z-10 text-center px-4 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <div className="inline-block mb-6">
            <div className="relative">
              <Brain className="w-24 h-24 text-blue-400 animate-pulse" />
              <Sparkles className="absolute -top-2 -right-2 w-8 h-8 text-yellow-400 animate-spin" />
            </div>
          </div>
          
          <h1 className="text-7xl md:text-9xl font-black mb-6 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            SYNK-IA
          </h1>
          
          <p className="text-3xl md:text-4xl font-bold mb-4 text-gray-200">
            La IA que organiza tu negocio
          </p>
          
          <p className="text-xl md:text-2xl text-gray-400 mb-8 max-w-3xl mx-auto">
            ERP con Inteligencia Artificial • Automatización total • Ahorro real
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link to={createPageUrl("Dashboard")}>
              <Button size="lg" className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-6 text-lg rounded-xl shadow-2xl hover:shadow-purple-500/50 transition-all">
                <Rocket className="w-6 h-6 mr-2" />
                Entrar al Dashboard
                <ArrowRight className="w-6 h-6 ml-2" />
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="border-2 border-white/30 text-white hover:bg-white/10 px-8 py-6 text-lg rounded-xl">
              <Globe className="w-6 h-6 mr-2" />
              Ver Demo
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-8 mt-16 max-w-2xl mx-auto">
            <div>
              <p className="text-4xl font-bold text-blue-400">15K€</p>
              <p className="text-sm text-gray-400">Ahorro anual medio</p>
            </div>
            <div>
              <p className="text-4xl font-bold text-purple-400">80%</p>
              <p className="text-sm text-gray-400">Menos tiempo manual</p>
            </div>
            <div>
              <p className="text-4xl font-bold text-pink-400">100%</p>
              <p className="text-sm text-gray-400">Automatizado</p>
            </div>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 animate-bounce">
          <ArrowRight className="w-8 h-8 text-white/50 rotate-90" />
        </div>
      </section>

      {/* Features Carousel */}
      <section className="py-20 bg-gradient-to-b from-black to-gray-900">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-5xl font-bold text-center mb-16">
            <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              ¿Qué hace SYNK-IA?
            </span>
          </h2>
          
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              {features.map((feature, idx) => (
                <Card
                  key={idx}
                  className={`border-none transition-all duration-500 cursor-pointer ${
                    currentFeature === idx
                      ? 'bg-gradient-to-r ' + feature.color + ' text-white scale-105 shadow-2xl'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                  onClick={() => setCurrentFeature(idx)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <feature.icon className="w-12 h-12 flex-shrink-0" />
                      <div>
                        <h3 className="text-2xl font-bold mb-2">{feature.title}</h3>
                        <p className={currentFeature === idx ? 'text-white/90' : 'text-gray-500'}>
                          {feature.description}
                        </p>
                        <p className="text-sm font-bold mt-2">{feature.stats}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="relative">
              <div className="aspect-video bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl shadow-2xl flex items-center justify-center">
                {React.createElement(features[currentFeature].icon, { className: "w-32 h-32 text-white animate-pulse" })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Modules Grid */}
      <section className="py-20 bg-gray-900">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-5xl font-bold text-center mb-4">
            <span className="bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
              10 Módulos Completos
            </span>
          </h2>
          <p className="text-xl text-gray-400 text-center mb-16">
            Todo lo que necesitas en un solo lugar
          </p>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
            {modules.map((module, idx) => (
              <Card key={idx} className="bg-gray-800 border-gray-700 hover:bg-gray-700 transition-all hover:scale-105 cursor-pointer">
                <CardContent className="p-6 text-center">
                  <module.icon className="w-12 h-12 mx-auto mb-3 text-blue-400" />
                  <h3 className="font-bold text-white mb-1">{module.name}</h3>
                  <p className="text-xs text-gray-400">{module.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-20 bg-gradient-to-b from-gray-900 to-black">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-5xl font-bold text-center mb-16">
            <span className="bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent">
              ¿Por qué SYNK-IA?
            </span>
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Brain,
                title: "IA que aprende",
                description: "Cuanto más la usas, más inteligente se vuelve. Aprende de tus patrones.",
                color: "text-blue-400"
              },
              {
                icon: Zap,
                title: "Velocidad extrema",
                description: "Procesa 100 facturas en 10 segundos. OCR + IA + Automatización.",
                color: "text-yellow-400"
              },
              {
                icon: DollarSign,
                title: "ROI inmediato",
                description: "El sistema se paga solo en 2 meses con los ahorros que genera.",
                color: "text-green-400"
              },
              {
                icon: Smartphone,
                title: "PWA móvil",
                description: "Instala en tu móvil. Funciona offline. Notificaciones push.",
                color: "text-purple-400"
              },
              {
                icon: Shield,
                title: "Seguridad total",
                description: "Encriptación end-to-end. RGPD compliant. Backups automáticos.",
                color: "text-red-400"
              },
              {
                icon: Users,
                title: "Multi-usuario",
                description: "Permisos granulares. Cada usuario ve solo lo que debe.",
                color: "text-pink-400"
              }
            ].map((benefit, idx) => (
              <Card key={idx} className="bg-gray-800 border-gray-700 hover:shadow-2xl hover:shadow-purple-500/20 transition-all">
                <CardContent className="p-8">
                  <benefit.icon className={`w-16 h-16 mb-4 ${benefit.color}`} />
                  <h3 className="text-2xl font-bold text-white mb-3">{benefit.title}</h3>
                  <p className="text-gray-400">{benefit.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonial */}
      <section className="py-20 bg-gradient-to-r from-blue-900 to-purple-900">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <Sparkles className="w-12 h-12 mx-auto mb-6 text-yellow-400" />
          <blockquote className="text-3xl font-bold mb-6">
            "Antes perdíamos 20 horas/semana en gestión. Ahora SYNK-IA lo hace todo automáticamente. 
            Hemos ahorrado 12K€ este año solo optimizando proveedores."
          </blockquote>
          <p className="text-xl text-blue-200">
            — David, CEO de empresa real
          </p>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-32 bg-black relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20"></div>
        <div className="relative z-10 max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-6xl font-black mb-6">
            <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              ¿Listo para automatizar tu negocio?
            </span>
          </h2>
          <p className="text-2xl text-gray-300 mb-12">
            Únete a las empresas que ya están ahorrando tiempo y dinero con IA
          </p>
          
          <Link to={createPageUrl("Dashboard")}>
            <Button size="lg" className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-12 py-8 text-2xl rounded-2xl shadow-2xl hover:shadow-purple-500/50 transition-all">
              <Rocket className="w-8 h-8 mr-3" />
              Empezar Ahora
              <ArrowRight className="w-8 h-8 ml-3" />
            </Button>
          </Link>

          <p className="text-sm text-gray-500 mt-8">
            No requiere tarjeta de crédito • Setup en 5 minutos • Soporte 24/7
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-950 py-12 border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Brain className="w-8 h-8 text-blue-400" />
                <span className="text-xl font-bold">SYNK-IA</span>
              </div>
              <p className="text-gray-400 text-sm">
                La IA que organiza tu negocio
              </p>
            </div>
            <div>
              <h3 className="font-bold mb-4">Producto</h3>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>Características</li>
                <li>Precios</li>
                <li>Casos de uso</li>
                <li>Documentación</li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold mb-4">Empresa</h3>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>Sobre nosotros</li>
                <li>Blog</li>
                <li>Contacto</li>
                <li>Careers</li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold mb-4">Legal</h3>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>Privacidad</li>
                <li>Términos</li>
                <li>RGPD</li>
                <li>Seguridad</li>
              </ul>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-gray-800 text-center text-gray-500 text-sm">
            © 2025 SYNK-IA. Todos los derechos reservados. Made with 🧠 by AI.
          </div>
        </div>
      </footer>
    </div>
  );
}
