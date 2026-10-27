// @ts-check
// Lógica de los clientes finales.
import { AppError } from '../../lib/errors.js';
import { conNegocio } from '../../lib/negocio.js';

/** @typedef {import('../../lib/tokens.js').DatosSesion} DatosSesion */

/** Máximo de clientes por búsqueda: la caja busca a uno, no recorre la lista completa. */
const MAXIMO_RESULTADOS = 50;

/**
 * Busca clientes por nombre (contiene, sin importar mayúsculas) o por número de documento (empieza por).
 * Sin búsqueda, devuelve los más recientes por nombre.
 * @param {DatosSesion} sesion
 * @param {{ buscar?: string }} filtros
 */
export function listarClientes(sesion, { buscar }) {
  return conNegocio(sesion.tenantId, (tx) =>
    tx.cliente.findMany({
      where: buscar
        ? {
            OR: [
              { nombre: { contains: buscar, mode: 'insensitive' } },
              { numeroDocumento: { startsWith: buscar } },
            ],
          }
        : undefined,
      orderBy: { nombre: 'asc' },
      take: MAXIMO_RESULTADOS,
    }),
  );
}

/**
 * @param {DatosSesion} sesion
 * @param {string} id
 */
export async function obtenerCliente(sesion, id) {
  const cliente = await conNegocio(sesion.tenantId, (tx) =>
    tx.cliente.findUnique({ where: { id } }),
  );
  if (!cliente) throw new AppError(404, 'NO_ENCONTRADO', 'El cliente no existe');
  return cliente;
}

/**
 * Registra un cliente. Si ya existe uno con el mismo tipo y número de documento, responde 409.
 * @param {DatosSesion} sesion
 * @param {{ tipoDocumento: 'cc' | 'nit' | 'ce' | 'pasaporte' | 'otro', numeroDocumento: string,
 *   nombre: string, email?: string | null, telefono?: string | null }} datos
 */
export function crearCliente(sesion, datos) {
  return conNegocio(sesion.tenantId, (tx) =>
    tx.cliente.create({ data: { ...datos, tenantId: sesion.tenantId } }),
  );
}

/**
 * @param {DatosSesion} sesion
 * @param {string} id
 * @param {Partial<{ tipoDocumento: 'cc' | 'nit' | 'ce' | 'pasaporte' | 'otro', numeroDocumento: string,
 *   nombre: string, email: string | null, telefono: string | null }>} datos
 */
export function actualizarCliente(sesion, id, datos) {
  return conNegocio(sesion.tenantId, (tx) => tx.cliente.update({ where: { id }, data: datos }));
}
