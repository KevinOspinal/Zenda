// @ts-check
// Rutas de los domiciliarios.
// - Verlos: cajero, administrador y dueño (la caja elige quién lleva cada domicilio).
// - Registrarlos y editarlos: administrador y dueño.
// - Darles o quitarles acceso a Zenda: el dueño (igual que con los demás empleados).
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

const consultan = permitirRoles('dueno', 'administrador', 'cajero');
const gestionan = permitirRoles('dueno', 'administrador');
const soloDueno = permitirRoles('dueno');

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
  gestionan,
  validar({ body: esquemaCrearDomiciliario }),
  controlador.crear,
);
rutasDomiciliarios.patch(
  '/:id',
  gestionan,
  validar({ params: esquemaParamsId, body: esquemaActualizarDomiciliario }),
  controlador.actualizar,
);
rutasDomiciliarios.post(
  '/:id/acceso',
  soloDueno,
  validar({ params: esquemaParamsId, body: esquemaDarAcceso }),
  controlador.darAcceso,
);
rutasDomiciliarios.delete(
  '/:id/acceso',
  soloDueno,
  validar({ params: esquemaParamsId }),
  controlador.quitarAcceso,
);
rutasDomiciliarios.post(
  '/:id/liquidar',
  consultan,
  validar({ params: esquemaParamsId, body: esquemaLiquidar }),
  controlador.liquidar,
);
