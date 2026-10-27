// @ts-check
// Controladores de autenticación: reciben la petición ya validada, llaman al servicio
// y arman la respuesta HTTP. No contienen lógica de negocio.
import { obtenerSesion } from '../../middlewares/auth.js';
import * as servicioAuth from './auth.service.js';

/**
 * POST /auth/login → 200 con los tokens y el usuario.
 * @type {import('express').RequestHandler}
 */
export async function login(_req, res) {
  const sesion = await servicioAuth.iniciarSesion(res.locals.entrada.body);
  res.json(sesion);
}

/**
 * POST /auth/refresh → 200 con tokens nuevos.
 * @type {import('express').RequestHandler}
 */
export async function refresh(_req, res) {
  const sesion = await servicioAuth.renovarSesion(res.locals.entrada.body.refreshToken);
  res.json(sesion);
}

/**
 * POST /auth/logout → 204 sin contenido.
 * @type {import('express').RequestHandler}
 */
export async function logout(_req, res) {
  await servicioAuth.cerrarSesion(res.locals.entrada.body.refreshToken);
  res.status(204).end();
}

/**
 * GET /auth/yo → 200 con el usuario autenticado y su negocio.
 * @type {import('express').RequestHandler}
 */
export async function perfil(_req, res) {
  res.json(await servicioAuth.obtenerPerfil(obtenerSesion(res)));
}
