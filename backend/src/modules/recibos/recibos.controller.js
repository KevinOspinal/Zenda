// @ts-check
// Controladores de los recibos de venta.
import { obtenerSesion } from '../../middlewares/auth.js';
import * as servicio from './recibos.service.js';

/**
 * GET /recibos?numero=7
 * @type {import('express').RequestHandler}
 */
export async function listar(_req, res) {
  res.json(await servicio.listarRecibos(obtenerSesion(res), res.locals.entrada.query));
}
