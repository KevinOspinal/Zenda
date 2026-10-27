// @ts-check
// Límite de peticiones por IP para los endpoints públicos sensibles (login, renovar
// sesión, registrar negocio). Frena a quien prueba muchas contraseñas o crea negocios
// en masa. Al pasarse, responde 429 con el formato de error uniforme.
//
// Los contadores viven en Redis: así el límite se respeta aunque haya varios procesos
// del API, y no se reinicia al reiniciar el servidor.
import { rateLimit } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { env } from '../config/env.js';
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { redis } from '../lib/redis.js';

const UN_MINUTO = 60 * 1000;
const UNA_HORA = 60 * UN_MINUTO;

/**
 * Crea un limitador.
 * @param {object} opciones
 * @param {string} opciones.nombre Identifica el contador en Redis, por ejemplo "login".
 * @param {number} opciones.maximo Peticiones permitidas por IP en la ventana.
 * @param {number} opciones.ventanaMs Duración de la ventana en milisegundos.
 * @returns {import('express').RequestHandler}
 */
export function crearLimitador({ nombre, maximo, ventanaMs }) {
  return rateLimit({
    windowMs: ventanaMs,
    limit: maximo,
    // Encabezados estándar RateLimit y Retry-After para que la app sepa cuánto esperar.
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    store: new RedisStore({
      prefix: `zenda:limite:${nombre}:`,
      sendCommand: (comando, ...argumentos) =>
        /** @type {Promise<any>} */ (redis.call(comando, ...argumentos)),
    }),
    // Si Redis está caído, se deja pasar la petición en lugar de bloquear el login
    // de todo el restaurante. Se registra para enterarse.
    passOnStoreError: true,
    handler: (_req, _res, next, opciones) => {
      const segundos = Math.ceil(opciones.windowMs / 1000);
      logger.warn({ limitador: nombre }, 'Límite de peticiones alcanzado');
      next(
        new AppError(
          429,
          'DEMASIADAS_SOLICITUDES',
          `Demasiados intentos. Espere hasta ${segundos} segundos e intente de nuevo`,
        ),
      );
    },
  });
}

/** POST /auth/login: frena a quien prueba contraseñas. */
export const limiteLogin = crearLimitador({
  nombre: 'login',
  maximo: env.LIMITE_LOGIN_POR_MINUTO,
  ventanaMs: UN_MINUTO,
});

/** POST /auth/refresh: las apps renuevan seguido, por eso el límite es más alto. */
export const limiteRefresh = crearLimitador({
  nombre: 'refresh',
  maximo: env.LIMITE_REFRESH_POR_MINUTO,
  ventanaMs: UN_MINUTO,
});

/** POST /negocios/registro: frena la creación de negocios en masa. */
export const limiteRegistro = crearLimitador({
  nombre: 'registro',
  maximo: env.LIMITE_REGISTRO_POR_HORA,
  ventanaMs: UNA_HORA,
});
