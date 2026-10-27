// @ts-check
// Domiciliarios del negocio: quienes llevan los domicilios. No inician sesión; la caja les
// asigna los pedidos al despacharlos. No se borran: se desactivan, para conservar su historial.
import { AppError } from '../../lib/errors.js';
import { conNegocio } from '../../lib/negocio.js';

/** @typedef {import('../../lib/tokens.js').DatosSesion} DatosSesion */

/**
 * Lista los domiciliarios: primero los activos, por nombre.
 * @param {DatosSesion} sesion
 * @param {{ activos?: boolean }} filtros
 */
export function listarDomiciliarios(sesion, { activos }) {
  return conNegocio(sesion.tenantId, (tx) =>
    tx.domiciliario.findMany({
      where: activos ? { activo: true } : {},
      orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
    }),
  );
}

/**
 * @param {DatosSesion} sesion
 * @param {{ nombre: string, telefono: string }} datos
 */
export function crearDomiciliario(sesion, datos) {
  return conNegocio(sesion.tenantId, (tx) =>
    tx.domiciliario.create({ data: { tenantId: sesion.tenantId, ...datos } }),
  );
}

/**
 * @param {DatosSesion} sesion
 * @param {string} id
 * @param {{ nombre?: string, telefono?: string, activo?: boolean }} datos
 * @throws {AppError} 404 si no existe en el negocio.
 */
export function actualizarDomiciliario(sesion, id, datos) {
  return conNegocio(sesion.tenantId, async (tx) => {
    const existe = await tx.domiciliario.findUnique({ where: { id } });
    if (!existe) {
      throw new AppError(404, 'DOMICILIARIO_NO_ENCONTRADO', 'El domiciliario no existe');
    }
    return tx.domiciliario.update({ where: { id }, data: datos });
  });
}
