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
 *   estadoCocina: string, producto: { nombre: string },
 *   opciones?: { id: string, grupo: string, nombre: string }[] }[]} items
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
    // Término, adiciones, lo que hay que quitar...: la cocina los necesita para prepararlo.
    opciones: (item.opciones ?? []).map(({ id, grupo, nombre }) => ({ id, grupo, nombre })),
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

/**
 * Un pedido cobrado ocupa su mesa hasta que llegan sus platos. Al enviarlo a la cocina o al
 * entregar un plato, la mesa puede cambiar (con el último plato queda libre): se avisa.
 * @param {PedidoCompleto} pedido
 */
function avisarMesaDePedidoCobrado(pedido) {
  if (pedido.estado === 'pagado') avisarEstadoMesa(pedido);
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
  avisarMesaDePedidoCobrado(pedido);
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
  if (item.estadoCocina === 'entregado') avisarMesaDePedidoCobrado(pedido);
}

/**
 * Varios platos de un pedido cambiaron a la vez ("Todo listo", "Entregar todo"). Un solo
 * evento con todos, para que el mesero reciba un solo aviso y no uno por plato.
 * @param {PedidoCompleto} pedido
 * @param {string[]} itemIds Los platos que cambiaron.
 */
export function avisarEstadoCocinaDelPedido(pedido, itemIds) {
  const cambiados = pedido.items.filter((item) => itemIds.includes(item.id));
  if (cambiados.length === 0) return;
  emitirANegocio(pedido.tenantId, EVENTOS.PEDIDO_ESTADO_COCINA, {
    pedidoId: pedido.id,
    tipo: pedido.tipo,
    numero: pedido.numero,
    mesa: pedido.mesa ? { id: pedido.mesa.id, nombre: pedido.mesa.nombre } : null,
    estadoCocina: cambiados[0].estadoCocina,
    items: cambiados.map((item) => ({
      id: item.id,
      producto: item.producto.nombre,
      cantidad: item.cantidad,
    })),
  });
  if (cambiados[0].estadoCocina === 'entregado') avisarMesaDePedidoCobrado(pedido);
}

/**
 * Se entregó el pedido (POST /pedidos/:id/entregar). Si es de mesa (se cobró y no fue a la
 * cocina), la mesa quedó libre: también se avisa.
 * @param {PedidoCompleto} pedido
 */
export function avisarPedidoEntregado(pedido) {
  avisarPedidoActualizado(pedido);
  avisarEstadoMesa(pedido);
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
