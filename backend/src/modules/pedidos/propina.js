// @ts-check
// Propina voluntaria (Ley 1935 de 2018).
//
// - Es voluntaria: el negocio la sugiere, pero el cliente decide si la paga y cuánto.
// - La sugerida no puede superar el 10 % del valor del servicio.
// - No es venta del negocio (es de los trabajadores): no hace parte del total del pedido
//   ni de la base de los impuestos.
//
// ⚠️ Pendiente de confirmar con un contador: la ley habla del "valor del servicio" sin
// aclarar si es antes o después de impuestos. Se calcula sobre el subtotal (antes de
// impuestos), que da el valor más bajo y nunca supera el límite.
import { Decimal, aDecimal } from '../../lib/dinero.js';

/** Porcentaje máximo de propina que se puede sugerir (Ley 1935 de 2018). */
export const PROPINA_MAXIMA_SUGERIDA = 10;

/**
 * Calcula la propina que se le sugiere al cliente: el porcentaje del negocio sobre el
 * subtotal del pedido, en pesos enteros y redondeada hacia abajo para no pasar del límite.
 * Ejemplo: subtotal 59259.26 con 10 % → 5925.
 * @param {import('../../lib/dinero.js').ValorNumerico} subtotal Valor del pedido antes de impuestos.
 * @param {import('../../lib/dinero.js').ValorNumerico} porcentaje Porcentaje sugerido por el negocio (0 a 10).
 * @returns {import('../../lib/dinero.js').ValorDecimal}
 */
export function calcularPropinaSugerida(subtotal, porcentaje) {
  return aDecimal(subtotal)
    .times(aDecimal(porcentaje))
    .dividedBy(100)
    .toDecimalPlaces(0, Decimal.ROUND_DOWN);
}
