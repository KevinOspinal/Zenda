// @ts-check
// Controladores de los domiciliarios.
import { obtenerSesion } from '../../middlewares/auth.js';
import * as eventosPedidos from '../pedidos/pedidos.eventos.js';
import { liquidarDomiciliario } from '../pedidos/pedidos.service.js';
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

/**
 * POST /domiciliarios/:id/acceso → 201
 * @type {import('express').RequestHandler}
 */
export async function darAcceso(_req, res) {
  const { params, body } = res.locals.entrada;
  res.status(201).json(await servicio.darAcceso(obtenerSesion(res), params.id, body));
}

/**
 * DELETE /domiciliarios/:id/acceso
 * @type {import('express').RequestHandler}
 */
export async function quitarAcceso(_req, res) {
  res.json(await servicio.quitarAcceso(obtenerSesion(res), res.locals.entrada.params.id));
}

/**
 * POST /domiciliarios/:id/liquidar: cada domicilio queda cobrado y se avisa en vivo.
 * @type {import('express').RequestHandler}
 */
export async function liquidar(_req, res) {
  const { params, body } = res.locals.entrada;
  const resultado = await liquidarDomiciliario(obtenerSesion(res), params.id, body);
  for (const pedido of resultado.pedidos) {
    eventosPedidos.avisarPedidoPagado(/** @type {any} */ (pedido));
  }
  res.json(resultado);
}
