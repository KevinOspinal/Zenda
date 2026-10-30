// @ts-check
// Domiciliarios del negocio: quienes llevan los domicilios. La caja les asigna los pedidos al
// despacharlos. No se borran: se desactivan, para conservar su historial.
//
// Acceso a Zenda: el dueño puede darle a un domiciliario un usuario (rol domiciliario) para
// que vea sus entregas en el celular y las marque como entregadas. Sin acceso, la caja sigue
// manejando sus domicilios como siempre.
import { ACCIONES, registrarAuditoria } from '../../lib/auditoria.js';
import { hashearContrasena } from '../../lib/contrasenas.js';
import { AppError } from '../../lib/errors.js';
import { conNegocio } from '../../lib/negocio.js';
import { revocarSesionesDeUsuario } from '../auth/auth.service.js';

/** @typedef {import('../../lib/tokens.js').DatosSesion} DatosSesion */
/** @typedef {import('../../lib/negocio.js').TransaccionPrisma} TransaccionPrisma */

/** El usuario con que entra el domiciliario: nunca el hash de la contraseña. */
const CON_ACCESO = /** @type {const} */ ({
  include: { usuario: { select: { email: true, activo: true } } },
});

/**
 * Da forma al domiciliario que se devuelve: su acceso (`null` si nunca se le dio) en lugar del
 * usuario completo.
 * @template {{ usuario: { email: string, activo: boolean } | null }} T
 * @param {T} domiciliario
 */
function presentarDomiciliario({ usuario, ...domiciliario }) {
  return { ...domiciliario, acceso: usuario };
}

/**
 * Lista los domiciliarios: primero los activos, por nombre.
 * @param {DatosSesion} sesion
 * @param {{ activos?: boolean }} filtros
 */
export async function listarDomiciliarios(sesion, { activos }) {
  const domiciliarios = await conNegocio(sesion.tenantId, (tx) =>
    tx.domiciliario.findMany({
      where: activos ? { activo: true } : {},
      orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
      ...CON_ACCESO,
    }),
  );
  return domiciliarios.map(presentarDomiciliario);
}

/**
 * @param {DatosSesion} sesion
 * @param {{ nombre: string, telefono: string }} datos
 */
export async function crearDomiciliario(sesion, datos) {
  const domiciliario = await conNegocio(sesion.tenantId, (tx) =>
    tx.domiciliario.create({ data: { tenantId: sesion.tenantId, ...datos }, ...CON_ACCESO }),
  );
  return presentarDomiciliario(domiciliario);
}

/**
 * Edita un domiciliario. Si tiene acceso, su usuario lo sigue: el nombre cambia con él y, si
 * se desactiva, ya no puede entrar (se cierran sus sesiones).
 * @param {DatosSesion} sesion
 * @param {string} id
 * @param {{ nombre?: string, telefono?: string, activo?: boolean }} datos
 * @throws {AppError} 404 si no existe en el negocio.
 */
export async function actualizarDomiciliario(sesion, id, datos) {
  const domiciliario = await conNegocio(sesion.tenantId, async (tx) => {
    const actual = await buscarDomiciliario(tx, id);
    await tx.domiciliario.update({ where: { id }, data: datos });

    if (actual.usuarioId) {
      if (datos.nombre !== undefined) {
        await tx.usuario.update({
          where: { id: actual.usuarioId },
          data: { nombre: datos.nombre },
        });
      }
      if (datos.activo === false) {
        await tx.usuario.update({ where: { id: actual.usuarioId }, data: { activo: false } });
        await revocarSesionesDeUsuario(tx, actual.usuarioId);
      }
    }
    return tx.domiciliario.findUniqueOrThrow({ where: { id }, ...CON_ACCESO });
  });
  return presentarDomiciliario(domiciliario);
}

/**
 * Le da acceso a Zenda a un domiciliario: un usuario con rol domiciliario, con el correo y la
 * contraseña que el dueño le entrega. Si ya tuvo acceso y se le quitó, se reactiva con estos
 * datos. Queda en la auditoría (la contraseña nunca).
 * @param {DatosSesion} sesion
 * @param {string} id
 * @param {{ email: string, contrasena: string }} datos
 * @throws {AppError} 404 si no existe; 409 si está inactivo, si ya tiene acceso o si el correo
 *   ya lo usa otra persona del negocio.
 */
export async function darAcceso(sesion, id, { email, contrasena }) {
  // El hash va fuera de la transacción: argon2 es lento a propósito y no debe tenerla abierta.
  const passwordHash = await hashearContrasena(contrasena);

  const domiciliario = await conNegocio(sesion.tenantId, async (tx) => {
    // 1. Un domiciliario activo y sin acceso vigente.
    const actual = await tx.domiciliario.findUnique({ where: { id }, ...CON_ACCESO });
    if (!actual) throw errorDomiciliarioNoEncontrado();
    if (!actual.activo) {
      throw new AppError(
        409,
        'DOMICILIARIO_INACTIVO',
        'Active al domiciliario antes de darle acceso',
      );
    }
    if (actual.usuario?.activo) {
      throw new AppError(409, 'ACCESO_EXISTENTE', 'Este domiciliario ya tiene acceso a Zenda');
    }

    // 2. El correo no lo puede usar otra persona del negocio.
    const conEseCorreo = await tx.usuario.findUnique({
      where: { tenantId_email: { tenantId: sesion.tenantId, email } },
    });
    if (conEseCorreo && conEseCorreo.id !== actual.usuarioId) {
      throw new AppError(409, 'YA_EXISTE', 'Ese correo ya lo usa otra persona del negocio');
    }

    // 3. Crear su usuario o, si ya tuvo acceso, reactivarlo con los datos nuevos.
    const datosUsuario = {
      nombre: actual.nombre,
      email,
      passwordHash,
      activo: true,
      intentosFallidos: 0,
      bloqueadoHasta: null,
    };
    if (actual.usuarioId) {
      await tx.usuario.update({ where: { id: actual.usuarioId }, data: datosUsuario });
    } else {
      const usuario = await tx.usuario.create({
        data: { ...datosUsuario, tenantId: sesion.tenantId, rol: 'domiciliario' },
      });
      await tx.domiciliario.update({ where: { id }, data: { usuarioId: usuario.id } });
    }

    await registrarAuditoria(tx, sesion, {
      accion: ACCIONES.DAR_ACCESO_DOMICILIARIO,
      entidad: 'domiciliarios',
      entidadId: id,
      detalle: { domiciliario: actual.nombre, email },
    });
    return tx.domiciliario.findUniqueOrThrow({ where: { id }, ...CON_ACCESO });
  });
  return presentarDomiciliario(domiciliario);
}

/**
 * Le quita el acceso a Zenda a un domiciliario: su usuario queda inactivo y se cierran sus
 * sesiones. Sigue siendo domiciliario: la caja le puede asignar domicilios.
 * @param {DatosSesion} sesion
 * @param {string} id
 * @throws {AppError} 404 si no existe; 409 si no tiene acceso.
 */
export async function quitarAcceso(sesion, id) {
  const domiciliario = await conNegocio(sesion.tenantId, async (tx) => {
    const actual = await tx.domiciliario.findUnique({ where: { id }, ...CON_ACCESO });
    if (!actual) throw errorDomiciliarioNoEncontrado();
    if (!actual.usuarioId || !actual.usuario?.activo) {
      throw new AppError(409, 'SIN_ACCESO', 'Este domiciliario no tiene acceso a Zenda');
    }

    await tx.usuario.update({ where: { id: actual.usuarioId }, data: { activo: false } });
    await revocarSesionesDeUsuario(tx, actual.usuarioId);
    await registrarAuditoria(tx, sesion, {
      accion: ACCIONES.QUITAR_ACCESO_DOMICILIARIO,
      entidad: 'domiciliarios',
      entidadId: id,
      detalle: { domiciliario: actual.nombre },
    });
    return tx.domiciliario.findUniqueOrThrow({ where: { id }, ...CON_ACCESO });
  });
  return presentarDomiciliario(domiciliario);
}

/**
 * @param {TransaccionPrisma} tx
 * @param {string} id
 */
async function buscarDomiciliario(tx, id) {
  const domiciliario = await tx.domiciliario.findUnique({ where: { id } });
  if (!domiciliario) throw errorDomiciliarioNoEncontrado();
  return domiciliario;
}

function errorDomiciliarioNoEncontrado() {
  return new AppError(404, 'DOMICILIARIO_NO_ENCONTRADO', 'El domiciliario no existe');
}
