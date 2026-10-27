// @ts-check
// Controladores de los clientes.
import { obtenerSesion } from '../../middlewares/auth.js';
import * as servicio from './clientes.service.js';

/**
 * GET /clientes?buscar=...
 * @type {import('express').RequestHandler}
 */
export async function listarClientes(_req, res) {
  res.json(await servicio.listarClientes(obtenerSesion(res), res.locals.entrada.query));
}

/**
 * GET /clientes/:id
 * @type {import('express').RequestHandler}
 */
export async function obtenerCliente(_req, res) {
  res.json(await servicio.obtenerCliente(obtenerSesion(res), res.locals.entrada.params.id));
}

/**
 * POST /clientes → 201
 * @type {import('express').RequestHandler}
 */
export async function crearCliente(_req, res) {
  res.status(201).json(await servicio.crearCliente(obtenerSesion(res), res.locals.entrada.body));
}

/**
 * PATCH /clientes/:id
 * @type {import('express').RequestHandler}
 */
export async function actualizarCliente(_req, res) {
  const { params, body } = res.locals.entrada;
  res.json(await servicio.actualizarCliente(obtenerSesion(res), params.id, body));
}
