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
  no_responsable: 'No responsable de impuesto al consumo',
});

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
