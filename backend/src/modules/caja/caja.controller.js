// @ts-check
// Controladores de la caja.
import { obtenerSesion } from '../../middlewares/auth.js';
import * as servicio from './caja.service.js';

/**
 * POST /caja/abrir → 201
 * @type {import('express').RequestHandler}
 */
export async function abrir(_req, res) {
  res.status(201).json(await servicio.abrirTurno(obtenerSesion(res), res.locals.entrada.body));
}

/**
 * GET /caja/actual
 * @type {import('express').RequestHandler}
 */
export async function actual(_req, res) {
  res.json(await servicio.obtenerTurnoActual(obtenerSesion(res)));
}

/**
 * POST /caja/cerrar
 * @type {import('express').RequestHandler}
 */
export async function cerrar(_req, res) {
  res.json(await servicio.cerrarTurno(obtenerSesion(res), res.locals.entrada.body));
}

/**
 * GET /caja/turnos
 * @type {import('express').RequestHandler}
 */
export async function listarTurnos(_req, res) {
  res.json(await servicio.listarTurnos(obtenerSesion(res)));
}

/**
 * GET /caja/turnos/:id
 * @type {import('express').RequestHandler}
 */
export async function obtenerTurno(_req, res) {
  res.json(await servicio.obtenerTurno(obtenerSesion(res), res.locals.entrada.params.id));
}
