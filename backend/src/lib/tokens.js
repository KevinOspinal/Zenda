// @ts-check
// Tokens de sesión.
//
// - Token de acceso: JWT firmado, de vida corta (15 minutos). Va en cada petición.
// - Refresh token: valor aleatorio de vida larga (30 días). Solo sirve para pedir un token
//   de acceso nuevo. En la base se guarda su hash, nunca el valor, para poder revocarlo.
import { createHash, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../config/env.js';

/** @typedef {'dueno' | 'administrador' | 'cajero' | 'mesero' | 'cocina' | 'domiciliario'} Rol */

/**
 * Datos del usuario autenticado que viajan dentro del token de acceso.
 * @typedef {object} DatosSesion
 * @property {string} usuarioId
 * @property {string} tenantId Negocio al que pertenece el usuario.
 * @property {Rol} rol
 * @property {number} [expiraEn] Momento en que vence el token (segundos desde 1970). Solo al verificarlo.
 */

const esquemaContenidoToken = z.object({
  sub: z.uuid(),
  tenantId: z.uuid(),
  rol: z.enum(['dueno', 'administrador', 'cajero', 'mesero', 'cocina', 'domiciliario']),
  exp: z.number(),
});

/**
 * Firma un token de acceso para el usuario.
 * @param {DatosSesion} datos
 * @returns {string} JWT firmado con HS256.
 */
export function firmarTokenAcceso({ usuarioId, tenantId, rol }) {
  return jwt.sign({ tenantId, rol }, env.JWT_SECRET, {
    algorithm: 'HS256',
    subject: usuarioId,
    expiresIn: env.JWT_MINUTOS * 60,
  });
}

/**
 * Verifica un token de acceso y devuelve sus datos.
 * @param {string} token
 * @returns {DatosSesion}
 * @throws {jwt.TokenExpiredError} Si el token venció.
 * @throws {Error} Si la firma o el contenido no son válidos.
 */
export function verificarTokenAcceso(token) {
  // Se fija el algoritmo para que nadie pueda enviar un token con "alg: none".
  const contenido = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
  const { sub, tenantId, rol, exp } = esquemaContenidoToken.parse(contenido);
  return { usuarioId: sub, tenantId, rol, expiraEn: exp };
}

/**
 * Crea un refresh token nuevo.
 *
 * El formato es `<tenantId>.<secreto>`: el negocio va al inicio porque, por Row-Level
 * Security, hay que saber el negocio antes de poder buscar la sesión en la base.
 *
 * @param {string} tenantId
 * @returns {{ token: string, tokenHash: string }} El token para el cliente y el hash para la base.
 */
export function generarRefreshToken(tenantId) {
  const secreto = randomBytes(32).toString('base64url');
  const token = `${tenantId}.${secreto}`;
  return { token, tokenHash: hashearRefreshToken(token) };
}

/**
 * Calcula el hash que se guarda en `sesiones_usuario.token_hash`.
 * SHA-256 es suficiente aquí: el token ya es aleatorio y largo, no una contraseña.
 * @param {string} token
 * @returns {string}
 */
export function hashearRefreshToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Extrae el negocio de un refresh token.
 * @param {string} token
 * @returns {string | null} UUID del negocio, o null si el formato no es válido.
 */
export function negocioDelRefreshToken(token) {
  const [tenantId, secreto] = token.split('.');
  if (!secreto || !z.uuid().safeParse(tenantId).success) {
    return null;
  }
  return tenantId;
}
