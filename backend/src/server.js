// @ts-check
import { createServer } from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';

const server = createServer(createApp());

server.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'API escuchando');
});

/**
 * Cierra el servidor de forma ordenada al recibir una señal del sistema.
 * @param {NodeJS.Signals} signal
 */
function shutdown(signal) {
  logger.info({ signal }, 'Cerrando servidor');
  server.close((err) => {
    if (err) {
      logger.error({ err }, 'Error al cerrar el servidor');
      process.exit(1);
    }
    process.exit(0);
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
