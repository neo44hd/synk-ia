import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, User, FileText, Calendar, Clock, DollarSign, 
  Phone, Mail, MapPin, Download, Eye, Edit, 
  Upload, CheckCircle2, AlertCircle, TrendingUp, ChevronDown
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

export default function EmployeeDetail({ employee, onBack }) {
  const [isUploading, setIsUploading] = useState(false);
  const queryClient = useQueryClient();

  const handleFileUpload = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      const newItem = {
        file_url,
        upload_date: new Date().toISOString().split('T')[0],
        title: file.name
      };

      let updatedData = { ...employee };
      
      if (type === 'payroll') {
        const period = prompt('Introduce el periodo (YYYY-MM):', format(new Date(), 'yyyy-MM'));
        if (!period) return;
        newItem.period = period;
        newItem.status = 'pagada';
        updatedData.payrolls = [...(employee.payrolls || []), newItem];
      } else if (type === 'contract') {
        newItem.type = 'Contrato';
        newItem.signed = true;
        updatedData.contracts = [...(employee.contracts || []), newItem];
      } else {
        const docType = prompt('Tipo de documento (DNI, Título, Certificado, etc.):');
        newItem.type = docType || 'Documento';
        updatedData.documents = [...(employee.documents || []), newItem];
      }

      await base44.entities.Employee.update(employee.id, updatedData);
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success('Documento subido correctamente');
      onBack();
    } catch (error) {
      toast.error('Error subiendo archivo: ' + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const statusColors = {
    activo: 'bg-green-600 text-white',
    baja: 'bg-red-600 text-white',
    vacaciones: 'bg-blue-600 text-white',
    baja_medica: 'bg-orange-600 text-white',
    excedencia: 'bg-purple-600 text-white'
  };

  const payrollStatusColors = {
    pagada: 'bg-green-600 text-white',
    pendiente: 'bg-yellow-600 text-white'
  };

  const sortedPayrolls = [...(employee.payrolls || [])].sort((a, b) => (b.period || '').localeCompare(a.period || ''));
  const sortedTimesheets = [...(employee.timesheets || [])].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  return (
    <div className="p-4 md:p-8 min-h-screen bg-gradient-to-br from-zinc-950 via-neutral-900 to-zinc-950">
      <div className="max-w-7xl mx-auto">
        {/* Header compacto */}
        <Button 
          variant="ghost" 
          onClick={onBack}
          className="text-zinc-400 hover:text-white mb-6"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Volver
        </Button>

        {/* Hero Section - Avatar + Info principal */}
        <Card className="border-none bg-gradient-to-br from-violet-950 via-zinc-900 to-zinc-900 border border-violet-500/30 mb-6 overflow-hidden relative" style={{ boxShadow: '0 10px 40px rgba(124, 58, 237, 0.3)' }}>
          <div className="absolute inset-0 bg-gradient-to-r from-violet-500/5 via-transparent to-purple-500/5" />
          <CardContent className="p-8 relative">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
              {/* Avatar Grande */}
              <div className="relative flex-shrink-0">
                <div className="absolute inset-0 bg-gradient-to-br from-violet-500 to-purple-600 rounded-3xl blur-xl opacity-60 animate-pulse" />
                {employee.photo_url ? (
                  <img 
                    src={employee.photo_url} 
                    alt={employee.full_name}
                    className="relative w-32 h-32 rounded-3xl object-cover ring-4 ring-violet-500/50"
                  />
                ) : (
                  <div className="relative w-32 h-32 bg-gradient-to-br from-violet-500 to-purple-600 rounded-3xl flex items-center justify-center ring-4 ring-violet-500/50">
                    <User className="w-16 h-16 text-white" />
                  </div>
                )}
                <div className={`absolute -bottom-2 -right-2 w-8 h-8 rounded-full border-4 border-zinc-900 ${employee.status === 'activo' ? 'bg-green-500 shadow-lg shadow-green-500/50' : 'bg-zinc-500'}`} />
              </div>

              {/* Info */}
              <div className="flex-1">
                <h1 className="text-4xl font-black text-white mb-2">{employee.full_name}</h1>
                {employee.position && (
                  <p className="text-xl text-violet-300 mb-3">{employee.position}</p>
                )}
                <div className="flex flex-wrap gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className={`${statusColors[employee.status]} text-base px-4 py-1 rounded-md flex items-center gap-2 hover:opacity-80 transition-opacity`}>
                        {employee.status}
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="bg-zinc-900 border-zinc-800">
                      <DropdownMenuItem 
                        onClick={async () => {
                          await base44.entities.Employee.update(employee.id, { status: 'activo' });
                          toast.success('Estado actualizado');
                          queryClient.invalidateQueries({ queryKey: ['employees'] });
                          onBack();
                        }}
                        className="text-green-400 hover:bg-green-950 cursor-pointer"
                      >
                        ✓ Activo
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={async () => {
                          await base44.entities.Employee.update(employee.id, { status: 'baja' });
                          toast.success('Estado actualizado');
                          queryClient.invalidateQueries({ queryKey: ['employees'] });
                          onBack();
                        }}
                        className="text-red-400 hover:bg-red-950 cursor-pointer"
                      >
                        ✗ Baja
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={async () => {
                          await base44.entities.Employee.update(employee.id, { status: 'vacaciones' });
                          toast.success('Estado actualizado');
                          queryClient.invalidateQueries({ queryKey: ['employees'] });
                          onBack();
                        }}
                        className="text-blue-400 hover:bg-blue-950 cursor-pointer"
                      >
                        🏖️ Vacaciones
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={async () => {
                          await base44.entities.Employee.update(employee.id, { status: 'baja_medica' });
                          toast.success('Estado actualizado');
                          queryClient.invalidateQueries({ queryKey: ['employees'] });
                          onBack();
                        }}
                        className="text-orange-400 hover:bg-orange-950 cursor-pointer"
                      >
                        🏥 Baja Médica
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={async () => {
                          await base44.entities.Employee.update(employee.id, { status: 'excedencia' });
                          toast.success('Estado actualizado');
                          queryClient.invalidateQueries({ queryKey: ['employees'] });
                          onBack();
                        }}
                        className="text-purple-400 hover:bg-purple-950 cursor-pointer"
                      >
                        📋 Excedencia
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  {employee.department && (
                    <Badge variant="outline" className="border-violet-500/50 text-violet-300 text-base px-4 py-1">
                      {employee.department}
                    </Badge>
                  )}
                </div>
              </div>

              {/* KPIs compactos */}
              <div className="flex gap-4">
                <div className="bg-violet-950/50 rounded-2xl p-4 text-center border border-violet-500/30 min-w-24">
                  <FileText className="w-6 h-6 text-violet-400 mx-auto mb-1" />
                  <p className="text-3xl font-black text-white">{employee.payrolls?.length || 0}</p>
                  <p className="text-xs text-zinc-400">Nóminas</p>
                </div>
                <div className="bg-blue-950/50 rounded-2xl p-4 text-center border border-blue-500/30 min-w-24">
                  <Clock className="w-6 h-6 text-blue-400 mx-auto mb-1" />
                  <p className="text-3xl font-black text-white">{employee.timesheets?.length || 0}</p>
                  <p className="text-xs text-zinc-400">Fichajes</p>
                </div>
                <div className="bg-green-950/50 rounded-2xl p-4 text-center border border-green-500/30 min-w-24">
                  <DollarSign className="w-6 h-6 text-green-400 mx-auto mb-1" />
                  <p className="text-3xl font-black text-white">{employee.salary_net?.toFixed(0) || 0}€</p>
                  <p className="text-xs text-zinc-400">Salario</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Columna izquierda - Info personal */}
          <div className="xl:col-span-1 space-y-6">
            <Card className="border-none bg-zinc-900/50 border border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <User className="w-5 h-5 text-violet-400" />
                  Datos Personales
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {employee.dni && (
                  <div>
                    <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">DNI/NIE</p>
                    <p className="text-white font-medium">{employee.dni}</p>
                  </div>
                )}
                {employee.email && (
                  <div>
                    <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Email</p>
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-zinc-500" />
                      <p className="text-white font-medium">{employee.email}</p>
                    </div>
                  </div>
                )}
                {employee.phone && (
                  <div>
                    <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Teléfono</p>
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-zinc-500" />
                      <p className="text-white font-medium">{employee.phone}</p>
                    </div>
                  </div>
                )}
                {employee.address && (
                  <div>
                    <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Dirección</p>
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-zinc-500 mt-0.5" />
                      <p className="text-white font-medium">{employee.address}</p>
                    </div>
                  </div>
                )}
                {employee.ss_number && (
                  <div>
                    <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Seguridad Social</p>
                    <p className="text-white font-medium">{employee.ss_number}</p>
                  </div>
                )}
                {employee.birth_date && (
                  <div>
                    <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Fecha Nacimiento</p>
                    <p className="text-white font-medium">{employee.birth_date}</p>
                  </div>
                )}
                {employee.hire_date && (
                  <div>
                    <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Fecha Alta</p>
                    <p className="text-white font-medium">{employee.hire_date}</p>
                  </div>
                )}
                {employee.bank_account && (
                  <div>
                    <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Cuenta Bancaria</p>
                    <p className="text-white font-medium font-mono text-sm">{employee.bank_account}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Contacto emergencia */}
            {(employee.emergency_contact || employee.emergency_phone) && (
              <Card className="border-none bg-red-950/20 border border-red-500/30">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2 text-base">
                    <AlertCircle className="w-5 h-5 text-red-400" />
                    Emergencia
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {employee.emergency_contact && (
                    <p className="text-white font-medium">{employee.emergency_contact}</p>
                  )}
                  {employee.emergency_phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-red-400" />
                      <p className="text-white">{employee.emergency_phone}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Columna derecha - Nóminas + Fichajes */}
          <div className="xl:col-span-2 space-y-6">
            {/* Nóminas */}
            <Card className="border-none bg-zinc-900/50 border border-zinc-800">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-white flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-green-400" />
                  Historial de Nóminas
                </CardTitle>
                <label className="cursor-pointer">
                  <input type="file" className="hidden" accept=".pdf,.jpg,.png" onChange={(e) => handleFileUpload(e, 'payroll')} disabled={isUploading} />
                  <Button className="bg-green-600 hover:bg-green-700" disabled={isUploading}>
                    <Upload className="w-4 h-4 mr-2" />
                    {isUploading ? 'Subiendo...' : 'Agregar'}
                  </Button>
                </label>
              </CardHeader>
              <CardContent>
                {sortedPayrolls.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {sortedPayrolls.map((payroll, idx) => (
                      <div key={idx} className="bg-zinc-950/50 rounded-xl p-4 border border-zinc-800 hover:border-green-500/50 transition-all group">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="text-lg font-bold text-white">{payroll.period || 'Sin periodo'}</p>
                            <Badge className={`mt-1 ${payrollStatusColors[payroll.status] || 'bg-zinc-600'}`}>
                              {payroll.status || 'pendiente'}
                            </Badge>
                          </div>
                          {payroll.file_url && (
                            <a href={payroll.file_url} target="_blank" rel="noopener noreferrer">
                              <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-green-400">
                                <Eye className="w-4 h-4" />
                              </Button>
                            </a>
                          )}
                        </div>
                        <div className="space-y-1 text-sm">
                          {payroll.gross_salary && <div className="flex justify-between text-zinc-400"><span>Bruto:</span><span className="text-white">{payroll.gross_salary.toFixed(2)}€</span></div>}
                          {payroll.social_security && <div className="flex justify-between text-zinc-400"><span>SS:</span><span className="text-white">-{payroll.social_security.toFixed(2)}€</span></div>}
                          {payroll.irpf && <div className="flex justify-between text-zinc-400"><span>IRPF:</span><span className="text-white">-{payroll.irpf.toFixed(2)}€</span></div>}
                          <div className="flex justify-between pt-2 border-t border-zinc-800 font-bold">
                            <span className="text-green-400">Neto:</span>
                            <span className="text-green-400 text-lg">{payroll.net_salary?.toFixed(2) || payroll.amount?.toFixed(2) || '0.00'}€</span>
                          </div>
                        </div>
                        {!payroll.file_url && (
                          <p className="text-xs text-orange-400 mt-2 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            Sin archivo adjunto
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <DollarSign className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
                    <p className="text-zinc-500 mb-2">No hay nóminas registradas para este empleado</p>
                    <p className="text-xs text-zinc-600">Las nóminas se agregan automáticamente al procesar PDFs en el Archivo Global</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Control Horario */}
            <Card className="border-none bg-zinc-900/50 border border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Clock className="w-5 h-5 text-blue-400" />
                  Control Horario
                </CardTitle>
              </CardHeader>
              <CardContent>
                {sortedTimesheets.length > 0 ? (
                  <div className="space-y-2">
                    {sortedTimesheets.slice(0, 10).map((timesheet, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-zinc-950/50 rounded-lg border border-zinc-800 hover:border-blue-500/50 transition-all">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-950/50 rounded-lg flex items-center justify-center border border-blue-500/30">
                            <Clock className="w-5 h-5 text-blue-400" />
                          </div>
                          <div>
                            <p className="font-bold text-white">{timesheet.date}</p>
                            <p className="text-sm text-zinc-400">
                              {timesheet.check_in} → {timesheet.check_out || 'En curso'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold text-blue-400">{timesheet.total_hours?.toFixed(1) || '0.0'}h</p>
                          <Badge className={timesheet.status === 'completo' ? 'bg-green-600' : 'bg-yellow-600'}>
                            {timesheet.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Clock className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
                    <p className="text-zinc-500">No hay fichajes registrados</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Documentos adicionales */}
            {(employee.contracts?.length > 0 || employee.documents?.length > 0) && (
              <Card className="border-none bg-zinc-900/50 border border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <FileText className="w-5 h-5 text-orange-400" />
                    Documentos
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {employee.contracts?.map((contract, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-zinc-950/50 rounded-lg border border-zinc-800">
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-blue-400" />
                        <div>
                          <p className="font-medium text-white">{contract.type || 'Contrato'}</p>
                          <p className="text-xs text-zinc-500">{contract.start_date}</p>
                        </div>
                      </div>
                      {contract.file_url && (
                        <a href={contract.file_url} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="sm"><Eye className="w-4 h-4" /></Button>
                        </a>
                      )}
                    </div>
                  ))}
                  {employee.documents?.map((doc, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-zinc-950/50 rounded-lg border border-zinc-800">
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-purple-400" />
                        <div>
                          <p className="font-medium text-white">{doc.title || doc.type}</p>
                          <p className="text-xs text-zinc-500">{doc.type}</p>
                        </div>
                      </div>
                      {doc.file_url && (
                        <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="sm"><Eye className="w-4 h-4" /></Button>
                        </a>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}