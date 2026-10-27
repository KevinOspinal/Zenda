// @ts-check
// Documentación de /usuarios (gestión de empleados).
import { esquemaParamsId } from '../../lib/esquemas.js';
import {
  esquemaActualizarUsuario,
  esquemaCrearUsuario,
  esquemaRestablecerContrasena,
} from '../../modules/usuarios/usuarios.schemas.js';
import { cuerpo, operacion, parametros, respuesta } from '../ayudantes.js';
import { ID } from '../ejemplos.js';

const CONSULTAN = /** @type {const} */ (['dueno', 'administrador']);

const ID_EMPLEADO = 'd7e8f9a0-b1c2-4d3e-8f4a-5b6c7d8e9f00';

const EMPLEADO = {
  id: ID_EMPLEADO,
  nombre: 'Sofía Martínez',
  email: 'sofia@laindustria.test',
  rol: 'mesero',
  activo: true,
  bloqueadoHasta: null,
  creadoEn: '2026-10-27T14:00:00.000Z',
  bloqueado: false,
};

const idEmpleado = parametros('path', esquemaParamsId, {
  id: { descripcion: 'Id del empleado.', ejemplo: ID_EMPLEADO },
});

const DESCRIPCIONES = {
  nombre: 'Nombre completo del empleado.',
  email: 'Correo con el que inicia sesión. Único en el negocio; no importan las mayúsculas.',
  rol: '`administrador`, `cajero` o `mesero`. El dueño no se asigna: hay uno por negocio.',
  contrasena: 'Contraseña inicial: mínimo 8 caracteres, con al menos una letra y un número.',
  activo: '`false` desactiva al empleado (no puede iniciar sesión); `true` lo reactiva.',
  contrasenaNueva: 'Mínimo 8 caracteres, con al menos una letra y un número.',
};

export const documentacionUsuarios = {
  '/usuarios': {
    get: operacion({
      etiqueta: 'Usuarios',
      resumen: 'Listar los empleados',
      roles: [...CONSULTAN],
      descripcion: `
Todos los usuarios del negocio: primero los activos, luego por nombre. Nunca incluye
contraseñas.

\`bloqueado\` es \`true\` si el usuario está bloqueado ahora mismo por 5 intentos fallidos
de inicio de sesión (se desbloquea solo en 15 minutos o restableciendo su contraseña).`,
      respuestas: {
        200: respuesta('Lista de empleados.', [
          {
            id: ID.cajero,
            nombre: 'Camilo Torres',
            email: 'cajero@laindustria.test',
            rol: 'cajero',
            activo: true,
            bloqueadoHasta: null,
            creadoEn: '2026-10-26T12:00:00.000Z',
            bloqueado: false,
          },
          EMPLEADO,
        ]),
      },
    }),
    post: operacion({
      etiqueta: 'Usuarios',
      resumen: 'Crear un empleado',
      roles: ['dueno'],
      descripcion: `
Crea un empleado con su rol y una contraseña inicial. Entrégale la contraseña de forma
segura y pídele que la cambie con \`POST /auth/cambiar-contrasena\`.

Si el correo ya existe en el negocio, responde 409. Queda en la **auditoría**.`,
      cuerpo: cuerpo(esquemaCrearUsuario, {
        ejemplo: {
          nombre: 'Sofía Martínez',
          email: 'sofia@laindustria.test',
          rol: 'mesero',
          contrasena: 'Temporal2026',
        },
        descripciones: DESCRIPCIONES,
      }),
      respuestas: { 201: respuesta('Empleado creado.', EMPLEADO) },
      errores: ['400', '409'],
    }),
  },

  '/usuarios/{id}': {
    get: operacion({
      etiqueta: 'Usuarios',
      resumen: 'Ver un empleado',
      roles: [...CONSULTAN],
      descripcion: 'Datos de un empleado (sin contraseña).',
      parametros: idEmpleado,
      respuestas: { 200: respuesta('El empleado.', EMPLEADO) },
      errores: ['400', '404'],
    }),
    patch: operacion({
      etiqueta: 'Usuarios',
      resumen: 'Editar, cambiar el rol o desactivar un empleado',
      roles: ['dueno'],
      descripcion: `
Envía solo lo que cambia.

- **Cambiar el rol** o **desactivar** cierra las sesiones del empleado: no sigue trabajando
  con permisos que ya no tiene (su token actual vence en máximo 15 minutos).
- Los usuarios **no se borran**: se desactivan, para conservar quién hizo cada venta.
- La **cuenta del dueño** no se puede desactivar ni cambiar de rol (422 \`DUENO_PROTEGIDO\`).
- Los cambios quedan en la **auditoría** con el valor anterior y el nuevo.`,
      parametros: idEmpleado,
      cuerpo: cuerpo(esquemaActualizarUsuario, {
        ejemplos: {
          rol: { summary: 'Ascender a cajero', value: { rol: 'cajero' } },
          desactivar: { summary: 'Desactivar (ya no trabaja aquí)', value: { activo: false } },
          reactivar: { summary: 'Reactivar', value: { activo: true } },
        },
        descripciones: DESCRIPCIONES,
      }),
      respuestas: { 200: respuesta('Empleado actualizado.', { ...EMPLEADO, rol: 'cajero' }) },
      errores: ['400', '404', '422'],
    }),
  },

  '/usuarios/{id}/restablecer-contrasena': {
    post: operacion({
      etiqueta: 'Usuarios',
      resumen: 'Restablecer la contraseña de un empleado',
      roles: ['dueno'],
      descripcion: `
Para cuando un empleado olvidó su contraseña: el dueño le asigna una nueva.

También **quita el bloqueo** por intentos fallidos y **cierra sus sesiones**. Queda en la
auditoría (sin la contraseña).`,
      parametros: idEmpleado,
      cuerpo: cuerpo(esquemaRestablecerContrasena, {
        ejemplo: { contrasenaNueva: 'Nueva2026' },
        descripciones: DESCRIPCIONES,
      }),
      respuestas: { 204: respuesta('Contraseña restablecida. Sin contenido.') },
      errores: ['400', '404'],
    }),
  },
};
