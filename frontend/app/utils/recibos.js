// @ts-check
// Datos del recibo de venta listos para mostrar: su número, cada producto con su valor, los
// pagos con su cambio y el total pagado. Los valores vienen del API; aquí solo se multiplican y
// se restan para mostrarlos.
import { aDecimal } from './dinero.js';

/**
 * Número del recibo con seis cifras: 123 → "000123".
 * @param {number} numero
 */
export function numeroDeRecibo(numero) {
  return String(numero).padStart(6, '0');
}

/**
 * Cada producto del pedido con su valor (cantidad × precio).
 * @param {any} pedido Pedido completo (forma del API).
 */
export function lineasDelRecibo(pedido) {
  return (pedido.items ?? []).map((/** @type {any} */ item) => ({
    id: item.id,
    cantidad: item.cantidad,
    nombre: item.producto.nombre,
    notas: item.notas ?? null,
    valor: aDecimal(item.precioUnitario).times(item.cantidad),
  }));
}

/**
 * Los pagos con el cambio de cada uno: solo en efectivo, cuando el cliente entregó más.
 * @param {any} pedido
 */
export function pagosDelRecibo(pedido) {
  return (pedido.pagos ?? []).map((/** @type {any} */ pago) => {
    const cambio = pago.recibido ? aDecimal(pago.recibido).minus(pago.monto) : null;
    return { ...pago, cambio: cambio && cambio.greaterThan(0) ? cambio : null };
  });
}

/**
 * Lo que pagó el cliente en total: la cuenta más la propina voluntaria.
 * @param {{ total: string, propina?: string | null }} pedido
 */
export function totalPagadoDelRecibo(pedido) {
  return aDecimal(pedido.total).plus(aDecimal(pedido.propina ?? 0));
}
