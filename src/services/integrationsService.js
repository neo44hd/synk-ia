/**
 * SYNK-IA - Servicio de Integraciones Locales
 * © 2024 David Roldan - Chicken Palace Ibiza
 * Futuro: SYNK-IA LABS
 * 
 * Integraciones mock que simulan las operaciones que antes realizaba Base44
 */

// Helper para simular operaciones asíncronas
const mockAsync = (result, delay = 300) => {
  return new Promise(resolve => setTimeout(() => resolve(result), delay));
};

/**
 * Integración Core - Funciones principales
 */
export const Core = {
  /**
   * Invoca un modelo de lenguaje (LLM)
   */
  InvokeLLM: async ({ prompt, model = 'gpt-4', ...options }) => {
    console.log('[SYNK-IA] InvokeLLM ejecutado (mock)', { prompt: prompt?.substring(0, 100) });
    return mockAsync({
      success: true,
      response: `[Respuesta simulada] Esta es una respuesta de demostración para: "${prompt?.substring(0, 50)}..."`,
      model,
      tokens_used: 0
    });
  },

  /**
   * Envía un email
   */
  SendEmail: async ({ to, subject, body, attachments = [] }) => {
    console.log('[SYNK-IA] SendEmail ejecutado (mock)', { to, subject });
    return mockAsync({
      success: true,
      message: `Email simulado enviado a ${to}`,
      messageId: 'mock-' + Date.now()
    });
  },

  /**
   * Sube un archivo
   */
  UploadFile: async ({ file, path, metadata = {} }) => {
    console.log('[SYNK-IA] UploadFile ejecutado (mock)', { path });
    
    // Guardar referencia en localStorage
    const fileId = 'file_' + Date.now();
    const fileRecord = {
      id: fileId,
      name: file?.name || path,
      size: file?.size || 0,
      type: file?.type || 'application/octet-stream',
      uploaded_at: new Date().toISOString(),
      metadata
    };
    
    const files = JSON.parse(localStorage.getItem('synkia_data_uploadedfile') || '[]');
    files.push(fileRecord);
    localStorage.setItem('synkia_data_uploadedfile', JSON.stringify(files));
    
    return mockAsync({
      success: true,
      fileId,
      url: `local://files/${fileId}`,
      message: 'Archivo guardado localmente'
    });
  },

  /**
   * Genera una imagen
   */
  GenerateImage: async ({ prompt, size = '1024x1024' }) => {
    console.log('[SYNK-IA] GenerateImage ejecutado (mock)', { prompt: prompt?.substring(0, 50) });
    return mockAsync({
      success: false,
      message: 'Generación de imágenes no disponible en modo local',
      url: null
    });
  },

  /**
   * Extrae datos de un archivo subido
   */
  ExtractDataFromUploadedFile: async ({ fileId, type = 'auto' }) => {
    console.log('[SYNK-IA] ExtractDataFromUploadedFile ejecutado (mock)', { fileId, type });
    return mockAsync({
      success: true,
      data: {},
      message: 'Extracción simulada (modo local)'
    });
  },

  /**
   * Crea una URL firmada para un archivo
   */
  CreateFileSignedUrl: async ({ fileId, expiresIn = 3600 }) => {
    console.log('[SYNK-IA] CreateFileSignedUrl ejecutado (mock)', { fileId });
    return mockAsync({
      success: true,
      url: `local://files/${fileId}?token=mock`,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString()
    });
  },

  /**
   * Sube un archivo privado
   */
  UploadPrivateFile: async ({ file, path, metadata = {} }) => {
    console.log('[SYNK-IA] UploadPrivateFile ejecutado (mock)', { path });
    
    const fileId = 'private_' + Date.now();
    const fileRecord = {
      id: fileId,
      name: file?.name || path,
      size: file?.size || 0,
      type: file?.type || 'application/octet-stream',
      private: true,
      uploaded_at: new Date().toISOString(),
      metadata
    };
    
    const files = JSON.parse(localStorage.getItem('synkia_data_uploadedfile') || '[]');
    files.push(fileRecord);
    localStorage.setItem('synkia_data_uploadedfile', JSON.stringify(files));
    
    return mockAsync({
      success: true,
      fileId,
      message: 'Archivo privado guardado localmente'
    });
  }
};

// Exportar funciones individuales para compatibilidad
export const InvokeLLM = Core.InvokeLLM;
export const SendEmail = Core.SendEmail;
export const UploadFile = Core.UploadFile;
export const GenerateImage = Core.GenerateImage;
export const ExtractDataFromUploadedFile = Core.ExtractDataFromUploadedFile;
export const CreateFileSignedUrl = Core.CreateFileSignedUrl;
export const UploadPrivateFile = Core.UploadPrivateFile;

export const integrationsService = {
  Core
};

export default integrationsService;
