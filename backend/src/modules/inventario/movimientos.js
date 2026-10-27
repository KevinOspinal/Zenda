// @ts-check
// Movimientos de inventario que generan las ventas.
//
// Regla: el stock de un producto siempre es la suma de sus movimientos.
// - Venta cobrada:   movimiento "venta" con cantidad negativa, enlazado al pedido.
// - Venta anulada:   movimiento "ajuste" con cantidad positiva, enlazado al mismo pedido.
// Solo se mueven los productos con `controlaStock = true` (por ejemplo, bebidas embotelladas).
//
// Se permite vender aunque el stock quede negativo: bloquear la venta en plena hora pico
// por un inventario desactualizado es peor. En ese caso se devuelve una advertencia.
import { sumar } from '../../lib/dinero.js';

/** @typedef {import('../../lib/negocio.js').TransaccionPrisma} TransaccionPrisma */

/**
 * @typedef {object} AdvertenciaStock
 * @property {string} productoId
 * @property {string} nombre
 * @property {string} stock Stock que quedó después de la venta (negativo).
 */

/**
 * Descuenta del inventario los productos vendidos en un pedido.
 * Se llama al cobrar, dentro de la misma transacción.
 * @param {TransaccionPrisma} tx
 * @param {string} tenantId
 * @param {string} pedidoId
 * @returns {Promise<AdvertenciaStock[]>} Productos que quedaron con stock negativo.
 */
export async function descontarInventarioPorVenta(tx, tenantId, pedidoId) {
  // 1. Ítems del pedido cuyos productos controlan inventario.
  const items = await tx.itemPedido.findMany({
    where: { pedidoId, producto: { controlaStock: true } },
    select: { productoId: true, cantidad: true },
  });

  // 2. Un movimiento por producto, aunque aparezca en varios ítems del pedido.
  /** @type {AdvertenciaStock[]} */
  const advertencias = [];
  for (const [productoId, cantidad] of agruparPorProducto(items)) {
    const producto = await moverStock(tx, {
      tenantId,
      productoId,
      pedidoId,
      tipo: 'venta',
      cantidad: cantidad.negated(),
    });

    if (producto.stock.isNegative()) {
      advertencias.push({ productoId, nombre: producto.nombre, stock: producto.stock.toString() });
    }
  }
  return advertencias;
}

/**
 * Devuelve al inventario lo que se descontó por la venta de un pedido que se anula.
 * @param {TransaccionPrisma} tx
 * @param {string} tenantId
 * @param {string} pedidoId
 */
export async function devolverInventarioPorAnulacion(tx, tenantId, pedidoId) {
  // Se revierte exactamente lo que se descontó (no lo que diga hoy el pedido).
  const ventas = await tx.movimientoInventario.findMany({
    where: { pedidoId, tipo: 'venta' },
    select: { productoId: true, cantidad: true },
  });

  for (const [productoId, cantidad] of agruparPorProducto(ventas)) {
    await moverStock(tx, {
      tenantId,
      productoId,
      pedidoId,
      tipo: 'ajuste',
      cantidad: cantidad.negated(),
    });
  }
}

/**
 * Registra un movimiento y actualiza el stock del producto en una sola operación atómica.
 * @param {TransaccionPrisma} tx
 * @param {{ tenantId: string, productoId: string, pedidoId?: string,
 *   tipo: 'venta' | 'compra' | 'ajuste', cantidad: import('../../lib/dinero.js').ValorDecimal }} movimiento
 * @returns {Promise<{ nombre: string, stock: import('@prisma/client').Prisma.Decimal }>}
 */
export async function moverStock(tx, { tenantId, productoId, pedidoId, tipo, cantidad }) {
  await tx.movimientoInventario.create({
    data: { tenantId, productoId, pedidoId, tipo, cantidad },
  });

  // `increment` suma en la base: dos ventas simultáneas del mismo producto no se pisan.
  return tx.producto.update({
    where: { id: productoId },
    data: { stock: { increment: cantidad } },
    select: { nombre: true, stock: true },
  });
}

/**
 * Suma las cantidades por producto.
 * @param {{ productoId: string, cantidad: import('../../lib/dinero.js').ValorNumerico }[]} filas
 * @returns {Map<string, import('../../lib/dinero.js').ValorDecimal>}
 */
function agruparPorProducto(filas) {
  /** @type {Map<string, import('../../lib/dinero.js').ValorNumerico[]>} */
  const cantidades = new Map();
  for (const { productoId, cantidad } of filas) {
    cantidades.set(productoId, [...(cantidades.get(productoId) ?? []), cantidad]);
  }
  return new Map([...cantidades].map(([productoId, lista]) => [productoId, sumar(lista)]));
}
