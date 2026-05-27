/**
 * Logs Service - Agregar logs de múltiples fuentes
 */

import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);
const readFile = promisify(fs.readFile);

export class LogsService {
  /**
   * Obtener logs del sistema (últimas líneas)
   */
  static async getSystemLogs(lines = 100) {
    try {
      const { stdout } = await execAsync(`log show --predicate 'process == "node"' --last 1h 2>/dev/null || echo "No system logs available"`);
      return stdout.split('\n').slice(-lines).join('\n');
    } catch (err) {
      return `Error reading system logs: ${err.message}`;
    }
  }

  /**
   * Obtener logs del servidor (PM2)
   */
  static async getPM2Logs(service = '', lines = 100) {
    try {
      let cmd = `pm2 logs --lines ${lines} --nostream`;
      if (service) {
        cmd = `pm2 logs "${service}" --lines ${lines} --nostream`;
      }
      const { stdout } = await execAsync(`${cmd} 2>/dev/null || echo "No PM2 logs available"`);
      return stdout;
    } catch (err) {
      return `Error reading PM2 logs: ${err.message}`;
    }
  }

  /**
   * Obtener logs de archivo específico
   */
  static async getFileLogs(filePath, lines = 100) {
    try {
      if (!fs.existsSync(filePath)) {
        return `File not found: ${filePath}`;
      }
      
      const content = await readFile(filePath, 'utf-8');
      const logLines = content.split('\n');
      return logLines.slice(-lines).join('\n');
    } catch (err) {
      return `Error reading file logs: ${err.message}`;
    }
  }

  /**
   * Obtener logs de aplicación (si existe)
   */
  static async getAppLogs(lines = 100) {
    const logDir = path.join(process.cwd(), 'logs');
    const logFile = path.join(logDir, 'app.log');

    if (fs.existsSync(logFile)) {
      return this.getFileLogs(logFile, lines);
    }

    return 'App log file not found';
  }

  /**
   * Obtener logs de error
   */
  static async getErrorLogs(lines = 100) {
    const logDir = path.join(process.cwd(), 'logs');
    const errorFile = path.join(logDir, 'error.log');

    if (fs.existsSync(errorFile)) {
      return this.getFileLogs(errorFile, lines);
    }

    try {
      // Intenta obtener errores de PM2
      const { stdout } = await execAsync('pm2 logs --err --lines 100 --nostream 2>/dev/null || echo "No error logs"');
      return stdout;
    } catch (err) {
      return 'No error logs available';
    }
  }

  /**
   * Obtener resumen de logs de múltiples servicios
   */
  static async getLogsSummary(lines = 50) {
    const summary = {
      pm2: await this.getPM2Logs('', lines),
      app: await this.getAppLogs(lines),
      error: await this.getErrorLogs(lines)
    };

    return summary;
  }

  /**
   * Buscar en logs
   */
  static async searchLogs(query, lines = 200) {
    try {
      let searchResults = [];
      
      // Buscar en PM2
      const pm2Logs = await this.getPM2Logs('', lines);
      const pm2Matches = pm2Logs.split('\n').filter(line => 
        line.toLowerCase().includes(query.toLowerCase())
      );
      searchResults.push({ source: 'PM2', matches: pm2Matches });

      // Buscar en app logs
      const appLogs = await this.getAppLogs(lines);
      const appMatches = appLogs.split('\n').filter(line =>
        line.toLowerCase().includes(query.toLowerCase())
      );
      searchResults.push({ source: 'App', matches: appMatches });

      return searchResults;
    } catch (err) {
      return [{ source: 'Error', matches: [err.message] }];
    }
  }
}

export default LogsService;
