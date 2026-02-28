// Inspección Laboral - SYNK-IA
// Módulo de cumplimiento para Inspección de Trabajo

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format, parseISO, differenceInDays, startOfMonth, endOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import {
  Shield,
  FileText,
  Clock,
  Users,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Download,
  Calendar,
  FileSignature,
  Briefcase,
  ArrowLeft,
  Search,
  Filter,
  RefreshCw,
  History,
  Eye,
  Edit,
  AlertCircle
} from "lucide-react";
import { complianceService, COMPLIANCE_STATUS } from "@/services/complianceService";

const Employee = base44.entities.Employee;
const Timesheet = base44.entities.Timesheet;
const Payroll = base44.entities.Payroll;

// Componente de Semáforo
const ComplianceTrafficLight = ({ status, size = "md" }) => {
  const sizeClasses = {
    sm: "w-3 h-3",
    md: "w-5 h-5",
    lg: "w-8 h-8"
  };
  
  const colorClasses = {
    green: "bg-green-500",
    yellow: "bg-yellow-500",
    red: "bg-red-500"
  };
  
  return (
    <div className={`${sizeClasses[size]} ${colorClasses[status]} rounded-full animate-pulse`} />
  );
};

// Componente de Estado de Documento
const DocumentStatus = ({ expirationDate, label }) => {
  const today = new Date();
  const expDate = typeof expirationDate === 'string' ? parseISO(expirationDate) : expirationDate;
  const daysUntilExpiry = expDate ? differenceInDays(expDate, today) : null;
  
  let statusColor = "bg-green-500/20 text-green-400 border-green-500/30";
  let statusText = "Vigente";
  
  if (!expirationDate) {
    statusColor = "bg-gray-500/20 text-gray-400 border-gray-500/30";
    statusText = "Sin fecha";
  } else if (daysUntilExpiry < 0) {
    statusColor = "bg-red-500/20 text-red-400 border-red-500/30";
    statusText = "Vencido";
  } else if (daysUntilExpiry <= 7) {
    statusColor = "bg-red-500/20 text-red-400 border-red-500/30";
    statusText = `${daysUntilExpiry}d`;
  } else if (daysUntilExpiry <= 30) {
    statusColor = "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    statusText = `${daysUntilExpiry}d`;
  }
  
  return (
    <Badge variant="outline" className={`${statusColor} text-xs`}>
      {label ? `${label}: ${statusText}` : statusText}
    </Badge>
  );
};

export default function InspeccionLaboral() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("registro-horario");
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState(format(new Date(), 'yyyy-MM'));
  const [mockData, setMockData] = useState(null);
  const [complianceResult, setComplianceResult] = useState(null);
  
  // Cargar datos mock para demo
  useEffect(() => {
    const data = complianceService.generateMockData();
    setMockData(data.laboral);
    
    // Evaluar cumplimiento
    const employees = [
      { id: 1, full_name: 'Juan García López', status: 'active' },
      { id: 2, full_name: 'María Rodríguez Pérez', status: 'active' },
      { id: 3, full_name: 'Pedro Martínez Sánchez', status: 'active' },
    ];
    
    const result = complianceService.evaluateLaborCompliance(
      employees,
      data.laboral.timesheets,
      data.laboral.payrolls,
      data.laboral.contracts
    );
    setComplianceResult(result);
  }, []);
  
  // Cargar datos reales (opcional, si existen)
  const { data: employees } = useQuery({
    queryKey: ['employees'],
    queryFn: () => Employee.list().catch(() => []),
    staleTime: 5 * 60 * 1000
  });
  
  const { data: timesheets } = useQuery({
    queryKey: ['timesheets'],
    queryFn: () => Timesheet.list().catch(() => []),
    staleTime: 5 * 60 * 1000
  });
  
  const { data: payrolls } = useQuery({
    queryKey: ['payrolls'],
    queryFn: () => Payroll.list().catch(() => []),
    staleTime: 5 * 60 * 1000
  });
  
  // Exportar para inspección
  const handleExportForInspection = () => {
    if (mockData) {
      complianceService.generateInspectionReport('laboral', mockData);
      toast.success("Informe para Inspección de Trabajo generado");
    }
  };
  
  // Filtrar datos
  const filterData = (data) => {
    if (!data) return [];
    return data.filter(item => {
      const matchesSearch = !searchTerm || 
        (item.employee_name && item.employee_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.employee_dni && item.employee_dni.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchesSearch;
    });
  };
  
  const overallStatus = complianceResult?.status || COMPLIANCE_STATUS.OK;
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate(createPageUrl("ComplianceDashboard"))}
            className="text-gray-400 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Briefcase className="h-8 w-8 text-blue-400" />
              Inspección Laboral
            </h1>
            <p className="text-gray-400 mt-1">Cumplimiento normativo laboral español</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-gray-800/50 rounded-lg px-4 py-2 border border-gray-700">
            <span className="text-gray-400 text-sm">Estado General:</span>
            <ComplianceTrafficLight status={overallStatus} size="md" />
            <span className={`font-medium ${
              overallStatus === 'green' ? 'text-green-400' :
              overallStatus === 'yellow' ? 'text-yellow-400' : 'text-red-400'
            }`}>
              {overallStatus === 'green' ? 'Conforme' :
               overallStatus === 'yellow' ? 'Revisar' : 'No Conforme'}
            </span>
          </div>
          
          <Button 
            onClick={handleExportForInspection}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar para Inspección
          </Button>
        </div>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Empleados Activos</p>
                <p className="text-2xl font-bold text-white">{complianceResult?.stats?.totalEmployees || 0}</p>
              </div>
              <Users className="h-8 w-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Con Registro Horario</p>
                <p className="text-2xl font-bold text-white">{complianceResult?.stats?.withTimesheets || 0}</p>
              </div>
              <Clock className="h-8 w-8 text-green-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Nóminas Firmadas</p>
                <p className="text-2xl font-bold text-white">{complianceResult?.stats?.withPayrolls || 0}</p>
              </div>
              <FileSignature className="h-8 w-8 text-purple-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Contratos por Vencer</p>
                <p className="text-2xl font-bold text-yellow-400">{complianceResult?.stats?.contractsExpiring || 0}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-yellow-400" />
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Alertas de Incumplimiento */}
      {complianceResult?.issues?.length > 0 && (
        <Card className="bg-red-500/10 border-red-500/30 mb-6">
          <CardHeader>
            <CardTitle className="text-red-400 flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Alertas de Cumplimiento ({complianceResult.issues.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {complianceResult.issues.slice(0, 5).map((issue, idx) => (
                <div key={idx} className="flex items-center gap-3 p-2 bg-gray-800/50 rounded-lg">
                  {issue.severity === 'critical' ? 
                    <XCircle className="h-4 w-4 text-red-400" /> :
                    <AlertTriangle className="h-4 w-4 text-yellow-400" />
                  }
                  <span className="text-gray-300">
                    {issue.employee && <span className="font-medium">{issue.employee}: </span>}
                    {issue.message}
                  </span>
                  <Badge variant="outline" className={`ml-auto ${
                    issue.type === 'timesheet' ? 'border-blue-500/30 text-blue-400' :
                    issue.type === 'payroll' ? 'border-purple-500/30 text-purple-400' :
                    'border-yellow-500/30 text-yellow-400'
                  }`}>
                    {issue.type === 'timesheet' ? 'Horario' :
                     issue.type === 'payroll' ? 'Nómina' : 'Contrato'}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Filtros */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <Input
            placeholder="Buscar por empleado o DNI..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-gray-800/50 border-gray-700 text-white"
          />
        </div>
        <Input
          type="month"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="w-48 bg-gray-800/50 border-gray-700 text-white"
        />
      </div>
      
      {/* Tabs de Contenido */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-gray-800/50 border border-gray-700">
          <TabsTrigger value="registro-horario" className="data-[state=active]:bg-blue-600">
            <Clock className="h-4 w-4 mr-2" />
            Registro Horario
          </TabsTrigger>
          <TabsTrigger value="contratos" className="data-[state=active]:bg-blue-600">
            <FileText className="h-4 w-4 mr-2" />
            Contratos
          </TabsTrigger>
          <TabsTrigger value="nominas" className="data-[state=active]:bg-blue-600">
            <FileSignature className="h-4 w-4 mr-2" />
            Nóminas Firmadas
          </TabsTrigger>
          <TabsTrigger value="trazabilidad" className="data-[state=active]:bg-blue-600">
            <History className="h-4 w-4 mr-2" />
            Trazabilidad
          </TabsTrigger>
        </TabsList>
        
        {/* Registro Horario */}
        <TabsContent value="registro-horario">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white">Registro Horario Certificado</CardTitle>
                  <CardDescription className="text-gray-400">
                    Conforme al RDL 8/2019 de control horario
                  </CardDescription>
                </div>
                <Button variant="outline" className="border-gray-600">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Sincronizar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-700">
                    <TableHead className="text-gray-400">Empleado</TableHead>
                    <TableHead className="text-gray-400">DNI</TableHead>
                    <TableHead className="text-gray-400">Fecha</TableHead>
                    <TableHead className="text-gray-400">Entrada</TableHead>
                    <TableHead className="text-gray-400">Salida</TableHead>
                    <TableHead className="text-gray-400">Horas</TableHead>
                    <TableHead className="text-gray-400">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filterData(mockData?.timesheets).map((ts) => (
                    <TableRow key={ts.id} className="border-gray-700">
                      <TableCell className="text-white font-medium">{ts.employee_name}</TableCell>
                      <TableCell className="text-gray-300">{ts.employee_dni}</TableCell>
                      <TableCell className="text-gray-300">
                        {format(parseISO(ts.date), 'dd/MM/yyyy')}
                      </TableCell>
                      <TableCell className="text-gray-300">{ts.check_in || '-'}</TableCell>
                      <TableCell className="text-gray-300">{ts.check_out || '-'}</TableCell>
                      <TableCell className="text-gray-300">{ts.hours_worked || '-'}</TableCell>
                      <TableCell>
                        {ts.verified ? (
                          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Verificado
                          </Badge>
                        ) : (
                          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Pendiente
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Contratos */}
        <TabsContent value="contratos">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Lista de Contratos</CardTitle>
              <CardDescription className="text-gray-400">
                Estado y vencimiento de contratos laborales
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-700">
                    <TableHead className="text-gray-400">Empleado</TableHead>
                    <TableHead className="text-gray-400">DNI</TableHead>
                    <TableHead className="text-gray-400">Tipo</TableHead>
                    <TableHead className="text-gray-400">Inicio</TableHead>
                    <TableHead className="text-gray-400">Fin</TableHead>
                    <TableHead className="text-gray-400">Estado</TableHead>
                    <TableHead className="text-gray-400">Vencimiento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filterData(mockData?.contracts).map((contract) => (
                    <TableRow key={contract.id} className="border-gray-700">
                      <TableCell className="text-white font-medium">{contract.employee_name}</TableCell>
                      <TableCell className="text-gray-300">{contract.employee_dni}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`${
                          contract.type === 'indefinido' ? 'border-green-500/30 text-green-400' :
                          'border-yellow-500/30 text-yellow-400'
                        }`}>
                          {contract.type === 'indefinido' ? 'Indefinido' : 'Temporal'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-gray-300">
                        {format(parseISO(contract.start_date), 'dd/MM/yyyy')}
                      </TableCell>
                      <TableCell className="text-gray-300">
                        {contract.end_date ? format(parseISO(contract.end_date), 'dd/MM/yyyy') : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                          {contract.status === 'active' ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {contract.end_date ? (
                          <DocumentStatus expirationDate={contract.end_date} />
                        ) : (
                          <Badge className="bg-gray-500/20 text-gray-400">N/A</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Nóminas Firmadas */}
        <TabsContent value="nominas">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Nóminas Firmadas Digitalmente</CardTitle>
              <CardDescription className="text-gray-400">
                Registro de nóminas con firma digital del empleado
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-700">
                    <TableHead className="text-gray-400">Empleado</TableHead>
                    <TableHead className="text-gray-400">DNI</TableHead>
                    <TableHead className="text-gray-400">Período</TableHead>
                    <TableHead className="text-gray-400">Bruto</TableHead>
                    <TableHead className="text-gray-400">Neto</TableHead>
                    <TableHead className="text-gray-400">Firmada</TableHead>
                    <TableHead className="text-gray-400">Fecha Firma</TableHead>
                    <TableHead className="text-gray-400">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filterData(mockData?.payrolls).map((payroll) => (
                    <TableRow key={payroll.id} className="border-gray-700">
                      <TableCell className="text-white font-medium">{payroll.employee_name}</TableCell>
                      <TableCell className="text-gray-300">{payroll.employee_dni}</TableCell>
                      <TableCell className="text-gray-300">{payroll.period}</TableCell>
                      <TableCell className="text-gray-300">
                        {payroll.gross_salary?.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                      </TableCell>
                      <TableCell className="text-gray-300">
                        {payroll.net_salary?.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                      </TableCell>
                      <TableCell>
                        {payroll.signed ? (
                          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Firmada
                          </Badge>
                        ) : (
                          <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                            <XCircle className="h-3 w-3 mr-1" />
                            Pendiente
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-gray-300">
                        {payroll.signed_date ? format(parseISO(payroll.signed_date), 'dd/MM/yyyy') : '-'}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Trazabilidad */}
        <TabsContent value="trazabilidad">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Trazabilidad de Modificaciones</CardTitle>
              <CardDescription className="text-gray-400">
                Registro de cambios y auditoría de documentos laborales
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { date: '2026-02-28 14:30', user: 'Admin', action: 'Registro de entrada', target: 'Pedro Martínez - Fichaje 10:00' },
                  { date: '2026-02-28 10:15', user: 'Sistema', action: 'Nómina generada', target: 'Todos los empleados - Febrero 2026' },
                  { date: '2026-02-27 16:45', user: 'Admin', action: 'Contrato actualizado', target: 'María Rodríguez - Prórroga temporal' },
                  { date: '2026-02-26 09:00', user: 'Sistema', action: 'Alerta generada', target: 'Contrato Pedro Martínez - Vence en 5 días' },
                  { date: '2026-02-25 18:30', user: 'Juan García', action: 'Nómina firmada', target: 'Juan García - Febrero 2026' },
                ].map((log, idx) => (
                  <div key={idx} className="flex items-center gap-4 p-3 bg-gray-900/50 rounded-lg">
                    <div className="w-2 h-2 bg-blue-400 rounded-full" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 text-sm">{log.date}</span>
                        <Badge variant="outline" className="border-gray-600 text-gray-300 text-xs">
                          {log.user}
                        </Badge>
                      </div>
                      <p className="text-white">{log.action}</p>
                      <p className="text-gray-400 text-sm">{log.target}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
