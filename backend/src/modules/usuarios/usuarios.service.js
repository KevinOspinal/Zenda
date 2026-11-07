// @ts-check
// Gestión de las cuentas del negocio: listar, crear, editar, desactivar y restablecer
// contraseñas. Lo hace solo el administrador de Zenda (ver usuarios.routes.js), que también
// crea al dueño.
//
// Los usuarios no se borran: se desactivan, porque sus pedidos y cierres de caja deben
// seguir mostrando quién los hizo.
import { ACCIONES, registrarAuditoria } from '../../lib/auditoria.js';
import { hashearContrasena } from '../../lib/contrasenas.js';
import { AppError } from '../../lib/errors.js';
import { conNegocio } from '../../lib/negocio.js';
import { revocarSesionesDeUsuario } from '../auth/auth.service.js';

/** @typedef {import('../../lib/tokens.js').DatosSesion} DatosSesion */
/** @typedef {'dueno' | 'administrador' | 'cajero' | 'mesero' | 'cocina'} RolAsignable */

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
 * - La cuenta de un administrador de Zenda no se puede desactivar ni cambiar de rol desde la
 *   app: así nadie deja al negocio sin quien lo atiende.
 * - Al único dueño activo tampoco: el negocio quedaría sin dueño. Para reemplazarlo, primero
 *   se crea el nuevo.
 *
 * @param {DatosSesion} sesion
 * @param {string} id
 * @param {{ nombre?: string, rol?: RolAsignable, activo?: boolean }} datos
 */
export async function actualizarUsuario(sesion, id, datos) {
  const usuario = await conNegocio(sesion.tenantId, async (tx) => {
    // 1. Buscar la cuenta.
    const actual = await tx.usuario.findUnique({ where: { id } });
    if (!actual) throw errorUsuarioNoEncontrado();

    // 2. Proteger la cuenta del administrador de Zenda y la del único dueño activo.
    const cambiaRol = datos.rol !== undefined && datos.rol !== actual.rol;
    const pierdeAcceso = cambiaRol || (datos.activo === false && actual.activo);
    if (actual.rol === 'administrador_zenda' && pierdeAcceso) {
      throw new AppError(
        422,
        'CUENTA_ZENDA_PROTEGIDA',
        'La cuenta del administrador de Zenda no se puede desactivar ni cambiar de rol',
      );
    }
    if (actual.rol === 'dueno' && actual.activo && pierdeAcceso) {
      const otrosDuenos = await tx.usuario.count({
        where: { rol: 'dueno', activo: true, id: { not: id } },
      });
      if (otrosDuenos === 0) {
        throw new AppError(
          422,
          'DUENO_PROTEGIDO',
          'Es el único dueño del negocio: crea primero al nuevo dueño',
        );
      }
    }

    // 3. El acceso de un domiciliario se maneja desde Domiciliarios: su usuario no cambia de
    //    rol (quedaría un domiciliario sin acceso o un empleado con entregas asignadas).
    if (actual.rol === 'domiciliario' && cambiaRol) {
      throw new AppError(
        422,
        'ROL_DOMICILIARIO',
        'El acceso de un domiciliario se maneja desde Domiciliarios',
      );
    }

    // 4. Guardar los cambios.
    const actualizado = await tx.usuario.update({
      where: { id },
      data: datos,
      select: CAMPOS_PUBLICOS,
    });

    // 5. Cerrar sus sesiones si perdió acceso o cambiaron sus permisos.
    if (cambiaRol || datos.activo === false) {
      await revocarSesionesDeUsuario(tx, id);
    }

    // 6. Auditoría con lo que cambió (antes y después).
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
