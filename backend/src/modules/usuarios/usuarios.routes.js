// @ts-check
// Rutas de la gestión de usuarios.
// - Consultar: dueño y administrador.
// - Crear, editar y restablecer contraseñas: solo el dueño.
//
// Módulo pequeño: los controladores son de una línea y van junto a las rutas.
import { Router } from 'express';
import { esquemaParamsId } from '../../lib/esquemas.js';
import { autenticar, obtenerSesion, permitirRoles } from '../../middlewares/auth.js';
import { validar } from '../../middlewares/validar.js';
import {
  esquemaActualizarUsuario,
  esquemaCrearUsuario,
  esquemaRestablecerContrasena,
} from './usuarios.schemas.js';
import * as servicio from './usuarios.service.js';

const consultan = permitirRoles('dueno', 'administrador');
const soloDueno = permitirRoles('dueno');

export const rutasUsuarios = Router();
rutasUsuarios.use(autenticar);

// GET /usuarios
rutasUsuarios.get('/', consultan, async (_req, res) => {
  res.json(await servicio.listarUsuarios(obtenerSesion(res)));
});

// GET /usuarios/:id
rutasUsuarios.get('/:id', consultan, validar({ params: esquemaParamsId }), async (_req, res) => {
  res.json(await servicio.obtenerUsuario(obtenerSesion(res), res.locals.entrada.params.id));
});

// POST /usuarios → 201
rutasUsuarios.post('/', soloDueno, validar({ body: esquemaCrearUsuario }), async (_req, res) => {
  res.status(201).json(await servicio.crearUsuario(obtenerSesion(res), res.locals.entrada.body));
});

// PATCH /usuarios/:id
rutasUsuarios.patch(
  '/:id',
  soloDueno,
  validar({ params: esquemaParamsId, body: esquemaActualizarUsuario }),
  async (_req, res) => {
    const { params, body } = res.locals.entrada;
    res.json(await servicio.actualizarUsuario(obtenerSesion(res), params.id, body));
  },
);

// POST /usuarios/:id/restablecer-contrasena → 204
rutasUsuarios.post(
  '/:id/restablecer-contrasena',
  soloDueno,
  validar({ params: esquemaParamsId, body: esquemaRestablecerContrasena }),
  async (_req, res) => {
    const { params, body } = res.locals.entrada;
    await servicio.restablecerContrasena(obtenerSesion(res), params.id, body);
    res.status(204).end();
  },
);
