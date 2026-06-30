import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { User, Clock, AlertCircle } from "lucide-react";

/**
 * Worker Mobile App - Simplified
 * Nota: La página anterior causaba loops infinitos con synkia.auth.me()
 * Esta versión simple muestra un mensaje hasta que se implemente correctamente
 */
export default function WorkerMobile() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-900/30 rounded-2xl flex items-center justify-center mx-auto border border-blue-500/30 mb-4">
            <User className="w-8 h-8 text-blue-400" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">App Trabajadores</h1>
          <p className="text-slate-400">Portal de control de horarios y asistencia</p>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="bg-slate-800/50 border-slate-700 hover:border-blue-500/50 transition-colors">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Clock className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-white font-semibold mb-1">Check-in / Check-out</h3>
                  <p className="text-slate-400 text-sm">Registra tu entrada y salida con reconocimiento facial</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700 hover:border-blue-500/50 transition-colors">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-green-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Clock className="w-6 h-6 text-green-400" />
                </div>
                <div>
                  <h3 className="text-white font-semibold mb-1">Ver Horario</h3>
                  <p className="text-slate-400 text-sm">Consulta tu horario y horas trabajadas</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700 hover:border-blue-500/50 transition-colors">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-purple-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-white font-semibold mb-1">Solicitar Vacaciones</h3>
                  <p className="text-slate-400 text-sm">Gestiona tus solicitudes de tiempo libre</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700 hover:border-blue-500/50 transition-colors">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-orange-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-6 h-6 text-orange-400" />
                </div>
                <div>
                  <h3 className="text-white font-semibold mb-1">Mis Documentos</h3>
                  <p className="text-slate-400 text-sm">Accede a tus documentos laborales y contratos</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Status */}
        <Card className="bg-blue-900/20 border-blue-500/30">
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-white font-semibold mb-1">ℹ️ En Desarrollo</h4>
                <p className="text-slate-300 text-sm">
                  Esta app se está optimizando para mejor rendimiento. Mientras tanto, puedes usar el Control Center para ver tus datos.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
