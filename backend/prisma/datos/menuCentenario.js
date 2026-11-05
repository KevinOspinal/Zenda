// @ts-check
// Menú del "Restaurante Centenario" (Ginebra, Valle: sancochos, atollados y platos familiares),
// transcrito de sus cartas físicas. Precios en pesos con el impuesto incluido.
//
// De dónde sale cada precio:
// - Platos individuales: de la carta fotografiada en febrero de 2022 (la única que los trae).
//   Hay que confirmarlos con el negocio: pueden haber subido.
// - Platos familiares, adicionales, postres y bebidas: de la carta más reciente ("Especiales
//   platos familiares").
// - Los asados de las noches (Asados Centenario) no se incluyen: falta su carta con precios.
//
// Convenciones:
// - El sancocho y el atollado se piden eligiendo la proteína (opción "Proteína"). La diferencia
//   de precio entre proteínas es la misma en los dos, así que cada combinación da exacto el
//   precio de la carta: base (con pernil) + precio extra de la proteína.
// - Los platos familiares traen "sancocho o atollado": se elige al pedirlo. Si la mesa quiere
//   de los dos, se marcan ambos y en la nota se dice cuántos de cada uno.

/** @typedef {import('./menus.js').CategoriaMenu} CategoriaMenu */
/** @typedef {import('./menus.js').GrupoMenu} GrupoMenu */

/** Grupos de opciones de la carta. Los productos los nombran en `grupos`. */
export const PROTEINA = 'Proteína';
export const SANCOCHO_O_ATOLLADO = 'Sancocho o atollado';

/** @type {GrupoMenu[]} */
export const gruposCentenario = [
  {
    nombre: PROTEINA,
    minimo: 1,
    maximo: 1,
    // En el orden de la carta. El pernil es el precio base del plato.
    opciones: [
      { nombre: 'Pernil', precioExtra: '0' },
      { nombre: 'Pechuga', precioExtra: '2000' },
      { nombre: 'Chuleta de pollo', precioExtra: '5000' },
      { nombre: 'Chuleta de cerdo', precioExtra: '5000' },
      { nombre: 'Punta de anca', precioExtra: '7000' },
      { nombre: 'Tilapia frita', precioExtra: '5000' },
      { nombre: 'Filete de pollo', precioExtra: '2000' },
    ],
  },
  {
    nombre: SANCOCHO_O_ATOLLADO,
    minimo: 1,
    maximo: 2,
    opciones: [
      { nombre: 'Sancocho', precioExtra: '0' },
      { nombre: 'Atollado', precioExtra: '0' },
    ],
  },
];

/** Lo que trae cada plato familiar, según la carta. */
const INCLUYE_PLATO_FAMILIAR =
  'Plato de sancocho o atollado, entrada (tostada de plátano con hogao y hojaldra), arroz, ' +
  'arepa, tajada de plátano maduro, ensalada, agua de panela con limón y salsa de la casa.';

/** Las proteínas para elegir en el sancocho y el atollado. */
const PROTEINAS =
  'Pernil, pechuga, chuleta de pollo o cerdo, punta de anca, tilapia frita o filete de pollo.';

/** @type {CategoriaMenu[]} */
export const menuCentenario = [
  {
    nombre: 'Platos individuales',
    productos: [
      {
        nombre: 'Sancocho de gallina',
        descripcion: PROTEINAS,
        precio: '28000',
        grupos: [PROTEINA],
      },
      {
        nombre: 'Atollado ginebrino',
        descripcion: PROTEINAS,
        precio: '30000',
        grupos: [PROTEINA],
      },
    ],
  },
  {
    nombre: 'Platos familiares',
    productos: [
      {
        nombre: 'Gallina completa (6 personas)',
        descripcion: INCLUYE_PLATO_FAMILIAR,
        precio: '170000',
        grupos: [SANCOCHO_O_ATOLLADO],
      },
      {
        nombre: 'Media gallina (3 personas)',
        descripcion: INCLUYE_PLATO_FAMILIAR,
        precio: '90000',
        grupos: [SANCOCHO_O_ATOLLADO],
      },
      {
        nombre: 'Pollo entero (6 personas)',
        descripcion: INCLUYE_PLATO_FAMILIAR,
        precio: '150000',
        grupos: [SANCOCHO_O_ATOLLADO],
      },
      {
        nombre: 'Medio pollo (3 personas)',
        descripcion: INCLUYE_PLATO_FAMILIAR,
        precio: '80000',
        grupos: [SANCOCHO_O_ATOLLADO],
      },
    ],
  },
  {
    nombre: 'Adicionales',
    productos: [
      { nombre: 'Papas a la francesa', precio: '4500' },
      { nombre: 'Porción de ensalada', precio: '4000' },
      { nombre: 'Tostadas de plátano con hogao', precio: '4000' },
      { nombre: 'Hojaldra', precio: '3000' },
      { nombre: 'Porción de sancocho', precio: '6000' },
      { nombre: 'Porción de atollado', precio: '8000' },
    ],
  },
  {
    nombre: 'Postres',
    productos: [
      { nombre: 'Postre de la casa', precio: '7000' },
      { nombre: 'Natas', precio: '7000' },
      { nombre: 'Cortado', precio: '7000' },
    ],
  },
  {
    nombre: 'Bebidas',
    productos: [
      { nombre: 'Jugo Hit', precio: '4000' },
      { nombre: 'Gaseosa personal', precio: '4000' },
      { nombre: 'Gaseosa familiar', precio: '9000' },
      { nombre: 'Botella de agua', precio: '3500' },
      { nombre: 'Jarra de limonada', precio: '18000' },
      { nombre: 'Jarra de mandarina', precio: '20000' },
      { nombre: 'Jarra de uva', precio: '20000' },
      { nombre: 'Vaso de limonada', precio: '5000' },
      { nombre: 'Vaso de mandarina', precio: '5000' },
      { nombre: 'Vaso de uva', precio: '5000' },
      { nombre: 'Vaso de limonada cerezada', precio: '8000' },
      { nombre: 'Vaso de limonada de coco', precio: '8000' },
    ],
  },
];
