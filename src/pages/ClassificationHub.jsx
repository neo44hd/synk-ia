import React, { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { classifierService } from "@/services/classifierService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Zap,
  Upload,
  Send,
  BarChart3,
  History,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Edit2,
  Save,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function ClassificationHub() {
  const [textInput, setTextInput] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [isClassifying, setIsClassifying] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [historyFilter, setHistoryFilter] = useState({ tipo: null, departamento: null });
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();

  // ── Obtener estadísticas ──────────────────────────────────────────────
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["classifier-stats"],
    queryFn: () => classifierService.getStats(),
    refetchInterval: 30000, // cada 30s
  });

  // ── Obtener historial ────────────────────────────────────────────────
  const { data: historyData, isLoading: historyLoading, refetch: refetchHistory } = useQuery({
    queryKey: ["classifier-history", historyFilter],
    queryFn: () =>
      classifierService.getHistory(50, 0, historyFilter.tipo, historyFilter.departamento),
  });

  // ── Obtener desglose ────────────────────────────────────────────────
  const { data: breakdown } = useQuery({
    queryKey: ["classifier-breakdown"],
    queryFn: () => classifierService.getBreakdown(),
  });

  // ── Clasificar ────────────────────────────────────────────────────────
  const classifyMutation = useMutation({
    mutationFn: async (text) => {
      setIsClassifying(true);
      try {
        const result = await classifierService.classify(text);
        setLastResult(result);
        return result;
      } finally {
        setIsClassifying(false);
      }
    },
    onSuccess: () => {
      toast.success("✅ Documento clasificado");
      refetchHistory();
      queryClient.invalidateQueries({ queryKey: ["classifier-stats"] });
      queryClient.invalidateQueries({ queryKey: ["classifier-breakdown"] });
    },
    onError: (error) => {
      toast.error("Error: " + error.message);
    },
  });

  // ── Registrar feedback ───────────────────────────────────────────────
  const feedbackMutation = useMutation({
    mutationFn: async (corrected) => {
      return classifierService.recordFeedback(lastResult.id, corrected);
    },
    onSuccess: () => {
      toast.success("✅ Feedback registrado");
      setEditingId(null);
      refetchHistory();
      queryClient.invalidateQueries({ queryKey: ["classifier-stats"] });
    },
    onError: (error) => {
      toast.error("Error: " + error.message);
    },
  });

  // ── Manejadores ─────────────────────────────────────────────────────
  const handleClassifyText = async () => {
    if (!textInput.trim()) {
      toast.error("Por favor ingresa texto para clasificar");
      return;
    }
    await classifyMutation.mutateAsync(textInput);
    setTextInput("");
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    try {
      const text = await classifierService.extractTextFromFile(file);
      await classifyMutation.mutateAsync(text);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      toast.error("Error: " + error.message);
      setSelectedFile(null);
    }
  };

  const handleSaveFeedback = async () => {
    if (!editingId || !editValues) return;
    await feedbackMutation.mutateAsync(editValues);
  };

  const getCategoryLabel = (value) => classifierService.getCategoryLabel(value);

  const CategoryBadge = ({ value }) => {
    const { label, color, icon } = getCategoryLabel(value);
    return (
      <Badge className={color}>
        {icon} {label}
      </Badge>
    );
  };

  const ConfidenceBar = ({ confidence }) => {
    const getColor = (conf) => {
      if (conf >= 80) return "bg-green-500";
      if (conf >= 60) return "bg-yellow-500";
      return "bg-red-500";
    };

    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full ${getColor(confidence)}`}
            style={{ width: `${confidence}%` }}
          />
        </div>
        <span className="text-xs font-medium">{confidence}%</span>
      </div>
    );
  };

  return (
    <div className="p-4 md:p-8 min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="max-w-7xl mx-auto">
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-3 h-3 bg-cyan-500 rounded-full animate-pulse" />
            <span className="text-sm font-medium text-cyan-400">
              Classification Engine • Reglas Locales + Ollama
            </span>
          </div>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
                <Zap className="w-10 h-10 text-cyan-400" />
                Classification Hub
              </h1>
              <p className="text-gray-400">
                Clasificación automática de documentos con feedback del usuario
              </p>
            </div>
          </div>
        </div>

        {/* ── Estadísticas ────────────────────────────────────────────────── */}
        {statsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-24 bg-slate-800 rounded-lg animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="pt-6">
                <div className="text-3xl font-bold text-cyan-400">
                  {stats?.total_classifications || 0}
                </div>
                <p className="text-sm text-gray-400 mt-2">Total clasificaciones</p>
              </CardContent>
            </Card>
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="pt-6">
                <div className="text-3xl font-bold text-green-400">
                  {stats?.correct_classifications || 0}
                </div>
                <p className="text-sm text-gray-400 mt-2">Correctas</p>
              </CardContent>
            </Card>
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="pt-6">
                <div className="text-3xl font-bold text-blue-400">
                  {stats?.accuracy_percentage || 0}%
                </div>
                <p className="text-sm text-gray-400 mt-2">Precisión</p>
              </CardContent>
            </Card>
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="pt-6">
                <BarChart3 className="w-8 h-8 text-purple-400 mb-2" />
                <p className="text-sm text-gray-400">Desglose disponible</p>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* ── Panel de entrada ────────────────────────────────────────── */}
          <Card className="lg:col-span-1 bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Clasificar documento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-gray-300 mb-2">Texto/Contenido</Label>
                <Textarea
                  placeholder="Pega aquí el texto del documento a clasificar..."
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  disabled={isClassifying}
                  className="bg-slate-700 border-slate-600 text-white h-32"
                />
              </div>

              <Button
                onClick={handleClassifyText}
                disabled={isClassifying || !textInput.trim()}
                className="w-full bg-cyan-600 hover:bg-cyan-700"
              >
                {isClassifying ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Clasificando...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Clasificar
                  </>
                )}
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-600" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="px-2 bg-slate-800 text-gray-400">o</span>
                </div>
              </div>

              <div>
                <Label className="text-gray-300 mb-2">Subir archivo</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  variant="outline"
                  className="w-full border-slate-600 text-gray-300 hover:bg-slate-700"
                  disabled={isClassifying}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Subir archivo (.txt)
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* ── Resultado actual ────────────────────────────────────────── */}
          {lastResult && (
            <Card className="lg:col-span-2 bg-slate-800 border-slate-700">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-white">Resultado</CardTitle>
                {!editingId && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditingId(lastResult.id);
                      setEditValues(
                        Object.fromEntries(
                          Object.entries(lastResult.classification).map(
                            ([k, v]) => [k, v.value]
                          )
                        )
                      );
                    }}
                    className="text-cyan-400 hover:text-cyan-300"
                  >
                    <Edit2 className="w-4 h-4 mr-2" />
                    Corregir
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {editingId === lastResult.id ? (
                  <div className="space-y-4">
                    <div>
                      <Label className="text-gray-300">Tipo</Label>
                      <Select
                        value={editValues.tipo}
                        onValueChange={(v) => setEditValues({ ...editValues, tipo: v })}
                      >
                        <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-700 border-slate-600">
                          {["Factura", "Presupuesto", "Contrato", "PO", "Recibo", "Otro"].map(
                            (t) => (
                              <SelectItem key={t} value={t} className="text-white">
                                {t}
                              </SelectItem>
                            )
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-gray-300">Departamento</Label>
                      <Select
                        value={editValues.departamento}
                        onValueChange={(v) => setEditValues({ ...editValues, departamento: v })}
                      >
                        <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-700 border-slate-600">
                          {["Compras", "RRHH", "Legal", "Finanzas", "IT", "Otro"].map((d) => (
                            <SelectItem key={d} value={d} className="text-white">
                              {d}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-gray-300">Urgencia</Label>
                      <Select
                        value={editValues.urgencia}
                        onValueChange={(v) => setEditValues({ ...editValues, urgencia: v })}
                      >
                        <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-700 border-slate-600">
                          {["Normal", "Urgente", "Critical"].map((u) => (
                            <SelectItem key={u} value={u} className="text-white">
                              {u}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-gray-300">Estado</Label>
                      <Select
                        value={editValues.estado}
                        onValueChange={(v) => setEditValues({ ...editValues, estado: v })}
                      >
                        <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-700 border-slate-600">
                          {["Nuevo", "Procesado", "Archivado"].map((e) => (
                            <SelectItem key={e} value={e} className="text-white">
                              {e}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={handleSaveFeedback}
                        disabled={feedbackMutation.isPending}
                        className="flex-1 bg-green-600 hover:bg-green-700"
                      >
                        <Save className="w-4 h-4 mr-2" />
                        Guardar
                      </Button>
                      <Button
                        onClick={() => setEditingId(null)}
                        variant="outline"
                        className="flex-1 border-slate-600"
                      >
                        <X className="w-4 h-4 mr-2" />
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Tipo</p>
                      <div className="flex items-center justify-between">
                        <CategoryBadge value={lastResult.classification.tipo.value} />
                        <ConfidenceBar confidence={lastResult.classification.tipo.confidence} />
                      </div>
                    </div>

                    <div>
                      <p className="text-sm text-gray-400 mb-1">Departamento</p>
                      <div className="flex items-center justify-between">
                        <CategoryBadge
                          value={lastResult.classification.departamento.value}
                        />
                        <ConfidenceBar
                          confidence={lastResult.classification.departamento.confidence}
                        />
                      </div>
                    </div>

                    <div>
                      <p className="text-sm text-gray-400 mb-1">Urgencia</p>
                      <div className="flex items-center justify-between">
                        <CategoryBadge value={lastResult.classification.urgencia.value} />
                        <ConfidenceBar
                          confidence={lastResult.classification.urgencia.confidence}
                        />
                      </div>
                    </div>

                    <div>
                      <p className="text-sm text-gray-400 mb-1">Estado</p>
                      <div className="flex items-center justify-between">
                        <CategoryBadge value={lastResult.classification.estado.value} />
                        <ConfidenceBar
                          confidence={lastResult.classification.estado.confidence}
                        />
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-600">
                      <p className="text-xs text-gray-500">
                        ID: {lastResult.id.substring(0, 20)}...
                      </p>
                      <p className="text-xs text-gray-500">
                        Tiempo: {new Date(lastResult.timestamp).toLocaleString()}
                      </p>
                      {lastResult.ollamaUsed && (
                        <p className="text-xs text-green-400 mt-1">✓ Ollama enriquecimiento</p>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── Historial y Filtros ────────────────────────────────────────── */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-cyan-400" />
              <CardTitle className="text-white">Historial de clasificaciones</CardTitle>
            </div>
            <Button
              size="sm"
              onClick={() => refetchHistory()}
              variant="ghost"
              className="text-gray-400 hover:text-gray-300"
            >
              Actualizar
            </Button>
          </CardHeader>
          <CardContent>
            {/* ── Filtros ──────────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <Label className="text-gray-300">Filtrar por Tipo</Label>
                <Select
                  value={historyFilter.tipo || ""}
                  onValueChange={(v) =>
                    setHistoryFilter({ ...historyFilter, tipo: v || null })
                  }
                >
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-700 border-slate-600">
                    <SelectItem value="">Todos</SelectItem>
                    {Object.keys(breakdown?.tipo || {}).map((t) => (
                      <SelectItem key={t} value={t} className="text-white">
                        {t} ({breakdown.tipo[t]})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-gray-300">Filtrar por Departamento</Label>
                <Select
                  value={historyFilter.departamento || ""}
                  onValueChange={(v) =>
                    setHistoryFilter({ ...historyFilter, departamento: v || null })
                  }
                >
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-700 border-slate-600">
                    <SelectItem value="">Todos</SelectItem>
                    {Object.keys(breakdown?.departamento || {}).map((d) => (
                      <SelectItem key={d} value={d} className="text-white">
                        {d} ({breakdown.departamento[d]})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* ── Tabla de historial ───────────────────────────────────────── */}
            {historyLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 bg-slate-700 rounded animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-700 hover:bg-slate-800/50">
                      <TableHead className="text-gray-400">Timestamp</TableHead>
                      <TableHead className="text-gray-400">Tipo</TableHead>
                      <TableHead className="text-gray-400">Departamento</TableHead>
                      <TableHead className="text-gray-400">Urgencia</TableHead>
                      <TableHead className="text-gray-400">Estado</TableHead>
                      <TableHead className="text-gray-400">Feedback</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyData?.history?.map((item) => (
                      <TableRow key={item.id} className="border-slate-700 hover:bg-slate-700/50">
                        <TableCell className="text-sm text-gray-400">
                          {format(new Date(item.timestamp), "MMM dd, HH:mm")}
                        </TableCell>
                        <TableCell>
                          <CategoryBadge value={item.classification.tipo.value} />
                        </TableCell>
                        <TableCell>
                          <CategoryBadge value={item.classification.departamento.value} />
                        </TableCell>
                        <TableCell>
                          <CategoryBadge value={item.classification.urgencia.value} />
                        </TableCell>
                        <TableCell>
                          <CategoryBadge value={item.classification.estado.value} />
                        </TableCell>
                        <TableCell>
                          {item.feedback ? (
                            <CheckCircle2 className="w-4 h-4 text-green-400" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-yellow-400" />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {historyData?.total === 0 && (
              <div className="text-center py-8">
                <p className="text-gray-400">No hay clasificaciones aún</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
