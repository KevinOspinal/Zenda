// @ts-check
// Controladores del inventario.
import { obtenerSesion } from '../../middlewares/auth.js';
import * as servicio from './inventario.service.js';

/**
 * GET /inventario
 * @type {import('express').RequestHandler}
 */
export async function listar(_req, res) {
  res.json(await servicio.listarInventario(obtenerSesion(res)));
}

/**
 * GET /inventario/:productoId/movimientos
 * @type {import('express').RequestHandler}
 */
export async function movimientos(_req, res) {
  res.json(
    await servicio.listarMovimientos(obtenerSesion(res), res.locals.entrada.params.productoId),
  );
}

/**
 * POST /inventario/movimientos → 201
 * @type {import('express').RequestHandler}
 */
export async function registrar(_req, res) {
  res
    .status(201)
    .json(await servicio.registrarMovimiento(obtenerSesion(res), res.locals.entrada.body));
}
