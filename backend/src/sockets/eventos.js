// @ts-check
// Canal de eventos en tiempo real hacia los dispositivos de cada negocio.
//
// Los módulos (pedidos, caja...) llaman a `emitirANegocio` DESPUÉS de que su transacción
// se confirmó: así nunca se avisa de un cambio que luego se deshizo.
//
// Cada negocio tiene su propia sala: un evento de La Industria solo llega a los
// dispositivos de La Industria. Los eventos no llevan datos personales de clientes
// porque el mesero también está en la sala.

/** Nombres de los eventos. Usar siempre estas constantes, nunca texto suelto. */
export const EVENTOS = Object.freeze({
  PEDIDO_CREADO: 'pedido:creado',
  PEDIDO_ACTUALIZADO: 'pedido:actualizado',
  PEDIDO_ENVIADO_A_COCINA: 'pedido:enviado_a_cocina',
  PEDIDO_PAGADO: 'pedido:pagado',
  PEDIDO_ANULADO: 'pedido:anulado',
  ITEM_ESTADO_COCINA: 'item:estado_cocina',
  // Varios platos de un pedido cambiaron a la vez ("Todo listo", "Entregar todo").
  PEDIDO_ESTADO_COCINA: 'pedido:estado_cocina',
  MESA_ESTADO: 'mesa:estado',
  CAJA_ABIERTA: 'caja:abierta',
  CAJA_CERRADA: 'caja:cerrada',
  // Se envía al dispositivo justo antes de desconectarlo porque su token venció.
  SESION_EXPIRADA: 'sesion:expirada',
});

/** @type {import('socket.io').Server | null} */
let servidor = null;

/**
 * Registra el servidor de Socket.IO. Lo llama server.js al arrancar.
 * Mientras no haya servidor (por ejemplo, en las pruebas que no lo usan), emitir no hace nada.
 * @param {import('socket.io').Server | null} io
 */
export function registrarServidorSocket(io) {
  servidor = io;
}

/**
 * Nombre de la sala de un negocio.
 * @param {string} tenantId
 */
export function salaDeNegocio(tenantId) {
  return `negocio:${tenantId}`;
}

/**
 * Envía un evento a todos los dispositivos conectados de un negocio.
 * @param {string} tenantId
 * @param {string} evento Uno de `EVENTOS`.
 * @param {unknown} datos
 */
export function emitirANegocio(tenantId, evento, datos) {
  servidor?.to(salaDeNegocio(tenantId)).emit(evento, datos);
}
