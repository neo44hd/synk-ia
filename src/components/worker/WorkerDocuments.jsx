import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { X, FileText, Download, Eye, DollarSign } from "lucide-react";
import { format } from "date-fns";

export default function WorkerDocuments({ onClose, user }) {
  const { data: contract } = useQuery({
    queryKey: ['my-contract'],
    queryFn: async () => {
      const contracts = await base44.entities.Contract.list();
      return contracts.find(c => c.employee_id === user?.id || c.employee_name === user?.full_name);
    },
    enabled: !!user,
  });

  const { data: payrolls = [] } = useQuery({
    queryKey: ['my-payrolls'],
    queryFn: async () => {
      const all = await base44.entities.Payroll.list('-period');
      return all.filter(p => p.employee_id === user?.id || p.employee_name === user?.full_name);
    },
    enabled: !!user,
  });

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl p-8 max-w-4xl w-full max-h-[80vh] overflow-y-auto border-2 border-blue-500/30 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl flex items-center justify-center">
              <FileText className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-white">Mis Documentos</h2>
              <p className="text-slate-400">Contratos, nóminas y documentos</p>
            </div>
          </div>
          <Button
            onClick={onClose}
            variant="ghost"
            size="icon"
            className="text-slate-400 hover:text-white hover:bg-slate-700 rounded-full"
          >
            <X className="w-6 h-6" />
          </Button>
        </div>

        {/* Mi Contrato */}
        {contract && (
          <div className="mb-8">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-400" />
              Mi Contrato
            </h3>
            <div className="bg-slate-700/50 rounded-2xl p-6 border border-slate-600">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-slate-400 text-sm">Tipo</p>
                  <p className="text-white font-medium capitalize">{contract.contract_type}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-sm">Puesto</p>
                  <p className="text-white font-medium">{contract.position}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-sm">Fecha Inicio</p>
                  <p className="text-white font-medium">
                    {contract.start_date ? format(new Date(contract.start_date), 'dd/MM/yyyy') : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400 text-sm">Estado</p>
                  <p className="text-green-400 font-medium capitalize">{contract.status}</p>
                </div>
              </div>
              {contract.file_url && (
                <Button
                  onClick={() => window.open(contract.file_url, '_blank')}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Ver Contrato Completo
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Mis Nóminas */}
        <div>
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-400" />
            Mis Nóminas
          </h3>
          {payrolls.length === 0 ? (
            <div className="bg-slate-700/50 rounded-2xl p-12 border border-slate-600 text-center">
              <DollarSign className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">No hay nóminas disponibles</p>
            </div>
          ) : (
            <div className="space-y-3">
              {payrolls.map((payroll) => (
                <div key={payroll.id} className="bg-slate-700/50 rounded-2xl p-6 border border-slate-600 hover:border-green-500/50 transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-white font-bold text-lg">Periodo: {payroll.period}</p>
                      <p className="text-slate-400 text-sm">
                        Pagado: {payroll.payment_date ? format(new Date(payroll.payment_date), 'dd/MM/yyyy') : 'Pendiente'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-green-400 font-bold text-2xl">{payroll.net_salary}€</p>
                      <p className="text-slate-400 text-sm">Neto</p>
                    </div>
                  </div>
                  {payroll.file_url && (
                    <Button
                      onClick={() => window.open(payroll.file_url, '_blank')}
                      className="w-full bg-green-600 hover:bg-green-700"
                      size="sm"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Descargar PDF
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}