// @ts-check
// Lógica de las mesas del local.
import { AppError } from '../../lib/errors.js';
import { conNegocio } from '../../lib/negocio.js';

/** @typedef {import('../../lib/tokens.js').DatosSesion} DatosSesion */

/**
 * Lista las mesas agrupadas por zona.
 * @param {DatosSesion} sesion
 */
export function listarMesas(sesion) {
  return conNegocio(sesion.tenantId, (tx) =>
    tx.mesa.findMany({ orderBy: [{ zona: 'asc' }, { nombre: 'asc' }] }),
  );
}

/**
 * @param {DatosSesion} sesion
 * @param {string} id
 */
export async function obtenerMesa(sesion, id) {
  const mesa = await conNegocio(sesion.tenantId, (tx) => tx.mesa.findUnique({ where: { id } }));
  if (!mesa) throw new AppError(404, 'NO_ENCONTRADO', 'La mesa no existe');
  return mesa;
}

/**
 * Crea una mesa. Si ya existe otra con el mismo nombre en el negocio, responde 409.
 * @param {DatosSesion} sesion
 * @param {{ nombre: string, zona?: string | null, capacidad: number }} datos
 */
export function crearMesa(sesion, datos) {
  return conNegocio(sesion.tenantId, (tx) =>
    tx.mesa.create({ data: { ...datos, tenantId: sesion.tenantId } }),
  );
}

/**
 * @param {DatosSesion} sesion
 * @param {string} id
 * @param {{ nombre?: string, zona?: string | null, capacidad?: number }} datos
 */
export function actualizarMesa(sesion, id, datos) {
  return conNegocio(sesion.tenantId, (tx) => tx.mesa.update({ where: { id }, data: datos }));
}

/**
 * Elimina una mesa. Si ya tuvo pedidos, la base lo impide (409 EN_USO) para no perder el historial.
 * @param {DatosSesion} sesion
 * @param {string} id
 */
export async function eliminarMesa(sesion, id) {
  await conNegocio(sesion.tenantId, (tx) => tx.mesa.delete({ where: { id } }));
}
