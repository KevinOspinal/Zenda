// @ts-check
// Rutas de negocios.
// - Registro: público, porque quien se registra todavía no tiene cuenta.
// - Ver el negocio de la sesión: cualquier usuario del negocio.
// - Cambiar su configuración (propina, domicilio, recibo, Bre-B): el dueño y el administrador
//   de Zenda. La facturación (el régimen de impuestos), solo el administrador de Zenda.
import { Router } from 'express';
import { AppError } from '../../lib/errors.js';
import { autenticar, obtenerSesion, permitirRoles } from '../../middlewares/auth.js';
import { limiteRegistro } from '../../middlewares/limitePeticiones.js';
import { validar } from '../../middlewares/validar.js';
import { esquemaConfiguracionNegocio, esquemaRegistroNegocio } from './negocios.schemas.js';
import * as servicio from './negocios.service.js';

export const rutasNegocios = Router();

/**
 * El régimen de impuestos decide si el negocio factura electrónicamente y qué impuesto cobra:
 * lo cambia solo el administrador de Zenda. Va después de validar el cuerpo.
 * @type {import('express').RequestHandler}
 */
function soloZendaCambiaLaFacturacion(_req, res, next) {
  const cambiaRegimen = res.locals.entrada.body.regimenImpuesto !== undefined;
  if (cambiaRegimen && obtenerSesion(res).rol !== 'administrador_zenda') {
    next(
      new AppError(
        403,
        'SIN_PERMISO',
        'Solo el administrador de Zenda puede cambiar la facturación del negocio',
      ),
    );
    return;
  }
  next();
}

// POST /negocios/registro → 201 con el negocio y la sesión de quien lo registró.
rutasNegocios.post(
  '/registro',
  limiteRegistro,
  validar({ body: esquemaRegistroNegocio }),
  async (_req, res) => {
    res.status(201).json(await servicio.registrarNegocio(res.locals.entrada.body));
  },
);

// GET /negocios/actual
rutasNegocios.get('/actual', autenticar, async (_req, res) => {
  res.json(await servicio.obtenerNegocioActual(obtenerSesion(res)));
});

// PATCH /negocios/actual
rutasNegocios.patch(
  '/actual',
  autenticar,
  permitirRoles('administrador_zenda', 'dueno'),
  validar({ body: esquemaConfiguracionNegocio }),
  soloZendaCambiaLaFacturacion,
  async (_req, res) => {
    res.json(await servicio.actualizarNegocioActual(obtenerSesion(res), res.locals.entrada.body));
  },
);
