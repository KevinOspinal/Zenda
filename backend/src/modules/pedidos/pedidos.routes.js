// @ts-check
// Rutas de los pedidos.
// - Tomar pedidos, agregar o quitar ítems y manejar la cocina: todos los roles.
// - Cobrar: cajero, administrador y dueño (el mesero no cobra).
// - Anular: administrador y dueño.
import { Router } from 'express';
import { esquemaParamsId } from '../../lib/esquemas.js';
import { autenticar, permitirRoles } from '../../middlewares/auth.js';
import { validar } from '../../middlewares/validar.js';
import * as controlador from './pedidos.controller.js';
import {
  esquemaAnular,
  esquemaCobrar,
  esquemaCrearPedido,
  esquemaEstadoCocina,
  esquemaFiltrosPedidos,
  esquemaItem,
  esquemaParamsItem,
} from './pedidos.schemas.js';

const cobran = permitirRoles('dueno', 'administrador', 'cajero');
const anulan = permitirRoles('dueno', 'administrador');

export const rutasPedidos = Router();
rutasPedidos.use(autenticar);

rutasPedidos.post('/', validar({ body: esquemaCrearPedido }), controlador.crear);
rutasPedidos.get('/', validar({ query: esquemaFiltrosPedidos }), controlador.listar);
rutasPedidos.get('/:id', validar({ params: esquemaParamsId }), controlador.obtener);

rutasPedidos.post(
  '/:id/items',
  validar({ params: esquemaParamsId, body: esquemaItem }),
  controlador.agregarItem,
);
rutasPedidos.delete(
  '/:id/items/:itemId',
  validar({ params: esquemaParamsItem }),
  controlador.quitarItem,
);
rutasPedidos.patch(
  '/:id/items/:itemId/cocina',
  validar({ params: esquemaParamsItem, body: esquemaEstadoCocina }),
  controlador.cambiarEstadoCocina,
);
rutasPedidos.post(
  '/:id/enviar-cocina',
  validar({ params: esquemaParamsId }),
  controlador.enviarACocina,
);

rutasPedidos.post(
  '/:id/cobrar',
  cobran,
  validar({ params: esquemaParamsId, body: esquemaCobrar }),
  controlador.cobrar,
);
rutasPedidos.post(
  '/:id/anular',
  anulan,
  validar({ params: esquemaParamsId, body: esquemaAnular }),
  controlador.anular,
);
