/**
 * SYNK-IA Backup Service
 * Exporta/importa datos completos desde la API /api/data en vez de localStorage
 * Migrado: localStorage → /api/data/:entity (persistencia en servidor)
 */

import { auditService, AUDIT_ACTIONS, SEVERITY } from './auditService';

// Todas las entidades disponibles en el sistema
const ALL_ENTITIES = [
  'provider', 'invoice', 'pricecomparison', 'document', 'timesheet',
  'contract', 'payroll', 'vacationrequest', 'emailintegration',
  'notification', 'report', 'mutuaincident', 'rgpdcompliance',
  'companydocument', 'sale', 'menuitem', 'revoemployee', 'websync',
  'albaran', 'verifactu', 'emailaccount', 'order', 'emailmessage',
  'emailcontact', 'quote', 'client', 'salesinvoice', 'product',
  'productpurchase', 'employee', 'uploadedfile',
  'auditlog', 'docbrainqueue', 'docbrainlog', 'revoconfig',
  'revosyncstatus', 'revosyncevents', 'chathistory',
  'whatsappconfig', 'whatsappmessage'
];

const API_BASE = '/api/data';

async function fetchEntity(entity) {
  try {
    const res = await fetch(`${API_BASE}/${entity}`, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data?.data || [];
  } catch (err) {
    console.warn(`[Backup] Error leyendo entidad ${entity}:`, err.message);
    return [];
  }
}

async function restoreEntity(entity, records) {
  try {
    const res = await fetch(`${API_BASE}/${entity}/bulk`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records, merge: false }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data;
  } catch (err) {
    console.warn(`[Backup] Error restaurando entidad ${entity}:`, err.message);
    return null;
  }
}

class BackupService {
  /**
   * Crear backup completo de todas las entidades desde la API
   */
  async createFullBackup() {
    const backup = {
      metadata: {
        version: '2.0.0',
        appName: 'SYNK-IA',
        createdAt: new Date().toISOString(),
        createdBy: auditService.getCurrentUser()?.name || 'Unknown',
        source: 'api'
      },
      entities: {},
      statistics: {}
    };

    let totalRecords = 0;
    const entityStats = {};

    // Leer todas las entidades en paralelo (grupos de 5 para no saturar)
    for (let i = 0; i < ALL_ENTITIES.length; i += 5) {
      const batch = ALL_ENTITIES.slice(i, i + 5);
      const results = await Promise.all(batch.map(async (entity) => {
        const records = await fetchEntity(entity);
        return { entity, records };
      }));

      for (const { entity, records } of results) {
        if (records.length > 0) {
          backup.entities[entity] = records;
          totalRecords += records.length;
          entityStats[entity] = records.length;
        }
      }
    }

    backup.statistics = {
      totalEntities: Object.keys(backup.entities).length,
      totalRecords,
      entityStats,
      dataSize: new Blob([JSON.stringify(backup)]).size
    };

    // Registrar la acción de backup
    await auditService.log(AUDIT_ACTIONS.EXPORT_BACKUP, {
      entitiesBackedUp: Object.keys(backup.entities).length,
      totalRecords,
      size: backup.statistics.dataSize
    }, SEVERITY.INFO);

    return backup;
  }

  /**
   * Descargar backup como archivo JSON
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
   * Restaurar desde backup (formato v2 con entities, o v1 con localStorage)
   */
  async restoreFromBackup(backupData) {
    if (!backupData.metadata) {
      throw new Error('Formato de backup inválido');
    }

    // Registrar intento de restauración
    await auditService.log(AUDIT_ACTIONS.IMPORT_DATA, {
      backupDate: backupData.metadata.createdAt,
      backupVersion: backupData.metadata.version,
      source: backupData.metadata.source || 'unknown'
    }, SEVERITY.CRITICAL);

    let restoredEntities = 0;
    let restoredRecords = 0;

    // Formato v2: entities directamente desde API
    if (backupData.entities) {
      for (const [entity, records] of Object.entries(backupData.entities)) {
        if (Array.isArray(records) && records.length > 0) {
          const result = await restoreEntity(entity, records);
          if (result) {
            restoredEntities++;
            restoredRecords += records.length;
          }
        }
      }
    }

    // Formato v1 (legacy): localStorage — convertir a API
    if (backupData.localStorage && !backupData.entities) {
      console.warn('[Backup] Restaurando backup v1 (localStorage) — migrando a API');
      // Intentar mapear claves conocidas a entidades
      const keyEntityMap = {
        synkia_audit_logs: 'auditlog',
        docbrain_processed: 'docbrainqueue',
        docbrain_activity_log: 'docbrainlog',
        synkia_brain_history: 'chathistory',
        synkia_whatsapp_config: 'whatsappconfig',
        synkia_whatsapp_messages: 'whatsappmessage',
        revo_sync_events: 'revosyncevents',
      };

      for (const [key, value] of Object.entries(backupData.localStorage)) {
        const entity = keyEntityMap[key];
        if (entity && value) {
          try {
            const records = Array.isArray(value) ? value : [value];
            const stamped = records.map((r, i) => ({
              id: r.id || `migrated_${i}_${Date.now()}`,
              ...r
            }));
            const result = await restoreEntity(entity, stamped);
            if (result) {
              restoredEntities++;
              restoredRecords += stamped.length;
            }
          } catch (e) {
            console.warn(`[Backup] Error migrando ${key} → ${entity}:`, e.message);
          }
        }
      }
    }

    return {
      success: true,
      restoredEntities,
      restoredRecords
    };
  }
}

export const backupService = new BackupService();
export default backupService;
