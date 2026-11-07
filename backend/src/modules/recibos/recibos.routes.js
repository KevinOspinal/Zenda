// @ts-check
// Rutas de los recibos de venta. Los consultan quienes cobran: cajero, administrador, dueño y
// administrador de Zenda.
import { Router } from 'express';
import { autenticar, permitirRoles } from '../../middlewares/auth.js';
import { validar } from '../../middlewares/validar.js';
import * as controlador from './recibos.controller.js';
import { esquemaFiltrosRecibos } from './recibos.schemas.js';

const cobran = permitirRoles('administrador_zenda', 'dueno', 'administrador', 'cajero');

export const rutasRecibos = Router();
rutasRecibos.use(autenticar);

rutasRecibos.get('/', cobran, validar({ query: esquemaFiltrosRecibos }), controlador.listar);
