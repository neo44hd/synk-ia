/**
 * PM2 Service - Monitorizar y gestionar procesos PM2
 */

import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

export class PM2Service {
  /**
   * Obtener lista de procesos PM2
   */
  static async listProcesses() {
    try {
      const { stdout } = await execAsync('pm2 list --no-pager --format json 2>/dev/null || echo "[]"');
      try {
        return JSON.parse(stdout);
      } catch {
        return [];
      }
    } catch (err) {
      console.error('[PM2Service] Error listing processes:', err.message);
      return [];
    }
  }

  /**
   * Obtener estado detallado de un proceso
   */
  static async getProcessStatus(processName) {
    try {
      const { stdout } = await execAsync(`pm2 show "${processName}" 2>/dev/null || true`);
      return stdout;
    } catch (err) {
      return null;
    }
  }

  /**
   * Reiniciar un proceso
   */
  static async restartProcess(processName) {
    try {
      const { stdout } = await execAsync(`pm2 restart "${processName}" 2>&1`);
      return { success: true, message: stdout };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Obtener logs de un proceso
   */
  static async getProcessLogs(processName, lines = 100) {
    try {
      const { stdout } = await execAsync(`pm2 logs "${processName}" --lines ${lines} --nostream 2>/dev/null || true`);
      return stdout || 'No logs available';
    } catch (err) {
      return `Error reading logs: ${err.message}`;
    }
  }

  /**
   * Obtener resumen de procesos
   */
  static async getSummary() {
    try {
      const processes = await this.listProcesses();
      const online = processes.filter(p => p.pm2_env?.status === 'online').length;
      const stopped = processes.filter(p => p.pm2_env?.status === 'stopped').length;
      const errored = processes.filter(p => p.pm2_env?.status === 'errored').length;

      return {
        total: processes.length,
        online,
        stopped,
        errored,
        processes: processes.map(p => ({
          name: p.name,
          status: p.pm2_env?.status || 'unknown',
          pid: p.pid,
          memory: p.monit?.memory || 0,
          cpu: p.monit?.cpu || 0,
          uptime: p.pm2_env?.create_time ? new Date(p.pm2_env.create_time) : null,
          restarts: p.pm2_env?.restart_time || 0
        }))
      };
    } catch (err) {
      console.error('[PM2Service] Error getting summary:', err.message);
      return { total: 0, online: 0, stopped: 0, errored: 0, processes: [] };
    }
  }
}

export default PM2Service;
