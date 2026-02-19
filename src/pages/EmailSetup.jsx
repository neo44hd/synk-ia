import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, CheckCircle2, Mail, Lock, ExternalLink } from "lucide-react";

export default function EmailSetup() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-5xl font-black text-white mb-3 flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center shadow-2xl">
            <Mail className="w-8 h-8 text-white" />
          </div>
          CONFIGURAR GMAIL
        </h1>
        <p className="text-xl text-gray-400 mb-8">
          Guía para conectar info@chickenpalace.es con SYNK-IA
        </p>

        {/* Paso 1 */}
        <Card className="border-none shadow-2xl bg-slate-800 mb-6">
          <CardHeader className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-t-xl">
            <CardTitle className="flex items-center gap-3">
              <span className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center font-bold">1</span>
              Activar Autenticación de 2 Pasos en Google
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 text-gray-300">
            <ol className="space-y-3 list-decimal list-inside">
              <li>Accede a tu cuenta de Google: <a href="https://myaccount.google.com" target="_blank" className="text-blue-400 hover:underline inline-flex items-center gap-1">myaccount.google.com <ExternalLink className="w-3 h-3" /></a></li>
              <li>Ve a <strong className="text-white">Seguridad</strong> en el menú lateral</li>
              <li>Busca <strong className="text-white">"Verificación en dos pasos"</strong> y actívala</li>
              <li>Sigue los pasos para configurar tu teléfono</li>
            </ol>
            <div className="mt-4 p-4 bg-yellow-900/20 border border-yellow-700 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-400 mt-0.5" />
                <div>
                  <p className="text-yellow-400 font-bold">Importante</p>
                  <p className="text-sm text-gray-300">Sin la verificación en 2 pasos activada, no podrás generar contraseñas de aplicación.</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Paso 2 */}
        <Card className="border-none shadow-2xl bg-slate-800 mb-6">
          <CardHeader className="bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-t-xl">
            <CardTitle className="flex items-center gap-3">
              <span className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center font-bold">2</span>
              Generar Contraseña de Aplicación
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 text-gray-300">
            <ol className="space-y-3 list-decimal list-inside">
              <li>En <strong className="text-white">Seguridad</strong>, busca <strong className="text-white">"Contraseñas de aplicaciones"</strong></li>
              <li>O accede directamente: <a href="https://myaccount.google.com/apppasswords" target="_blank" className="text-blue-400 hover:underline inline-flex items-center gap-1">myaccount.google.com/apppasswords <ExternalLink className="w-3 h-3" /></a></li>
              <li>Es posible que te pida confirmar tu contraseña</li>
              <li>En <strong className="text-white">"Selecciona la app"</strong>, elige <strong className="text-white">"Correo"</strong></li>
              <li>En <strong className="text-white">"Selecciona el dispositivo"</strong>, elige <strong className="text-white">"Otro (nombre personalizado)"</strong></li>
              <li>Escribe: <strong className="text-white">SYNK-IA</strong></li>
              <li>Haz clic en <strong className="text-white">"Generar"</strong></li>
            </ol>
            
            <div className="mt-4 p-4 bg-blue-900/20 border border-blue-700 rounded-lg">
              <div className="flex items-start gap-2">
                <Lock className="w-5 h-5 text-blue-400 mt-0.5" />
                <div>
                  <p className="text-blue-400 font-bold">Google te mostrará una contraseña de 16 caracteres</p>
                  <p className="text-sm text-gray-300 mt-1">Ejemplo: <code className="bg-slate-900 px-2 py-1 rounded text-yellow-400">abcd efgh ijkl mnop</code></p>
                  <p className="text-sm text-gray-300 mt-2"><strong>¡CÓPIALA AHORA!</strong> Google solo la muestra una vez.</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Paso 3 */}
        <Card className="border-none shadow-2xl bg-slate-800 mb-6">
          <CardHeader className="bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-t-xl">
            <CardTitle className="flex items-center gap-3">
              <span className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center font-bold">3</span>
              Configurar en Base44 (Dashboard)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 text-gray-300">
            <ol className="space-y-3 list-decimal list-inside">
              <li>Ve al Dashboard de Base44: <a href="https://base44.com" target="_blank" className="text-blue-400 hover:underline inline-flex items-center gap-1">base44.com <ExternalLink className="w-3 h-3" /></a></li>
              <li>Navega a <strong className="text-white">Settings → Environment Variables</strong></li>
              <li>Busca o crea el secret: <code className="bg-slate-900 px-2 py-1 rounded text-yellow-400">EMAIL_APP_PASSWORD</code></li>
              <li>Pega la contraseña de 16 caracteres (sin espacios): <code className="bg-slate-900 px-2 py-1 rounded text-yellow-400">abcdefghijklmnop</code></li>
              <li>Guarda los cambios</li>
            </ol>
            
            <div className="mt-4 p-4 bg-green-900/20 border border-green-700 rounded-lg">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5" />
                <div>
                  <p className="text-green-400 font-bold">¡Listo!</p>
                  <p className="text-sm text-gray-300 mt-1">SYNK-IA ya podrá conectarse automáticamente a info@chickenpalace.es</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Verificación */}
        <Card className="border-none shadow-2xl bg-gradient-to-r from-orange-600 to-red-600 text-white">
          <CardContent className="p-6">
            <h3 className="text-xl font-bold mb-3">✅ Verificar Conexión</h3>
            <p className="mb-4">Una vez configurado el secret, ve a:</p>
            <div className="space-y-2">
              <div className="bg-white/20 p-3 rounded-lg">
                <strong>API Diagnostics</strong> → Testear Email
              </div>
              <div className="bg-white/20 p-3 rounded-lg">
                <strong>Automation Hub</strong> → Email Processor → Ejecutar
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Troubleshooting */}
        <Card className="border-none shadow-2xl bg-slate-800 mt-6">
          <CardHeader className="bg-gradient-to-r from-red-600 to-orange-600 text-white rounded-t-xl">
            <CardTitle className="flex items-center gap-3">
              <AlertCircle className="w-6 h-6" />
              Solución de Problemas
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 text-gray-300 space-y-4">
            <div>
              <p className="font-bold text-white">❌ Error: "Invalid credentials"</p>
              <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                <li>Verifica que copiaste la contraseña SIN espacios</li>
                <li>Asegúrate de que la verificación en 2 pasos está activa</li>
                <li>Genera una nueva contraseña de aplicación</li>
              </ul>
            </div>
            
            <div>
              <p className="font-bold text-white">❌ No puedo ver "Contraseñas de aplicaciones"</p>
              <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                <li>Primero activa la verificación en 2 pasos</li>
                <li>Espera unos minutos y recarga la página</li>
                <li>Asegúrate de estar usando info@chickenpalace.es (no otra cuenta)</li>
              </ul>
            </div>
            
            <div>
              <p className="font-bold text-white">❌ "Connection timeout"</p>
              <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                <li>Verifica que Gmail está habilitado para IMAP</li>
                <li>Ve a Gmail → Configuración → Ver toda la configuración → Reenvío y correo POP/IMAP</li>
                <li>Activa "Habilitar IMAP"</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}