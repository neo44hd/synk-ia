/**
 * SYNK-IA - Cliente de Datos Local (Compatibilidad)
 * © 2024 David Roldan - Chicken Palace Ibiza
 * Futuro: SYNK-IA LABS
 * 
 * Este archivo proporciona compatibilidad con el código existente
 * que usaba Base44 SDK, ahora usando almacenamiento local.
 */

import { dataService } from '../services/dataService';
import { authService } from '../services/authService';
import { functionsService } from '../services/functionsService';
import { integrationsService } from '../services/integrationsService';

/**
 * Objeto de compatibilidad que simula la estructura de Base44 SDK
 */
export const base44 = {
  entities: dataService,
  auth: authService,
  functions: functionsService,
  integrations: integrationsService
};

export default base44;
