// @ts-check
// Esquemas Zod de la gestión de usuarios (empleados del negocio).
import { z } from 'zod';
import { alMenosUnCampo, esquemaContrasenaNueva, textoObligatorio } from '../../lib/esquemas.js';

/**
 * Roles que el dueño puede asignar. "dueno" no está: cada negocio tiene un solo dueño,
 * que se crea al registrar el negocio.
 */
const ROLES_ASIGNABLES = /** @type {const} */ (['administrador', 'cajero', 'mesero']);

/** POST /usuarios */
export const esquemaCrearUsuario = z.object({
  nombre: textoObligatorio(120),
  // Se normaliza a minúsculas: el login no distingue mayúsculas.
  email: z.string().trim().toLowerCase().pipe(z.email('correo inválido')),
  rol: z.enum(ROLES_ASIGNABLES, 'el rol debe ser administrador, cajero o mesero'),
  contrasena: esquemaContrasenaNueva,
});

/** PATCH /usuarios/:id */
export const esquemaActualizarUsuario = alMenosUnCampo(
  z
    .object({
      nombre: textoObligatorio(120),
      rol: z.enum(ROLES_ASIGNABLES, 'el rol debe ser administrador, cajero o mesero'),
      // false desactiva al empleado (no puede iniciar sesión); true lo reactiva.
      activo: z.boolean(),
    })
    .partial(),
);

/** POST /usuarios/:id/restablecer-contrasena */
export const esquemaRestablecerContrasena = z.object({
  contrasenaNueva: esquemaContrasenaNueva,
});
