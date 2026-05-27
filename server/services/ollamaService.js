/**
 * Ollama Service - Información de modelos IA locales
 */

import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

export class OllamaService {
  /**
   * Verificar si Ollama está disponible
   */
  static async isAvailable() {
    try {
      const { stdout } = await execAsync('which ollama');
      return !!stdout;
    } catch {
      return false;
    }
  }

  /**
   * Obtener lista de modelos locales
   */
  static async getLocalModels() {
    try {
      const available = await this.isAvailable();
      if (!available) {
        return { success: false, message: 'Ollama not installed', models: [] };
      }

      const { stdout } = await execAsync('ollama list 2>/dev/null || echo ""');
      const models = [];
      
      stdout.split('\n').slice(1).forEach(line => {
        if (line.trim()) {
          const parts = line.split(/\s+/);
          if (parts.length >= 3) {
            models.push({
              name: parts[0],
              tag: parts[1] || 'latest',
              size: parts[2] || 'Unknown',
              modified: parts.slice(3).join(' ') || ''
            });
          }
        }
      });

      return { success: true, models };
    } catch (err) {
      console.error('[OllamaService] Error getting models:', err.message);
      return { success: false, error: err.message, models: [] };
    }
  }

  /**
   * Obtener modelo actualmente en uso
   */
  static async getRunningModel() {
    try {
      // Intenta obtener el proceso Ollama en ejecución
      const { stdout } = await execAsync('ps aux | grep ollama | grep -v grep || echo ""');
      
      if (stdout.trim()) {
        return { running: true, pid: stdout.split(/\s+/)[1] };
      }
      
      return { running: false };
    } catch (err) {
      return { running: false, error: err.message };
    }
  }

  /**
   * Obtener tamaño total de modelos
   */
  static async getModelsSize() {
    try {
      const { stdout } = await execAsync('du -sh ~/.ollama/models 2>/dev/null || echo "0B"');
      return stdout.trim();
    } catch (err) {
      return 'Unknown';
    }
  }

  /**
   * Obtener resumen de Ollama
   */
  static async getSummary() {
    const available = await this.isAvailable();
    const models = await this.getLocalModels();
    const running = await this.getRunningModel();
    const size = await this.getModelsSize();

    return {
      installed: available,
      running: running.running,
      models: models.models || [],
      total_models: (models.models || []).length,
      models_size: size,
      error: models.error || null
    };
  }

  /**
   * Configuraciones y preferencias
   */
  static async getConfig() {
    try {
      // Leer configuración de Ollama si existe
      const { stdout } = await execAsync('echo "CPU Cores: $(sysctl -n hw.ncpu)" 2>/dev/null || echo "Unknown"');
      
      return {
        status: 'active',
        config_location: '~/.ollama',
        system_info: stdout.trim()
      };
    } catch (err) {
      return { status: 'unknown', error: err.message };
    }
  }
}

export default OllamaService;
