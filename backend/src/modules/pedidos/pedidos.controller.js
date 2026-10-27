// @ts-check
// Controladores de los pedidos.
import { obtenerSesion } from '../../middlewares/auth.js';
import * as servicio from './pedidos.service.js';

/**
 * POST /pedidos → 201 si se creó; 200 si ya existía (mismo uuidOffline).
 * @type {import('express').RequestHandler}
 */
export async function crear(_req, res) {
  const { pedido, creado } = await servicio.crearPedido(
    obtenerSesion(res),
    res.locals.entrada.body,
  );
  res.status(creado ? 201 : 200).json(pedido);
}

/**
 * GET /pedidos
 * @type {import('express').RequestHandler}
 */
export async function listar(_req, res) {
  res.json(await servicio.listarPedidos(obtenerSesion(res), res.locals.entrada.query));
}

/**
 * GET /pedidos/:id
 * @type {import('express').RequestHandler}
 */
export async function obtener(_req, res) {
  res.json(await servicio.obtenerPedido(obtenerSesion(res), res.locals.entrada.params.id));
}

/**
 * POST /pedidos/:id/items
 * @type {import('express').RequestHandler}
 */
export async function agregarItem(_req, res) {
  const { params, body } = res.locals.entrada;
  res.json(await servicio.agregarItem(obtenerSesion(res), params.id, body));
}

/**
 * DELETE /pedidos/:id/items/:itemId
 * @type {import('express').RequestHandler}
 */
export async function quitarItem(_req, res) {
  const { params } = res.locals.entrada;
  res.json(await servicio.quitarItem(obtenerSesion(res), params.id, params.itemId));
}

/**
 * PATCH /pedidos/:id/items/:itemId/cocina
 * @type {import('express').RequestHandler}
 */
export async function cambiarEstadoCocina(_req, res) {
  const { params, body } = res.locals.entrada;
  res.json(
    await servicio.cambiarEstadoCocina(
      obtenerSesion(res),
      params.id,
      params.itemId,
      body.estadoCocina,
    ),
  );
}

/**
 * POST /pedidos/:id/enviar-cocina
 * @type {import('express').RequestHandler}
 */
export async function enviarACocina(_req, res) {
  res.json(await servicio.enviarACocina(obtenerSesion(res), res.locals.entrada.params.id));
}

/**
 * POST /pedidos/:id/cobrar
 * @type {import('express').RequestHandler}
 */
export async function cobrar(_req, res) {
  const { params, body } = res.locals.entrada;
  res.json(await servicio.cobrarPedido(obtenerSesion(res), params.id, body));
}

/**
 * POST /pedidos/:id/anular
 * @type {import('express').RequestHandler}
 */
export async function anular(_req, res) {
  const { params, body } = res.locals.entrada;
  res.json(await servicio.anularPedido(obtenerSesion(res), params.id, body));
}
