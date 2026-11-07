// @ts-check
// Rutas de los domiciliarios.
// - Verlos: cajero, administrador, dueño y administrador de Zenda (la caja elige quién lleva
//   cada domicilio).
// - Registrarlos, editarlos y darles o quitarles acceso a Zenda: solo el administrador de
//   Zenda (igual que con las demás cuentas del negocio).
// - Liquidarlos (recibir el dinero de sus domicilios contra entrega): la caja.
import { Router } from 'express';
import { esquemaParamsId } from '../../lib/esquemas.js';
import { autenticar, permitirRoles } from '../../middlewares/auth.js';
import { validar } from '../../middlewares/validar.js';
import { esquemaLiquidar } from '../pedidos/pedidos.schemas.js';
import * as controlador from './domiciliarios.controller.js';
import {
  esquemaActualizarDomiciliario,
  esquemaCrearDomiciliario,
  esquemaDarAcceso,
  esquemaFiltrosDomiciliarios,
} from './domiciliarios.schemas.js';

const consultan = permitirRoles('administrador_zenda', 'dueno', 'administrador', 'cajero');
const soloZenda = permitirRoles('administrador_zenda');

export const rutasDomiciliarios = Router();
rutasDomiciliarios.use(autenticar);

rutasDomiciliarios.get(
  '/',
  consultan,
  validar({ query: esquemaFiltrosDomiciliarios }),
  controlador.listar,
);
rutasDomiciliarios.post(
  '/',
  soloZenda,
  validar({ body: esquemaCrearDomiciliario }),
  controlador.crear,
);
rutasDomiciliarios.patch(
  '/:id',
  soloZenda,
  validar({ params: esquemaParamsId, body: esquemaActualizarDomiciliario }),
  controlador.actualizar,
);
rutasDomiciliarios.post(
  '/:id/acceso',
  soloZenda,
  validar({ params: esquemaParamsId, body: esquemaDarAcceso }),
  controlador.darAcceso,
);
rutasDomiciliarios.delete(
  '/:id/acceso',
  soloZenda,
  validar({ params: esquemaParamsId }),
  controlador.quitarAcceso,
);
rutasDomiciliarios.post(
  '/:id/liquidar',
  consultan,
  validar({ params: esquemaParamsId, body: esquemaLiquidar }),
  controlador.liquidar,
);
