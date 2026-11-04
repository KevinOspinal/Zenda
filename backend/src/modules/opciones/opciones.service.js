// @ts-check
// Grupos de opciones de los productos: "Término de la carne" (elegir 1, obligatorio),
// "Adiciones" (varias, con precio), "Quitar" (varias, sin precio)... Un grupo se crea una vez y
// se asigna a los productos que lo llevan (ver menu.service.js).
//
// Las ventas guardan una copia de cada opción elegida (ver items_pedido_opciones): editar o
// borrar un grupo nunca cambia lo que ya se vendió.
import { ACCIONES, registrarAuditoria } from '../../lib/auditoria.js';
import { aDecimal } from '../../lib/dinero.js';
import { AppError } from '../../lib/errors.js';
import { conNegocio } from '../../lib/negocio.js';
import { obtenerTasaImpuesto } from '../pedidos/calculoImpuestos.js';

/** @typedef {import('../../lib/tokens.js').DatosSesion} DatosSesion */
/** @typedef {import('../../lib/negocio.js').TransaccionPrisma} TransaccionPrisma */
/** @typedef {import('../../config/impuestos.js').TipoImpuesto} TipoImpuesto */

/**
 * @typedef {object} DatosOpcion
 * @property {string} [id] Opción que ya existe; sin id es nueva.
 * @property {string} nombre
 * @property {string} precioExtra
 * @property {TipoImpuesto} tipoImpuesto
 * @property {boolean} activo
 */

/**
 * @typedef {object} DatosGrupo
 * @property {string} nombre
 * @property {number} minimo
 * @property {number | null} maximo
 * @property {number} orden
 * @property {DatosOpcion[]} opciones En el orden en que se muestran.
 */

/** Lo que se devuelve de un grupo: sus opciones en orden y en cuántos productos se usa. */
const DETALLE_GRUPO = /** @type {const} */ ({
  opciones: { orderBy: [{ orden: 'asc' }, { nombre: 'asc' }] },
  _count: { select: { productos: true } },
});

/**
 * Grupo listo para el cliente del API: `productos` es en cuántos productos se usa.
 * @param {{ _count: { productos: number }, [campo: string]: unknown }} grupo
 */
function presentarGrupo({ _count, ...grupo }) {
  return { ...grupo, productos: _count.productos };
}

/**
 * Todos los grupos del negocio con sus opciones (también las inactivas).
 * @param {DatosSesion} sesion
 */
export function listarGrupos(sesion) {
  return conNegocio(sesion.tenantId, async (tx) => {
    const grupos = await tx.grupoOpciones.findMany({
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
      include: DETALLE_GRUPO,
    });
    return grupos.map(presentarGrupo);
  });
}

/**
 * Crea un grupo con sus opciones.
 * @param {DatosSesion} sesion
 * @param {DatosGrupo} datos
 */
export function crearGrupo(sesion, { opciones, ...grupo }) {
  return conNegocio(sesion.tenantId, async (tx) => {
    // 1. El impuesto de cada opción debe ser compatible con el régimen del negocio.
    await validarImpuestos(tx, sesion.tenantId, opciones);

    // 2. Crear el grupo y sus opciones, en el orden en que llegaron.
    const creado = await tx.grupoOpciones.create({
      data: {
        ...grupo,
        tenantId: sesion.tenantId,
        opciones: {
          create: opciones.map(({ id: _id, ...opcion }, orden) => ({
            ...opcion,
            orden,
            tenantId: sesion.tenantId,
          })),
        },
      },
      include: DETALLE_GRUPO,
    });
    return presentarGrupo(creado);
  });
}

/**
 * Reemplaza un grupo con lo que llega: actualiza las opciones que traen id, crea las nuevas y
 * borra las que no llegaron. Los cambios de precio quedan en la auditoría.
 * @param {DatosSesion} sesion
 * @param {string} id
 * @param {DatosGrupo} datos
 */
export function actualizarGrupo(sesion, id, { opciones, ...grupo }) {
  return conNegocio(sesion.tenantId, async (tx) => {
    // 1. El grupo debe ser del negocio.
    const actual = await tx.grupoOpciones.findUnique({
      where: { id },
      include: { opciones: true },
    });
    if (!actual) throw new AppError(404, 'NO_ENCONTRADO', 'El grupo de opciones no existe');

    // 2. Validar los impuestos y que las opciones con id sean de este grupo.
    await validarImpuestos(tx, sesion.tenantId, opciones);
    const existentes = new Map(actual.opciones.map((opcion) => [opcion.id, opcion]));
    for (const opcion of opciones) {
      if (opcion.id && !existentes.has(opcion.id)) {
        throw new AppError(404, 'OPCION_NO_ENCONTRADA', `"${opcion.nombre}" no es de este grupo`);
      }
    }

    // 3. Borrar las que ya no están. Las ventas que las tenían conservan su copia.
    const quedan = opciones.map((opcion) => opcion.id).filter((idOpcion) => idOpcion !== undefined);
    await tx.opcion.deleteMany({ where: { grupoId: id, id: { notIn: quedan } } });

    // 4. Actualizar las existentes (auditando el precio) y crear las nuevas, en su orden.
    for (const [orden, { id: idOpcion, ...opcion }] of opciones.entries()) {
      const anterior = idOpcion ? existentes.get(idOpcion) : undefined;
      if (!anterior) {
        await tx.opcion.create({
          data: { ...opcion, orden, grupoId: id, tenantId: sesion.tenantId },
        });
        continue;
      }
      await tx.opcion.update({ where: { id: anterior.id }, data: { ...opcion, orden } });
      if (!anterior.precioExtra.equals(aDecimal(opcion.precioExtra))) {
        await registrarAuditoria(tx, sesion, {
          accion: ACCIONES.CAMBIAR_PRECIO,
          entidad: 'opciones',
          entidadId: anterior.id,
          detalle: {
            producto: `${grupo.nombre} · ${opcion.nombre}`,
            precioAnterior: anterior.precioExtra.toFixed(2),
            precioNuevo: aDecimal(opcion.precioExtra).toFixed(2),
          },
        });
      }
    }

    // 5. Guardar los datos del grupo.
    const actualizado = await tx.grupoOpciones.update({
      where: { id },
      data: grupo,
      include: DETALLE_GRUPO,
    });
    return presentarGrupo(actualizado);
  });
}

/**
 * Borra un grupo con sus opciones y lo quita de los productos que lo llevaban. Las ventas
 * pasadas conservan su copia de las opciones elegidas.
 * @param {DatosSesion} sesion
 * @param {string} id
 */
export async function eliminarGrupo(sesion, id) {
  // Si no existe o es de otro negocio, Prisma lanza P2025 → 404.
  await conNegocio(sesion.tenantId, (tx) => tx.grupoOpciones.delete({ where: { id } }));
}

/**
 * Comprueba que el impuesto de cada opción sea compatible con el régimen del negocio, igual
 * que el de los productos (INC o IVA, nunca ambos).
 * @param {TransaccionPrisma} tx
 * @param {string} tenantId
 * @param {{ tipoImpuesto: TipoImpuesto }[]} opciones
 * @throws {AppError} 422 si el negocio no puede cobrar alguno de esos impuestos.
 */
async function validarImpuestos(tx, tenantId, opciones) {
  const negocio = await tx.tenant.findUniqueOrThrow({ where: { id: tenantId } });
  for (const { tipoImpuesto } of opciones)
    obtenerTasaImpuesto(negocio.regimenImpuesto, tipoImpuesto);
}
