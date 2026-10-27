// @ts-check
// Utilidades para manejar dinero con precisión decimal.
//
// Nunca se usan números de punto flotante (`number`) para dinero: 0.1 + 0.2 da 0.30000000000000004.
// Todo valor monetario es un `Decimal` y se redondea con las reglas de la DIAN.
import { Prisma } from '@prisma/client';

/**
 * Clase Decimal de la app. Es la misma de Prisma (decimal.js), con más precisión interna
 * para que las operaciones intermedias no pierdan dígitos, y redondeo "a la par" por defecto.
 */
export const Decimal = Prisma.Decimal.clone({
  precision: 40,
  rounding: Prisma.Decimal.ROUND_HALF_EVEN,
});

/** @typedef {InstanceType<typeof Decimal>} ValorDecimal */
/** @typedef {string | number | Prisma.Decimal} ValorNumerico */

/** Decimales de los montos: totales, bases e impuestos (pesos con centavos). */
export const DECIMALES_MONTO = 2;

/** Decimales de los valores unitarios en la factura electrónica (Anexo técnico DIAN 1.9). */
export const DECIMALES_VALOR_UNITARIO = 6;

/**
 * Convierte un valor a Decimal.
 * Acepta texto ("3500.50"), Decimal o un número que venga de un literal; nunca resultados
 * de operaciones con `number`, porque ya podrían traer errores de punto flotante.
 * @param {ValorNumerico} valor
 * @returns {ValorDecimal}
 * @throws {TypeError} Si el valor no es un número finito.
 */
export function aDecimal(valor) {
  const decimal = new Decimal(typeof valor === 'number' ? String(valor) : valor);
  if (!decimal.isFinite()) {
    throw new TypeError(`Valor numérico inválido: ${valor}`);
  }
  return decimal;
}

/**
 * Redondea "a la par" (round-half-to-even), el método de la DIAN según la NTC 3711:
 * si el dígito a eliminar es exactamente 5, se redondea hacia el dígito par.
 * Ejemplos con 2 decimales: 2.345 → 2.34, 2.355 → 2.36, 2.3451 → 2.35.
 * @param {ValorNumerico} valor
 * @param {number} decimales
 * @returns {ValorDecimal}
 */
export function redondear(valor, decimales) {
  return aDecimal(valor).toDecimalPlaces(decimales, Decimal.ROUND_HALF_EVEN);
}

/**
 * Redondea un monto (total, base o impuesto) a 2 decimales.
 * @param {ValorNumerico} valor
 * @returns {ValorDecimal}
 */
export function redondearMonto(valor) {
  return redondear(valor, DECIMALES_MONTO);
}

/**
 * Suma una lista de valores. Devuelve 0 si la lista está vacía.
 * @param {ValorNumerico[]} valores
 * @returns {ValorDecimal}
 */
export function sumar(valores) {
  return valores.reduce((acumulado, valor) => acumulado.plus(aDecimal(valor)), new Decimal(0));
}
