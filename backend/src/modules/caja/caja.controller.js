// @ts-check
// Controladores de la caja.
import { obtenerSesion } from '../../middlewares/auth.js';
import { EVENTOS, emitirANegocio } from '../../sockets/eventos.js';
import * as servicio from './caja.service.js';

/**
 * POST /caja/abrir → 201
 * @type {import('express').RequestHandler}
 */
export async function abrir(_req, res) {
  const sesion = obtenerSesion(res);
  const turno = await servicio.abrirTurno(sesion, res.locals.entrada.body);
  // Los meseros ya pueden tomar pedidos. No se envían montos: el mesero no los necesita.
  emitirANegocio(sesion.tenantId, EVENTOS.CAJA_ABIERTA, {
    turnoId: turno.id,
    abiertoEn: turno.abiertoEn,
  });
  res.status(201).json(turno);
}

/**
 * GET /caja/estado (todos los roles, sin montos)
 * @type {import('express').RequestHandler}
 */
export async function estado(_req, res) {
  res.json(await servicio.obtenerEstadoCaja(obtenerSesion(res)));
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
  const sesion = obtenerSesion(res);
  const turno = await servicio.cerrarTurno(sesion, res.locals.entrada.body);
  // No se envía el arqueo: es información solo para quien maneja la caja.
  emitirANegocio(sesion.tenantId, EVENTOS.CAJA_CERRADA, {
    turnoId: turno.id,
    cerradoEn: turno.cerradoEn,
  });
  res.json(turno);
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
