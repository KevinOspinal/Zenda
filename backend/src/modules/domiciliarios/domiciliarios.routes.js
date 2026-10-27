// @ts-check
// Rutas de los domiciliarios.
// - Verlos: cajero, administrador y dueño (la caja elige quién lleva cada domicilio).
// - Registrarlos y editarlos: administrador y dueño.
import { Router } from 'express';
import { esquemaParamsId } from '../../lib/esquemas.js';
import { autenticar, permitirRoles } from '../../middlewares/auth.js';
import { validar } from '../../middlewares/validar.js';
import * as controlador from './domiciliarios.controller.js';
import {
  esquemaActualizarDomiciliario,
  esquemaCrearDomiciliario,
  esquemaFiltrosDomiciliarios,
} from './domiciliarios.schemas.js';

const consultan = permitirRoles('dueno', 'administrador', 'cajero');
const gestionan = permitirRoles('dueno', 'administrador');

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
