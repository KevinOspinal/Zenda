// @ts-check
// Rutas de los clientes. Los gestionan quienes facturan: cajero, administrador y dueño.
// El mesero no accede: no necesita ver datos personales (Ley 1581 de 2012).
import { Router } from 'express';
import { esquemaParamsId } from '../../lib/esquemas.js';
import { autenticar, permitirRoles } from '../../middlewares/auth.js';
import { validar } from '../../middlewares/validar.js';
import * as controlador from './clientes.controller.js';
import {
  esquemaActualizarCliente,
  esquemaCrearCliente,
  esquemaFiltrosClientes,
} from './clientes.schemas.js';

export const rutasClientes = Router();
rutasClientes.use(autenticar, permitirRoles('dueno', 'administrador', 'cajero'));

rutasClientes.get('/', validar({ query: esquemaFiltrosClientes }), controlador.listarClientes);
rutasClientes.get('/:id', validar({ params: esquemaParamsId }), controlador.obtenerCliente);
rutasClientes.post('/', validar({ body: esquemaCrearCliente }), controlador.crearCliente);
rutasClientes.patch(
  '/:id',
  validar({ params: esquemaParamsId, body: esquemaActualizarCliente }),
  controlador.actualizarCliente,
);
