// @ts-check
// Middleware de validación: revisa la entrada de la petición con esquemas Zod
// antes de que llegue al controlador. Si algo no cumple, responde 400.
import { AppError } from '../lib/errors.js';

/**
 * @typedef {object} EsquemasPeticion
 * @property {import('zod').ZodType} [body] Esquema del cuerpo (JSON).
 * @property {import('zod').ZodType} [params] Esquema de los parámetros de la ruta (`/mesas/:id`).
 * @property {import('zod').ZodType} [query] Esquema de los parámetros de búsqueda (`?pagina=2`).
 */

/**
 * Crea un middleware que valida la petición con los esquemas indicados.
 *
 * Los datos validados quedan en `res.locals.entrada` (ya convertidos y sin campos de más).
 * El controlador debe leer de ahí, no de `req.body`.
 *
 * @param {EsquemasPeticion} esquemas
 * @returns {import('express').RequestHandler}
 *
 * @example
 * router.post('/login', validar({ body: esquemaLogin }), controlador.login);
 */
export function validar(esquemas) {
  return (req, res, next) => {
    /** @type {Record<string, unknown>} */
    const entrada = {};

    for (const parte of /** @type {const} */ (['body', 'params', 'query'])) {
      const esquema = esquemas[parte];
      if (!esquema) continue;

      const resultado = esquema.safeParse(req[parte] ?? {});
      if (!resultado.success) {
        // Mensaje legible con los campos inválidos, sin mostrar los valores enviados.
        const detalle = resultado.error.issues
          .map((issue) => `${issue.path.join('.') || parte}: ${issue.message}`)
          .join('; ');
        next(new AppError(400, 'VALIDATION_ERROR', `Datos inválidos. ${detalle}`));
        return;
      }
      entrada[parte] = resultado.data;
    }

    res.locals.entrada = entrada;
    next();
  };
}
