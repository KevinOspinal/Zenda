// @ts-check
// Middlewares finales: ruta no encontrada (404) y conversión de errores al formato uniforme.
import { Prisma } from '@prisma/client';
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

/**
 * Errores conocidos de la base de datos que se traducen a una respuesta clara.
 * Los códigos son de Prisma: https://www.prisma.io/docs/orm/reference/error-reference
 */
const ERRORES_DE_BASE = Object.freeze({
  // Violación de unicidad, por ejemplo dos mesas con el mismo nombre en un negocio.
  P2002: new AppError(409, 'YA_EXISTE', 'Ya existe un registro con esos datos'),
  // Llave foránea: se intenta borrar algo que otros registros usan (una mesa con pedidos).
  P2003: new AppError(409, 'EN_USO', 'No se puede eliminar porque otros registros lo usan'),
  // El registro a actualizar o borrar no existe (o es de otro negocio, que RLS oculta).
  P2025: new AppError(404, 'NO_ENCONTRADO', 'El registro no existe'),
});

/**
 * Responde 404 a cualquier ruta no registrada.
 * @type {import('express').RequestHandler}
 */
export function notFound(req, _res, next) {
  next(new AppError(404, 'NOT_FOUND', `Ruta no encontrada: ${req.method} ${req.path}`));
}

/**
 * Convierte cualquier error al formato uniforme `{ error: { code, message } }`.
 * Los errores no previstos se registran y se responden como 500 genérico.
 * @type {import('express').ErrorRequestHandler}
 */
export function errorHandler(err, _req, res, _next) {
  // 1. Errores propios de la app: ya traen código y mensaje seguros.
  if (err instanceof AppError) {
    responderError(res, err);
    return;
  }

  // 2. Errores conocidos de la base de datos.
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code in ERRORES_DE_BASE) {
    responderError(res, ERRORES_DE_BASE[/** @type {keyof typeof ERRORES_DE_BASE} */ (err.code)]);
    return;
  }

  // 3. JSON mal formado u otros errores de body-parser.
  if (err?.type === 'entity.parse.failed') {
    responderError(res, new AppError(400, 'INVALID_JSON', 'El cuerpo no es JSON válido'));
    return;
  }

  // 4. Cualquier otro error: se registra completo, pero al cliente no se le muestran detalles.
  logger.error({ err }, 'Error no controlado');
  responderError(res, new AppError(500, 'INTERNAL_ERROR', 'Error interno del servidor'));
}

/**
 * @param {import('express').Response} res
 * @param {AppError} error
 */
function responderError(res, error) {
  res.status(error.status).json({ error: { code: error.code, message: error.message } });
}
