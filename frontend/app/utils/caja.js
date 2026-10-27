// @ts-check
// Cuentas de la caja en pantalla: el cobro (cuánto falta, el cambio) y el conteo del
// efectivo al cerrar. Son ayuda visual con Decimal: lo que se guarda lo calcula y lo valida
// el backend (los pagos deben sumar exactamente el total más la propina).
import { Decimal, aDecimal, esMontoValido, sumar } from './dinero.js';

/** @typedef {import('./dinero.js').ValorDinero} ValorDinero */
/** @typedef {'efectivo' | 'tarjeta' | 'transferencia' | 'otro'} MetodoPago */
/**
 * Un pago mientras el cajero arma el cobro. Los montos son texto, como en los campos.
 * @typedef {{ metodo: MetodoPago, monto: string, recibido?: string, referencia?: string }} PagoEnPantalla
 */

/** Billetes colombianos en circulación, de mayor a menor. */
export const BILLETES = Object.freeze([100000, 50000, 20000, 10000, 5000, 2000]);
/** Monedas colombianas en circulación, de mayor a menor. */
export const MONEDAS = Object.freeze([1000, 500, 200, 100, 50]);

/**
 * Valor de un campo de dinero; si está vacío o no es válido, cuenta como cero.
 * @param {string | undefined} texto
 */
function valorDelCampo(texto) {
  return texto && esMontoValido(texto) ? aDecimal(texto) : new Decimal(0);
}

/**
 * Cómo va el cobro mientras el cajero lo arma.
 * @param {{ total: ValorDinero, propina: ValorDinero, pagos: PagoEnPantalla[] }} datos
 */
export function estadoDelCobro({ total, propina, pagos }) {
  const aPagar = aDecimal(total).plus(aDecimal(propina || 0));
  const pagado = sumar(pagos.map((pago) => valorDelCampo(pago.monto)));
  const diferencia = aPagar.minus(pagado);
  // El cambio: lo que entregó el cliente en efectivo menos lo que se abona en efectivo.
  const cambio = sumar(
    pagos
      .filter((pago) => pago.metodo === 'efectivo' && pago.recibido)
      .map((pago) => Decimal.max(valorDelCampo(pago.recibido).minus(valorDelCampo(pago.monto)), 0)),
  );
  return {
    aPagar,
    pagado,
    faltante: Decimal.max(diferencia, 0),
    sobrante: Decimal.max(diferencia.negated(), 0),
    cuadra: diferencia.isZero() && pagado.greaterThan(0),
    cambio,
  };
}

/**
 * Indica si lo recibido en efectivo alcanza para el monto (el backend no acepta menos).
 * @param {PagoEnPantalla} pago
 */
export function recibidoAlcanza(pago) {
  if (pago.metodo !== 'efectivo' || !pago.recibido) return true;
  return valorDelCampo(pago.recibido).greaterThanOrEqualTo(valorDelCampo(pago.monto));
}

/**
 * Convierte los pagos de la pantalla al formato del API: sin campos vacíos y con el
 * recibido solo en efectivo.
 * @param {PagoEnPantalla[]} pagos
 */
export function pagosParaApi(pagos) {
  return pagos
    .filter((pago) => valorDelCampo(pago.monto).greaterThan(0))
    .map(({ metodo, monto, recibido, referencia }) => ({
      metodo,
      monto,
      ...(metodo === 'efectivo' && recibido ? { recibido } : {}),
      ...(metodo !== 'efectivo' && referencia?.trim() ? { referencia: referencia.trim() } : {}),
    }));
}

/**
 * Montos rápidos para el efectivo que entrega el cliente: el valor exacto y los redondos
 * más cercanos por encima (por ejemplo, para $ 38.000: 38.000, 40.000, 50.000 y 100.000).
 * @param {ValorDinero} aPagar
 * @returns {string[]} Montos en el formato del API, de menor a mayor (máximo 4).
 */
export function montosRapidos(aPagar) {
  const valor = aDecimal(aPagar);
  if (valor.lessThanOrEqualTo(0)) return [];
  const candidatos = [
    valor,
    ...[1000, 5000, 10000, 20000, 50000, 100000].map((paso) =>
      valor.dividedBy(paso).ceil().times(paso),
    ),
  ];
  const unicos = [...new Set(candidatos.map((monto) => monto.toFixed(monto.isInteger() ? 0 : 2)))];
  return unicos.sort((a, b) => aDecimal(a).comparedTo(aDecimal(b))).slice(0, 4);
}

/**
 * Total del efectivo contado por denominación.
 * @param {Record<string | number, number>} conteo Por ejemplo { 50000: 2, 1000: 3 }.
 */
export function totalDelConteo(conteo) {
  return sumar(
    Object.entries(conteo).map(([valor, cantidad]) =>
      aDecimal(valor).times(Number.isFinite(cantidad) && cantidad > 0 ? cantidad : 0),
    ),
  );
}
