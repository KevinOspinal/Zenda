// @ts-check
// Punto de entrada del API: arranca el servidor HTTP y lo cierra de forma ordenada.
import { createServer } from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';

const server = createServer(createApp());

// Empieza a recibir peticiones en el puerto configurado.
server.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'API escuchando');
});

/**
 * Cierra el servidor de forma ordenada al recibir una señal del sistema.
 * @param {NodeJS.Signals} signal
 */
function cerrarServidor(signal) {
  logger.info({ signal }, 'Cerrando servidor');
  // Deja de aceptar conexiones nuevas y espera a que terminen las que están en curso.
  server.close((err) => {
    if (err) {
      logger.error({ err }, 'Error al cerrar el servidor');
      process.exit(1);
    }
    process.exit(0);
  });
}

// SIGTERM lo envía Docker al detener el contenedor; SIGINT es Ctrl+C en la terminal.
process.on('SIGTERM', cerrarServidor);
process.on('SIGINT', cerrarServidor);
