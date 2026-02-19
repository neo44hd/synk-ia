import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, X, ExternalLink, FileText, Image as ImageIcon } from "lucide-react";

export default function FilePreviewModal({ file, isOpen, onClose }) {
  if (!file) return null;

  // Simple extension check
  const ext = file.filename?.split('.').pop()?.toLowerCase();
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext) || file.content_type?.startsWith("image/");
  const isPdf = ext === 'pdf' || file.content_type === "application/pdf";

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl h-[85vh] bg-zinc-950 border-zinc-800 text-white flex flex-col p-0 gap-0 sm:rounded-xl overflow-hidden shadow-2xl">
        <DialogHeader className="p-3 border-b border-zinc-800 flex flex-row items-center justify-between space-y-0 bg-zinc-900/50 backdrop-blur-sm">
          <DialogTitle className="truncate pr-4 flex items-center gap-2 text-sm font-medium">
            {isImage ? <ImageIcon className="w-4 h-4 text-purple-400" /> : <FileText className="w-4 h-4 text-cyan-400" />}
            <span className="truncate max-w-md">{file.filename}</span>
          </DialogTitle>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => window.open(file.file_url, '_blank')}
              className="h-7 w-7 p-0 text-zinc-400 hover:text-cyan-400 hover:bg-cyan-950/30"
              title="Abrir en nueva pestaña"
            >
              <ExternalLink className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onClose}
              className="h-7 w-7 p-0 text-zinc-400 hover:text-red-400 hover:bg-red-950/30"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>
        
        <div className="flex-1 bg-zinc-950/50 overflow-hidden flex items-center justify-center relative w-full h-full">
          {isImage ? (
            <div className="w-full h-full flex items-center justify-center p-4">
              <img 
                src={file.file_url} 
                alt={file.filename} 
                className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
              />
            </div>
          ) : isPdf ? (
            <iframe
              src={`${file.file_url}#view=FitH`}
              className="w-full h-full border-none bg-zinc-800"
              title="PDF Preview"
            />
          ) : (
            <div className="text-center p-8">
              <div className="w-20 h-20 bg-zinc-900 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-zinc-800 shadow-xl">
                <FileText className="w-10 h-10 text-zinc-600" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">Vista previa no disponible</h3>
              <p className="text-zinc-500 mb-6 text-sm">Este tipo de archivo no se puede visualizar directamente.</p>
              <Button 
                onClick={() => window.open(file.file_url, '_blank')}
                className="bg-cyan-600 hover:bg-cyan-700 text-white rounded-full px-6"
              >
                <Download className="w-4 h-4 mr-2" />
                Descargar Archivo
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}