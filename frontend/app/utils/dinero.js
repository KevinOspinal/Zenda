// @ts-check
// Dinero en pantalla: convierte los valores del API a Decimal, suma sin errores de punto
// flotante y muestra en pesos colombianos.
//
// El API envía el dinero como texto ("12000", "25925.92"). Nunca se usa `number` para
// sumar: 0.1 + 0.2 da 0.30000000000000004. Las cuentas de esta app son solo ayuda visual
// (cambio, cuánto falta, total del arqueo); los totales oficiales los calcula el backend.
import DecimalBase from 'decimal.js';

/**
 * Clase Decimal de la app, con la misma configuración del backend: mucha precisión interna
 * y redondeo "a la par" (el de la DIAN).
 */
export const Decimal = DecimalBase.clone({ precision: 40, rounding: DecimalBase.ROUND_HALF_EVEN });

/** @typedef {InstanceType<typeof Decimal>} ValorDecimal */
/** @typedef {string | number | ValorDecimal} ValorDinero */

/** Formato de pesos sin centavos: $ 12.000 */
const PESOS_ENTEROS = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** Formato de pesos con centavos: $ 25.925,92 */
const PESOS_CON_CENTAVOS = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Cantidades de producto: hasta 3 decimales, con coma decimal (0,5 porción). */
const CANTIDAD = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 3 });

/** Porcentajes: hasta 2 decimales (48,28 %). */
const PORCENTAJE = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 });

/**
 * Convierte un valor a Decimal.
 * Acepta texto del API ("3500.50"), Decimal o un número escrito en el código (2000).
 * @param {ValorDinero} valor
 * @returns {ValorDecimal}
 * @throws {TypeError} Si el valor está vacío o no es un número finito.
 */
export function aDecimal(valor) {
  if (valor === '' || valor === null || valor === undefined) {
    throw new TypeError('Valor numérico vacío');
  }
  let decimal;
  try {
    decimal = new Decimal(typeof valor === 'number' ? String(valor) : valor);
  } catch {
    throw new TypeError(`Valor numérico inválido: ${valor}`);
  }
  if (!decimal.isFinite()) throw new TypeError(`Valor numérico inválido: ${valor}`);
  return decimal;
}

/**
 * Suma una lista de valores. Devuelve 0 si la lista está vacía.
 * @param {ValorDinero[]} valores
 * @returns {ValorDecimal}
 */
export function sumar(valores) {
  return valores.reduce(
    (acumulado, valor) => acumulado.plus(aDecimal(valor)),
    /** @type {ValorDecimal} */ (new Decimal(0)),
  );
}

/**
 * Muestra un valor en pesos colombianos.
 * - Por defecto, sin centavos si el valor es entero: precios y totales a cobrar ($ 12.000).
 * - Con centavos si los tiene o si se pide `conCentavos` (bases e impuestos: $ 25.925,92).
 *   Nunca se ocultan centavos que existen: eso cambiaría el valor que se muestra.
 * @param {ValorDinero} valor
 * @param {{ conCentavos?: boolean }} [opciones]
 * @returns {string}
 */
export function formatearPesos(valor, { conCentavos = false } = {}) {
  const decimal = aDecimal(valor);
  const formato = conCentavos || !decimal.isInteger() ? PESOS_CON_CENTAVOS : PESOS_ENTEROS;
  // Intl acepta el número como texto: así no pasa por punto flotante y no pierde precisión.
  return formato.format(/** @type {any} */ (decimal.toFixed(2)));
}

/**
 * Muestra una cantidad de producto: "2", "0,5", "1,25".
 * @param {ValorDinero} valor
 * @returns {string}
 */
export function formatearCantidad(valor) {
  return CANTIDAD.format(/** @type {any} */ (aDecimal(valor).toFixed(3)));
}

/**
 * Muestra un porcentaje: "10 %", "48,28 %". El espacio antes del signo es el correcto en
 * español y no se parte entre líneas.
 * @param {ValorDinero} valor Porcentaje (10 = 10 %).
 * @returns {string}
 */
export function formatearPorcentaje(valor) {
  return `${PORCENTAJE.format(/** @type {any} */ (aDecimal(valor).toFixed(2)))}\u00a0%`;
}

/**
 * Indica si un texto es un monto que acepta el API: solo dígitos, sin separadores de miles
 * y con máximo 2 decimales separados por punto ("12000", "12000.5").
 * @param {string} texto
 */
export function esMontoValido(texto) {
  return /^\d{1,12}(\.\d{1,2})?$/.test(texto);
}

/**
 * Texto de un monto para los campos y para el API: sin decimales si es entero ("42000") y
 * con dos si tiene centavos ("42000.50").
 * @param {ValorDinero} valor
 */
export function montoComoTexto(valor) {
  const decimal = aDecimal(valor);
  return decimal.toFixed(decimal.isInteger() ? 0 : 2);
}
