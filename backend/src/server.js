// @ts-check
// Punto de entrada del API: arranca el servidor HTTP con Socket.IO y lo cierra de forma ordenada.
import { createServer } from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { prisma } from './lib/db.js';
import { logger } from './lib/logger.js';
import { registrarServidorSocket } from './sockets/eventos.js';
import { crearServidorSocket } from './sockets/servidor.js';

const server = createServer(createApp());

// Tiempo real: Socket.IO comparte el puerto del API.
const io = crearServidorSocket(server);
registrarServidorSocket(io);

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
  // Cierra las conexiones de Socket.IO y deja de aceptar peticiones nuevas; espera a que
  // terminen las que están en curso y libera las conexiones a la base de datos.
  io.close(async (err) => {
    await prisma.$disconnect();
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
