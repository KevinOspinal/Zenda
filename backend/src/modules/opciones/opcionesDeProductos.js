// @ts-check
// Opciones de cada producto al pedirlo: qué grupos lleva (con sus opciones activas) y la
// revisión de lo que se eligió. Lo usan el menú (para mostrarlas) y los pedidos (para cobrarlas).
//
// Regla: un grupo sin opciones activas no se ofrece, y si se desactivaron opciones, el mínimo
// nunca pide más de las que quedan. Así un plato nunca queda imposible de pedir.
import { AppError } from '../../lib/errors.js';

/**
 * Los grupos de un producto con sus opciones activas, en orden. Va en un `include` o `select`
 * de Prisma sobre `producto`.
 */
export const GRUPOS_DEL_PRODUCTO = /** @type {const} */ ({
  orderBy: { orden: 'asc' },
  select: {
    grupo: {
      select: {
        id: true,
        nombre: true,
        minimo: true,
        maximo: true,
        opciones: {
          where: { activo: true },
          orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
          select: { id: true, nombre: true, precioExtra: true, tipoImpuesto: true },
        },
      },
    },
  },
});

/**
 * @typedef {object} OpcionParaPedir
 * @property {string} id
 * @property {string} nombre
 * @property {import('@prisma/client').Prisma.Decimal} precioExtra
 * @property {import('../../config/impuestos.js').TipoImpuesto} tipoImpuesto
 */

/**
 * @typedef {object} GrupoParaPedir
 * @property {string} id
 * @property {string} nombre
 * @property {number} minimo Ya ajustado a las opciones activas.
 * @property {number | null} maximo
 * @property {OpcionParaPedir[]} opciones Solo las activas.
 */

/**
 * Convierte los grupos de un producto (como los trae GRUPOS_DEL_PRODUCTO) en los que se
 * ofrecen al pedirlo: sin los grupos vacíos y con el mínimo ajustado a las opciones activas.
 * @param {{ grupo: Omit<GrupoParaPedir, 'minimo'> & { minimo: number } }[]} grupos
 * @returns {GrupoParaPedir[]}
 */
export function gruposParaPedir(grupos) {
  return grupos
    .map(({ grupo }) => ({ ...grupo, minimo: Math.min(grupo.minimo, grupo.opciones.length) }))
    .filter((grupo) => grupo.opciones.length > 0);
}

/**
 * Revisa las opciones elegidas para un plato y las entrega en el orden en que se muestran.
 * @param {string} producto Nombre del producto, para los mensajes.
 * @param {GrupoParaPedir[]} grupos Los grupos que se le ofrecen (ver gruposParaPedir).
 * @param {string[]} elegidas Ids de las opciones elegidas.
 * @returns {{ grupo: GrupoParaPedir, opcion: OpcionParaPedir }[]}
 * @throws {AppError} 422 si una opción no es de este producto o si un grupo no se cumple.
 */
export function revisarOpcionesElegidas(producto, grupos, elegidas) {
  // 1. Cada opción elegida debe ser de alguno de los grupos del producto.
  const delProducto = grupos.flatMap((grupo) => grupo.opciones.map((opcion) => opcion.id));
  if (elegidas.some((id) => !delProducto.includes(id))) {
    throw new AppError(
      422,
      'OPCION_NO_VALIDA',
      `Una de las opciones elegidas no está disponible para "${producto}"`,
    );
  }

  // 2. Cada grupo debe cumplir su mínimo y su máximo.
  const resultado = [];
  for (const grupo of grupos) {
    const delGrupo = grupo.opciones.filter((opcion) => elegidas.includes(opcion.id));
    if (delGrupo.length < grupo.minimo) {
      const cuantas = grupo.minimo === 1 ? 'una opción' : `${grupo.minimo} opciones`;
      throw new AppError(
        422,
        'FALTAN_OPCIONES',
        `Elige ${cuantas} en "${grupo.nombre}" para "${producto}"`,
      );
    }
    if (grupo.maximo !== null && delGrupo.length > grupo.maximo) {
      const cuantas = grupo.maximo === 1 ? 'una sola opción' : `máximo ${grupo.maximo} opciones`;
      throw new AppError(
        422,
        'DEMASIADAS_OPCIONES',
        `En "${grupo.nombre}" se puede elegir ${cuantas}`,
      );
    }
    for (const opcion of delGrupo) resultado.push({ grupo, opcion });
  }
  return resultado;
}
