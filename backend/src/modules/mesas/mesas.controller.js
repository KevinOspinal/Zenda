// @ts-check
// Controladores de las mesas.
import { obtenerSesion } from '../../middlewares/auth.js';
import * as servicio from './mesas.service.js';

/**
 * GET /mesas
 * @type {import('express').RequestHandler}
 */
export async function listarMesas(_req, res) {
  res.json(await servicio.listarMesas(obtenerSesion(res)));
}

/**
 * GET /mesas/:id
 * @type {import('express').RequestHandler}
 */
export async function obtenerMesa(_req, res) {
  res.json(await servicio.obtenerMesa(obtenerSesion(res), res.locals.entrada.params.id));
}

/**
 * POST /mesas → 201
 * @type {import('express').RequestHandler}
 */
export async function crearMesa(_req, res) {
  res.status(201).json(await servicio.crearMesa(obtenerSesion(res), res.locals.entrada.body));
}

/**
 * PATCH /mesas/:id
 * @type {import('express').RequestHandler}
 */
export async function actualizarMesa(_req, res) {
  const { params, body } = res.locals.entrada;
  res.json(await servicio.actualizarMesa(obtenerSesion(res), params.id, body));
}

/**
 * DELETE /mesas/:id → 204
 * @type {import('express').RequestHandler}
 */
export async function eliminarMesa(_req, res) {
  await servicio.eliminarMesa(obtenerSesion(res), res.locals.entrada.params.id);
  res.status(204).end();
}
