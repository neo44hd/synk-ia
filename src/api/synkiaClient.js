/**
 * SYNK-IA — Cliente de Datos Local (Compatibilidad)
 * © 2026 David Roldán / Chicken Palace Ibiza S.L.
 *
 * Este archivo REEMPLAZA la capa de compatibilidad base44Client.
 * Proporciona el mismo objeto `synkia` que antes usaba base44Client,
 * ahora delegando a los servicios internos reales.
 *
 * ⚠️ Después de completar sa-4b, eliminar este archivo y actualizar
 *    todos los imports para usar directamente los servicios.
 */

import { dataService } from '../services/dataService';
import { authService } from '../services/authService';
import { functionsService } from '../services/functionsService';
import { integrationsService } from '../services/integrationsService';

const synkia = {
  entities:  dataService,
  auth:      authService,
  functions: functionsService,
  integrations: integrationsService,
};

export { synkia };
export default synkia;