// @ts-check
// Rutas del menú. Todos los roles pueden consultarlo; solo el dueño y el administrador lo editan.
import { Router } from 'express';
import { esquemaParamsId } from '../../lib/esquemas.js';
import { autenticar, permitirRoles } from '../../middlewares/auth.js';
import { validar } from '../../middlewares/validar.js';
import * as controlador from './menu.controller.js';
import {
  esquemaActualizarCategoria,
  esquemaActualizarProducto,
  esquemaCrearCategoria,
  esquemaCrearProducto,
  esquemaFiltrosProductos,
} from './menu.schemas.js';

/** Roles que pueden cambiar el menú y los precios. */
const editanMenu = permitirRoles('dueno', 'administrador');

// /menu: vista para tomar pedidos (categorías con productos activos).
export const rutasMenu = Router();
rutasMenu.use(autenticar);
rutasMenu.get('/', controlador.obtenerMenu);

// /categorias
export const rutasCategorias = Router();
rutasCategorias.use(autenticar);
rutasCategorias.get('/', controlador.listarCategorias);
rutasCategorias.post(
  '/',
  editanMenu,
  validar({ body: esquemaCrearCategoria }),
  controlador.crearCategoria,
);
rutasCategorias.patch(
  '/:id',
  editanMenu,
  validar({ params: esquemaParamsId, body: esquemaActualizarCategoria }),
  controlador.actualizarCategoria,
);
rutasCategorias.delete(
  '/:id',
  editanMenu,
  validar({ params: esquemaParamsId }),
  controlador.eliminarCategoria,
);

// /productos (no se eliminan: se desactivan con activo=false para no afectar ventas pasadas)
export const rutasProductos = Router();
rutasProductos.use(autenticar);
rutasProductos.get('/', validar({ query: esquemaFiltrosProductos }), controlador.listarProductos);
rutasProductos.get('/:id', validar({ params: esquemaParamsId }), controlador.obtenerProducto);
rutasProductos.post(
  '/',
  editanMenu,
  validar({ body: esquemaCrearProducto }),
  controlador.crearProducto,
);
rutasProductos.patch(
  '/:id',
  editanMenu,
  validar({ params: esquemaParamsId, body: esquemaActualizarProducto }),
  controlador.actualizarProducto,
);
