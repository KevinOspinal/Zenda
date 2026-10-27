// @ts-check
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

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
  if (err instanceof AppError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }

  // JSON mal formado u otros errores de body-parser.
  if (err?.type === 'entity.parse.failed') {
    res
      .status(400)
      .json({ error: { code: 'INVALID_JSON', message: 'El cuerpo no es JSON válido' } });
    return;
  }

  logger.error({ err }, 'Error no controlado');
  res
    .status(500)
    .json({ error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' } });
}
