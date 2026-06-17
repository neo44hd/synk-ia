/**
 * Database Module - SQLite for tasks, agents, metrics, alerts
 */

import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, '../data/control-brain.db');

export interface Task {
  id: string;
  prompt: string;
  agent: string;
  model: string;
  provider: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  start_time: number;
  end_time?: number;
  latency_ms?: number;
  result?: string;
  cost_estimate?: number;
}

export interface Agent {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'unknown';
  last_heartbeat: number;
  task_count: number;
  uptime_ms: number;
}

export interface Alert {
  id: string;
  type: string;
  message: string;
  resolved: boolean;
  created_at: number;
}

export class Database {
  private db: sqlite3.Database | null = null;

  constructor() {
    this.initDb();
  }

  private initDb() {
    this.db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('Database error:', err.message);
      } else {
        console.log(`📊 Database initialized at ${DB_PATH}`);
        this.createTables();
      }
    });
  }

  private createTables() {
    if (!this.db) return;

    this.db.serialize(() => {
      // Tasks table
      this.db!.run(`
        CREATE TABLE IF NOT EXISTS tasks (
          id TEXT PRIMARY KEY,
          prompt TEXT,
          agent TEXT,
          model TEXT,
          provider TEXT,
          status TEXT,
          start_time INTEGER,
          end_time INTEGER,
          latency_ms INTEGER,
          result TEXT,
          cost_estimate REAL
        )
      `);

      // Agents table
      this.db!.run(`
        CREATE TABLE IF NOT EXISTS agents (
          id TEXT PRIMARY KEY,
          name TEXT,
          status TEXT,
          last_heartbeat INTEGER,
          task_count INTEGER,
          uptime_ms INTEGER
        )
      `);

      // Alerts table
      this.db!.run(`
        CREATE TABLE IF NOT EXISTS alerts (
          id TEXT PRIMARY KEY,
          type TEXT,
          message TEXT,
          resolved BOOLEAN,
          created_at INTEGER
        )
      `);

      // Metrics table
      this.db!.run(`
        CREATE TABLE IF NOT EXISTS metrics (
          id TEXT PRIMARY KEY,
          timestamp INTEGER,
          agent TEXT,
          task_count INTEGER,
          latency_p50 REAL,
          latency_p99 REAL,
          cost_total REAL
        )
      `);
    });
  }

  // Task operations
  async insertTask(task: Task): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }
      this.db.run(
        `INSERT INTO tasks (id, prompt, agent, model, provider, status, start_time, end_time, latency_ms, result, cost_estimate)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          task.id,
          task.prompt,
          task.agent,
          task.model,
          task.provider,
          task.status,
          task.start_time,
          task.end_time,
          task.latency_ms,
          task.result,
          task.cost_estimate,
        ],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  async getTask(taskId: string): Promise<Task | null> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }
      this.db.get('SELECT * FROM tasks WHERE id = ?', [taskId], (err, row) => {
        if (err) reject(err);
        else resolve(row as Task || null);
      });
    });
  }

  async getRecentTasks(limit: number = 10): Promise<Task[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }
      this.db.all(
        'SELECT * FROM tasks ORDER BY start_time DESC LIMIT ?',
        [limit],
        (err, rows) => {
          if (err) reject(err);
          else resolve((rows as Task[]) || []);
        }
      );
    });
  }

  async updateTaskStatus(
    taskId: string,
    status: Task['status'],
    result?: string,
    latency_ms?: number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }
      const endTime = Date.now();
      this.db.run(
        `UPDATE tasks SET status = ?, end_time = ?, latency_ms = ?, result = ? WHERE id = ?`,
        [status, endTime, latency_ms, result, taskId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  // Alert operations
  async insertAlert(alert: Alert): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }
      this.db.run(
        `INSERT INTO alerts (id, type, message, resolved, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [alert.id, alert.type, alert.message, alert.resolved ? 1 : 0, alert.created_at],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  async getActiveAlerts(): Promise<Alert[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }
      this.db.all(
        'SELECT * FROM alerts WHERE resolved = 0 ORDER BY created_at DESC',
        (err, rows) => {
          if (err) reject(err);
          else {
            resolve(
              ((rows as any[]) || []).map((row) => ({
                ...row,
                resolved: !!row.resolved,
              }))
            );
          }
        }
      );
    });
  }

  close(): void {
    if (this.db) {
      this.db.close((err) => {
        if (err) console.error('Error closing database:', err.message);
        else console.log('Database closed');
      });
    }
  }
}

export const db = new Database();
