// Dashboard de Cumplimiento Legal - SYNK-IA
// Vista general de compliance para CEO

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { format, parseISO, differenceInDays, addDays } from "date-fns";
import { es } from "date-fns/locale";
import {
  Shield,
  Briefcase,
  HardHat,
  Stethoscope,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Download,
  Calendar,
  Clock,
  FileText,
  ArrowRight,
  AlertCircle,
  Bell,
  TrendingUp,
  Eye,
  FileCheck,
  RefreshCw
} from "lucide-react";
import { complianceService, COMPLIANCE_STATUS, ALERT_THRESHOLDS } from "@/services/complianceService";

// Componente de Semáforo Grande
const TrafficLightLarge = ({ status, label, onClick }) => {
  const colorClasses = {
    green: "from-green-500 to-green-600 shadow-green-500/30",
    yellow: "from-yellow-500 to-yellow-600 shadow-yellow-500/30",
    red: "from-red-500 to-red-600 shadow-red-500/30"
  };
  
  const statusLabels = {
    green: "Conforme",
    yellow: "Revisar",
    red: "No Conforme"
  };
  
  return (
    <div 
      className="flex flex-col items-center gap-2 cursor-pointer hover:scale-105 transition-transform"
      onClick={onClick}
    >
      <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${colorClasses[status]} shadow-lg animate-pulse`} />
      <span className="text-white font-medium">{label}</span>
      <span className={`text-sm ${
        status === 'green' ? 'text-green-400' :
        status === 'yellow' ? 'text-yellow-400' : 'text-red-400'
      }`}>
        {statusLabels[status]}
      </span>
    </div>
  );
};

// Componente de Alerta de Vencimiento
const ExpirationAlert = ({ item, type }) => {
  const daysLeft = item.daysUntilExpiry;
  
  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg ${
      daysLeft < 0 ? 'bg-red-500/10 border border-red-500/30' :
      daysLeft <= 7 ? 'bg-red-500/10 border border-red-500/30' :
      daysLeft <= 15 ? 'bg-yellow-500/10 border border-yellow-500/30' :
      'bg-blue-500/10 border border-blue-500/30'
    }`}>
      <div className={`p-2 rounded-lg ${
        daysLeft < 0 ? 'bg-red-500/20' :
        daysLeft <= 7 ? 'bg-red-500/20' :
        daysLeft <= 15 ? 'bg-yellow-500/20' :
        'bg-blue-500/20'
      }`}>
        {daysLeft < 0 ? (
          <XCircle className="h-5 w-5 text-red-400" />
        ) : daysLeft <= 7 ? (
          <AlertTriangle className="h-5 w-5 text-red-400" />
        ) : (
          <Clock className="h-5 w-5 text-yellow-400" />
        )}
      </div>
      <div className="flex-1">
        <p className="text-white font-medium">
          {item.employee_name || item.name || item.document || 'Documento'}
        </p>
        <p className="text-gray-400 text-sm">{type}</p>
      </div>
      <Badge variant="outline" className={`${
        daysLeft < 0 ? 'border-red-500/30 text-red-400' :
        daysLeft <= 7 ? 'border-red-500/30 text-red-400' :
        daysLeft <= 15 ? 'border-yellow-500/30 text-yellow-400' :
        'border-blue-500/30 text-blue-400'
      }`}>
        {daysLeft < 0 ? 'Vencido' : `${daysLeft} días`}
      </Badge>
    </div>
  );
};

// Módulo Card
const ModuleCard = ({ title, icon: Icon, status, stats, onClick, color }) => {
  const colorClasses = {
    blue: 'border-blue-500/30 hover:border-blue-500/50',
    green: 'border-green-500/30 hover:border-green-500/50',
    orange: 'border-orange-500/30 hover:border-orange-500/50'
  };
  
  const iconColors = {
    blue: 'text-blue-400',
    green: 'text-green-400',
    orange: 'text-orange-400'
  };
  
  return (
    <Card 
      className={`bg-gray-800/50 ${colorClasses[color]} cursor-pointer transition-all hover:bg-gray-800/70`}
      onClick={onClick}
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className={`p-3 rounded-xl bg-gradient-to-br ${
            color === 'blue' ? 'from-blue-500/20 to-blue-600/20' :
            color === 'green' ? 'from-green-500/20 to-green-600/20' :
            'from-orange-500/20 to-orange-600/20'
          }`}>
            <Icon className={`h-6 w-6 ${iconColors[color]}`} />
          </div>
          <TrafficLightLarge status={status} label="" onClick={() => {}} />
        </div>
        
        <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
        
        <div className="space-y-2 mb-4">
          {stats.map((stat, idx) => (
            <div key={idx} className="flex items-center justify-between text-sm">
              <span className="text-gray-400">{stat.label}</span>
              <span className={`font-medium ${
                stat.status === 'ok' ? 'text-green-400' :
                stat.status === 'warning' ? 'text-yellow-400' :
                stat.status === 'error' ? 'text-red-400' :
                'text-white'
              }`}>
                {stat.value}
              </span>
            </div>
          ))}
        </div>
        
        <Button variant="outline" className="w-full border-gray-600 hover:bg-gray-700">
          <Eye className="h-4 w-4 mr-2" />
          Ver detalle
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </CardContent>
    </Card>
  );
};

export default function ComplianceDashboard() {
  const navigate = useNavigate();
  const [mockData, setMockData] = useState(null);
  const [complianceResults, setComplianceResults] = useState({
    laboral: null,
    sanidad: null,
    industria: null
  });
  const [allAlerts, setAllAlerts] = useState([]);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  
  // Cargar todos los datos de compliance
  useEffect(() => {
    const data = complianceService.generateMockData();
    setMockData(data);
    
    // Evaluar cada área
    const employees = [
      { id: 1, full_name: 'Juan García López', status: 'active' },
      { id: 2, full_name: 'María Rodríguez Pérez', status: 'active' },
      { id: 3, full_name: 'Pedro Martínez Sánchez', status: 'active' },
    ];
    
    const laboralResult = complianceService.evaluateLaborCompliance(
      employees,
      data.laboral.timesheets,
      data.laboral.payrolls,
      data.laboral.contracts
    );
    
    const sanidadResult = complianceService.evaluateHealthCompliance(
      data.sanidad.temperatures,
      data.sanidad.foodHandlerCerts,
      data.sanidad.cleaningRecords,
      data.sanidad.pestControl,
      data.sanidad.allergenPlan
    );
    
    const industriaResult = complianceService.evaluateIndustryCompliance(
      data.industria.prlPlan,
      data.industria.riskEvaluations,
      data.industria.prlTraining,
      data.industria.epis,
      data.industria.accidents,
      data.industria.medicalReviews,
      data.industria.licenses,
      data.industria.insurance
    );
    
    setComplianceResults({
      laboral: laboralResult,
      sanidad: sanidadResult,
      industria: industriaResult
    });
    
    // Recopilar todas las alertas de vencimiento
    const alerts = [];
    
    // Alertas de contratos
    data.laboral.contracts.forEach(c => {
      if (c.end_date) {
        const days = differenceInDays(parseISO(c.end_date), new Date());
        if (days <= 30) {
          alerts.push({ ...c, type: 'Contrato Laboral', daysUntilExpiry: days, area: 'laboral' });
        }
      }
    });
    
    // Alertas de carnets manipulador
    data.sanidad.foodHandlerCerts.forEach(c => {
      if (c.expiration_date) {
        const days = differenceInDays(parseISO(c.expiration_date), new Date());
        if (days <= 30) {
          alerts.push({ ...c, type: 'Carnet Manipulador', daysUntilExpiry: days, area: 'sanidad' });
        }
      }
    });
    
    // Alertas de formación PRL
    data.industria.prlTraining.forEach(t => {
      if (t.expiration_date) {
        const days = differenceInDays(parseISO(t.expiration_date), new Date());
        if (days <= 30) {
          alerts.push({ ...t, type: 'Formación PRL', daysUntilExpiry: days, area: 'industria' });
        }
      }
    });
    
    // Alertas de revisiones médicas
    data.industria.medicalReviews.forEach(r => {
      if (r.next_review_date) {
        const days = differenceInDays(parseISO(r.next_review_date), new Date());
        if (days <= 30) {
          alerts.push({ ...r, type: 'Revisión Médica', daysUntilExpiry: days, area: 'industria' });
        }
      }
    });
    
    // Alertas de licencias
    data.industria.licenses.forEach(l => {
      if (l.expiration_date) {
        const days = differenceInDays(parseISO(l.expiration_date), new Date());
        if (days <= 30) {
          alerts.push({ ...l, type: 'Licencia/Permiso', daysUntilExpiry: days, area: 'industria' });
        }
      }
    });
    
    // Alertas de seguros
    data.industria.insurance.forEach(i => {
      if (i.expiration_date) {
        const days = differenceInDays(parseISO(i.expiration_date), new Date());
        if (days <= 30) {
          alerts.push({ ...i, type: 'Seguro', daysUntilExpiry: days, area: 'industria' });
        }
      }
    });
    
    // Ordenar por urgencia
    alerts.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
    setAllAlerts(alerts);
  }, []);
  
  // Generar informe completo para inspección
  const handleGenerateFullReport = () => {
    setIsGeneratingReport(true);
    
    setTimeout(() => {
      if (mockData) {
        complianceService.generateInspectionReport('complete', mockData);
        toast.success("Informe completo de compliance generado");
      }
      setIsGeneratingReport(false);
    }, 1500);
  };
  
  // Calcular estado global
  const getOverallStatus = () => {
    const statuses = [
      complianceResults.laboral?.status,
      complianceResults.sanidad?.status,
      complianceResults.industria?.status
    ].filter(Boolean);
    
    if (statuses.includes(COMPLIANCE_STATUS.CRITICAL)) return COMPLIANCE_STATUS.CRITICAL;
    if (statuses.includes(COMPLIANCE_STATUS.WARNING)) return COMPLIANCE_STATUS.WARNING;
    return COMPLIANCE_STATUS.OK;
  };
  
  const overallStatus = getOverallStatus();
  const criticalAlerts = allAlerts.filter(a => a.daysUntilExpiry <= 7);
  const warningAlerts = allAlerts.filter(a => a.daysUntilExpiry > 7 && a.daysUntilExpiry <= 15);
  const noticeAlerts = allAlerts.filter(a => a.daysUntilExpiry > 15 && a.daysUntilExpiry <= 30);
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Shield className="h-8 w-8 text-purple-400" />
            Dashboard de Cumplimiento Legal
          </h1>
          <p className="text-gray-400 mt-1">Control centralizado de compliance normativo español</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-gray-800/50 rounded-lg px-4 py-2 border border-gray-700">
            <span className="text-gray-400 text-sm">Estado Global:</span>
            <div className={`w-4 h-4 rounded-full animate-pulse ${
              overallStatus === 'green' ? 'bg-green-500' :
              overallStatus === 'yellow' ? 'bg-yellow-500' : 'bg-red-500'
            }`} />
            <span className={`font-medium ${
              overallStatus === 'green' ? 'text-green-400' :
              overallStatus === 'yellow' ? 'text-yellow-400' : 'text-red-400'
            }`}>
              {overallStatus === 'green' ? 'Conforme' :
               overallStatus === 'yellow' ? 'Revisar' : 'No Conforme'}
            </span>
          </div>
          
          <Button 
            onClick={handleGenerateFullReport}
            disabled={isGeneratingReport}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {isGeneratingReport ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Preparar para Inspección
          </Button>
        </div>
      </div>
      
      {/* Semáforos por Área */}
      <Card className="bg-gray-800/50 border-gray-700 mb-6">
        <CardContent className="p-6">
          <div className="flex items-center justify-around">
            <TrafficLightLarge 
              status={complianceResults.laboral?.status || 'green'} 
              label="Laboral"
              onClick={() => navigate(createPageUrl("InspeccionLaboral"))}
            />
            <div className="h-20 w-px bg-gray-700" />
            <TrafficLightLarge 
              status={complianceResults.sanidad?.status || 'green'} 
              label="Sanidad"
              onClick={() => navigate(createPageUrl("InspeccionSanidad"))}
            />
            <div className="h-20 w-px bg-gray-700" />
            <TrafficLightLarge 
              status={complianceResults.industria?.status || 'green'} 
              label="Industria/PRL"
              onClick={() => navigate(createPageUrl("InspeccionIndustria"))}
            />
          </div>
        </CardContent>
      </Card>
      
      {/* Alertas Críticas */}
      {criticalAlerts.length > 0 && (
        <Card className="bg-red-500/10 border-red-500/30 mb-6">
          <CardHeader>
            <CardTitle className="text-red-400 flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Alertas Críticas (≤7 días) - {criticalAlerts.length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {criticalAlerts.map((alert, idx) => (
                <ExpirationAlert key={idx} item={alert} type={alert.type} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Resumen de Alertas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total Alertas</p>
                <p className="text-3xl font-bold text-white">{allAlerts.length}</p>
              </div>
              <Bell className="h-8 w-8 text-purple-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gray-800/50 border-red-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Críticas (≤7d)</p>
                <p className="text-3xl font-bold text-red-400">{criticalAlerts.length}</p>
              </div>
              <XCircle className="h-8 w-8 text-red-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gray-800/50 border-yellow-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Advertencias (≤15d)</p>
                <p className="text-3xl font-bold text-yellow-400">{warningAlerts.length}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-yellow-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gray-800/50 border-blue-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Avisos (≤30d)</p>
                <p className="text-3xl font-bold text-blue-400">{noticeAlerts.length}</p>
              </div>
              <Clock className="h-8 w-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Módulos de Inspección */}
      <h2 className="text-xl font-bold text-white mb-4">Módulos de Inspección</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <ModuleCard
          title="Inspección Laboral"
          icon={Briefcase}
          status={complianceResults.laboral?.status || 'green'}
          color="blue"
          onClick={() => navigate(createPageUrl("InspeccionLaboral"))}
          stats={[
            { label: 'Empleados activos', value: complianceResults.laboral?.stats?.totalEmployees || 0 },
            { label: 'Con registro horario', value: complianceResults.laboral?.stats?.withTimesheets || 0, status: 'ok' },
            { label: 'Nóminas firmadas', value: complianceResults.laboral?.stats?.withPayrolls || 0 },
            { label: 'Contratos por vencer', value: complianceResults.laboral?.stats?.contractsExpiring || 0, status: complianceResults.laboral?.stats?.contractsExpiring > 0 ? 'warning' : 'ok' },
          ]}
        />
        
        <ModuleCard
          title="Inspección Sanidad"
          icon={Stethoscope}
          status={complianceResults.sanidad?.status || 'green'}
          color="green"
          onClick={() => navigate(createPageUrl("InspeccionSanidad"))}
          stats={[
            { label: 'Temperaturas hoy', value: complianceResults.sanidad?.stats?.todayTemperatureRecords || 0 },
            { label: 'Carnets válidos', value: `${complianceResults.sanidad?.stats?.validFoodHandlerCerts || 0}/${complianceResults.sanidad?.stats?.totalFoodHandlerCerts || 0}` },
            { label: 'Limpieza semana', value: `${complianceResults.sanidad?.stats?.cleaningRecordsThisWeek || 0}/7` },
            { label: 'Control plagas', value: 'OK', status: 'ok' },
          ]}
        />
        
        <ModuleCard
          title="Inspección Industria/PRL"
          icon={HardHat}
          status={complianceResults.industria?.status || 'green'}
          color="orange"
          onClick={() => navigate(createPageUrl("InspeccionIndustria"))}
          stats={[
            { label: 'Plan PRL', value: complianceResults.industria?.stats?.hasPRLPlan ? 'Aprobado' : 'Pendiente', status: complianceResults.industria?.stats?.hasPRLPlan ? 'ok' : 'error' },
            { label: 'Eval. riesgos', value: complianceResults.industria?.stats?.riskEvaluationsCount || 0 },
            { label: 'Formados PRL', value: complianceResults.industria?.stats?.trainedEmployees || 0 },
            { label: 'Accidentes año', value: complianceResults.industria?.stats?.accidentsThisYear || 0, status: (complianceResults.industria?.stats?.accidentsThisYear || 0) > 0 ? 'warning' : 'ok' },
          ]}
        />
      </div>
      
      {/* Todas las alertas próximas */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white">Vencimientos Próximos (30 días)</CardTitle>
              <CardDescription className="text-gray-400">
                Documentos y certificados que requieren atención
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline" className="border-red-500/30 text-red-400">
                ≤7d: {criticalAlerts.length}
              </Badge>
              <Badge variant="outline" className="border-yellow-500/30 text-yellow-400">
                ≤15d: {warningAlerts.length}
              </Badge>
              <Badge variant="outline" className="border-blue-500/30 text-blue-400">
                ≤30d: {noticeAlerts.length}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {allAlerts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {allAlerts.map((alert, idx) => (
                <ExpirationAlert key={idx} item={alert} type={alert.type} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <CheckCircle className="h-16 w-16 text-green-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-green-400">Todo al día</h3>
              <p className="text-gray-400 mt-2">No hay vencimientos próximos en los próximos 30 días</p>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Accesos Rápidos */}
      <div className="mt-6 flex justify-center gap-4">
        <Button 
          variant="outline" 
          className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
          onClick={() => navigate(createPageUrl("InspeccionLaboral"))}
        >
          <Briefcase className="h-4 w-4 mr-2" />
          Ir a Laboral
        </Button>
        <Button 
          variant="outline" 
          className="border-green-500/30 text-green-400 hover:bg-green-500/10"
          onClick={() => navigate(createPageUrl("InspeccionSanidad"))}
        >
          <Stethoscope className="h-4 w-4 mr-2" />
          Ir a Sanidad
        </Button>
        <Button 
          variant="outline" 
          className="border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
          onClick={() => navigate(createPageUrl("InspeccionIndustria"))}
        >
          <HardHat className="h-4 w-4 mr-2" />
          Ir a Industria/PRL
        </Button>
      </div>
    </div>
  );
}
