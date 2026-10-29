// @ts-check
// Rutas de los recibos de venta. Los consultan quienes cobran: cajero, administrador y dueño.
import { Router } from 'express';
import { autenticar, permitirRoles } from '../../middlewares/auth.js';
import { validar } from '../../middlewares/validar.js';
import * as controlador from './recibos.controller.js';
import { esquemaFiltrosRecibos } from './recibos.schemas.js';

const cobran = permitirRoles('dueno', 'administrador', 'cajero');

export const rutasRecibos = Router();
rutasRecibos.use(autenticar);

rutasRecibos.get('/', cobran, validar({ query: esquemaFiltrosRecibos }), controlador.listar);
