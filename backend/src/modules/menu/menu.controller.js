// @ts-check
// Controladores del menú: leen la entrada validada, llaman al servicio y responden.
import { obtenerSesion } from '../../middlewares/auth.js';
import * as servicio from './menu.service.js';

/**
 * GET /categorias
 * @type {import('express').RequestHandler}
 */
export async function listarCategorias(_req, res) {
  res.json(await servicio.listarCategorias(obtenerSesion(res)));
}

/**
 * POST /categorias → 201
 * @type {import('express').RequestHandler}
 */
export async function crearCategoria(_req, res) {
  const categoria = await servicio.crearCategoria(obtenerSesion(res), res.locals.entrada.body);
  res.status(201).json(categoria);
}

/**
 * PATCH /categorias/:id
 * @type {import('express').RequestHandler}
 */
export async function actualizarCategoria(_req, res) {
  const { params, body } = res.locals.entrada;
  res.json(await servicio.actualizarCategoria(obtenerSesion(res), params.id, body));
}

/**
 * DELETE /categorias/:id → 204
 * @type {import('express').RequestHandler}
 */
export async function eliminarCategoria(_req, res) {
  await servicio.eliminarCategoria(obtenerSesion(res), res.locals.entrada.params.id);
  res.status(204).end();
}

/**
 * GET /menu
 * @type {import('express').RequestHandler}
 */
export async function obtenerMenu(_req, res) {
  res.json(await servicio.obtenerMenu(obtenerSesion(res)));
}

/**
 * GET /productos
 * @type {import('express').RequestHandler}
 */
export async function listarProductos(_req, res) {
  res.json(await servicio.listarProductos(obtenerSesion(res), res.locals.entrada.query));
}

/**
 * GET /productos/:id
 * @type {import('express').RequestHandler}
 */
export async function obtenerProducto(_req, res) {
  res.json(await servicio.obtenerProducto(obtenerSesion(res), res.locals.entrada.params.id));
}

/**
 * POST /productos → 201
 * @type {import('express').RequestHandler}
 */
export async function crearProducto(_req, res) {
  const producto = await servicio.crearProducto(obtenerSesion(res), res.locals.entrada.body);
  res.status(201).json(producto);
}

/**
 * PATCH /productos/:id
 * @type {import('express').RequestHandler}
 */
export async function actualizarProducto(_req, res) {
  const { params, body } = res.locals.entrada;
  res.json(await servicio.actualizarProducto(obtenerSesion(res), params.id, body));
}
