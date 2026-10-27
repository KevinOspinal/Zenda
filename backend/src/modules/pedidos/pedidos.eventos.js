// @ts-check
// Eventos en tiempo real de los pedidos y las mesas.
//
// Los datos de cada evento son mínimos: lo que necesita cada pantalla para actualizarse.
// No incluyen datos personales de clientes (nombre, documento, correo) porque los meseros
// también están en la sala del negocio. Si una pantalla necesita más, consulta el API.
import { EVENTOS, emitirANegocio } from '../../sockets/eventos.js';

/**
 * Pedido tal como lo devuelve el servicio (con ítems, pagos y mesa).
 * @typedef {object} PedidoCompleto
 * @property {string} id
 * @property {string} tenantId
 * @property {string} estado
 * @property {string} tipo
 * @property {number} numero
 * @property {string} meseroId
 * @property {import('@prisma/client').Prisma.Decimal} total
 * @property {Date} abiertoEn
 * @property {{ id: string, nombre: string, estado: string } | null} mesa
 * @property {{ id: string, cantidad: import('@prisma/client').Prisma.Decimal, notas: string | null,
 *   estadoCocina: string, producto: { nombre: string } }[]} items
 */

/**
 * Datos básicos de un pedido para listas y tableros.
 * @param {PedidoCompleto} pedido
 */
function resumen(pedido) {
  return {
    id: pedido.id,
    estado: pedido.estado,
    tipo: pedido.tipo,
    numero: pedido.numero,
    mesa: pedido.mesa ? { id: pedido.mesa.id, nombre: pedido.mesa.nombre } : null,
    meseroId: pedido.meseroId,
    total: pedido.total,
    abiertoEn: pedido.abiertoEn,
  };
}

/**
 * La comanda: lo que la cocina necesita para preparar el pedido.
 * @param {PedidoCompleto} pedido
 */
function itemsDeComanda(pedido) {
  return pedido.items.map((item) => ({
    id: item.id,
    producto: item.producto.nombre,
    cantidad: item.cantidad,
    notas: item.notas,
    estadoCocina: item.estadoCocina,
  }));
}

/**
 * Avisa el estado de la mesa del pedido (ocupada o libre), si tiene mesa.
 * @param {PedidoCompleto} pedido
 */
function avisarEstadoMesa(pedido) {
  if (!pedido.mesa) return;
  emitirANegocio(pedido.tenantId, EVENTOS.MESA_ESTADO, {
    mesaId: pedido.mesa.id,
    nombre: pedido.mesa.nombre,
    estado: pedido.mesa.estado,
  });
}

/** @param {PedidoCompleto} pedido */
export function avisarPedidoCreado(pedido) {
  emitirANegocio(pedido.tenantId, EVENTOS.PEDIDO_CREADO, resumen(pedido));
  avisarEstadoMesa(pedido);
}

/**
 * Se agregaron o quitaron ítems. Incluye la comanda completa: si el pedido ya estaba
 * en cocina, la cocina ve de inmediato lo nuevo.
 * @param {PedidoCompleto} pedido
 */
export function avisarPedidoActualizado(pedido) {
  emitirANegocio(pedido.tenantId, EVENTOS.PEDIDO_ACTUALIZADO, {
    ...resumen(pedido),
    items: itemsDeComanda(pedido),
  });
}

/** @param {PedidoCompleto} pedido */
export function avisarEnviadoACocina(pedido) {
  emitirANegocio(pedido.tenantId, EVENTOS.PEDIDO_ENVIADO_A_COCINA, {
    ...resumen(pedido),
    items: itemsDeComanda(pedido),
  });
}

/**
 * Cambió el estado de cocina de un ítem (por ejemplo, "listo": el mesero puede llevarlo).
 * @param {PedidoCompleto} pedido
 * @param {string} itemId
 */
export function avisarEstadoCocina(pedido, itemId) {
  const item = pedido.items.find((i) => i.id === itemId);
  if (!item) return;
  emitirANegocio(pedido.tenantId, EVENTOS.ITEM_ESTADO_COCINA, {
    pedidoId: pedido.id,
    mesa: pedido.mesa ? { id: pedido.mesa.id, nombre: pedido.mesa.nombre } : null,
    itemId: item.id,
    producto: item.producto.nombre,
    estadoCocina: item.estadoCocina,
  });
}

/** @param {PedidoCompleto} pedido */
export function avisarPedidoPagado(pedido) {
  emitirANegocio(pedido.tenantId, EVENTOS.PEDIDO_PAGADO, resumen(pedido));
  avisarEstadoMesa(pedido);
}

/** @param {PedidoCompleto} pedido */
export function avisarPedidoAnulado(pedido) {
  emitirANegocio(pedido.tenantId, EVENTOS.PEDIDO_ANULADO, resumen(pedido));
  avisarEstadoMesa(pedido);
}
