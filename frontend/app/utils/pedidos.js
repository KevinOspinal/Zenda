// @ts-check
// Cómo se nombra y se reconoce un pedido según su tipo: de mesa, de mostrador o a domicilio.
// Los que no tienen mesa se identifican con su número del día y el nombre del cliente.

/** @typedef {'mesa' | 'mostrador' | 'domicilio'} TipoPedido */
/** @typedef {'local' | 'whatsapp' | 'telefono' | 'otro'} OrigenPedido */

/** @type {Readonly<Record<TipoPedido, { etiqueta: string, icono: string }>>} */
export const TIPOS_PEDIDO = Object.freeze({
  mesa: { etiqueta: 'Mesa', icono: 'i-lucide-armchair' },
  mostrador: { etiqueta: 'Mostrador', icono: 'i-lucide-shopping-bag' },
  domicilio: { etiqueta: 'Domicilio', icono: 'i-lucide-bike' },
});

/** Por dónde llegó el pedido. @type {Readonly<Record<OrigenPedido, { etiqueta: string, icono: string }>>} */
export const ORIGENES_PEDIDO = Object.freeze({
  local: { etiqueta: 'En el local', icono: 'i-lucide-store' },
  whatsapp: { etiqueta: 'WhatsApp', icono: 'i-lucide-message-circle' },
  telefono: { etiqueta: 'Teléfono', icono: 'i-lucide-phone' },
  otro: { etiqueta: 'Otro', icono: 'i-lucide-globe' },
});

/**
 * Tipo de un pedido. Los que vienen sin tipo (datos anteriores) se deducen de la mesa.
 * @param {{ tipo?: TipoPedido, mesa?: object | null }} pedido
 * @returns {TipoPedido}
 */
export function tipoDelPedido(pedido) {
  return pedido.tipo ?? (pedido.mesa ? 'mesa' : 'mostrador');
}

/**
 * Nombre con el que se reconoce un pedido: la mesa, o el número del día y el cliente.
 * Por ejemplo: "Mesa 4", "#15 · Juan" o "#16 · Mostrador".
 * @param {{ tipo?: TipoPedido, mesa?: { nombre: string } | null, numero?: number,
 *   nombreCliente?: string | null }} pedido
 */
export function nombreDelPedido(pedido) {
  if (pedido.mesa) return pedido.mesa.nombre;
  const quien = pedido.nombreCliente || TIPOS_PEDIDO[tipoDelPedido(pedido)].etiqueta;
  return pedido.numero ? `#${pedido.numero} · ${quien}` : quien;
}
