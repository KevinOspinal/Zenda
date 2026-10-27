// @ts-check
// Lógica del menú: categorías, productos y la vista del menú para tomar pedidos.
import { ACCIONES, registrarAuditoria } from '../../lib/auditoria.js';
import { aDecimal } from '../../lib/dinero.js';
import { AppError } from '../../lib/errors.js';
import { conNegocio } from '../../lib/negocio.js';
import { obtenerTasaImpuesto } from '../pedidos/calculoImpuestos.js';

/** @typedef {import('../../lib/tokens.js').DatosSesion} DatosSesion */
/** @typedef {import('../../lib/negocio.js').TransaccionPrisma} TransaccionPrisma */
/** @typedef {import('../../config/impuestos.js').TipoImpuesto} TipoImpuesto */

// ───────────────────────────── Categorías ─────────────────────────────

/**
 * Lista las categorías en el orden del menú.
 * @param {DatosSesion} sesion
 */
export function listarCategorias(sesion) {
  return conNegocio(sesion.tenantId, (tx) =>
    tx.categoria.findMany({ orderBy: [{ orden: 'asc' }, { nombre: 'asc' }] }),
  );
}

/**
 * @param {DatosSesion} sesion
 * @param {{ nombre: string, orden: number }} datos
 */
export function crearCategoria(sesion, datos) {
  return conNegocio(sesion.tenantId, (tx) =>
    tx.categoria.create({ data: { ...datos, tenantId: sesion.tenantId } }),
  );
}

/**
 * @param {DatosSesion} sesion
 * @param {string} id
 * @param {{ nombre?: string, orden?: number }} datos
 */
export function actualizarCategoria(sesion, id, datos) {
  // Si la categoría no existe o es de otro negocio, Prisma lanza P2025 → 404.
  return conNegocio(sesion.tenantId, (tx) => tx.categoria.update({ where: { id }, data: datos }));
}

/**
 * Elimina una categoría vacía. Si tiene productos, la base lo impide (409 EN_USO).
 * @param {DatosSesion} sesion
 * @param {string} id
 */
export async function eliminarCategoria(sesion, id) {
  await conNegocio(sesion.tenantId, (tx) => tx.categoria.delete({ where: { id } }));
}

// ───────────────────────────── Menú para tomar pedidos ─────────────────────────────

/**
 * Menú completo: categorías en orden con sus productos activos.
 * Es lo que ve el mesero al tomar un pedido.
 * @param {DatosSesion} sesion
 */
export function obtenerMenu(sesion) {
  return conNegocio(sesion.tenantId, (tx) =>
    tx.categoria.findMany({
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
      include: {
        productos: {
          where: { activo: true },
          orderBy: { nombre: 'asc' },
          select: { id: true, nombre: true, descripcion: true, precio: true },
        },
      },
    }),
  );
}

// ───────────────────────────── Productos ─────────────────────────────

/**
 * @param {DatosSesion} sesion
 * @param {{ categoriaId?: string, activo?: boolean }} filtros
 */
export function listarProductos(sesion, filtros) {
  return conNegocio(sesion.tenantId, (tx) =>
    tx.producto.findMany({ where: filtros, orderBy: { nombre: 'asc' } }),
  );
}

/**
 * @param {DatosSesion} sesion
 * @param {string} id
 */
export async function obtenerProducto(sesion, id) {
  const producto = await conNegocio(sesion.tenantId, (tx) =>
    tx.producto.findUnique({ where: { id } }),
  );
  if (!producto) throw new AppError(404, 'NO_ENCONTRADO', 'El producto no existe');
  return producto;
}

/**
 * Crea un producto en una categoría del negocio.
 * @param {DatosSesion} sesion
 * @param {{ categoriaId: string, nombre: string, descripcion?: string | null, precio: string,
 *   tipoImpuesto: TipoImpuesto, controlaStock: boolean, activo: boolean }} datos
 */
export function crearProducto(sesion, datos) {
  return conNegocio(sesion.tenantId, async (tx) => {
    // 1. La categoría debe ser de este negocio (las llaves foráneas no aplican RLS).
    await validarCategoria(tx, datos.categoriaId);

    // 2. El impuesto debe ser compatible con el régimen del negocio (INC o IVA, nunca ambos).
    await validarImpuesto(tx, sesion.tenantId, datos.tipoImpuesto);

    return tx.producto.create({ data: { ...datos, tenantId: sesion.tenantId } });
  });
}

/**
 * Actualiza un producto. Si cambia el precio, queda registrado en la auditoría.
 * Las ventas pasadas no cambian: cada ítem de pedido guarda el precio con el que se vendió.
 * @param {DatosSesion} sesion
 * @param {string} id
 * @param {Partial<{ categoriaId: string, nombre: string, descripcion: string | null, precio: string,
 *   tipoImpuesto: TipoImpuesto, controlaStock: boolean, activo: boolean }>} datos
 */
export function actualizarProducto(sesion, id, datos) {
  return conNegocio(sesion.tenantId, async (tx) => {
    // 1. Buscar el producto actual (null si no existe o es de otro negocio).
    const actual = await tx.producto.findUnique({ where: { id } });
    if (!actual) throw new AppError(404, 'NO_ENCONTRADO', 'El producto no existe');

    // 2. Validar solo lo que cambia.
    if (datos.categoriaId) await validarCategoria(tx, datos.categoriaId);
    if (datos.tipoImpuesto) await validarImpuesto(tx, sesion.tenantId, datos.tipoImpuesto);

    const actualizado = await tx.producto.update({ where: { id }, data: datos });

    // 3. Auditar el cambio de precio con el valor anterior y el nuevo.
    if (datos.precio !== undefined && !actual.precio.equals(aDecimal(datos.precio))) {
      await registrarAuditoria(tx, sesion, {
        accion: ACCIONES.CAMBIAR_PRECIO,
        entidad: 'productos',
        entidadId: id,
        detalle: {
          producto: actual.nombre,
          precioAnterior: actual.precio.toFixed(2),
          precioNuevo: actualizado.precio.toFixed(2),
        },
      });
    }

    return actualizado;
  });
}

// ───────────────────────────── Validaciones internas ─────────────────────────────

/**
 * Comprueba que la categoría exista en el negocio activo.
 * Es necesario porque PostgreSQL revisa las llaves foráneas sin aplicar RLS: sin esta
 * validación se podría crear un producto apuntando a la categoría de otro negocio.
 * @param {TransaccionPrisma} tx
 * @param {string} categoriaId
 */
async function validarCategoria(tx, categoriaId) {
  const categoria = await tx.categoria.findUnique({ where: { id: categoriaId } });
  if (!categoria) {
    throw new AppError(404, 'CATEGORIA_NO_ENCONTRADA', 'La categoría no existe');
  }
}

/**
 * Comprueba que el tipo de impuesto sea compatible con el régimen del negocio.
 * @param {TransaccionPrisma} tx
 * @param {string} tenantId
 * @param {TipoImpuesto} tipoImpuesto
 * @throws {AppError} 422 si el negocio no puede cobrar ese impuesto.
 */
async function validarImpuesto(tx, tenantId, tipoImpuesto) {
  const negocio = await tx.tenant.findUniqueOrThrow({ where: { id: tenantId } });
  obtenerTasaImpuesto(negocio.regimenImpuesto, tipoImpuesto);
}
