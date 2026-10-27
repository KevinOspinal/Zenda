// @ts-check
// Rutas de las mesas. Todos los roles las consultan; solo el dueño y el administrador las editan.
import { Router } from 'express';
import { esquemaParamsId } from '../../lib/esquemas.js';
import { autenticar, permitirRoles } from '../../middlewares/auth.js';
import { validar } from '../../middlewares/validar.js';
import * as controlador from './mesas.controller.js';
import { esquemaActualizarMesa, esquemaCrearMesa } from './mesas.schemas.js';

const editanMesas = permitirRoles('dueno', 'administrador');

export const rutasMesas = Router();
rutasMesas.use(autenticar);

rutasMesas.get('/', controlador.listarMesas);
rutasMesas.get('/:id', validar({ params: esquemaParamsId }), controlador.obtenerMesa);
rutasMesas.post('/', editanMesas, validar({ body: esquemaCrearMesa }), controlador.crearMesa);
rutasMesas.patch(
  '/:id',
  editanMesas,
  validar({ params: esquemaParamsId, body: esquemaActualizarMesa }),
  controlador.actualizarMesa,
);
rutasMesas.delete(
  '/:id',
  editanMesas,
  validar({ params: esquemaParamsId }),
  controlador.eliminarMesa,
);
