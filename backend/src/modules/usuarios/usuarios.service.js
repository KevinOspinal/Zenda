// @ts-check
// Gestión de los empleados del negocio: listar, crear, editar, desactivar y restablecer
// contraseñas. Solo el dueño hace cambios; el administrador solo consulta.
//
// Los usuarios no se borran: se desactivan, porque sus pedidos y cierres de caja deben
// seguir mostrando quién los hizo.
import { ACCIONES, registrarAuditoria } from '../../lib/auditoria.js';
import { hashearContrasena } from '../../lib/contrasenas.js';
import { AppError } from '../../lib/errors.js';
import { conNegocio } from '../../lib/negocio.js';
import { revocarSesionesDeUsuario } from '../auth/auth.service.js';

/** @typedef {import('../../lib/tokens.js').DatosSesion} DatosSesion */
/** @typedef {'administrador' | 'cajero' | 'mesero' | 'cocina'} RolAsignable */

/** Datos públicos de un usuario: nunca se devuelve el hash de la contraseña. */
const CAMPOS_PUBLICOS = /** @type {const} */ ({
  id: true,
  nombre: true,
  email: true,
  rol: true,
  activo: true,
  bloqueadoHasta: true,
  creadoEn: true,
});

/**
 * Agrega `bloqueado` (si hoy está bloqueado por intentos fallidos) a los datos públicos.
 * @template {{ bloqueadoHasta: Date | null }} T
 * @param {T} usuario
 */
function conEstadoDeBloqueo(usuario) {
  return {
    ...usuario,
    bloqueado: Boolean(usuario.bloqueadoHasta && usuario.bloqueadoHasta > new Date()),
  };
}

/**
 * Empleados del negocio: primero los activos, luego por nombre.
 * @param {DatosSesion} sesion
 */
export async function listarUsuarios(sesion) {
  const usuarios = await conNegocio(sesion.tenantId, (tx) =>
    tx.usuario.findMany({
      select: CAMPOS_PUBLICOS,
      orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
    }),
  );
  return usuarios.map(conEstadoDeBloqueo);
}

/**
 * @param {DatosSesion} sesion
 * @param {string} id
 */
export async function obtenerUsuario(sesion, id) {
  const usuario = await conNegocio(sesion.tenantId, (tx) =>
    tx.usuario.findUnique({ where: { id }, select: CAMPOS_PUBLICOS }),
  );
  if (!usuario) throw errorUsuarioNoEncontrado();
  return conEstadoDeBloqueo(usuario);
}

/**
 * Crea un empleado. Si el correo ya existe en el negocio, responde 409.
 * @param {DatosSesion} sesion
 * @param {{ nombre: string, email: string, rol: RolAsignable, contrasena: string }} datos
 */
export async function crearUsuario(sesion, { contrasena, ...datos }) {
  // El hash va fuera de la transacción: argon2 es lento a propósito y no debe tenerla abierta.
  const passwordHash = await hashearContrasena(contrasena);

  const usuario = await conNegocio(sesion.tenantId, async (tx) => {
    const creado = await tx.usuario.create({
      data: { ...datos, tenantId: sesion.tenantId, passwordHash },
      select: CAMPOS_PUBLICOS,
    });
    await registrarAuditoria(tx, sesion, {
      accion: ACCIONES.CREAR_USUARIO,
      entidad: 'usuarios',
      entidadId: creado.id,
      detalle: { nombre: creado.nombre, email: creado.email, rol: creado.rol },
    });
    return creado;
  });

  return conEstadoDeBloqueo(usuario);
}

/**
 * Edita el nombre, el rol o el estado (activo) de un empleado.
 *
 * - Si cambia el rol o se desactiva, se cierran sus sesiones: así no sigue trabajando
 *   con permisos que ya no tiene. Su token de acceso actual vence en máximo 15 minutos.
 * - La cuenta del dueño no se puede desactivar ni cambiar de rol: el negocio nunca debe
 *   quedarse sin dueño.
 *
 * @param {DatosSesion} sesion
 * @param {string} id
 * @param {{ nombre?: string, rol?: RolAsignable, activo?: boolean }} datos
 */
export async function actualizarUsuario(sesion, id, datos) {
  const usuario = await conNegocio(sesion.tenantId, async (tx) => {
    // 1. Buscar al empleado.
    const actual = await tx.usuario.findUnique({ where: { id } });
    if (!actual) throw errorUsuarioNoEncontrado();

    // 2. Proteger la cuenta del dueño.
    const cambiaRol = datos.rol !== undefined && datos.rol !== actual.rol;
    const cambiaActivo = datos.activo !== undefined && datos.activo !== actual.activo;
    if (actual.rol === 'dueno' && (cambiaRol || cambiaActivo)) {
      throw new AppError(
        422,
        'DUENO_PROTEGIDO',
        'La cuenta del dueño no se puede desactivar ni cambiar de rol',
      );
    }

    // 3. Guardar los cambios.
    const actualizado = await tx.usuario.update({
      where: { id },
      data: datos,
      select: CAMPOS_PUBLICOS,
    });

    // 4. Cerrar sus sesiones si perdió acceso o cambiaron sus permisos.
    if (cambiaRol || datos.activo === false) {
      await revocarSesionesDeUsuario(tx, id);
    }

    // 5. Auditoría con lo que cambió (antes y después).
    /** @type {Record<string, { antes: unknown, despues: unknown }>} */
    const cambios = {};
    for (const campo of /** @type {const} */ (['nombre', 'rol', 'activo'])) {
      if (datos[campo] !== undefined && datos[campo] !== actual[campo]) {
        cambios[campo] = { antes: actual[campo], despues: datos[campo] };
      }
    }
    if (Object.keys(cambios).length > 0) {
      await registrarAuditoria(tx, sesion, {
        accion: ACCIONES.EDITAR_USUARIO,
        entidad: 'usuarios',
        entidadId: id,
        detalle: { usuario: actual.nombre, cambios },
      });
    }

    return actualizado;
  });

  return conEstadoDeBloqueo(usuario);
}

/**
 * Asigna una contraseña nueva a un empleado que olvidó la suya. Le quita el bloqueo por
 * intentos fallidos y cierra sus sesiones.
 * @param {DatosSesion} sesion
 * @param {string} id
 * @param {{ contrasenaNueva: string }} datos
 */
export async function restablecerContrasena(sesion, id, { contrasenaNueva }) {
  const passwordHash = await hashearContrasena(contrasenaNueva);

  await conNegocio(sesion.tenantId, async (tx) => {
    const usuario = await tx.usuario.findUnique({ where: { id } });
    if (!usuario) throw errorUsuarioNoEncontrado();

    await tx.usuario.update({
      where: { id },
      data: { passwordHash, intentosFallidos: 0, bloqueadoHasta: null },
    });
    await revocarSesionesDeUsuario(tx, id);

    // Nunca se guarda la contraseña en la auditoría, solo a quién se le restableció.
    await registrarAuditoria(tx, sesion, {
      accion: ACCIONES.RESTABLECER_CONTRASENA,
      entidad: 'usuarios',
      entidadId: id,
      detalle: { usuario: usuario.nombre },
    });
  });
}

function errorUsuarioNoEncontrado() {
  return new AppError(404, 'NO_ENCONTRADO', 'El usuario no existe');
}
