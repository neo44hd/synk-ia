/**
 * SYNK-IA Backup Service
 * Handles complete data backup and export functionality
 */

import { auditService, AUDIT_ACTIONS, SEVERITY } from './auditService';

class BackupService {
  /**
   * Get all localStorage keys that belong to SYNK-IA
   */
  getSynkiaKeys() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      // Include all keys related to the app
      if (key && (
        key.startsWith('synkia_') ||
        key.startsWith('revo_') ||
        key.startsWith('whatsapp_') ||
        key.startsWith('compliance_') ||
        key.includes('cache') ||
        key.includes('sync') ||
        key.includes('history')
      )) {
        keys.push(key);
      }
    }
    return keys;
  }

  /**
   * Create a complete backup of all app data
   */
  async createFullBackup() {
    const backup = {
      metadata: {
        version: '1.0.0',
        appName: 'SYNK-IA',
        createdAt: new Date().toISOString(),
        createdBy: auditService.getCurrentUser()?.name || 'Unknown'
      },
      localStorage: {},
      statistics: {}
    };

    // Backup all localStorage data
    const keys = this.getSynkiaKeys();
    keys.forEach(key => {
      try {
        const value = localStorage.getItem(key);
        backup.localStorage[key] = value ? JSON.parse(value) : null;
      } catch (e) {
        backup.localStorage[key] = localStorage.getItem(key);
      }
    });

    // Add statistics
    backup.statistics = {
      totalKeys: keys.length,
      auditLogsCount: auditService.getLogs().length,
      dataSize: new Blob([JSON.stringify(backup)]).size
    };

    // Log the backup action
    auditService.log(AUDIT_ACTIONS.EXPORT_BACKUP, {
      keysBackedUp: keys.length,
      size: backup.statistics.dataSize
    }, SEVERITY.INFO);

    return backup;
  }

  /**
   * Download backup as JSON file
   */
  async downloadBackup() {
    const backup = await this.createFullBackup();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const date = new Date().toISOString().split('T')[0];
    const filename = `synkia_backup_${date}.json`;
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    return { success: true, filename, size: backup.statistics.dataSize };
  }

  /**
   * Restore from backup (with confirmation)
   */
  async restoreFromBackup(backupData) {
    if (!backupData.metadata || !backupData.localStorage) {
      throw new Error('Invalid backup format');
    }

    // Log restore attempt
    auditService.log(AUDIT_ACTIONS.IMPORT_DATA, {
      backupDate: backupData.metadata.createdAt,
      keysToRestore: Object.keys(backupData.localStorage).length
    }, SEVERITY.CRITICAL);

    // Restore localStorage data
    Object.entries(backupData.localStorage).forEach(([key, value]) => {
      try {
        localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
      } catch (e) {
        console.error(`Failed to restore key ${key}:`, e);
      }
    });

    return { success: true, keysRestored: Object.keys(backupData.localStorage).length };
  }
}

export const backupService = new BackupService();
export default backupService;
