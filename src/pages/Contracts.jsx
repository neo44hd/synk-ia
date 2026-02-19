import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  FileText, 
  Eye, 
  Download,
  Calendar,
  DollarSign,
  Clock,
  Shield
} from "lucide-react";
import { format } from "date-fns";

export default function Contracts() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        console.error('Error loading user:', error);
      }
    };
    loadUser();
  }, []);

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ['contracts'],
    queryFn: async () => {
      const allContracts = await base44.entities.Contract.list('-created_date');
      
      // Si no es admin, solo muestra su contrato
      if (user && user.permission_level !== 'super_admin' && user.permission_level !== 'admin') {
        return allContracts.filter(c => c.employee_id === user.id || c.employee_name === user.full_name);
      }
      
      return allContracts;
    },
    initialData: [],
    enabled: !!user,
  });

  const typeColors = {
    indefinido: 'bg-green-100 text-green-800',
    temporal: 'bg-blue-100 text-blue-800',
    practicas: 'bg-purple-100 text-purple-800',
    formacion: 'bg-orange-100 text-orange-800'
  };

  const statusColors = {
    activo: 'bg-green-100 text-green-800',
    finalizado: 'bg-gray-100 text-gray-800',
    suspendido: 'bg-red-100 text-red-800'
  };

  const activeContracts = contracts.filter(c => c.status === 'activo').length;
  const myContract = contracts.find(c => c.employee_id === user?.id || c.employee_name === user?.full_name);

  return (
    <div className="p-4 md:p-8 min-h-screen bg-gradient-to-br from-zinc-950 via-neutral-900 to-zinc-950">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <FileText className="w-8 h-8 text-blue-400" />
            Contratos Laborales
          </h1>
          <p className="text-zinc-400 mt-1">
            {user?.permission_level === 'employee' 
              ? 'Consulta tu información contractual'
              : 'Gestión de contratos del equipo'}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="border-none shadow-lg bg-zinc-800/50 border border-zinc-800">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <FileText className="w-5 h-5 text-blue-400" />
                <p className="text-sm text-zinc-400">Contratos Activos</p>
              </div>
              <p className="text-3xl font-bold text-white">{activeContracts}</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-lg bg-zinc-800/50 border border-zinc-800">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <Shield className="w-5 h-5 text-green-400" />
                <p className="text-sm text-zinc-400">Total Contratos</p>
              </div>
              <p className="text-3xl font-bold text-white">{contracts.length}</p>
            </CardContent>
          </Card>
          {myContract && (
            <Card className="border-none shadow-lg bg-gradient-to-br from-blue-500 to-blue-700 text-white">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-2">
                  <Calendar className="w-5 h-5" />
                  <p className="text-sm opacity-90">Tu Antigüedad</p>
                </div>
                <p className="text-3xl font-bold">
                  {myContract.start_date 
                    ? `${Math.floor((new Date() - new Date(myContract.start_date)) / (365 * 24 * 60 * 60 * 1000))} años`
                    : 'N/A'}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Contracts List */}
        {isLoading ? (
          <Card className="border-none shadow-lg bg-zinc-800/50 border border-zinc-800">
            <CardContent className="p-12 text-center">
              <p className="text-zinc-400">Cargando contratos...</p>
            </CardContent>
          </Card>
        ) : contracts.length === 0 ? (
          <Card className="border-none shadow-lg bg-zinc-800/50 border border-zinc-800">
            <CardContent className="p-12 text-center">
              <FileText className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
              <p className="text-zinc-400 mb-4">No hay contratos registrados</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {contracts.map((contract) => (
              <Card key={contract.id} className="border-none shadow-lg bg-zinc-800/50 border border-zinc-800 hover:bg-zinc-800 transition-all">
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl flex items-center justify-center flex-shrink-0">
                        <FileText className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-white mb-2">{contract.employee_name}</h3>
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                          <Badge className={typeColors[contract.contract_type]}>
                            {contract.contract_type}
                          </Badge>
                          <Badge className={statusColors[contract.status]}>
                            {contract.status}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                          <div className="flex items-center gap-2">
                            <Shield className="w-4 h-4 text-zinc-500" />
                            <span className="text-zinc-300">
                              <strong>Puesto:</strong> {contract.position}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-zinc-500" />
                            <span className="text-zinc-300">
                              <strong>Inicio:</strong> {contract.start_date ? format(new Date(contract.start_date), 'dd/MM/yyyy') : 'N/A'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <DollarSign className="w-4 h-4 text-zinc-500" />
                            <span className="text-zinc-300">
                              <strong>Salario:</strong> {contract.salary?.toLocaleString()}€/año
                            </span>
                          </div>
                          {contract.end_date && (
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-zinc-500" />
                              <span className="text-zinc-300">
                                <strong>Fin:</strong> {format(new Date(contract.end_date), 'dd/MM/yyyy')}
                              </span>
                            </div>
                          )}
                        </div>
                        {contract.schedule && (
                          <p className="text-sm text-zinc-400 mt-3">
                            <strong>Horario:</strong> {contract.schedule}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    {contract.file_url && (
                      <div className="flex flex-col gap-2">
                        <Button
                          variant="outline"
                          onClick={() => window.open(contract.file_url, '_blank')}
                          className="whitespace-nowrap"
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          Ver Contrato
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Info Card */}
        <Card className="border-none shadow-lg mt-8 bg-blue-900/30 border border-blue-700/50">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <Shield className="w-6 h-6 text-blue-400 mt-1" />
              <div>
                <p className="font-medium text-blue-200 mb-2">Información Confidencial</p>
                <p className="text-sm text-blue-100/70">
                  Los contratos son documentos confidenciales. Los empleados solo pueden ver su propio contrato.
                  Para modificaciones, contacta con Recursos Humanos.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}