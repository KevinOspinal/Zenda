// @ts-check
// Rutas de los grupos de opciones de los productos. Todos los roles pueden consultarlos; solo
// el administrador de Zenda, el dueño y el administrador los editan, igual que el menú.
import { Router } from 'express';
import { esquemaParamsId } from '../../lib/esquemas.js';
import { autenticar, obtenerSesion, permitirRoles } from '../../middlewares/auth.js';
import { validar } from '../../middlewares/validar.js';
import { esquemaGrupoOpciones } from './opciones.schemas.js';
import * as servicio from './opciones.service.js';

/** Roles que pueden cambiar el menú y los precios. */
const editanMenu = permitirRoles('administrador_zenda', 'dueno', 'administrador');

export const rutasGruposOpciones = Router();
rutasGruposOpciones.use(autenticar);

// GET /grupos-opciones
rutasGruposOpciones.get('/', async (_req, res) => {
  res.json(await servicio.listarGrupos(obtenerSesion(res)));
});

// POST /grupos-opciones → 201
rutasGruposOpciones.post(
  '/',
  editanMenu,
  validar({ body: esquemaGrupoOpciones }),
  async (_req, res) => {
    res.status(201).json(await servicio.crearGrupo(obtenerSesion(res), res.locals.entrada.body));
  },
);

// PUT /grupos-opciones/:id: se envía el grupo completo.
rutasGruposOpciones.put(
  '/:id',
  editanMenu,
  validar({ params: esquemaParamsId, body: esquemaGrupoOpciones }),
  async (_req, res) => {
    const { params, body } = res.locals.entrada;
    res.json(await servicio.actualizarGrupo(obtenerSesion(res), params.id, body));
  },
);

// DELETE /grupos-opciones/:id → 204
rutasGruposOpciones.delete(
  '/:id',
  editanMenu,
  validar({ params: esquemaParamsId }),
  async (_req, res) => {
    await servicio.eliminarGrupo(obtenerSesion(res), res.locals.entrada.params.id);
    res.status(204).end();
  },
);
