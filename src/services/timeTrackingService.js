/**
 * TimeTrackingService - Servicio de Control Horario con Geolocalización
 * Cumplimiento Real Decreto 2026 - Registro de Jornada Laboral
 */

import { base44 } from "@/api/base44Client";

// Configuración de ubicaciones permitidas
const ALLOWED_LOCATIONS = [
  {
    id: 'oficina_central',
    name: 'Oficina Central',
    latitude: 41.3874,
    longitude: 2.1686,
    radius: 100 // metros
  },
  {
    id: 'local_1',
    name: 'Local Principal',
    latitude: 41.3851,
    longitude: 2.1734,
    radius: 75
  }
];

// Tipos de fichaje
export const CHECK_TYPES = {
  ENTRADA: 'entrada',
  SALIDA: 'salida',
  PAUSA_INICIO: 'pausa_inicio',
  PAUSA_FIN: 'pausa_fin',
  REMOTO: 'remoto'
};

// Estados de empleado
export const EMPLOYEE_STATUS = {
  WORKING: 'trabajando',
  ON_BREAK: 'en_pausa',
  NOT_CHECKED_IN: 'no_fichado',
  LATE: 'tarde',
  OFF: 'libre'
};

class TimeTrackingService {
  constructor() {
    this.currentPosition = null;
    this.watchId = null;
    this.listeners = [];
  }

  // ==================== GEOLOCALIZACIÓN ====================
  
  /**
   * Obtener ubicación actual del dispositivo
   */
  async getCurrentLocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocalización no soportada'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          this.currentPosition = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: new Date().toISOString()
          };
          resolve(this.currentPosition);
        },
        (error) => {
          reject(new Error(this._getGeoError(error)));
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        }
      );
    });
  }

  _getGeoError(error) {
    switch(error.code) {
      case error.PERMISSION_DENIED:
        return 'Permiso de ubicación denegado';
      case error.POSITION_UNAVAILABLE:
        return 'Ubicación no disponible';
      case error.TIMEOUT:
        return 'Tiempo de espera agotado';
      default:
        return 'Error desconocido de ubicación';
    }
  }

  /**
   * Calcular distancia entre dos puntos (Haversine)
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // metros
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }

  /**
   * Validar si la ubicación está dentro del radio permitido
   */
  validateLocation(position, allowedLocations = ALLOWED_LOCATIONS) {
    if (!position) return { valid: false, location: null, distance: null };

    for (const loc of allowedLocations) {
      const distance = this.calculateDistance(
        position.latitude,
        position.longitude,
        loc.latitude,
        loc.longitude
      );

      if (distance <= loc.radius) {
        return {
          valid: true,
          location: loc,
          distance: Math.round(distance),
          message: `En ${loc.name} (${Math.round(distance)}m del centro)`
        };
      }
    }

    // Encontrar la ubicación más cercana
    const closest = allowedLocations.reduce((prev, curr) => {
      const prevDist = this.calculateDistance(position.latitude, position.longitude, prev.latitude, prev.longitude);
      const currDist = this.calculateDistance(position.latitude, position.longitude, curr.latitude, curr.longitude);
      return currDist < prevDist ? curr : prev;
    });

    const closestDistance = this.calculateDistance(
      position.latitude,
      position.longitude,
      closest.latitude,
      closest.longitude
    );

    return {
      valid: false,
      location: closest,
      distance: Math.round(closestDistance),
      message: `Fuera del área permitida. Distancia a ${closest.name}: ${Math.round(closestDistance)}m`
    };
  }

  // ==================== FICHAJE ====================

  /**
   * Registrar fichaje con geolocalización
   */
  async registerCheckIn({
    userId,
    userName,
    checkType,
    photo = null,
    remoteJustification = null,
    forceRemote = false
  }) {
    try {
      // Obtener ubicación
      let position = null;
      let locationValidation = { valid: false };
      
      try {
        position = await this.getCurrentLocation();
        locationValidation = this.validateLocation(position);
      } catch (geoError) {
        if (!forceRemote) {
          throw new Error(`Error de ubicación: ${geoError.message}. Puede fichar en modo remoto.`);
        }
      }

      // Validar ubicación si no es remoto
      if (!forceRemote && !locationValidation.valid) {
        return {
          success: false,
          requiresJustification: true,
          message: locationValidation.message,
          position,
          closestLocation: locationValidation.location,
          distance: locationValidation.distance
        };
      }

      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const timeStr = now.toTimeString().slice(0, 5);

      // Crear registro de fichaje
      const checkInData = {
        user_id: userId,
        user_name: userName,
        date: today,
        check_type: checkType,
        time: timeStr,
        timestamp: now.toISOString(),
        
        // Geolocalización
        latitude: position?.latitude || null,
        longitude: position?.longitude || null,
        accuracy: position?.accuracy || null,
        location_name: locationValidation.location?.name || 'Remoto',
        location_valid: locationValidation.valid,
        distance_from_center: locationValidation.distance,
        
        // Remoto
        is_remote: forceRemote || !locationValidation.valid,
        remote_justification: remoteJustification,
        
        // Foto verificación
        verification_photo: photo,
        
        // Trazabilidad Legal RD 2026
        device_info: this._getDeviceInfo(),
        ip_address: null, // Se obtiene del servidor
        digital_signature: this._generateSignature(userId, now),
        created_at: now.toISOString(),
        modified_at: null,
        modified_by: null,
        modification_reason: null
      };

      // Guardar en base de datos
      const result = await base44.entities.TimeRecord.create(checkInData);

      // Actualizar timesheet del día si es entrada o salida
      if (checkType === CHECK_TYPES.ENTRADA || checkType === CHECK_TYPES.SALIDA) {
        await this._updateDailyTimesheet(userId, userName, today, checkType, timeStr);
      }

      // Registrar en log de auditoría
      await this._logAuditEvent({
        action: 'CHECK_IN',
        userId,
        checkType,
        timestamp: now.toISOString(),
        details: checkInData
      });

      // Notificar listeners
      this._notifyListeners({
        type: 'check_in',
        data: result
      });

      return {
        success: true,
        record: result,
        message: this._getCheckMessage(checkType),
        position,
        locationValid: locationValidation.valid
      };

    } catch (error) {
      console.error('Error en fichaje:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Actualizar timesheet diario
   */
  async _updateDailyTimesheet(userId, userName, date, checkType, time) {
    try {
      // Buscar timesheet existente
      const timesheets = await base44.entities.Timesheet.filter({
        user_id: userId,
        date: date
      });

      if (checkType === CHECK_TYPES.ENTRADA) {
        if (timesheets.length === 0) {
          // Crear nuevo timesheet
          await base44.entities.Timesheet.create({
            user_id: userId,
            user_name: userName,
            date: date,
            check_in: time,
            status: 'incompleto'
          });
        } else {
          // Actualizar si no hay entrada
          const ts = timesheets[0];
          if (!ts.check_in) {
            await base44.entities.Timesheet.update(ts.id, {
              check_in: time
            });
          }
        }
      } else if (checkType === CHECK_TYPES.SALIDA) {
        if (timesheets.length > 0) {
          const ts = timesheets[0];
          const checkIn = ts.check_in;
          
          if (checkIn) {
            const [inH, inM] = checkIn.split(':').map(Number);
            const [outH, outM] = time.split(':').map(Number);
            const totalMinutes = (outH * 60 + outM) - (inH * 60 + inM);
            const totalHours = Math.round(totalMinutes / 60 * 100) / 100;
            
            await base44.entities.Timesheet.update(ts.id, {
              check_out: time,
              total_hours: totalHours,
              status: 'completo'
            });
          }
        }
      }
    } catch (error) {
      console.error('Error actualizando timesheet:', error);
    }
  }

  _getCheckMessage(checkType) {
    const messages = {
      [CHECK_TYPES.ENTRADA]: '✅ Entrada registrada correctamente',
      [CHECK_TYPES.SALIDA]: '👋 Salida registrada. ¡Hasta mañana!',
      [CHECK_TYPES.PAUSA_INICIO]: '☕ Pausa iniciada',
      [CHECK_TYPES.PAUSA_FIN]: '💪 Vuelta de pausa registrada',
      [CHECK_TYPES.REMOTO]: '🏠 Fichaje remoto registrado'
    };
    return messages[checkType] || 'Fichaje registrado';
  }

  _getDeviceInfo() {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height
    };
  }

  _generateSignature(userId, timestamp) {
    // Firma digital simple para trazabilidad
    const data = `${userId}-${timestamp.toISOString()}`;
    return btoa(data).slice(0, 32);
  }

  // ==================== CONSULTAS ====================

  /**
   * Obtener fichajes del día para un empleado
   */
  async getTodayRecords(userId) {
    const today = new Date().toISOString().split('T')[0];
    try {
      const records = await base44.entities.TimeRecord.filter({
        user_id: userId,
        date: today
      });
      return records.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    } catch {
      return [];
    }
  }

  /**
   * Obtener estado actual del empleado
   */
  async getEmployeeStatus(userId) {
    const records = await this.getTodayRecords(userId);
    
    if (records.length === 0) {
      return { status: EMPLOYEE_STATUS.NOT_CHECKED_IN, lastRecord: null };
    }

    const lastRecord = records[records.length - 1];
    
    switch (lastRecord.check_type) {
      case CHECK_TYPES.ENTRADA:
        return { status: EMPLOYEE_STATUS.WORKING, lastRecord };
      case CHECK_TYPES.PAUSA_INICIO:
        return { status: EMPLOYEE_STATUS.ON_BREAK, lastRecord };
      case CHECK_TYPES.PAUSA_FIN:
        return { status: EMPLOYEE_STATUS.WORKING, lastRecord };
      case CHECK_TYPES.SALIDA:
        return { status: EMPLOYEE_STATUS.OFF, lastRecord };
      default:
        return { status: EMPLOYEE_STATUS.NOT_CHECKED_IN, lastRecord };
    }
  }

  /**
   * Obtener estado de todos los empleados (para vista CEO)
   */
  async getAllEmployeesStatus() {
    const today = new Date().toISOString().split('T')[0];
    
    try {
      // Obtener todos los empleados
      const users = await base44.auth.listUsers?.() || [];
      
      // Obtener todos los fichajes de hoy
      const allRecords = await base44.entities.TimeRecord.filter({ date: today });
      
      // Agrupar por usuario
      const statusMap = new Map();
      
      for (const user of users) {
        const userRecords = allRecords.filter(r => r.user_id === user.id);
        const lastRecord = userRecords.sort((a, b) => 
          new Date(b.timestamp) - new Date(a.timestamp)
        )[0];
        
        let status = EMPLOYEE_STATUS.NOT_CHECKED_IN;
        let entryTime = null;
        let totalBreakMinutes = 0;
        
        if (lastRecord) {
          const entryRecord = userRecords.find(r => r.check_type === CHECK_TYPES.ENTRADA);
          entryTime = entryRecord?.time;
          
          switch (lastRecord.check_type) {
            case CHECK_TYPES.ENTRADA:
            case CHECK_TYPES.PAUSA_FIN:
              status = EMPLOYEE_STATUS.WORKING;
              break;
            case CHECK_TYPES.PAUSA_INICIO:
              status = EMPLOYEE_STATUS.ON_BREAK;
              break;
            case CHECK_TYPES.SALIDA:
              status = EMPLOYEE_STATUS.OFF;
              break;
          }
          
          // Calcular tiempo de pausas
          const pauseStarts = userRecords.filter(r => r.check_type === CHECK_TYPES.PAUSA_INICIO);
          const pauseEnds = userRecords.filter(r => r.check_type === CHECK_TYPES.PAUSA_FIN);
          
          for (let i = 0; i < Math.min(pauseStarts.length, pauseEnds.length); i++) {
            const start = new Date(`${today}T${pauseStarts[i].time}`);
            const end = new Date(`${today}T${pauseEnds[i].time}`);
            totalBreakMinutes += (end - start) / 60000;
          }
        }
        
        // Calcular horas trabajadas
        let workedMinutes = 0;
        if (entryTime) {
          const [h, m] = entryTime.split(':').map(Number);
          const entryMinutes = h * 60 + m;
          const now = new Date();
          const nowMinutes = now.getHours() * 60 + now.getMinutes();
          workedMinutes = nowMinutes - entryMinutes - totalBreakMinutes;
        }
        
        statusMap.set(user.id, {
          userId: user.id,
          userName: user.full_name,
          email: user.email,
          role: user.role,
          status,
          entryTime,
          lastRecord,
          workedMinutes: Math.max(0, workedMinutes),
          workedHours: Math.round(Math.max(0, workedMinutes) / 60 * 100) / 100,
          breakMinutes: totalBreakMinutes,
          recordsCount: userRecords.length
        });
      }
      
      return Array.from(statusMap.values());
    } catch (error) {
      console.error('Error obteniendo estado de empleados:', error);
      return [];
    }
  }

  /**
   * Obtener historial de fichajes
   */
  async getHistory(userId, startDate, endDate) {
    try {
      const records = await base44.entities.TimeRecord.filter({
        user_id: userId
      });
      
      return records.filter(r => {
        const recordDate = new Date(r.date);
        return recordDate >= new Date(startDate) && recordDate <= new Date(endDate);
      }).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    } catch {
      return [];
    }
  }

  // ==================== ALERTAS ====================

  /**
   * Verificar alertas de fichaje
   */
  async checkAlerts(userId, expectedEntryTime = '09:00') {
    const alerts = [];
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentTime = now.toTimeString().slice(0, 5);
    
    const records = await this.getTodayRecords(userId);
    
    // Alerta: No ha fichado a su hora
    if (records.length === 0) {
      const [expectedH, expectedM] = expectedEntryTime.split(':').map(Number);
      const [currentH, currentM] = currentTime.split(':').map(Number);
      const expectedMinutes = expectedH * 60 + expectedM;
      const currentMinutes = currentH * 60 + currentM;
      
      if (currentMinutes > expectedMinutes + 15) {
        alerts.push({
          type: 'late_entry',
          severity: 'warning',
          message: `No ha fichado entrada. Hora esperada: ${expectedEntryTime}`,
          time: currentTime
        });
      }
    }
    
    // Alerta: Olvidó fichar salida (si es después de las 18:00 y sigue activo)
    const lastRecord = records[records.length - 1];
    if (lastRecord && 
        (lastRecord.check_type === CHECK_TYPES.ENTRADA || lastRecord.check_type === CHECK_TYPES.PAUSA_FIN)) {
      const [currentH] = currentTime.split(':').map(Number);
      if (currentH >= 20) {
        alerts.push({
          type: 'forgot_checkout',
          severity: 'error',
          message: 'Parece que olvidaste fichar la salida',
          time: currentTime
        });
      }
    }
    
    // Alerta: Horas extras
    const status = await this.getEmployeeStatus(userId);
    if (status.status === EMPLOYEE_STATUS.WORKING) {
      const entryRecord = records.find(r => r.check_type === CHECK_TYPES.ENTRADA);
      if (entryRecord) {
        const [entryH, entryM] = entryRecord.time.split(':').map(Number);
        const entryMinutes = entryH * 60 + entryM;
        const [currentH, currentM] = currentTime.split(':').map(Number);
        const currentMinutes = currentH * 60 + currentM;
        const workedMinutes = currentMinutes - entryMinutes;
        
        if (workedMinutes > 540) { // 9 horas
          alerts.push({
            type: 'overtime',
            severity: 'info',
            message: `Acumuladas ${Math.round(workedMinutes / 60)} horas. ¿Horas extra?`,
            time: currentTime
          });
        }
      }
    }
    
    return alerts;
  }

  // ==================== AUDITORÍA Y LEGAL (RD 2026) ====================

  async _logAuditEvent(event) {
    try {
      await base44.entities.AuditLog?.create?.({
        ...event,
        created_at: new Date().toISOString()
      });
    } catch {
      // Log silently fails if entity doesn't exist
      console.log('Audit event:', event);
    }
  }

  /**
   * Exportar registro para Inspección de Trabajo
   */
  async exportLegalReport(options = {}) {
    const { userId, startDate, endDate, format = 'json' } = options;
    
    try {
      let records;
      
      if (userId) {
        records = await this.getHistory(userId, startDate, endDate);
      } else {
        // Obtener todos los registros del período
        const allRecords = await base44.entities.TimeRecord.list('-timestamp', 1000);
        records = allRecords.filter(r => {
          const d = new Date(r.date);
          return d >= new Date(startDate) && d <= new Date(endDate);
        });
      }
      
      // Agrupar por empleado y día
      const grouped = {};
      for (const record of records) {
        const key = `${record.user_id}_${record.date}`;
        if (!grouped[key]) {
          grouped[key] = {
            employee_id: record.user_id,
            employee_name: record.user_name,
            date: record.date,
            records: [],
            entry_time: null,
            exit_time: null,
            total_hours: 0,
            break_time: 0,
            overtime: 0,
            is_remote: false,
            location: null
          };
        }
        grouped[key].records.push(record);
        
        if (record.check_type === CHECK_TYPES.ENTRADA && !grouped[key].entry_time) {
          grouped[key].entry_time = record.time;
          grouped[key].location = record.location_name;
          grouped[key].is_remote = record.is_remote;
        }
        
        if (record.check_type === CHECK_TYPES.SALIDA) {
          grouped[key].exit_time = record.time;
        }
      }
      
      // Calcular totales
      for (const key in grouped) {
        const day = grouped[key];
        if (day.entry_time && day.exit_time) {
          const [inH, inM] = day.entry_time.split(':').map(Number);
          const [outH, outM] = day.exit_time.split(':').map(Number);
          day.total_hours = Math.round(((outH * 60 + outM) - (inH * 60 + inM)) / 60 * 100) / 100;
          
          if (day.total_hours > 8) {
            day.overtime = Math.round((day.total_hours - 8) * 100) / 100;
          }
        }
      }
      
      const report = {
        generated_at: new Date().toISOString(),
        period: { start: startDate, end: endDate },
        employee_id: userId || 'ALL',
        total_records: records.length,
        compliance: {
          standard: 'Real Decreto 8/2019 (actualizado 2026)',
          storage_period: '4 años',
          digital_signature: true,
          audit_trail: true
        },
        daily_records: Object.values(grouped).sort((a, b) => 
          new Date(b.date) - new Date(a.date)
        )
      };
      
      return report;
    } catch (error) {
      console.error('Error generando reporte legal:', error);
      throw error;
    }
  }

  // ==================== LISTENERS ====================

  addListener(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  _notifyListeners(event) {
    this.listeners.forEach(l => l(event));
  }
}

export const timeTrackingService = new TimeTrackingService();
export default timeTrackingService;
