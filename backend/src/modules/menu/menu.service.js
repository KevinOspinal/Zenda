// @ts-check
// Lógica del menú: categorías, productos y la vista del menú para tomar pedidos.
import { ACCIONES, registrarAuditoria } from '../../lib/auditoria.js';
import { aDecimal } from '../../lib/dinero.js';
import { AppError } from '../../lib/errors.js';
import { conNegocio } from '../../lib/negocio.js';
import { GRUPOS_DEL_PRODUCTO, gruposParaPedir } from '../opciones/opcionesDeProductos.js';
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
 * Menú completo: categorías en orden con sus productos activos y, en cada producto, los grupos
 * de opciones que se eligen al pedirlo (solo las opciones activas).
 * Es lo que ve el mesero al tomar un pedido.
 * @param {DatosSesion} sesion
 */
export function obtenerMenu(sesion) {
  return conNegocio(sesion.tenantId, async (tx) => {
    const categorias = await tx.categoria.findMany({
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
      include: {
        productos: {
          where: { activo: true },
          orderBy: { nombre: 'asc' },
          select: {
            id: true,
            nombre: true,
            descripcion: true,
            precio: true,
            grupos: GRUPOS_DEL_PRODUCTO,
          },
        },
      },
    });
    return categorias.map((categoria) => ({
      ...categoria,
      productos: categoria.productos.map(({ grupos, ...producto }) => ({
        ...producto,
        // El impuesto de cada opción no hace falta para pedir: lo aplica el API al cobrar.
        grupos: gruposParaPedir(grupos).map((grupo) => ({
          ...grupo,
          opciones: grupo.opciones.map(({ id, nombre, precioExtra }) => ({
            id,
            nombre,
            precioExtra,
          })),
        })),
      })),
    }));
  });
}

// ───────────────────────────── Productos ─────────────────────────────

/**
 * @param {DatosSesion} sesion
 * @param {{ categoriaId?: string, activo?: boolean }} filtros
 */
export function listarProductos(sesion, filtros) {
  return conNegocio(sesion.tenantId, async (tx) => {
    const productos = await tx.producto.findMany({
      where: filtros,
      orderBy: { nombre: 'asc' },
      include: CON_GRUPOS,
    });
    return productos.map(presentarProducto);
  });
}

/**
 * @param {DatosSesion} sesion
 * @param {string} id
 */
export async function obtenerProducto(sesion, id) {
  const producto = await conNegocio(sesion.tenantId, (tx) =>
    tx.producto.findUnique({ where: { id }, include: CON_GRUPOS }),
  );
  if (!producto) throw new AppError(404, 'NO_ENCONTRADO', 'El producto no existe');
  return presentarProducto(producto);
}

/**
 * Crea un producto en una categoría del negocio, con los grupos de opciones que lleva.
 * @param {DatosSesion} sesion
 * @param {{ categoriaId: string, nombre: string, descripcion?: string | null, precio: string,
 *   tipoImpuesto: TipoImpuesto, controlaStock: boolean, activo: boolean,
 *   gruposOpciones: string[] }} datos
 */
export function crearProducto(sesion, { gruposOpciones, ...datos }) {
  return conNegocio(sesion.tenantId, async (tx) => {
    // 1. La categoría debe ser de este negocio (las llaves foráneas no aplican RLS).
    await validarCategoria(tx, datos.categoriaId);

    // 2. El impuesto debe ser compatible con el régimen del negocio (INC o IVA, nunca ambos).
    await validarImpuesto(tx, sesion.tenantId, datos.tipoImpuesto);

    // 3. Los grupos de opciones también deben ser de este negocio.
    await validarGrupos(tx, gruposOpciones);

    const producto = await tx.producto.create({
      data: {
        ...datos,
        tenantId: sesion.tenantId,
        grupos: { create: enlacesDeGrupos(sesion.tenantId, gruposOpciones) },
      },
      include: CON_GRUPOS,
    });
    return presentarProducto(producto);
  });
}

/**
 * Actualiza un producto. Si cambia el precio, queda registrado en la auditoría.
 * Las ventas pasadas no cambian: cada ítem de pedido guarda el precio con el que se vendió.
 * @param {DatosSesion} sesion
 * @param {string} id
 * @param {Partial<{ categoriaId: string, nombre: string, descripcion: string | null, precio: string,
 *   tipoImpuesto: TipoImpuesto, controlaStock: boolean, activo: boolean,
 *   gruposOpciones: string[] }>} datos
 */
export function actualizarProducto(sesion, id, { gruposOpciones, ...datos }) {
  return conNegocio(sesion.tenantId, async (tx) => {
    // 1. Buscar el producto actual (null si no existe o es de otro negocio).
    const actual = await tx.producto.findUnique({ where: { id } });
    if (!actual) throw new AppError(404, 'NO_ENCONTRADO', 'El producto no existe');

    // 2. Validar solo lo que cambia.
    if (datos.categoriaId) await validarCategoria(tx, datos.categoriaId);
    if (datos.tipoImpuesto) await validarImpuesto(tx, sesion.tenantId, datos.tipoImpuesto);

    // 3. Los grupos de opciones, si llegan, reemplazan a los anteriores.
    if (gruposOpciones) {
      await validarGrupos(tx, gruposOpciones);
      await tx.productoGrupoOpciones.deleteMany({ where: { productoId: id } });
      await tx.productoGrupoOpciones.createMany({
        data: enlacesDeGrupos(sesion.tenantId, gruposOpciones).map((enlace) => ({
          ...enlace,
          productoId: id,
        })),
      });
    }

    const actualizado = await tx.producto.update({
      where: { id },
      data: datos,
      include: CON_GRUPOS,
    });

    // 4. Auditar el cambio de precio con el valor anterior y el nuevo.
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

    return presentarProducto(actualizado);
  });
}

/** Los grupos de opciones de un producto, en orden (solo sus ids). */
const CON_GRUPOS = /** @type {const} */ ({
  grupos: { orderBy: { orden: 'asc' }, select: { grupoId: true } },
});

/**
 * Producto para el cliente del API: `gruposOpciones` son los ids de sus grupos, en orden.
 * @template {{ grupos: { grupoId: string }[] }} T
 * @param {T} producto
 */
function presentarProducto({ grupos, ...producto }) {
  return { ...producto, gruposOpciones: grupos.map((grupo) => grupo.grupoId) };
}

/**
 * Enlaces producto ↔ grupo para crear, con el orden en que llegaron.
 * @param {string} tenantId
 * @param {string[]} gruposOpciones
 */
function enlacesDeGrupos(tenantId, gruposOpciones) {
  return gruposOpciones.map((grupoId, orden) => ({ tenantId, grupoId, orden }));
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
 * Comprueba que todos los grupos de opciones existan en el negocio activo (las llaves foráneas
 * no aplican RLS: sin esto se podría enlazar el grupo de otro negocio).
 * @param {TransaccionPrisma} tx
 * @param {string[]} gruposOpciones
 */
async function validarGrupos(tx, gruposOpciones) {
  if (gruposOpciones.length === 0) return;
  const encontrados = await tx.grupoOpciones.count({ where: { id: { in: gruposOpciones } } });
  if (encontrados !== gruposOpciones.length) {
    throw new AppError(404, 'GRUPO_NO_ENCONTRADO', 'Uno de los grupos de opciones no existe');
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
