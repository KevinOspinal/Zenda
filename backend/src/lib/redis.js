// @ts-check
// Cliente de Redis compartido por toda la app (límite de peticiones y, en la Fase 2,
// la cola de facturación). Es opcional: sin REDIS_URL vale null y los límites de
// peticiones se guardan en memoria (ver middlewares/limitePeticiones.js).
import { Redis } from 'ioredis';
import { env } from '../config/env.js';
import { logger } from './logger.js';

/**
 * Instancia única de Redis, o null si no está configurado.
 * - lazyConnect: se conecta con el primer comando, no al importar el archivo.
 * - maxRetriesPerRequest: si Redis está caído, un comando falla rápido en lugar de
 *   quedarse esperando; ioredis sigue intentando reconectar en segundo plano.
 * @type {Redis | null}
 */
export const redis = env.REDIS_URL
  ? new Redis(env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
    })
  : null;

// Sin este manejador, un Redis caído generaría errores no controlados en el proceso.
redis?.on('error', (error) => {
  logger.warn({ err: error }, 'Problema de conexión con Redis');
});
