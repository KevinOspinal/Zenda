// @ts-check
// Rutas de los pedidos.
// - Tomar pedidos, agregar o quitar ítems, enviar a cocina y dividir: todos menos la cocina.
// - Ver los pedidos y avanzar los platos: todos. Cada paso tiene su regla en el servicio: la
//   cocina marca "preparando" y "listo"; el mesero, "entregado".
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
  esquemaDividir,
  esquemaEstadoCocina,
  esquemaFiltrosPedidos,
  esquemaItem,
  esquemaParamsItem,
} from './pedidos.schemas.js';

const atienden = permitirRoles('dueno', 'administrador', 'cajero', 'mesero');
const cobran = permitirRoles('dueno', 'administrador', 'cajero');
const anulan = permitirRoles('dueno', 'administrador');

export const rutasPedidos = Router();
rutasPedidos.use(autenticar);

rutasPedidos.post('/', atienden, validar({ body: esquemaCrearPedido }), controlador.crear);
rutasPedidos.get('/', validar({ query: esquemaFiltrosPedidos }), controlador.listar);
rutasPedidos.get('/:id', validar({ params: esquemaParamsId }), controlador.obtener);

rutasPedidos.post(
  '/:id/items',
  atienden,
  validar({ params: esquemaParamsId, body: esquemaItem }),
  controlador.agregarItem,
);
rutasPedidos.delete(
  '/:id/items/:itemId',
  atienden,
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
  atienden,
  validar({ params: esquemaParamsId }),
  controlador.enviarACocina,
);

// Dividir la cuenta: todos menos la cocina (no mueve dinero; normalmente lo hace el mesero).
rutasPedidos.post(
  '/:id/dividir',
  atienden,
  validar({ params: esquemaParamsId, body: esquemaDividir }),
  controlador.dividir,
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
