// Inspección Sanidad (APPCC) - SYNK-IA
// Módulo de cumplimiento sanitario y APPCC

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
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format, parseISO, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import {
  Shield,
  Thermometer,
  BadgeCheck,
  Sparkles,
  Bug,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Download,
  ArrowLeft,
  Search,
  Plus,
  RefreshCw,
  FileText,
  Utensils,
  AlertCircle,
  ThermometerSun,
  ThermometerSnowflake,
  ClipboardCheck
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

// Componente de Estado de Temperatura
const TemperatureStatus = ({ temperature, minTemp, maxTemp }) => {
  const isInRange = temperature >= minTemp && temperature <= maxTemp;
  
  return (
    <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${
      isInRange ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
    }`}>
      {temperature > maxTemp ? (
        <ThermometerSun className="h-4 w-4" />
      ) : temperature < minTemp ? (
        <ThermometerSnowflake className="h-4 w-4" />
      ) : (
        <Thermometer className="h-4 w-4" />
      )}
      <span className="font-medium">{temperature}°C</span>
      {!isInRange && <AlertTriangle className="h-4 w-4" />}
    </div>
  );
};

// APPCC Checklist Items
const APPCC_CHECKLIST = [
  { id: 1, category: 'Recepción', item: 'Control de temperatura en recepción de mercancías', critical: true },
  { id: 2, category: 'Recepción', item: 'Verificación de etiquetado y caducidades', critical: true },
  { id: 3, category: 'Almacenamiento', item: 'Separación de alimentos crudos y cocinados', critical: true },
  { id: 4, category: 'Almacenamiento', item: 'Control de temperaturas de cámaras', critical: true },
  { id: 5, category: 'Almacenamiento', item: 'Rotación FIFO de productos', critical: false },
  { id: 6, category: 'Preparación', item: 'Lavado de manos antes de manipular', critical: true },
  { id: 7, category: 'Preparación', item: 'Uso de tablas de corte diferenciadas', critical: true },
  { id: 8, category: 'Preparación', item: 'Control de contaminación cruzada', critical: true },
  { id: 9, category: 'Cocinado', item: 'Control de temperaturas de cocción', critical: true },
  { id: 10, category: 'Cocinado', item: 'Mantenimiento en caliente > 65°C', critical: true },
  { id: 11, category: 'Servicio', item: 'Control de tiempo de exposición', critical: false },
  { id: 12, category: 'Servicio', item: 'Información de alérgenos disponible', critical: true },
  { id: 13, category: 'Limpieza', item: 'Plan de limpieza cumplido', critical: true },
  { id: 14, category: 'Limpieza', item: 'Productos de limpieza homologados', critical: false },
];

export default function InspeccionSanidad() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("appcc");
  const [searchTerm, setSearchTerm] = useState("");
  const [mockData, setMockData] = useState(null);
  const [complianceResult, setComplianceResult] = useState(null);
  const [checklistState, setChecklistState] = useState({});
  const [showTempDialog, setShowTempDialog] = useState(false);
  const [newTemp, setNewTemp] = useState({ equipment: '', temperature: '', recorded_by: '' });
  
  // Cargar datos mock para demo
  useEffect(() => {
    const data = complianceService.generateMockData();
    setMockData(data.sanidad);
    
    // Evaluar cumplimiento
    const result = complianceService.evaluateHealthCompliance(
      data.sanidad.temperatures,
      data.sanidad.foodHandlerCerts,
      data.sanidad.cleaningRecords,
      data.sanidad.pestControl,
      data.sanidad.allergenPlan
    );
    setComplianceResult(result);
    
    // Inicializar checklist con valores aleatorios para demo
    const initialChecklist = {};
    APPCC_CHECKLIST.forEach(item => {
      initialChecklist[item.id] = Math.random() > 0.15; // 85% checked
    });
    setChecklistState(initialChecklist);
  }, []);
  
  // Exportar para inspección
  const handleExportForInspection = () => {
    if (mockData) {
      complianceService.generateInspectionReport('sanidad', mockData);
      toast.success("Informe para Inspección de Sanidad generado");
    }
  };
  
  // Registrar temperatura
  const handleRegisterTemperature = () => {
    if (!newTemp.equipment || !newTemp.temperature) {
      toast.error("Complete todos los campos");
      return;
    }
    
    const temp = parseFloat(newTemp.temperature);
    const newRecord = {
      id: Date.now(),
      equipment_name: newTemp.equipment,
      recorded_at: new Date().toISOString(),
      temperature: temp,
      min_temp: newTemp.equipment.includes('Congelador') ? -22 : 0,
      max_temp: newTemp.equipment.includes('Congelador') ? -16 : 5,
      recorded_by: newTemp.recorded_by || 'Usuario'
    };
    
    setMockData(prev => ({
      ...prev,
      temperatures: [newRecord, ...prev.temperatures]
    }));
    
    setShowTempDialog(false);
    setNewTemp({ equipment: '', temperature: '', recorded_by: '' });
    toast.success("Temperatura registrada correctamente");
  };
  
  // Calcular porcentaje de cumplimiento APPCC
  const calculateAPPCCCompliance = () => {
    const total = APPCC_CHECKLIST.length;
    const checked = Object.values(checklistState).filter(v => v).length;
    return Math.round((checked / total) * 100);
  };
  
  const apccCompliance = calculateAPPCCCompliance();
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
              <Shield className="h-8 w-8 text-green-400" />
              Inspección Sanidad (APPCC)
            </h1>
            <p className="text-gray-400 mt-1">Cumplimiento sanitario y sistema APPCC</p>
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
            className="bg-green-600 hover:bg-green-700"
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar para Inspección
          </Button>
        </div>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">APPCC</p>
                <p className="text-2xl font-bold text-white">{apccCompliance}%</p>
              </div>
              <ClipboardCheck className={`h-8 w-8 ${apccCompliance >= 90 ? 'text-green-400' : apccCompliance >= 70 ? 'text-yellow-400' : 'text-red-400'}`} />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Temp. Hoy</p>
                <p className="text-2xl font-bold text-white">{complianceResult?.stats?.todayTemperatureRecords || 0}</p>
              </div>
              <Thermometer className="h-8 w-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Carnets Válidos</p>
                <p className="text-2xl font-bold text-white">
                  {complianceResult?.stats?.validFoodHandlerCerts || 0}/{complianceResult?.stats?.totalFoodHandlerCerts || 0}
                </p>
              </div>
              <BadgeCheck className="h-8 w-8 text-purple-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Limpieza Semana</p>
                <p className="text-2xl font-bold text-white">{complianceResult?.stats?.cleaningRecordsThisWeek || 0}/7</p>
              </div>
              <Sparkles className="h-8 w-8 text-cyan-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Control Plagas</p>
                <p className="text-2xl font-bold text-green-400">OK</p>
              </div>
              <Bug className="h-8 w-8 text-amber-400" />
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
              Alertas de Cumplimiento Sanitario ({complianceResult.issues.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {complianceResult.issues.map((issue, idx) => (
                <div key={idx} className="flex items-center gap-3 p-2 bg-gray-800/50 rounded-lg">
                  {issue.severity === 'critical' ? 
                    <XCircle className="h-4 w-4 text-red-400" /> :
                    <AlertTriangle className="h-4 w-4 text-yellow-400" />
                  }
                  <span className="text-gray-300">
                    {issue.employee && <span className="font-medium">{issue.employee}: </span>}
                    {issue.equipment && <span className="font-medium">{issue.equipment}: </span>}
                    {issue.message}
                  </span>
                  <Badge variant="outline" className={`ml-auto ${
                    issue.type === 'temperature' ? 'border-blue-500/30 text-blue-400' :
                    issue.type === 'food_handler' ? 'border-purple-500/30 text-purple-400' :
                    issue.type === 'cleaning' ? 'border-cyan-500/30 text-cyan-400' :
                    'border-amber-500/30 text-amber-400'
                  }`}>
                    {issue.type === 'temperature' ? 'Temperatura' :
                     issue.type === 'food_handler' ? 'Manipulador' : 
                     issue.type === 'cleaning' ? 'Limpieza' : 'Plagas'}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-gray-800/50 border border-gray-700">
          <TabsTrigger value="appcc" className="data-[state=active]:bg-green-600">
            <ClipboardCheck className="h-4 w-4 mr-2" />
            Plan APPCC
          </TabsTrigger>
          <TabsTrigger value="temperaturas" className="data-[state=active]:bg-green-600">
            <Thermometer className="h-4 w-4 mr-2" />
            Temperaturas
          </TabsTrigger>
          <TabsTrigger value="manipuladores" className="data-[state=active]:bg-green-600">
            <BadgeCheck className="h-4 w-4 mr-2" />
            Carnets Manipulador
          </TabsTrigger>
          <TabsTrigger value="limpieza" className="data-[state=active]:bg-green-600">
            <Sparkles className="h-4 w-4 mr-2" />
            Limpieza
          </TabsTrigger>
          <TabsTrigger value="plagas" className="data-[state=active]:bg-green-600">
            <Bug className="h-4 w-4 mr-2" />
            Control Plagas
          </TabsTrigger>
          <TabsTrigger value="alergenos" className="data-[state=active]:bg-green-600">
            <Utensils className="h-4 w-4 mr-2" />
            Alérgenos
          </TabsTrigger>
        </TabsList>
        
        {/* APPCC Checklist */}
        <TabsContent value="appcc">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white">Plan APPCC Digital</CardTitle>
                  <CardDescription className="text-gray-400">
                    Análisis de Peligros y Puntos de Control Crítico
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-2xl font-bold ${
                    apccCompliance >= 90 ? 'text-green-400' : 
                    apccCompliance >= 70 ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    {apccCompliance}%
                  </span>
                  <span className="text-gray-400">cumplimiento</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {['Recepción', 'Almacenamiento', 'Preparación', 'Cocinado', 'Servicio', 'Limpieza'].map(category => (
                  <div key={category}>
                    <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-400 rounded-full" />
                      {category}
                    </h3>
                    <div className="space-y-2 ml-4">
                      {APPCC_CHECKLIST.filter(item => item.category === category).map(item => (
                        <div key={item.id} className="flex items-center gap-3 p-2 bg-gray-900/50 rounded-lg">
                          <Checkbox
                            checked={checklistState[item.id] || false}
                            onCheckedChange={(checked) => {
                              setChecklistState(prev => ({
                                ...prev,
                                [item.id]: checked
                              }));
                            }}
                            className="border-gray-600"
                          />
                          <span className={`flex-1 ${checklistState[item.id] ? 'text-gray-300' : 'text-gray-500'}`}>
                            {item.item}
                          </span>
                          {item.critical && (
                            <Badge variant="outline" className="border-red-500/30 text-red-400 text-xs">
                              PCC
                            </Badge>
                          )}
                          {checklistState[item.id] ? (
                            <CheckCircle className="h-4 w-4 text-green-400" />
                          ) : (
                            <XCircle className="h-4 w-4 text-gray-600" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Temperaturas */}
        <TabsContent value="temperaturas">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white">Registro de Temperaturas</CardTitle>
                  <CardDescription className="text-gray-400">
                    Control de temperaturas de cámaras frigoríficas
                  </CardDescription>
                </div>
                <Dialog open={showTempDialog} onOpenChange={setShowTempDialog}>
                  <DialogTrigger asChild>
                    <Button className="bg-green-600 hover:bg-green-700">
                      <Plus className="h-4 w-4 mr-2" />
                      Registrar Temperatura
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-gray-800 border-gray-700">
                    <DialogHeader>
                      <DialogTitle className="text-white">Registrar Temperatura</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label className="text-gray-300">Equipo</Label>
                        <Input
                          value={newTemp.equipment}
                          onChange={(e) => setNewTemp({ ...newTemp, equipment: e.target.value })}
                          placeholder="Ej: Cámara Principal, Congelador 1..."
                          className="bg-gray-900/50 border-gray-600 text-white"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-gray-300">Temperatura (°C)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={newTemp.temperature}
                          onChange={(e) => setNewTemp({ ...newTemp, temperature: e.target.value })}
                          placeholder="Ej: 3.5"
                          className="bg-gray-900/50 border-gray-600 text-white"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-gray-300">Registrado por</Label>
                        <Input
                          value={newTemp.recorded_by}
                          onChange={(e) => setNewTemp({ ...newTemp, recorded_by: e.target.value })}
                          placeholder="Nombre del empleado"
                          className="bg-gray-900/50 border-gray-600 text-white"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowTempDialog(false)}>
                        Cancelar
                      </Button>
                      <Button onClick={handleRegisterTemperature} className="bg-green-600">
                        Registrar
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-700">
                    <TableHead className="text-gray-400">Equipo</TableHead>
                    <TableHead className="text-gray-400">Fecha/Hora</TableHead>
                    <TableHead className="text-gray-400">Temperatura</TableHead>
                    <TableHead className="text-gray-400">Rango</TableHead>
                    <TableHead className="text-gray-400">Estado</TableHead>
                    <TableHead className="text-gray-400">Registrado por</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockData?.temperatures?.map((temp) => (
                    <TableRow key={temp.id} className="border-gray-700">
                      <TableCell className="text-white font-medium">{temp.equipment_name}</TableCell>
                      <TableCell className="text-gray-300">
                        {format(parseISO(temp.recorded_at), 'dd/MM/yyyy HH:mm')}
                      </TableCell>
                      <TableCell>
                        <TemperatureStatus 
                          temperature={temp.temperature} 
                          minTemp={temp.min_temp} 
                          maxTemp={temp.max_temp} 
                        />
                      </TableCell>
                      <TableCell className="text-gray-300">
                        {temp.min_temp}°C - {temp.max_temp}°C
                      </TableCell>
                      <TableCell>
                        {temp.temperature >= temp.min_temp && temp.temperature <= temp.max_temp ? (
                          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            OK
                          </Badge>
                        ) : (
                          <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            ALERTA
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-gray-300">{temp.recorded_by}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Carnets Manipulador */}
        <TabsContent value="manipuladores">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Carnets de Manipulador de Alimentos</CardTitle>
              <CardDescription className="text-gray-400">
                Control de validez de carnets por empleado
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-700">
                    <TableHead className="text-gray-400">Empleado</TableHead>
                    <TableHead className="text-gray-400">DNI</TableHead>
                    <TableHead className="text-gray-400">Nº Carnet</TableHead>
                    <TableHead className="text-gray-400">Fecha Emisión</TableHead>
                    <TableHead className="text-gray-400">Caducidad</TableHead>
                    <TableHead className="text-gray-400">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockData?.foodHandlerCerts?.map((cert) => {
                    const today = new Date();
                    const expDate = cert.expiration_date ? parseISO(cert.expiration_date) : null;
                    const daysToExpiry = expDate ? differenceInDays(expDate, today) : null;
                    
                    return (
                      <TableRow key={cert.id} className="border-gray-700">
                        <TableCell className="text-white font-medium">{cert.employee_name}</TableCell>
                        <TableCell className="text-gray-300">{cert.employee_dni}</TableCell>
                        <TableCell className="text-gray-300">{cert.certificate_number}</TableCell>
                        <TableCell className="text-gray-300">
                          {cert.issue_date ? format(parseISO(cert.issue_date), 'dd/MM/yyyy') : '-'}
                        </TableCell>
                        <TableCell className="text-gray-300">
                          {cert.expiration_date ? format(parseISO(cert.expiration_date), 'dd/MM/yyyy') : '-'}
                        </TableCell>
                        <TableCell>
                          {daysToExpiry === null ? (
                            <Badge className="bg-gray-500/20 text-gray-400">Sin fecha</Badge>
                          ) : daysToExpiry < 0 ? (
                            <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                              <XCircle className="h-3 w-3 mr-1" />
                              Vencido
                            </Badge>
                          ) : daysToExpiry <= 30 ? (
                            <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              {daysToExpiry}d
                            </Badge>
                          ) : (
                            <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Válido
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Limpieza */}
        <TabsContent value="limpieza">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white">Plan de Limpieza y Desinfección</CardTitle>
                  <CardDescription className="text-gray-400">
                    Registros de limpieza diaria
                  </CardDescription>
                </div>
                <Button className="bg-cyan-600 hover:bg-cyan-700">
                  <Plus className="h-4 w-4 mr-2" />
                  Registrar Limpieza
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-700">
                    <TableHead className="text-gray-400">Fecha</TableHead>
                    <TableHead className="text-gray-400">Área</TableHead>
                    <TableHead className="text-gray-400">Tarea</TableHead>
                    <TableHead className="text-gray-400">Realizado por</TableHead>
                    <TableHead className="text-gray-400">Hora</TableHead>
                    <TableHead className="text-gray-400">Verificado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockData?.cleaningRecords?.map((record) => (
                    <TableRow key={record.id} className="border-gray-700">
                      <TableCell className="text-white font-medium">
                        {format(parseISO(record.date), 'dd/MM/yyyy')}
                      </TableCell>
                      <TableCell className="text-gray-300">{record.area}</TableCell>
                      <TableCell className="text-gray-300">{record.task}</TableCell>
                      <TableCell className="text-gray-300">{record.performed_by}</TableCell>
                      <TableCell className="text-gray-300">{record.time}</TableCell>
                      <TableCell>
                        {record.verified ? (
                          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Sí
                          </Badge>
                        ) : (
                          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
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
        
        {/* Control Plagas */}
        <TabsContent value="plagas">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Control de Plagas</CardTitle>
              <CardDescription className="text-gray-400">
                Registro de visitas y certificados de empresa externa
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-700">
                    <TableHead className="text-gray-400">Fecha Visita</TableHead>
                    <TableHead className="text-gray-400">Empresa</TableHead>
                    <TableHead className="text-gray-400">Técnico</TableHead>
                    <TableHead className="text-gray-400">Tratamiento</TableHead>
                    <TableHead className="text-gray-400">Próxima Visita</TableHead>
                    <TableHead className="text-gray-400">Certificado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockData?.pestControl?.map((record) => (
                    <TableRow key={record.id} className="border-gray-700">
                      <TableCell className="text-white font-medium">
                        {format(parseISO(record.date), 'dd/MM/yyyy')}
                      </TableCell>
                      <TableCell className="text-gray-300">{record.company}</TableCell>
                      <TableCell className="text-gray-300">{record.technician}</TableCell>
                      <TableCell className="text-gray-300">{record.treatment_type}</TableCell>
                      <TableCell className="text-gray-300">
                        {record.next_visit ? format(parseISO(record.next_visit), 'dd/MM/yyyy') : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                          {record.certificate_number}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Alérgenos */}
        <TabsContent value="alergenos">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Plan de Alérgenos</CardTitle>
              <CardDescription className="text-gray-400">
                Vinculado a la carta digital del establecimiento
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-white">Estado del Plan</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
                      <span className="text-gray-300">Última actualización</span>
                      <span className="text-white font-medium">
                        {mockData?.allergenPlan?.last_update ? 
                          format(parseISO(mockData.allergenPlan.last_update), 'dd/MM/yyyy') : '-'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
                      <span className="text-gray-300">Productos con alérgenos</span>
                      <span className="text-white font-medium">{mockData?.allergenPlan?.products_with_allergens || 0}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
                      <span className="text-gray-300">Matriz de alérgenos</span>
                      {mockData?.allergenPlan?.allergen_matrix ? (
                        <Badge className="bg-green-500/20 text-green-400">Disponible</Badge>
                      ) : (
                        <Badge className="bg-red-500/20 text-red-400">No disponible</Badge>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-white">14 Alérgenos Obligatorios</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      'Gluten', 'Crustáceos', 'Huevos', 'Pescado', 
                      'Cacahuetes', 'Soja', 'Lácteos', 'Frutos secos',
                      'Apio', 'Mostaza', 'Sésamo', 'Sulfitos',
                      'Altramuces', 'Moluscos'
                    ].map((allergen, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2 bg-gray-900/50 rounded-lg">
                        <CheckCircle className="h-4 w-4 text-green-400" />
                        <span className="text-gray-300 text-sm">{allergen}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
