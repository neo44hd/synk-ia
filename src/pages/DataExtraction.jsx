import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  extractDocument,
  getExtractions,
  deleteExtraction,
  downloadExtraction,
} from '../services/extractorService.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  FileText,
  Upload,
  Download,
  Trash2,
  Eye,
  Filter,
  BarChart3,
  Copy,
  CheckCircle,
  AlertCircle,
  Zap,
} from 'lucide-react';

export default function DataExtraction() {
  // State
  const [extractionText, setExtractionText] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [selectedType, setSelectedType] = useState(null);
  const [showDetails, setShowDetails] = useState(null);
  const [copied, setCopied] = useState(null);

  // Queries
  const { data: extractions = [], refetch, isLoading } = useQuery({
    queryKey: ['extractions'],
    queryFn: async () => {
      const all = await getExtractions(selectedType);
      return all.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    },
  });

  // Refresh cuando cambia el filtro
  useEffect(() => {
    refetch();
  }, [selectedType, refetch]);

  // Extract handler
  const handleExtract = async () => {
    if (!extractionText.trim()) {
      alert('Por favor, ingresa texto para extraer');
      return;
    }

    setIsExtracting(true);
    try {
      await extractDocument(extractionText);
      setExtractionText('');
      await refetch();
      alert('✓ Extracción completada correctamente');
    } catch (error) {
      console.error('Error:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setIsExtracting(false);
    }
  };

  // Delete handler
  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta extracción?')) return;

    try {
      await deleteExtraction(id);
      await refetch();
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  };

  // Export handler
  const handleExport = async (format) => {
    try {
      await downloadExtraction(format, selectedType);
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  };

  // Copy to clipboard
  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 2000);
  };

  // Stats
  const stats = {
    total: extractions.length,
    factura: extractions.filter((e) => e.type === 'factura').length,
    contrato: extractions.filter((e) => e.type === 'contrato').length,
    po: extractions.filter((e) => e.type === 'po').length,
    unknown: extractions.filter((e) => e.type === 'unknown').length,
  };

  const typeColors = {
    factura: 'bg-blue-100 text-blue-800',
    contrato: 'bg-purple-100 text-purple-800',
    po: 'bg-green-100 text-green-800',
    unknown: 'bg-gray-100 text-gray-800',
  };

  const confidenceColor = (conf) => {
    if (conf >= 0.8) return 'text-green-500';
    if (conf >= 0.6) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <div className="p-4 md:p-8 min-h-screen bg-gradient-to-br from-zinc-950 via-neutral-900 to-zinc-950">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Zap className="w-8 h-8 text-blue-400" />
            Extractor de Campos
          </h1>
          <p className="text-zinc-400 mt-1">Extrae información de Facturas, Contratos y POs con IA + Regex</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <Card className="border-none shadow-lg bg-zinc-800/50 border border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="w-4 h-4 text-white" />
                <p className="text-xs text-zinc-400">Total</p>
              </div>
              <p className="text-2xl font-bold text-white">{stats.total}</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg bg-blue-900/30 border border-blue-700/50">
            <CardContent className="p-4">
              <p className="text-xs text-blue-300 mb-1">Facturas</p>
              <p className="text-2xl font-bold text-blue-200">{stats.factura}</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg bg-purple-900/30 border border-purple-700/50">
            <CardContent className="p-4">
              <p className="text-xs text-purple-300 mb-1">Contratos</p>
              <p className="text-2xl font-bold text-purple-200">{stats.contrato}</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg bg-green-900/30 border border-green-700/50">
            <CardContent className="p-4">
              <p className="text-xs text-green-300 mb-1">POs</p>
              <p className="text-2xl font-bold text-green-200">{stats.po}</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg bg-zinc-700/50 border border-zinc-600">
            <CardContent className="p-4">
              <p className="text-xs text-zinc-300 mb-1">Sin clasificar</p>
              <p className="text-2xl font-bold text-zinc-100">{stats.unknown}</p>
            </CardContent>
          </Card>
        </div>

        {/* Extraction Input */}
        <Card className="border-none shadow-lg bg-zinc-800/50 border border-zinc-800 mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Upload className="w-5 h-5 text-blue-400" />
              Extraer Información
            </CardTitle>
          </CardHeader>
          <CardContent>
            <textarea
              value={extractionText}
              onChange={(e) => setExtractionText(e.target.value)}
              placeholder="Pega aquí el texto de tu documento (factura, contrato, PO)..."
              rows={8}
              className="w-full p-4 bg-zinc-700/50 border border-zinc-600 rounded text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-2 mt-4">
              <Button
                onClick={handleExtract}
                disabled={isExtracting || !extractionText.trim()}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isExtracting ? 'Extrayendo...' : '🔍 Extraer'}
              </Button>
              <Button
                onClick={() => setExtractionText('')}
                variant="outline"
                className="border-zinc-600 text-zinc-300 hover:bg-zinc-700"
              >
                Limpiar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Filter & Export */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={() => setSelectedType(null)}
              variant={selectedType === null ? 'default' : 'outline'}
              size="sm"
              className={selectedType === null ? 'bg-blue-600' : 'border-zinc-600'}
            >
              <Filter className="w-4 h-4 mr-2" />
              Todos ({stats.total})
            </Button>
            {stats.factura > 0 && (
              <Button
                onClick={() => setSelectedType('factura')}
                variant={selectedType === 'factura' ? 'default' : 'outline'}
                size="sm"
                className={selectedType === 'factura' ? 'bg-blue-600' : 'border-zinc-600'}
              >
                Facturas ({stats.factura})
              </Button>
            )}
            {stats.contrato > 0 && (
              <Button
                onClick={() => setSelectedType('contrato')}
                variant={selectedType === 'contrato' ? 'default' : 'outline'}
                size="sm"
                className={selectedType === 'contrato' ? 'bg-purple-600' : 'border-zinc-600'}
              >
                Contratos ({stats.contrato})
              </Button>
            )}
            {stats.po > 0 && (
              <Button
                onClick={() => setSelectedType('po')}
                variant={selectedType === 'po' ? 'default' : 'outline'}
                size="sm"
                className={selectedType === 'po' ? 'bg-green-600' : 'border-zinc-600'}
              >
                POs ({stats.po})
              </Button>
            )}
          </div>

          <div className="flex gap-2 ml-auto">
            <Button
              onClick={() => handleExport('json')}
              variant="outline"
              size="sm"
              disabled={extractions.length === 0}
              className="border-zinc-600 text-zinc-300"
            >
              <Download className="w-4 h-4 mr-2" />
              JSON
            </Button>
            <Button
              onClick={() => handleExport('csv')}
              variant="outline"
              size="sm"
              disabled={extractions.length === 0}
              className="border-zinc-600 text-zinc-300"
            >
              <Download className="w-4 h-4 mr-2" />
              CSV
            </Button>
          </div>
        </div>

        {/* Extractions List */}
        {isLoading ? (
          <Card className="border-none shadow-lg bg-zinc-800/50">
            <CardContent className="p-12 text-center">
              <p className="text-zinc-400">Cargando extracciones...</p>
            </CardContent>
          </Card>
        ) : extractions.length === 0 ? (
          <Card className="border-none shadow-lg bg-zinc-800/50">
            <CardContent className="p-12 text-center">
              <FileText className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
              <p className="text-zinc-400">No hay extracciones registradas</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {extractions.map((extraction) => (
              <Card
                key={extraction.id}
                className="border-none shadow-lg bg-zinc-800/50 border border-zinc-800 hover:bg-zinc-800 transition-all"
              >
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-800 rounded flex items-center justify-center flex-shrink-0">
                          <FileText className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-white">{extraction.id}</h3>
                          <p className="text-xs text-zinc-500">
                            {new Date(extraction.timestamp).toLocaleString()}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 mb-3">
                        <Badge className={typeColors[extraction.type]}>
                          {extraction.type.toUpperCase()}
                        </Badge>
                        <span className={`text-sm font-semibold ${confidenceColor(extraction.typeConfidence)}`}>
                          {Math.round(extraction.typeConfidence * 100)}% confianza
                        </span>
                      </div>

                      {/* Field Summary */}
                      <div className="text-sm text-zinc-300 space-y-1">
                        {Object.entries(extraction.extraction.fields || {})
                          .filter(([_, f]) => f.value !== null && f.value !== undefined)
                          .slice(0, 3)
                          .map(([key, field]) => (
                            <div key={key} className="flex items-center gap-2">
                              <CheckCircle className="w-3 h-3 text-green-500" />
                              <span>
                                <strong>{key}:</strong> {Array.isArray(field.value) ? field.value.join(', ') : field.value}
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 md:ml-auto">
                      <Button
                        onClick={() => setShowDetails(showDetails === extraction.id ? null : extraction.id)}
                        variant="outline"
                        size="sm"
                        className="border-zinc-600 text-zinc-300 hover:bg-zinc-700"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Detalles
                      </Button>
                      <Button
                        onClick={() => handleDelete(extraction.id)}
                        variant="outline"
                        size="sm"
                        className="border-red-600/50 text-red-400 hover:bg-red-900/20"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Eliminar
                      </Button>
                    </div>
                  </div>

                  {/* Details Expanded */}
                  {showDetails === extraction.id && (
                    <div className="mt-4 p-4 bg-zinc-900/50 rounded border border-zinc-700">
                      <h4 className="font-bold text-white mb-3">Campos Extraídos:</h4>
                      <div className="space-y-2 text-sm">
                        {Object.entries(extraction.extraction.fields || {}).map(([key, field]) => (
                          <div key={key} className="flex items-start justify-between p-2 bg-zinc-800/50 rounded">
                            <div className="flex-1">
                              <div className="font-mono text-xs text-zinc-400">{key}</div>
                              <div className="text-white break-words">
                                {Array.isArray(field.value)
                                  ? field.value.join(', ')
                                  : field.value || '(vacío)'}
                              </div>
                              <div className="text-xs text-zinc-500 mt-1">
                                {field.method} • {Math.round(field.confidence * 100)}% confianza
                              </div>
                            </div>
                            {field.value && (
                              <Button
                                onClick={() => handleCopy(field.value)}
                                size="sm"
                                variant="ghost"
                                className="ml-2 text-zinc-400 hover:text-white"
                              >
                                {copied === field.value ? '✓' : <Copy className="w-3 h-3" />}
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Info Card */}
        <Card className="border-none shadow-lg mt-8 bg-blue-900/30 border border-blue-700/50">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <BarChart3 className="w-6 h-6 text-blue-400 mt-1 flex-shrink-0" />
              <div>
                <p className="font-medium text-blue-200 mb-2">Cómo funciona:</p>
                <ul className="text-sm text-blue-100/70 space-y-1">
                  <li>✓ Detección automática de tipo de documento (Factura, Contrato, PO)</li>
                  <li>✓ Extracción de campos con Regex (rápido y confiable)</li>
                  <li>✓ Enriquecimiento opcional con Ollama local (si está disponible)</li>
                  <li>✓ Confianza por campo para validación manual</li>
                  <li>✓ Exportación a JSON y CSV</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
