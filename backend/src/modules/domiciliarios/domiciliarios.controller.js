// @ts-check
// Controladores de los domiciliarios.
import { obtenerSesion } from '../../middlewares/auth.js';
import * as servicio from './domiciliarios.service.js';

/**
 * GET /domiciliarios?activos=true
 * @type {import('express').RequestHandler}
 */
export async function listar(_req, res) {
  res.json(await servicio.listarDomiciliarios(obtenerSesion(res), res.locals.entrada.query));
}

/**
 * POST /domiciliarios → 201
 * @type {import('express').RequestHandler}
 */
export async function crear(_req, res) {
  const domiciliario = await servicio.crearDomiciliario(
    obtenerSesion(res),
    res.locals.entrada.body,
  );
  res.status(201).json(domiciliario);
}

/**
 * PATCH /domiciliarios/:id
 * @type {import('express').RequestHandler}
 */
export async function actualizar(_req, res) {
  const { params, body } = res.locals.entrada;
  res.json(await servicio.actualizarDomiciliario(obtenerSesion(res), params.id, body));
}
