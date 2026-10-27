// @ts-check
// Rutas de negocios.
// - Registro: público, porque quien se registra todavía no tiene cuenta.
// - Ver el negocio de la sesión: cualquier usuario del negocio.
// - Cambiar su configuración (propina sugerida): solo el dueño.
import { Router } from 'express';
import { autenticar, obtenerSesion, permitirRoles } from '../../middlewares/auth.js';
import { limiteRegistro } from '../../middlewares/limitePeticiones.js';
import { validar } from '../../middlewares/validar.js';
import { esquemaConfiguracionNegocio, esquemaRegistroNegocio } from './negocios.schemas.js';
import * as servicio from './negocios.service.js';

export const rutasNegocios = Router();

// POST /negocios/registro → 201 con el negocio y la sesión del dueño.
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
  permitirRoles('dueno'),
  validar({ body: esquemaConfiguracionNegocio }),
  async (_req, res) => {
    res.json(await servicio.actualizarNegocioActual(obtenerSesion(res), res.locals.entrada.body));
  },
);
