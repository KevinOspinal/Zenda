// @ts-check
// Rutas de los reportes de ventas. Solo las ven el dueño y el administrador.
//
// Módulo pequeño: los controladores son de una línea y van junto a las rutas.
import { Router } from 'express';
import { autenticar, obtenerSesion, permitirRoles } from '../../middlewares/auth.js';
import { validar } from '../../middlewares/validar.js';
import { esquemaRangoReporte } from './reportes.schemas.js';
import * as servicio from './reportes.service.js';

export const rutasReportes = Router();
rutasReportes.use(autenticar, permitirRoles('dueno', 'administrador'));

/** Todos los reportes reciben el mismo rango de fechas: ?desde=AAAA-MM-DD&hasta=AAAA-MM-DD */
const validarRango = validar({ query: esquemaRangoReporte });

// GET /reportes/resumen
rutasReportes.get('/resumen', validarRango, async (_req, res) => {
  res.json(await servicio.obtenerResumen(obtenerSesion(res), res.locals.entrada.query));
});

// GET /reportes/por-producto
rutasReportes.get('/por-producto', validarRango, async (_req, res) => {
  res.json(await servicio.obtenerVentasPorProducto(obtenerSesion(res), res.locals.entrada.query));
});

// GET /reportes/por-metodo-pago
rutasReportes.get('/por-metodo-pago', validarRango, async (_req, res) => {
  res.json(await servicio.obtenerVentasPorMetodoPago(obtenerSesion(res), res.locals.entrada.query));
});
