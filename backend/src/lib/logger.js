// @ts-check
import pino from 'pino';
import { env } from '../config/env.js';

/** Logger estructurado (JSON) de la aplicación. */
export const logger = pino({
  level: env.LOG_LEVEL,
  // Nunca registrar credenciales ni tokens.
  redact: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.client_secret'],
});
