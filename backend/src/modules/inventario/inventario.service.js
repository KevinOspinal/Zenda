// @ts-check
// Consulta de inventario y registro de compras y ajustes.
import { ACCIONES, registrarAuditoria } from '../../lib/auditoria.js';
import { aDecimal } from '../../lib/dinero.js';
import { AppError } from '../../lib/errors.js';
import { conNegocio } from '../../lib/negocio.js';
import { moverStock } from './movimientos.js';

/** @typedef {import('../../lib/tokens.js').DatosSesion} DatosSesion */

/**
 * Productos que controlan inventario con su stock actual. Los de stock negativo
 * (vendidos sin existencias registradas) aparecen primero para corregirlos.
 * @param {DatosSesion} sesion
 */
export function listarInventario(sesion) {
  return conNegocio(sesion.tenantId, (tx) =>
    tx.producto.findMany({
      where: { controlaStock: true },
      orderBy: [{ stock: 'asc' }, { nombre: 'asc' }],
      select: { id: true, nombre: true, stock: true, activo: true },
    }),
  );
}

/**
 * Últimos movimientos de un producto, del más reciente al más antiguo.
 * @param {DatosSesion} sesion
 * @param {string} productoId
 */
export function listarMovimientos(sesion, productoId) {
  return conNegocio(sesion.tenantId, async (tx) => {
    const producto = await tx.producto.findUnique({ where: { id: productoId } });
    if (!producto) throw errorProductoNoEncontrado();

    return tx.movimientoInventario.findMany({
      where: { productoId },
      orderBy: { fecha: 'desc' },
      take: 100,
    });
  });
}

/**
 * Registra una compra o un ajuste de inventario. Los ajustes quedan en la auditoría.
 * @param {DatosSesion} sesion
 * @param {{ tipo: 'compra', productoId: string, cantidad: string }
 *   | { tipo: 'ajuste', productoId: string, cantidad: string, motivo: string }} datos
 */
export function registrarMovimiento(sesion, datos) {
  return conNegocio(sesion.tenantId, async (tx) => {
    // 1. El producto debe ser del negocio y controlar inventario.
    const producto = await tx.producto.findUnique({ where: { id: datos.productoId } });
    if (!producto) throw errorProductoNoEncontrado();
    if (!producto.controlaStock) {
      throw new AppError(
        422,
        'PRODUCTO_SIN_INVENTARIO',
        `"${producto.nombre}" no controla inventario`,
      );
    }

    // 2. Registrar el movimiento y actualizar el stock.
    const actualizado = await moverStock(tx, {
      tenantId: sesion.tenantId,
      productoId: producto.id,
      tipo: datos.tipo,
      cantidad: aDecimal(datos.cantidad),
    });

    // 3. Un ajuste manual queda en la auditoría con su motivo.
    if (datos.tipo === 'ajuste') {
      await registrarAuditoria(tx, sesion, {
        accion: ACCIONES.AJUSTAR_INVENTARIO,
        entidad: 'productos',
        entidadId: producto.id,
        detalle: {
          producto: producto.nombre,
          cantidad: datos.cantidad,
          motivo: datos.motivo,
          stockAnterior: producto.stock.toString(),
          stockNuevo: actualizado.stock.toString(),
        },
      });
    }

    return { productoId: producto.id, nombre: producto.nombre, stock: actualizado.stock };
  });
}

function errorProductoNoEncontrado() {
  return new AppError(404, 'NO_ENCONTRADO', 'El producto no existe');
}
