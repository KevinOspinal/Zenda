// @ts-check
// Estado de salud del API: comprueba que PostgreSQL y Redis respondan.
//
// Lo usa GET /health. Si algo está caído responde 503, para que el servidor (Docker,
// el balanceador) sepa que este proceso no puede atender y lo reinicie o lo saque.
import { prisma } from './db.js';
import { redis } from './redis.js';

/** Tiempo máximo de cada comprobación: un servicio colgado cuenta como caído. */
const ESPERA_MAXIMA_MS = 2000;

/**
 * @typedef {object} EstadoSalud
 * @property {'ok' | 'error'} status
 * @property {{ baseDeDatos: 'ok' | 'caido', redis: 'ok' | 'caido' }} servicios
 */

/**
 * Comprueba los servicios de los que depende el API, en paralelo.
 * @returns {Promise<EstadoSalud>}
 */
export async function revisarSalud() {
  const [baseDeDatos, cache] = await Promise.all([
    comprobar(() => prisma.$queryRaw`SELECT 1`),
    comprobar(() => redis.ping()),
  ]);

  const todoBien = baseDeDatos === 'ok' && cache === 'ok';
  return { status: todoBien ? 'ok' : 'error', servicios: { baseDeDatos, redis: cache } };
}

/**
 * Ejecuta una comprobación con tiempo máximo.
 * @param {() => Promise<unknown>} prueba
 * @returns {Promise<'ok' | 'caido'>}
 */
async function comprobar(prueba) {
  /** @type {NodeJS.Timeout | undefined} */
  let temporizador;
  const limite = new Promise((_, reject) => {
    temporizador = setTimeout(() => reject(new Error('Tiempo agotado')), ESPERA_MAXIMA_MS);
  });

  try {
    await Promise.race([prueba(), limite]);
    return 'ok';
  } catch {
    return 'caido';
  } finally {
    clearTimeout(temporizador);
  }
}
