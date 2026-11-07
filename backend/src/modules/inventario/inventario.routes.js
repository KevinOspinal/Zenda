// @ts-check
// Rutas del inventario.
// - Consultar stock y movimientos: cajero, administrador, dueño y administrador de Zenda.
// - Registrar compras y ajustes: administrador, dueño y administrador de Zenda.
import { Router } from 'express';
import { autenticar, permitirRoles } from '../../middlewares/auth.js';
import { validar } from '../../middlewares/validar.js';
import * as controlador from './inventario.controller.js';
import { esquemaParamsProducto, esquemaRegistrarMovimiento } from './inventario.schemas.js';

export const rutasInventario = Router();
rutasInventario.use(autenticar);

rutasInventario.get(
  '/',
  permitirRoles('administrador_zenda', 'dueno', 'administrador', 'cajero'),
  controlador.listar,
);
rutasInventario.get(
  '/:productoId/movimientos',
  permitirRoles('administrador_zenda', 'dueno', 'administrador', 'cajero'),
  validar({ params: esquemaParamsProducto }),
  controlador.movimientos,
);
rutasInventario.post(
  '/movimientos',
  permitirRoles('administrador_zenda', 'dueno', 'administrador'),
  validar({ body: esquemaRegistrarMovimiento }),
  controlador.registrar,
);
