// @ts-check
// Cálculo de impuestos y totales de un pedido.
//
// Regla de negocio: el precio del menú es el precio final, con el impuesto incluido
// (Ley 1480 de 2011, art. 26: el consumidor solo paga el precio anunciado).
//
// Regla de la DIAN (Anexo técnico de factura electrónica 1.9): los valores se calculan
// de abajo hacia arriba. Primero el valor unitario sin impuesto, luego la base de cada
// línea y después el impuesto como base × tarifa. Todo con redondeo a la par.
//
// Como ese cálculo puede diferir en centavos de la suma de los precios del menú,
// la diferencia se guarda como "ajuste por redondeo" (en la factura electrónica va en
// PayableRoundingAmount). Así el cliente siempre paga exactamente lo que dice el menú.
//
// ⚠️ PENDIENTE DE VALIDAR CON UN CONTADOR (ver src/config/impuestos.js).
import { IMPUESTO_POR_REGIMEN, TARIFAS_IMPUESTO } from '../../config/impuestos.js';
import { AppError } from '../../lib/errors.js';
import {
  DECIMALES_VALOR_UNITARIO,
  Decimal,
  aDecimal,
  redondear,
  redondearMonto,
  sumar,
} from '../../lib/dinero.js';

/** @typedef {import('../../config/impuestos.js').RegimenImpuesto} RegimenImpuesto */
/** @typedef {import('../../config/impuestos.js').TipoImpuesto} TipoImpuesto */
/** @typedef {import('../../lib/dinero.js').ValorDecimal} ValorDecimal */
/** @typedef {import('../../lib/dinero.js').ValorNumerico} ValorNumerico */

/**
 * @typedef {object} LineaCalculada
 * @property {ValorDecimal} tasaImpuesto Porcentaje aplicado, por ejemplo 8.00.
 * @property {ValorDecimal} valorUnitario Precio unitario sin impuesto, con 6 decimales.
 * @property {ValorDecimal} base Valor de la línea sin impuesto (2 decimales).
 * @property {ValorDecimal} impuesto Impuesto de la línea: base × tarifa (2 decimales).
 * @property {ValorDecimal} totalAPagar Lo que paga el cliente por la línea: precio del menú × cantidad.
 */

/**
 * @typedef {object} ImpuestoPorTasa
 * @property {ValorDecimal} tasaImpuesto
 * @property {ValorDecimal} base Suma de las bases de las líneas con esta tasa.
 * @property {ValorDecimal} impuesto Suma de los impuestos de las líneas con esta tasa.
 */

/**
 * @typedef {object} TotalesPedido
 * @property {ValorDecimal} subtotal Suma de las bases (sin impuestos).
 * @property {ValorDecimal} impuestos Suma de los impuestos de las líneas.
 * @property {ValorDecimal} ajusteRedondeo total − (subtotal + impuestos). Unos pocos centavos o cero.
 * @property {ValorDecimal} total Lo que paga el cliente: la suma de los precios del menú.
 * @property {ImpuestoPorTasa[]} impuestosPorTasa Desglose para la factura, ordenado por tasa.
 */

/**
 * Devuelve la tasa de impuesto (en porcentaje) de un producto según el régimen del negocio.
 *
 * @param {RegimenImpuesto} regimen Régimen tributario del negocio.
 * @param {TipoImpuesto} tipoImpuesto Tipo de impuesto configurado en el producto.
 * @returns {ValorDecimal} Porcentaje, por ejemplo 8.00.
 * @throws {AppError} Si el producto tiene un impuesto que el régimen del negocio no permite
 *   (por ejemplo, IVA en un negocio responsable del INC: son excluyentes).
 */
export function obtenerTasaImpuesto(regimen, tipoImpuesto) {
  // 1. Un negocio no responsable no cobra impuesto al consumo en ningún producto.
  if (regimen === 'no_responsable' || tipoImpuesto === 'exento') {
    return aDecimal(TARIFAS_IMPUESTO.exento);
  }

  // 2. El impuesto del producto debe coincidir con el del régimen del negocio.
  if (IMPUESTO_POR_REGIMEN[regimen] !== tipoImpuesto) {
    throw new AppError(
      422,
      'IMPUESTO_NO_PERMITIDO',
      `Un negocio con régimen "${regimen}" no puede cobrar "${tipoImpuesto}"`,
    );
  }

  return aDecimal(TARIFAS_IMPUESTO[tipoImpuesto]);
}

/**
 * Calcula los valores de una línea del pedido a partir del precio del menú.
 *
 * @param {object} linea
 * @param {ValorNumerico} linea.precioConImpuesto Precio unitario del menú, con impuesto incluido.
 * @param {ValorNumerico} linea.cantidad Cantidad vendida (admite decimales, por ejemplo 0.5).
 * @param {ValorNumerico} linea.tasaImpuesto Porcentaje de impuesto, por ejemplo 8.
 * @returns {LineaCalculada}
 * @throws {RangeError} Si el precio es negativo, la cantidad no es positiva o la tasa no está entre 0 y 100.
 *
 * @example
 * // Un tinto de $3.500 con INC del 8 %:
 * calcularLinea({ precioConImpuesto: '3500', cantidad: '1', tasaImpuesto: '8' });
 * // → valorUnitario 3240.740741, base 3240.74, impuesto 259.26, totalAPagar 3500.00
 */
export function calcularLinea({ precioConImpuesto, cantidad, tasaImpuesto }) {
  const precio = aDecimal(precioConImpuesto);
  const unidades = aDecimal(cantidad);
  const tasa = aDecimal(tasaImpuesto);

  if (precio.isNegative()) throw new RangeError('El precio no puede ser negativo');
  if (unidades.lessThanOrEqualTo(0)) throw new RangeError('La cantidad debe ser mayor que cero');
  if (tasa.isNegative() || tasa.greaterThan(100)) {
    throw new RangeError('La tasa de impuesto debe estar entre 0 y 100');
  }

  // 1. Quitar el impuesto del precio del menú: valor unitario = precio ÷ (1 + tasa/100).
  const factorImpuesto = tasa.dividedBy(100);
  const valorUnitario = redondear(
    precio.dividedBy(factorImpuesto.plus(1)),
    DECIMALES_VALOR_UNITARIO,
  );

  // 2. Base de la línea = valor unitario × cantidad.
  const base = redondearMonto(valorUnitario.times(unidades));

  // 3. Impuesto de la línea = base × tarifa (nunca "total menos base").
  const impuesto = redondearMonto(base.times(factorImpuesto));

  // 4. Lo que paga el cliente por la línea: el precio anunciado en el menú.
  const totalAPagar = redondearMonto(precio.times(unidades));

  return { tasaImpuesto: tasa, valorUnitario, base, impuesto, totalAPagar };
}

/**
 * Calcula los totales del pedido a partir de sus líneas ya calculadas.
 *
 * @param {LineaCalculada[]} lineas Resultado de `calcularLinea` para cada ítem.
 * @returns {TotalesPedido}
 */
export function calcularTotalesPedido(lineas) {
  // 1. Totales calculados como exige la DIAN: suma de bases y suma de impuestos.
  const subtotal = sumar(lineas.map((linea) => linea.base));
  const impuestos = sumar(lineas.map((linea) => linea.impuesto));

  // 2. Lo que paga el cliente: la suma de los precios del menú.
  const total = sumar(lineas.map((linea) => linea.totalAPagar));

  // 3. La diferencia de centavos entre ambos se informa como ajuste por redondeo.
  const ajusteRedondeo = total.minus(subtotal).minus(impuestos);

  return {
    subtotal,
    impuestos,
    ajusteRedondeo,
    total,
    impuestosPorTasa: agruparPorTasa(lineas),
  };
}

/**
 * Agrupa bases e impuestos por tasa, como se reportan en la factura electrónica.
 * @param {LineaCalculada[]} lineas
 * @returns {ImpuestoPorTasa[]} Ordenado de menor a mayor tasa.
 */
function agruparPorTasa(lineas) {
  /** @type {Map<string, ImpuestoPorTasa>} */
  const grupos = new Map();

  for (const linea of lineas) {
    // La clave es el texto con 2 decimales para que 8 y 8.00 queden en el mismo grupo.
    const clave = linea.tasaImpuesto.toFixed(2);
    const grupo = grupos.get(clave) ?? {
      tasaImpuesto: linea.tasaImpuesto,
      base: new Decimal(0),
      impuesto: new Decimal(0),
    };
    grupo.base = grupo.base.plus(linea.base);
    grupo.impuesto = grupo.impuesto.plus(linea.impuesto);
    grupos.set(clave, grupo);
  }

  return [...grupos.values()].sort((a, b) => a.tasaImpuesto.comparedTo(b.tasaImpuesto));
}
