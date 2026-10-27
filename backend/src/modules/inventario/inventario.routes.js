// @ts-check
// Rutas del inventario.
// - Consultar stock y movimientos: cajero, administrador y dueño.
// - Registrar compras y ajustes: administrador y dueño.
import { Router } from 'express';
import { autenticar, permitirRoles } from '../../middlewares/auth.js';
import { validar } from '../../middlewares/validar.js';
import * as controlador from './inventario.controller.js';
import { esquemaParamsProducto, esquemaRegistrarMovimiento } from './inventario.schemas.js';

export const rutasInventario = Router();
rutasInventario.use(autenticar);

rutasInventario.get('/', permitirRoles('dueno', 'administrador', 'cajero'), controlador.listar);
rutasInventario.get(
  '/:productoId/movimientos',
  permitirRoles('dueno', 'administrador', 'cajero'),
  validar({ params: esquemaParamsProducto }),
  controlador.movimientos,
);
rutasInventario.post(
  '/movimientos',
  permitirRoles('dueno', 'administrador'),
  validar({ body: esquemaRegistrarMovimiento }),
  controlador.registrar,
);
