// @ts-check
// Nombres de los regímenes y tipos de impuesto, y qué impuesto puede llevar un producto
// según el régimen del negocio. Solo nombres y reglas: los impuestos los calcula siempre
// el backend (ver backend/src/modules/pedidos/calculoImpuestos.js).

/** @typedef {'responsable_inc' | 'franquicia_iva' | 'no_responsable'} RegimenImpuesto */
/** @typedef {'impoconsumo' | 'iva' | 'exento'} TipoImpuesto */

/** @type {Readonly<Record<RegimenImpuesto, string>>} */
export const NOMBRES_REGIMEN = Object.freeze({
  responsable_inc: 'Impuesto al consumo (INC 8 %)',
  franquicia_iva: 'IVA 19 % (franquicia)',
  no_responsable: 'Sin factura electrónica (no responsable)',
});

/**
 * Opciones para elegir cómo factura el negocio (registro y configuración). El régimen decide
 * los impuestos y si factura electrónicamente (ver facturaElectronica).
 */
export const OPCIONES_REGIMEN = Object.freeze([
  {
    value: 'responsable_inc',
    label: 'Factura electrónica con impuesto al consumo (8 %)',
    description: 'Restaurantes y cafeterías independientes. Es el más común.',
  },
  {
    value: 'franquicia_iva',
    label: 'Factura electrónica con IVA (19 %)',
    description: 'Franquicias de marcas.',
  },
  {
    value: 'no_responsable',
    label: 'Sin factura electrónica',
    description:
      'Negocios pequeños no responsables de IVA ni del impuesto al consumo: no cobran impuestos y entregan un recibo de venta.',
  },
]);

/**
 * Indica si el negocio factura electrónicamente. Un negocio no responsable de IVA ni del
 * impuesto al consumo no lo hace: entrega un recibo de venta (regla del backend).
 * @param {RegimenImpuesto | string | undefined} regimen
 */
export function facturaElectronica(regimen) {
  return regimen !== 'no_responsable';
}

/** @type {Readonly<Record<TipoImpuesto, { etiqueta: string, descripcion: string }>>} */
export const TIPOS_IMPUESTO = Object.freeze({
  impoconsumo: { etiqueta: 'INC 8 %', descripcion: 'Impuesto al consumo de restaurantes' },
  iva: { etiqueta: 'IVA 19 %', descripcion: 'Para franquicias' },
  exento: { etiqueta: 'Sin impuesto', descripcion: 'El producto no cobra impuesto' },
});

/**
 * Impuestos que puede tener un producto según el régimen del negocio (regla del backend:
 * el del régimen o exento; un negocio no responsable no cobra impuesto al consumo).
 * @param {RegimenImpuesto | string | undefined} regimen
 * @returns {TipoImpuesto[]}
 */
export function impuestosPermitidos(regimen) {
  if (regimen === 'responsable_inc') return ['impoconsumo', 'exento'];
  if (regimen === 'franquicia_iva') return ['iva', 'exento'];
  return ['exento'];
}
