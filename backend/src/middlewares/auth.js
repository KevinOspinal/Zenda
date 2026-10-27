// @ts-check
// Middlewares de autenticación (¿quién es?) y autorización (¿qué puede hacer?).
//
// Los permisos se validan siempre en el backend: nunca se confía en que el frontend
// oculte un botón.
import jwt from 'jsonwebtoken';
import { AppError } from '../lib/errors.js';
import { verificarTokenAcceso } from '../lib/tokens.js';

/** @typedef {import('../lib/tokens.js').DatosSesion} DatosSesion */
/** @typedef {import('../lib/tokens.js').Rol} Rol */

/**
 * Exige un token de acceso válido en el encabezado `Authorization: Bearer <token>`.
 * Si es válido, deja los datos del usuario en `res.locals.sesion`.
 * @type {import('express').RequestHandler}
 */
export function autenticar(req, res, next) {
  // 1. Leer el token del encabezado.
  const [tipo, token] = (req.headers.authorization ?? '').split(' ');
  if (tipo !== 'Bearer' || !token) {
    next(new AppError(401, 'NO_AUTENTICADO', 'Debe iniciar sesión'));
    return;
  }

  // 2. Verificar firma, vencimiento y contenido.
  try {
    res.locals.sesion = verificarTokenAcceso(token);
    next();
  } catch (error) {
    // Un token vencido se distingue para que la app sepa que debe usar el refresh token.
    if (error instanceof jwt.TokenExpiredError) {
      next(new AppError(401, 'TOKEN_EXPIRADO', 'La sesión expiró'));
      return;
    }
    next(new AppError(401, 'TOKEN_INVALIDO', 'Token de acceso inválido'));
  }
}

/**
 * Permite el paso solo a los roles indicados. Debe ir después de `autenticar`.
 * @param {...Rol} roles
 * @returns {import('express').RequestHandler}
 *
 * @example
 * router.put('/productos/:id', autenticar, permitirRoles('dueno', 'administrador'), ...);
 */
export function permitirRoles(...roles) {
  return (_req, res, next) => {
    const sesion = obtenerSesion(res);
    if (!roles.includes(sesion.rol)) {
      next(new AppError(403, 'SIN_PERMISO', 'No tiene permiso para esta acción'));
      return;
    }
    next();
  };
}

/**
 * Devuelve los datos del usuario autenticado. Usar solo en rutas protegidas con `autenticar`.
 * @param {import('express').Response} res
 * @returns {DatosSesion}
 */
export function obtenerSesion(res) {
  const sesion = res.locals.sesion;
  if (!sesion) {
    // Si pasa esto, a la ruta le falta el middleware `autenticar`: es un error de programación.
    throw new Error('Ruta protegida sin el middleware autenticar');
  }
  return sesion;
}
