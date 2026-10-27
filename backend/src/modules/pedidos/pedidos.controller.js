// @ts-check
// Controladores de los pedidos.
//
// Después de cada cambio se avisa en tiempo real a los dispositivos del negocio.
// El aviso va aquí, y no en el servicio, porque en este punto la transacción ya se
// confirmó: nunca se avisa de un cambio que luego se deshizo.
import { obtenerSesion } from '../../middlewares/auth.js';
import * as eventos from './pedidos.eventos.js';
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
  // Un reenvío offline de un pedido que ya existía no genera un aviso nuevo.
  if (creado) eventos.avisarPedidoCreado(pedido);
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
  const pedido = await servicio.agregarItem(obtenerSesion(res), params.id, body);
  eventos.avisarPedidoActualizado(pedido);
  res.json(pedido);
}

/**
 * DELETE /pedidos/:id/items/:itemId
 * @type {import('express').RequestHandler}
 */
export async function quitarItem(_req, res) {
  const { params } = res.locals.entrada;
  const pedido = await servicio.quitarItem(obtenerSesion(res), params.id, params.itemId);
  eventos.avisarPedidoActualizado(pedido);
  res.json(pedido);
}

/**
 * PATCH /pedidos/:id/items/:itemId/cocina
 * @type {import('express').RequestHandler}
 */
export async function cambiarEstadoCocina(_req, res) {
  const { params, body } = res.locals.entrada;
  const pedido = await servicio.cambiarEstadoCocina(
    obtenerSesion(res),
    params.id,
    params.itemId,
    body.estadoCocina,
  );
  eventos.avisarEstadoCocina(pedido, params.itemId);
  res.json(pedido);
}

/**
 * POST /pedidos/:id/enviar-cocina
 * @type {import('express').RequestHandler}
 */
export async function enviarACocina(_req, res) {
  const pedido = await servicio.enviarACocina(obtenerSesion(res), res.locals.entrada.params.id);
  eventos.avisarEnviadoACocina(pedido);
  res.json(pedido);
}

/**
 * POST /pedidos/:id/dividir → 201 con la cuenta original y la nueva.
 * @type {import('express').RequestHandler}
 */
export async function dividir(_req, res) {
  const { params, body } = res.locals.entrada;
  const { original, nuevo } = await servicio.dividirPedido(obtenerSesion(res), params.id, body);
  eventos.avisarPedidoActualizado(original);
  eventos.avisarPedidoCreado(nuevo);
  res.status(201).json({ original, nuevo });
}

/**
 * POST /pedidos/:id/cobrar
 * @type {import('express').RequestHandler}
 */
export async function cobrar(_req, res) {
  const { params, body } = res.locals.entrada;
  const resultado = await servicio.cobrarPedido(obtenerSesion(res), params.id, body);
  eventos.avisarPedidoPagado(resultado.pedido);
  res.json(resultado);
}

/**
 * POST /pedidos/:id/anular
 * @type {import('express').RequestHandler}
 */
export async function anular(_req, res) {
  const { params, body } = res.locals.entrada;
  const pedido = await servicio.anularPedido(obtenerSesion(res), params.id, body);
  eventos.avisarPedidoAnulado(pedido);
  res.json(pedido);
}
