import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { 
  Upload, 
  FileText, 
  Users, 
  Plus,
  Loader2,
  Eye,
  Trash2,
  Calendar,
  DollarSign,
  Briefcase,
  Search,
  FolderOpen,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function HRDocuments() {
  const [showContractDialog, setShowContractDialog] = useState(false);
  const [showEmployeeDialog, setShowEmployeeDialog] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [contractForm, setContractForm] = useState({
    employee_name: "",
    contract_type: "indefinido",
    position: "",
    salary: "",
    start_date: "",
    end_date: "",
    schedule: "",
    notes: "",
    file: null
  });
  const [employeeForm, setEmployeeForm] = useState({
    name: "",
    role: "camarero",
    phone: "",
    email: "",
    employee_code: "",
    hire_date: ""
  });
  
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: contracts = [] } = useQuery({
    queryKey: ['contracts'],
    queryFn: () => base44.entities.Contract.list('-created_date'),
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['revo-employees'],
    queryFn: () => base44.entities.RevoEmployee.list('-created_date'),
  });

  const createContractMutation = useMutation({
    mutationFn: async (data) => {
      let file_url = null;
      if (data.file) {
        setIsUploading(true);
        const result = await base44.integrations.Core.UploadFile({ file: data.file });
        file_url = result.file_url;
      }
      
      return base44.entities.Contract.create({
        employee_name: data.employee_name,
        contract_type: data.contract_type,
        position: data.position,
        salary: parseFloat(data.salary) || 0,
        start_date: data.start_date,
        end_date: data.end_date || null,
        schedule: data.schedule,
        notes: data.notes,
        file_url,
        status: 'activo'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      toast.success('Contrato guardado correctamente');
      setShowContractDialog(false);
      resetContractForm();
    },
    onError: (error) => {
      toast.error('Error al guardar: ' + error.message);
    },
    onSettled: () => {
      setIsUploading(false);
    }
  });

  const createEmployeeMutation = useMutation({
    mutationFn: (data) => base44.entities.RevoEmployee.create({
      name: data.name,
      role: data.role,
      phone: data.phone,
      email: data.email,
      employee_code: data.employee_code,
      hire_date: data.hire_date,
      active: true,
      total_sales: 0,
      sales_count: 0
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['revo-employees'] });
      toast.success('Empleado añadido correctamente');
      setShowEmployeeDialog(false);
      resetEmployeeForm();
    }
  });

  const deleteContractMutation = useMutation({
    mutationFn: (id) => base44.entities.Contract.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      toast.success('Contrato eliminado');
    }
  });

  const deleteEmployeeMutation = useMutation({
    mutationFn: (id) => base44.entities.RevoEmployee.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['revo-employees'] });
      toast.success('Empleado eliminado');
    }
  });

  const resetContractForm = () => {
    setContractForm({
      employee_name: "",
      contract_type: "indefinido",
      position: "",
      salary: "",
      start_date: "",
      end_date: "",
      schedule: "",
      notes: "",
      file: null
    });
  };

  const resetEmployeeForm = () => {
    setEmployeeForm({
      name: "",
      role: "camarero",
      phone: "",
      email: "",
      employee_code: "",
      hire_date: ""
    });
  };

  const filteredContracts = contracts.filter(c =>
    c.employee_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.position?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredEmployees = employees.filter(e =>
    e.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.role?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const typeColors = {
    indefinido: 'bg-green-100 text-green-800',
    temporal: 'bg-blue-100 text-blue-800',
    practicas: 'bg-purple-100 text-purple-800',
    formacion: 'bg-orange-100 text-orange-800'
  };

  const roleColors = {
    camarero: 'bg-cyan-100 text-cyan-800',
    cocinero: 'bg-orange-100 text-orange-800',
    bartender: 'bg-purple-100 text-purple-800',
    gerente: 'bg-blue-100 text-blue-800',
    repartidor: 'bg-green-100 text-green-800'
  };

  return (
    <div className="p-4 md:p-8 min-h-screen bg-gradient-to-br from-zinc-950 via-neutral-900 to-zinc-950">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-3 h-3 bg-cyan-400 rounded-full animate-pulse" style={{ boxShadow: '0 0 10px rgba(6, 182, 212, 0.8)' }} />
            <span className="text-sm font-medium text-cyan-400" style={{ textShadow: '0 0 10px rgba(6, 182, 212, 0.6)' }}>
              Gestión de Recursos Humanos
            </span>
          </div>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <h1 className="text-4xl font-black text-white mb-2 flex items-center gap-4">
                <div 
                  className="w-14 h-14 bg-black rounded-2xl flex items-center justify-center border border-cyan-500/50"
                  style={{ boxShadow: '0 0 25px rgba(6, 182, 212, 0.4), inset 0 0 15px rgba(6, 182, 212, 0.1)' }}
                >
                  <Users className="w-8 h-8 text-cyan-400" style={{ filter: 'drop-shadow(0 0 8px rgba(6, 182, 212, 0.8))' }} />
                </div>
                <span className="text-cyan-400" style={{ textShadow: '0 0 15px rgba(6, 182, 212, 0.6)' }}>RRHH & DOCUMENTACIÓN</span>
              </h1>
              <p className="text-zinc-400">
                Contratos, trabajadores y documentación laboral
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={() => setShowEmployeeDialog(true)}
                variant="outline"
                className="border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10"
              >
                <Plus className="w-4 h-4 mr-2" />
                Nuevo Empleado
              </Button>
              <Button
                onClick={() => setShowContractDialog(true)}
                className="bg-black border border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10"
                style={{ boxShadow: '0 0 15px rgba(6, 182, 212, 0.3)' }}
              >
                <Upload className="w-4 h-4 mr-2" />
                Subir Contrato
              </Button>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 border-purple-600/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">Empleados</p>
                  <p className="text-2xl font-bold text-white">{employees.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-900/30 to-cyan-900/30 border-blue-600/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">Contratos</p>
                  <p className="text-2xl font-bold text-white">{contracts.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-900/30 to-emerald-900/30 border-green-600/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
                  <Briefcase className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">Activos</p>
                  <p className="text-2xl font-bold text-white">
                    {contracts.filter(c => c.status === 'activo').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-yellow-900/30 to-orange-900/30 border-yellow-600/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-yellow-600 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">Masa Salarial</p>
                  <p className="text-xl font-bold text-white">
                    {(contracts.reduce((sum, c) => sum + (c.salary || 0), 0) / 12).toFixed(0)}€/mes
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar empleado o puesto..."
              className="pl-10 bg-slate-800 border-slate-700 text-white"
            />
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="contracts" className="space-y-6">
          <TabsList className="bg-black border border-cyan-500/30">
            <TabsTrigger value="contracts" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">
              📄 Contratos ({contracts.length})
            </TabsTrigger>
            <TabsTrigger value="employees" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">
              👥 Empleados ({employees.length})
            </TabsTrigger>
          </TabsList>

          {/* Contratos */}
          <TabsContent value="contracts">
            <Card className="bg-slate-900 border-slate-700">
              <CardContent className="p-0">
                {filteredContracts.length === 0 ? (
                  <div className="p-12 text-center">
                    <FolderOpen className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400 mb-4">No hay contratos registrados</p>
                    <Button onClick={() => setShowContractDialog(true)} className="bg-purple-600 hover:bg-purple-700">
                      <Upload className="w-4 h-4 mr-2" />
                      Subir primer contrato
                    </Button>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-700">
                    {filteredContracts.map((contract) => (
                      <div key={contract.id} className="p-4 hover:bg-slate-800/50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg flex items-center justify-center">
                              <FileText className="w-6 h-6 text-white" />
                            </div>
                            <div>
                              <p className="font-bold text-white">{contract.employee_name}</p>
                              <p className="text-sm text-gray-400">{contract.position}</p>
                              <div className="flex gap-2 mt-1">
                                <Badge className={typeColors[contract.contract_type]}>
                                  {contract.contract_type}
                                </Badge>
                                <Badge className={contract.status === 'activo' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                                  {contract.status}
                                </Badge>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="font-bold text-white">{contract.salary?.toLocaleString()}€/año</p>
                              <p className="text-xs text-gray-500">
                                Desde {contract.start_date && format(new Date(contract.start_date), 'dd/MM/yyyy')}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              {contract.file_url && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => window.open(contract.file_url, '_blank')}
                                  className="border-slate-600"
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => deleteContractMutation.mutate(contract.id)}
                                className="text-red-400 hover:text-red-300 hover:bg-red-500/20"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Empleados */}
          <TabsContent value="employees">
            <Card className="bg-slate-900 border-slate-700">
              <CardContent className="p-0">
                {filteredEmployees.length === 0 ? (
                  <div className="p-12 text-center">
                    <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400 mb-4">No hay empleados registrados</p>
                    <Button onClick={() => setShowEmployeeDialog(true)} className="bg-purple-600 hover:bg-purple-700">
                      <Plus className="w-4 h-4 mr-2" />
                      Añadir empleado
                    </Button>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-700">
                    {filteredEmployees.map((employee) => (
                      <div key={employee.id} className="p-4 hover:bg-slate-800/50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-gradient-to-br from-cyan-600 to-blue-600 rounded-full flex items-center justify-center">
                              <span className="text-white font-bold text-lg">
                                {employee.name?.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <p className="font-bold text-white">{employee.name}</p>
                              <div className="flex gap-2 mt-1">
                                <Badge className={roleColors[employee.role] || 'bg-gray-100 text-gray-800'}>
                                  {employee.role}
                                </Badge>
                                {employee.active && (
                                  <Badge className="bg-green-100 text-green-800">Activo</Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right text-sm text-gray-400">
                              {employee.phone && <p>📞 {employee.phone}</p>}
                              {employee.email && <p>✉️ {employee.email}</p>}
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteEmployeeMutation.mutate(employee.id)}
                              className="text-red-400 hover:text-red-300 hover:bg-red-500/20"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Dialog Nuevo Contrato */}
        <Dialog open={showContractDialog} onOpenChange={setShowContractDialog}>
          <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-purple-400" />
                Subir Contrato
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Nombre Empleado *</Label>
                  <Input
                    value={contractForm.employee_name}
                    onChange={(e) => setContractForm({...contractForm, employee_name: e.target.value})}
                    className="bg-slate-800 border-slate-700"
                    placeholder="Juan García"
                  />
                </div>
                <div>
                  <Label>Tipo Contrato</Label>
                  <Select value={contractForm.contract_type} onValueChange={(v) => setContractForm({...contractForm, contract_type: v})}>
                    <SelectTrigger className="bg-slate-800 border-slate-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="indefinido">Indefinido</SelectItem>
                      <SelectItem value="temporal">Temporal</SelectItem>
                      <SelectItem value="practicas">Prácticas</SelectItem>
                      <SelectItem value="formacion">Formación</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Puesto *</Label>
                  <Input
                    value={contractForm.position}
                    onChange={(e) => setContractForm({...contractForm, position: e.target.value})}
                    className="bg-slate-800 border-slate-700"
                    placeholder="Camarero"
                  />
                </div>
                <div>
                  <Label>Salario Bruto Anual (€)</Label>
                  <Input
                    type="number"
                    value={contractForm.salary}
                    onChange={(e) => setContractForm({...contractForm, salary: e.target.value})}
                    className="bg-slate-800 border-slate-700"
                    placeholder="18000"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Fecha Inicio *</Label>
                  <Input
                    type="date"
                    value={contractForm.start_date}
                    onChange={(e) => setContractForm({...contractForm, start_date: e.target.value})}
                    className="bg-slate-800 border-slate-700"
                  />
                </div>
                <div>
                  <Label>Fecha Fin (si temporal)</Label>
                  <Input
                    type="date"
                    value={contractForm.end_date}
                    onChange={(e) => setContractForm({...contractForm, end_date: e.target.value})}
                    className="bg-slate-800 border-slate-700"
                  />
                </div>
              </div>

              <div>
                <Label>Horario</Label>
                <Input
                  value={contractForm.schedule}
                  onChange={(e) => setContractForm({...contractForm, schedule: e.target.value})}
                  className="bg-slate-800 border-slate-700"
                  placeholder="L-V 9:00-17:00"
                />
              </div>

              <div>
                <Label>Documento del Contrato (PDF)</Label>
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => setContractForm({...contractForm, file: e.target.files[0]})}
                  className="bg-slate-800 border-slate-700"
                />
              </div>

              <div>
                <Label>Notas</Label>
                <Textarea
                  value={contractForm.notes}
                  onChange={(e) => setContractForm({...contractForm, notes: e.target.value})}
                  className="bg-slate-800 border-slate-700"
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowContractDialog(false)} className="border-slate-600">
                Cancelar
              </Button>
              <Button
                onClick={() => createContractMutation.mutate(contractForm)}
                disabled={createContractMutation.isPending || !contractForm.employee_name || !contractForm.position || !contractForm.start_date}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {createContractMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  'Guardar Contrato'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog Nuevo Empleado */}
        <Dialog open={showEmployeeDialog} onOpenChange={setShowEmployeeDialog}>
          <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-cyan-400" />
                Nuevo Empleado
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nombre Completo *</Label>
                <Input
                  value={employeeForm.name}
                  onChange={(e) => setEmployeeForm({...employeeForm, name: e.target.value})}
                  className="bg-slate-800 border-slate-700"
                  placeholder="Juan García López"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Rol</Label>
                  <Select value={employeeForm.role} onValueChange={(v) => setEmployeeForm({...employeeForm, role: v})}>
                    <SelectTrigger className="bg-slate-800 border-slate-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="camarero">Camarero</SelectItem>
                      <SelectItem value="cocinero">Cocinero</SelectItem>
                      <SelectItem value="bartender">Bartender</SelectItem>
                      <SelectItem value="gerente">Gerente</SelectItem>
                      <SelectItem value="repartidor">Repartidor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Código Empleado</Label>
                  <Input
                    value={employeeForm.employee_code}
                    onChange={(e) => setEmployeeForm({...employeeForm, employee_code: e.target.value})}
                    className="bg-slate-800 border-slate-700"
                    placeholder="EMP001"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Teléfono</Label>
                  <Input
                    value={employeeForm.phone}
                    onChange={(e) => setEmployeeForm({...employeeForm, phone: e.target.value})}
                    className="bg-slate-800 border-slate-700"
                    placeholder="600123456"
                  />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    value={employeeForm.email}
                    onChange={(e) => setEmployeeForm({...employeeForm, email: e.target.value})}
                    className="bg-slate-800 border-slate-700"
                    placeholder="juan@empresa.com"
                  />
                </div>
              </div>

              <div>
                <Label>Fecha Contratación</Label>
                <Input
                  type="date"
                  value={employeeForm.hire_date}
                  onChange={(e) => setEmployeeForm({...employeeForm, hire_date: e.target.value})}
                  className="bg-slate-800 border-slate-700"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEmployeeDialog(false)} className="border-slate-600">
                Cancelar
              </Button>
              <Button
                onClick={() => createEmployeeMutation.mutate(employeeForm)}
                disabled={createEmployeeMutation.isPending || !employeeForm.name}
                className="bg-cyan-600 hover:bg-cyan-700"
              >
                {createEmployeeMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : null}
                Guardar Empleado
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}