// Inspección Industria/PRL - SYNK-IA
// Módulo de Prevención de Riesgos Laborales

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { format, parseISO, differenceInDays } from "date-fns";
import {
  Shield,
  HardHat,
  FileText,
  GraduationCap,
  Stethoscope,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Download,
  ArrowLeft,
  Search,
  FileCheck,
  ShieldAlert,
  Building2,
  ClipboardList,
  Siren,
  Calendar,
  AlertCircle,
  HeartPulse,
  BadgeCheck
} from "lucide-react";
import { complianceService, COMPLIANCE_STATUS } from "@/services/complianceService";

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
const DocumentStatus = ({ expirationDate }) => {
  if (!expirationDate) {
    return <Badge className="bg-gray-500/20 text-gray-400">No caduca</Badge>;
  }
  
  const today = new Date();
  const expDate = typeof expirationDate === 'string' ? parseISO(expirationDate) : expirationDate;
  const daysUntilExpiry = differenceInDays(expDate, today);
  
  if (daysUntilExpiry < 0) {
    return (
      <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
        <XCircle className="h-3 w-3 mr-1" />
        Vencido
      </Badge>
    );
  } else if (daysUntilExpiry <= 7) {
    return (
      <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
        <AlertTriangle className="h-3 w-3 mr-1" />
        {daysUntilExpiry}d
      </Badge>
    );
  } else if (daysUntilExpiry <= 30) {
    return (
      <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
        <AlertTriangle className="h-3 w-3 mr-1" />
        {daysUntilExpiry}d
      </Badge>
    );
  }
  
  return (
    <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
      <CheckCircle className="h-3 w-3 mr-1" />
      Vigente
    </Badge>
  );
};

export default function InspeccionIndustria() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("plan-prl");
  const [searchTerm, setSearchTerm] = useState("");
  const [mockData, setMockData] = useState(null);
  const [complianceResult, setComplianceResult] = useState(null);
  
  // Cargar datos mock
  useEffect(() => {
    const data = complianceService.generateMockData();
    setMockData(data.industria);
    
    // Evaluar cumplimiento
    const result = complianceService.evaluateIndustryCompliance(
      data.industria.prlPlan,
      data.industria.riskEvaluations,
      data.industria.prlTraining,
      data.industria.epis,
      data.industria.accidents,
      data.industria.medicalReviews,
      data.industria.licenses,
      data.industria.insurance
    );
    setComplianceResult(result);
  }, []);
  
  // Exportar para inspección
  const handleExportForInspection = () => {
    if (mockData) {
      complianceService.generateInspectionReport('industria', mockData);
      toast.success("Informe para Inspección de Industria/PRL generado");
    }
  };
  
  // Filtrar datos
  const filterData = (data) => {
    if (!data) return [];
    return data.filter(item => {
      const matchesSearch = !searchTerm || 
        (item.employee_name && item.employee_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.name && item.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.position && item.position.toLowerCase().includes(searchTerm.toLowerCase()));
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
              <HardHat className="h-8 w-8 text-orange-400" />
              Inspección Industria / PRL
            </h1>
            <p className="text-gray-400 mt-1">Prevención de Riesgos Laborales y licencias</p>
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
            className="bg-orange-600 hover:bg-orange-700"
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar para Inspección
          </Button>
        </div>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6">
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Plan PRL</p>
                <p className="text-lg font-bold text-white">
                  {complianceResult?.stats?.hasPRLPlan ? 'Aprobado' : 'Pendiente'}
                </p>
              </div>
              <Shield className={`h-6 w-6 ${complianceResult?.stats?.hasPRLPlan ? 'text-green-400' : 'text-red-400'}`} />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Eval. Riesgos</p>
                <p className="text-lg font-bold text-white">{complianceResult?.stats?.riskEvaluationsCount || 0}</p>
              </div>
              <ShieldAlert className="h-6 w-6 text-amber-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Form. PRL</p>
                <p className="text-lg font-bold text-white">{complianceResult?.stats?.trainedEmployees || 0}</p>
              </div>
              <GraduationCap className="h-6 w-6 text-blue-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Rev. Médicas</p>
                <p className="text-lg font-bold text-white">{complianceResult?.stats?.validMedicalReviews || 0}</p>
              </div>
              <HeartPulse className="h-6 w-6 text-pink-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Licencias</p>
                <p className="text-lg font-bold text-white">{complianceResult?.stats?.validLicenses || 0}</p>
              </div>
              <FileCheck className="h-6 w-6 text-purple-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Accidentes Año</p>
                <p className="text-lg font-bold text-yellow-400">{complianceResult?.stats?.accidentsThisYear || 0}</p>
              </div>
              <Siren className="h-6 w-6 text-red-400" />
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Alertas */}
      {complianceResult?.issues?.length > 0 && (
        <Card className="bg-red-500/10 border-red-500/30 mb-6">
          <CardHeader>
            <CardTitle className="text-red-400 flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Alertas PRL ({complianceResult.issues.length})
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
                    {issue.document && <span className="font-medium">{issue.document}: </span>}
                    {issue.message}
                  </span>
                  <Badge variant="outline" className={`ml-auto ${
                    issue.type === 'prl_training' ? 'border-blue-500/30 text-blue-400' :
                    issue.type === 'medical_review' ? 'border-pink-500/30 text-pink-400' :
                    issue.type === 'license' ? 'border-purple-500/30 text-purple-400' :
                    issue.type === 'insurance' ? 'border-green-500/30 text-green-400' :
                    'border-amber-500/30 text-amber-400'
                  }`}>
                    {issue.type === 'prl_training' ? 'Formación' :
                     issue.type === 'medical_review' ? 'Médico' : 
                     issue.type === 'license' ? 'Licencia' : 
                     issue.type === 'insurance' ? 'Seguro' : 'PRL'}
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
            placeholder="Buscar..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-gray-800/50 border-gray-700 text-white"
          />
        </div>
      </div>
      
      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-gray-800/50 border border-gray-700 flex-wrap">
          <TabsTrigger value="plan-prl" className="data-[state=active]:bg-orange-600">
            <Shield className="h-4 w-4 mr-2" />
            Plan PRL
          </TabsTrigger>
          <TabsTrigger value="evaluaciones" className="data-[state=active]:bg-orange-600">
            <ShieldAlert className="h-4 w-4 mr-2" />
            Eval. Riesgos
          </TabsTrigger>
          <TabsTrigger value="formacion" className="data-[state=active]:bg-orange-600">
            <GraduationCap className="h-4 w-4 mr-2" />
            Formación
          </TabsTrigger>
          <TabsTrigger value="epis" className="data-[state=active]:bg-orange-600">
            <HardHat className="h-4 w-4 mr-2" />
            EPIs
          </TabsTrigger>
          <TabsTrigger value="accidentes" className="data-[state=active]:bg-orange-600">
            <Siren className="h-4 w-4 mr-2" />
            Accidentes
          </TabsTrigger>
          <TabsTrigger value="medicas" className="data-[state=active]:bg-orange-600">
            <HeartPulse className="h-4 w-4 mr-2" />
            Rev. Médicas
          </TabsTrigger>
          <TabsTrigger value="licencias" className="data-[state=active]:bg-orange-600">
            <Building2 className="h-4 w-4 mr-2" />
            Licencias
          </TabsTrigger>
          <TabsTrigger value="seguros" className="data-[state=active]:bg-orange-600">
            <FileCheck className="h-4 w-4 mr-2" />
            Seguros
          </TabsTrigger>
        </TabsList>
        
        {/* Plan PRL */}
        <TabsContent value="plan-prl">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Plan de Prevención de Riesgos Laborales</CardTitle>
              <CardDescription className="text-gray-400">
                Documento marco de gestión de la prevención
              </CardDescription>
            </CardHeader>
            <CardContent>
              {mockData?.prlPlan ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg">
                        <span className="text-gray-400">Nombre del Plan</span>
                        <span className="text-white font-medium">{mockData.prlPlan.name}</span>
                      </div>
                      <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg">
                        <span className="text-gray-400">Fecha de Aprobación</span>
                        <span className="text-white font-medium">
                          {format(parseISO(mockData.prlPlan.approved_date), 'dd/MM/yyyy')}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg">
                        <span className="text-gray-400">Última Revisión</span>
                        <span className="text-white font-medium">
                          {format(parseISO(mockData.prlPlan.last_review), 'dd/MM/yyyy')}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg">
                        <span className="text-gray-400">Servicio de Prevención</span>
                        <span className="text-white font-medium">{mockData.prlPlan.responsible}</span>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-white">Estado del Plan</h3>
                      <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                        <div className="flex items-center gap-3 mb-3">
                          <CheckCircle className="h-6 w-6 text-green-400" />
                          <span className="text-green-400 font-semibold">Plan Aprobado y Vigente</span>
                        </div>
                        <p className="text-gray-400 text-sm">
                          El Plan de Prevención cumple con los requisitos establecidos en la Ley 31/1995 de PRL
                          y el RD 39/1997 Reglamento de los Servicios de Prevención.
                        </p>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-400">Completitud del Plan</span>
                          <span className="text-white">100%</span>
                        </div>
                        <Progress value={100} className="h-2" />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <ShieldAlert className="h-12 w-12 text-red-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-red-400">Plan PRL No Disponible</h3>
                  <p className="text-gray-400 mt-2">Es obligatorio disponer de un Plan de Prevención de Riesgos Laborales</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Evaluaciones de Riesgo */}
        <TabsContent value="evaluaciones">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Evaluación de Riesgos por Puesto</CardTitle>
              <CardDescription className="text-gray-400">
                Identificación y evaluación de riesgos laborales
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-700">
                    <TableHead className="text-gray-400">Puesto</TableHead>
                    <TableHead className="text-gray-400">Fecha Evaluación</TableHead>
                    <TableHead className="text-gray-400">Riesgos</TableHead>
                    <TableHead className="text-gray-400">Medidas</TableHead>
                    <TableHead className="text-gray-400">Evaluador</TableHead>
                    <TableHead className="text-gray-400">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filterData(mockData?.riskEvaluations).map((eval_) => (
                    <TableRow key={eval_.id} className="border-gray-700">
                      <TableCell className="text-white font-medium">{eval_.position}</TableCell>
                      <TableCell className="text-gray-300">
                        {format(parseISO(eval_.date), 'dd/MM/yyyy')}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-amber-500/30 text-amber-400">
                          {eval_.risks_count} riesgos
                        </Badge>
                      </TableCell>
                      <TableCell className="text-gray-300 max-w-xs truncate">
                        {eval_.preventive_measures}
                      </TableCell>
                      <TableCell className="text-gray-300">{eval_.evaluator}</TableCell>
                      <TableCell>
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          {eval_.status === 'active' ? 'Activa' : eval_.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Formación PRL */}
        <TabsContent value="formacion">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Formación en PRL por Empleado</CardTitle>
              <CardDescription className="text-gray-400">
                Registro de cursos de prevención de riesgos laborales
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-700">
                    <TableHead className="text-gray-400">Empleado</TableHead>
                    <TableHead className="text-gray-400">DNI</TableHead>
                    <TableHead className="text-gray-400">Curso</TableHead>
                    <TableHead className="text-gray-400">Fecha</TableHead>
                    <TableHead className="text-gray-400">Horas</TableHead>
                    <TableHead className="text-gray-400">Certificado</TableHead>
                    <TableHead className="text-gray-400">Caducidad</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filterData(mockData?.prlTraining).map((training) => (
                    <TableRow key={training.id} className="border-gray-700">
                      <TableCell className="text-white font-medium">{training.employee_name}</TableCell>
                      <TableCell className="text-gray-300">{training.employee_dni}</TableCell>
                      <TableCell className="text-gray-300">{training.course_name}</TableCell>
                      <TableCell className="text-gray-300">
                        {format(parseISO(training.date), 'dd/MM/yyyy')}
                      </TableCell>
                      <TableCell className="text-gray-300">{training.hours}h</TableCell>
                      <TableCell className="text-gray-300">{training.certificate_number}</TableCell>
                      <TableCell>
                        <DocumentStatus expirationDate={training.expiration_date} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* EPIs */}
        <TabsContent value="epis">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Equipos de Protección Individual (EPIs)</CardTitle>
              <CardDescription className="text-gray-400">
                Registro de entrega de EPIs por empleado
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-700">
                    <TableHead className="text-gray-400">Empleado</TableHead>
                    <TableHead className="text-gray-400">EPI</TableHead>
                    <TableHead className="text-gray-400">Tipo</TableHead>
                    <TableHead className="text-gray-400">Fecha Entrega</TableHead>
                    <TableHead className="text-gray-400">Caducidad</TableHead>
                    <TableHead className="text-gray-400">Firmado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filterData(mockData?.epis).map((epi) => (
                    <TableRow key={epi.id} className="border-gray-700">
                      <TableCell className="text-white font-medium">{epi.employee_name}</TableCell>
                      <TableCell className="text-gray-300">{epi.epi_name}</TableCell>
                      <TableCell className="text-gray-300">{epi.epi_type}</TableCell>
                      <TableCell className="text-gray-300">
                        {format(parseISO(epi.delivery_date), 'dd/MM/yyyy')}
                      </TableCell>
                      <TableCell>
                        <DocumentStatus expirationDate={epi.expiration_date} />
                      </TableCell>
                      <TableCell>
                        {epi.signed ? (
                          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Sí
                          </Badge>
                        ) : (
                          <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                            <XCircle className="h-3 w-3 mr-1" />
                            No
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
        
        {/* Accidentes */}
        <TabsContent value="accidentes">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Registro de Accidentes e Incidentes</CardTitle>
              <CardDescription className="text-gray-400">
                Historial de accidentes laborales
              </CardDescription>
            </CardHeader>
            <CardContent>
              {mockData?.accidents?.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow className="border-gray-700">
                      <TableHead className="text-gray-400">Fecha</TableHead>
                      <TableHead className="text-gray-400">Empleado</TableHead>
                      <TableHead className="text-gray-400">Tipo</TableHead>
                      <TableHead className="text-gray-400">Descripción</TableHead>
                      <TableHead className="text-gray-400">Baja</TableHead>
                      <TableHead className="text-gray-400">Días</TableHead>
                      <TableHead className="text-gray-400">Parte</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockData.accidents.map((accident) => (
                      <TableRow key={accident.id} className="border-gray-700">
                        <TableCell className="text-white font-medium">
                          {format(parseISO(accident.date), 'dd/MM/yyyy')}
                        </TableCell>
                        <TableCell className="text-gray-300">{accident.employee_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`${
                            accident.type === 'Grave' ? 'border-red-500/30 text-red-400' :
                            accident.type === 'Leve' ? 'border-yellow-500/30 text-yellow-400' :
                            'border-gray-500/30 text-gray-400'
                          }`}>
                            {accident.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-gray-300">{accident.description}</TableCell>
                        <TableCell>
                          {accident.sick_leave ? (
                            <Badge className="bg-red-500/20 text-red-400">Sí</Badge>
                          ) : (
                            <Badge className="bg-green-500/20 text-green-400">No</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-gray-300">{accident.sick_leave_days}</TableCell>
                        <TableCell className="text-gray-300">{accident.report_number}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-green-400">Sin Accidentes Registrados</h3>
                  <p className="text-gray-400 mt-2">No hay accidentes laborales registrados en el período actual</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Revisiones Médicas */}
        <TabsContent value="medicas">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Revisiones Médicas por Empleado</CardTitle>
              <CardDescription className="text-gray-400">
                Vigilancia de la salud de los trabajadores
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-700">
                    <TableHead className="text-gray-400">Empleado</TableHead>
                    <TableHead className="text-gray-400">DNI</TableHead>
                    <TableHead className="text-gray-400">Fecha Revisión</TableHead>
                    <TableHead className="text-gray-400">Resultado</TableHead>
                    <TableHead className="text-gray-400">Próxima</TableHead>
                    <TableHead className="text-gray-400">Apto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filterData(mockData?.medicalReviews).map((review) => (
                    <TableRow key={review.id} className="border-gray-700">
                      <TableCell className="text-white font-medium">{review.employee_name}</TableCell>
                      <TableCell className="text-gray-300">{review.employee_dni}</TableCell>
                      <TableCell className="text-gray-300">
                        {format(parseISO(review.date), 'dd/MM/yyyy')}
                      </TableCell>
                      <TableCell className="text-gray-300">{review.result}</TableCell>
                      <TableCell>
                        <DocumentStatus expirationDate={review.next_review_date} />
                      </TableCell>
                      <TableCell>
                        {review.fit_for_work ? (
                          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Apto
                          </Badge>
                        ) : (
                          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Restricciones
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
        
        {/* Licencias */}
        <TabsContent value="licencias">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Licencias y Permisos Municipales</CardTitle>
              <CardDescription className="text-gray-400">
                Documentación administrativa del establecimiento
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-700">
                    <TableHead className="text-gray-400">Documento</TableHead>
                    <TableHead className="text-gray-400">Tipo</TableHead>
                    <TableHead className="text-gray-400">Número</TableHead>
                    <TableHead className="text-gray-400">Fecha Emisión</TableHead>
                    <TableHead className="text-gray-400">Caducidad</TableHead>
                    <TableHead className="text-gray-400">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filterData(mockData?.licenses).map((license) => (
                    <TableRow key={license.id} className="border-gray-700">
                      <TableCell className="text-white font-medium">{license.name}</TableCell>
                      <TableCell className="text-gray-300">{license.type}</TableCell>
                      <TableCell className="text-gray-300">{license.number}</TableCell>
                      <TableCell className="text-gray-300">
                        {license.issue_date ? format(parseISO(license.issue_date), 'dd/MM/yyyy') : '-'}
                      </TableCell>
                      <TableCell>
                        <DocumentStatus expirationDate={license.expiration_date} />
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                          {license.status === 'active' ? 'Activo' : license.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Seguros */}
        <TabsContent value="seguros">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Seguros</CardTitle>
              <CardDescription className="text-gray-400">
                Pólizas de seguro y vencimientos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-700">
                    <TableHead className="text-gray-400">Seguro</TableHead>
                    <TableHead className="text-gray-400">Tipo</TableHead>
                    <TableHead className="text-gray-400">Nº Póliza</TableHead>
                    <TableHead className="text-gray-400">Inicio</TableHead>
                    <TableHead className="text-gray-400">Vencimiento</TableHead>
                    <TableHead className="text-gray-400">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filterData(mockData?.insurance).map((ins) => (
                    <TableRow key={ins.id} className="border-gray-700">
                      <TableCell className="text-white font-medium">{ins.name}</TableCell>
                      <TableCell className="text-gray-300">{ins.type}</TableCell>
                      <TableCell className="text-gray-300">{ins.number}</TableCell>
                      <TableCell className="text-gray-300">
                        {ins.issue_date ? format(parseISO(ins.issue_date), 'dd/MM/yyyy') : '-'}
                      </TableCell>
                      <TableCell>
                        <DocumentStatus expirationDate={ins.expiration_date} />
                      </TableCell>
                      <TableCell>
                        <Badge className={`${
                          ins.status === 'active' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                          'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                        }`}>
                          {ins.status === 'active' ? 'Activo' : 
                           ins.status === 'expiring' ? 'Por vencer' : ins.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
