// @ts-check
// Esquemas Zod de la gestión de usuarios (las cuentas del negocio).
import { z } from 'zod';
import { alMenosUnCampo, esquemaContrasenaNueva, textoObligatorio } from '../../lib/esquemas.js';

/**
 * Roles que el administrador de Zenda puede asignar desde Usuarios. No están
 * "administrador_zenda" (nadie lo asigna desde la app: ver src/config/roles.js) ni
 * "domiciliario" (su acceso se da desde Domiciliarios).
 */
const ROLES_ASIGNABLES = /** @type {const} */ ([
  'dueno',
  'administrador',
  'cajero',
  'mesero',
  'cocina',
]);
const MENSAJE_ROL = 'el rol debe ser dueño, administrador, cajero, mesero o cocina';

/** POST /usuarios */
export const esquemaCrearUsuario = z.object({
  nombre: textoObligatorio(120),
  // Se normaliza a minúsculas: el login no distingue mayúsculas.
  email: z.string().trim().toLowerCase().pipe(z.email('correo inválido')),
  rol: z.enum(ROLES_ASIGNABLES, MENSAJE_ROL),
  contrasena: esquemaContrasenaNueva,
});

/** PATCH /usuarios/:id */
export const esquemaActualizarUsuario = alMenosUnCampo(
  z
    .object({
      nombre: textoObligatorio(120),
      rol: z.enum(ROLES_ASIGNABLES, MENSAJE_ROL),
      // false desactiva al empleado (no puede iniciar sesión); true lo reactiva.
      activo: z.boolean(),
    })
    .partial(),
);

/** POST /usuarios/:id/restablecer-contrasena */
export const esquemaRestablecerContrasena = z.object({
  contrasenaNueva: esquemaContrasenaNueva,
});
