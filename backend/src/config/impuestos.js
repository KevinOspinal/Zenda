// @ts-check
// Tarifas de impuestos para restaurantes y cafeterías en Colombia.
//
// ⚠️ PENDIENTE DE VALIDAR CON UN CONTADOR. Estas reglas se tomaron del Estatuto Tributario
// y de guías públicas (octubre de 2026), no de una asesoría profesional.
//
// Resumen de la norma:
// - Restaurantes, cafeterías, panaderías, heladerías, etc. cobran el Impuesto Nacional al
//   Consumo (INC) del 8 % sobre todo el consumo, incluidas bebidas y productos empacados
//   que se venden como parte del servicio (ET arts. 512-1, 512-8 y 512-9).
// - Si el negocio opera bajo franquicia, cobra IVA del 19 % en lugar del INC (ET art. 426, parágrafo).
//   Ambos impuestos son excluyentes: un negocio nunca cobra los dos.
// - Una persona natural con ingresos del año anterior menores a 3.500 UVT y un solo local
//   no es responsable del INC y no lo cobra (ET art. 512-13).
// - Los alimentos excluidos de IVA que se venden sin preparación no hacen parte de la base
//   del INC (ET art. 512-9): esos productos se marcan como "exento".
// - La propina es voluntaria y nunca hace parte de la base del impuesto (Ley 1935 de 2018).
//
// Si cambia la ley (por ejemplo, el Proyecto de Ley 454 de 2026 propone IVA del 5 %),
// se ajusta solo este archivo. Las ventas pasadas no cambian: cada ítem del pedido
// guarda la tasa con la que se vendió.

/** @typedef {'responsable_inc' | 'franquicia_iva' | 'no_responsable'} RegimenImpuesto */
/** @typedef {'impoconsumo' | 'iva' | 'exento'} TipoImpuesto */

/** Tarifas vigentes en porcentaje. Se usan como texto para no perder precisión. */
export const TARIFAS_IMPUESTO = Object.freeze({
  /** INC para restaurantes y cafeterías (ET art. 512-9). */
  impoconsumo: '8.00',
  /** IVA general, aplica a negocios bajo franquicia (ET art. 468). */
  iva: '19.00',
  /** Productos que no causan impuesto. */
  exento: '0.00',
});

/**
 * Tipo de impuesto que puede cobrar cada régimen (además de `exento`, que vale para todos).
 * @type {Readonly<Record<RegimenImpuesto, TipoImpuesto | null>>}
 */
export const IMPUESTO_POR_REGIMEN = Object.freeze({
  responsable_inc: 'impoconsumo',
  franquicia_iva: 'iva',
  // No responsable: no cobra ningún impuesto al consumo.
  no_responsable: null,
});

/**
 * Indica si el negocio factura electrónicamente. Un negocio no responsable de IVA ni del
 * impuesto al consumo no está obligado: entrega un recibo de venta (ver pedidos/recibos.js).
 * @param {RegimenImpuesto} regimen
 */
export function facturaElectronica(regimen) {
  return regimen !== 'no_responsable';
}
