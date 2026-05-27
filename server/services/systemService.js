/**
 * System Service - Información del sistema, métricas, puertos, redes
 */

import os from 'os';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

export class SystemService {
  /**
   * Obtener métricas del sistema
   */
  static getSystemMetrics() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const cpus = os.cpus();
    
    return {
      platform: os.platform(),
      arch: os.arch(),
      hostname: os.hostname(),
      uptime: os.uptime(),
      cpus: cpus.length,
      cpu_model: cpus[0]?.model || 'Unknown',
      memory: {
        total: Math.round(totalMem / 1024 / 1024), // MB
        free: Math.round(freeMem / 1024 / 1024),
        used: Math.round(usedMem / 1024 / 1024),
        percent: Math.round((usedMem / totalMem) * 100)
      },
      load_average: os.loadavg()
    };
  }

  /**
   * Obtener puertos en uso
   */
  static async getActivePorts() {
    try {
      const { stdout } = await execAsync("lsof -i -P -n 2>/dev/null | grep LISTEN || true");
      const ports = [];
      
      stdout.split('\n').forEach(line => {
        const match = line.match(/(\w+)\s+(\d+).*\*:(\d+)\s+\(LISTEN\)|localhost:(\d+)\s+\(LISTEN\)/);
        if (match) {
          const port = match[3] || match[4];
          ports.push({
            port: parseInt(port),
            process: match[1] || 'Unknown'
          });
        }
      });

      return ports;
    } catch (err) {
      console.error('[SystemService] Error getting ports:', err.message);
      return [];
    }
  }

  /**
   * Obtener procesos activos
   */
  static async getRunningProcesses() {
    try {
      const { stdout } = await execAsync("ps aux | head -20");
      const lines = stdout.split('\n').slice(1, -1);
      
      const processes = lines.map(line => {
        const parts = line.split(/\s+/);
        return {
          user: parts[0],
          pid: parts[1],
          cpu: parts[2],
          mem: parts[3],
          command: parts.slice(10).join(' ')
        };
      });

      return processes;
    } catch (err) {
      console.error('[SystemService] Error getting processes:', err.message);
      return [];
    }
  }

  /**
   * Obtener información de red
   */
  static getNetworkInfo() {
    const interfaces = os.networkInterfaces();
    const networks = [];

    for (const [name, addresses] of Object.entries(interfaces)) {
      addresses.forEach(addr => {
        if (addr.family === 'IPv4') {
          networks.push({
            interface: name,
            ip: addr.address,
            netmask: addr.netmask
          });
        }
      });
    }

    return networks;
  }

  /**
   * Obtener estadísticas de disco (macOS)
   */
  static async getDiskUsage() {
    try {
      const { stdout } = await execAsync("df -h / 2>/dev/null");
      const lines = stdout.split('\n');
      if (lines.length > 1) {
        const parts = lines[1].split(/\s+/);
        return {
          filesystem: parts[0],
          total: parts[1],
          used: parts[2],
          available: parts[3],
          percent: parts[4] || '0%'
        };
      }
    } catch (err) {
      console.error('[SystemService] Error getting disk usage:', err.message);
    }
    return null;
  }

  /**
   * Obtener resumen completo del sistema
   */
  static async getFullSummary() {
    const metrics = this.getSystemMetrics();
    const ports = await this.getActivePorts();
    const processes = await this.getRunningProcesses();
    const networks = this.getNetworkInfo();
    const disk = await this.getDiskUsage();

    return {
      metrics,
      ports,
      processes: processes.slice(0, 10), // Top 10
      networks,
      disk
    };
  }
}

export default SystemService;
