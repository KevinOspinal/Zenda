// @ts-check
// Servidor de Socket.IO: autentica cada conexión y la une a la sala de su negocio.
//
// Cómo se conecta un cliente (por ejemplo, la app web):
//   io('http://localhost:3000', { auth: { token: '<tokenAcceso>' } })
// También se acepta el encabezado `Authorization: Bearer <tokenAcceso>`, útil en Postman.
//
// Si el token es inválido, la conexión se rechaza con el error `connect_error` y el
// mensaje NO_AUTENTICADO, TOKEN_INVALIDO o TOKEN_EXPIRADO (los mismos códigos del API).
// Cuando el token vence, el servidor envía `sesion:expirada` y desconecta: la app debe
// renovar el token con /auth/refresh y volver a conectarse.
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { verificarTokenAcceso } from '../lib/tokens.js';
import { EVENTOS, salaDeNegocio } from './eventos.js';

/** @typedef {import('../lib/tokens.js').DatosSesion} DatosSesion */

/**
 * Crea el servidor de Socket.IO sobre el servidor HTTP del API.
 * @param {import('node:http').Server} servidorHttp
 * @returns {Server}
 */
export function crearServidorSocket(servidorHttp) {
  const io = new Server(servidorHttp, {
    // Mismos orígenes permitidos que el API REST.
    cors: { origin: env.CORS_ORIGENES },
  });

  // 1. Autenticar antes de aceptar la conexión.
  io.use((socket, next) => {
    const token = leerToken(socket.handshake);
    if (!token) {
      next(new Error('NO_AUTENTICADO'));
      return;
    }

    try {
      socket.data.sesion = verificarTokenAcceso(token);
      next();
    } catch (error) {
      next(new Error(error instanceof jwt.TokenExpiredError ? 'TOKEN_EXPIRADO' : 'TOKEN_INVALIDO'));
    }
  });

  // 2. Conexión aceptada: unir a la sala del negocio y programar la desconexión al vencer el token.
  io.on('connection', (socket) => {
    /** @type {DatosSesion} */
    const sesion = socket.data.sesion;
    socket.join(salaDeNegocio(sesion.tenantId));
    logger.debug({ tenantId: sesion.tenantId, rol: sesion.rol }, 'Dispositivo conectado');

    const temporizador = programarExpiracion(socket, sesion);
    socket.on('disconnect', () => clearTimeout(temporizador));
  });

  return io;
}

/**
 * Lee el token del handshake: primero de `auth.token` y si no, del encabezado Authorization.
 * @param {import('socket.io').Socket['handshake']} handshake
 * @returns {string | null}
 */
function leerToken(handshake) {
  if (typeof handshake.auth?.token === 'string') return handshake.auth.token;

  const [tipo, token] = (handshake.headers.authorization ?? '').split(' ');
  return tipo === 'Bearer' && token ? token : null;
}

/**
 * Desconecta el dispositivo cuando vence su token, avisándole antes con `sesion:expirada`.
 * Así nadie sigue escuchando eventos con una sesión vencida o revocada.
 * @param {import('socket.io').Socket} socket
 * @param {DatosSesion} sesion
 */
function programarExpiracion(socket, sesion) {
  const milisegundosRestantes = (sesion.expiraEn ?? 0) * 1000 - Date.now();

  return setTimeout(
    () => {
      socket.emit(EVENTOS.SESION_EXPIRADA, { mensaje: 'La sesión expiró; renueve el token' });
      socket.disconnect(true);
    },
    Math.max(milisegundosRestantes, 0),
  );
}
