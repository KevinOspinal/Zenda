// @ts-check
// Menú del "Restaurante Centenario" (Ginebra, Valle: sancochos, atollados, asados y platos
// familiares), transcrito de su carta vigente (la que envió el negocio en noviembre de 2026).
// Precios en pesos con el impuesto incluido.
//
// Cómo se lee la carta:
// - Cada plato es la proteína, y se pide con "sancocho de gallina o atollado" (opción
//   obligatoria). Los tradicionales, además, se piden con pernil o pechuga, asados o a la
//   criolla. Ninguna opción cambia el precio: el precio es el de la carta.
// - Los platos familiares son para 6 personas (enteros) o para 3 (medios), y se pueden pedir
//   con sancocho, con atollado o con los dos (en la nota se dice cuántos de cada uno).
// - "Los platos que se pidan con atollado no llevan arroz en la bandeja": va en la descripción
//   de cada plato, para que el mesero lo vea al tomar el pedido.

/** @typedef {import('./menus.js').CategoriaMenu} CategoriaMenu */
/** @typedef {import('./menus.js').GrupoMenu} GrupoMenu */

/** Grupos de opciones de la carta. Los productos los nombran en `grupos`. */
export const SANCOCHO_O_ATOLLADO = 'Sancocho o atollado';
export const PERNIL_O_PECHUGA = 'Pernil o pechuga';
export const ASADO_O_A_LA_CRIOLLA = 'Asado o a la criolla';
export const SOPAS_DEL_PLATO_FAMILIAR = 'Sopas del plato familiar';

/** Las dos sopas de la casa. */
const SOPAS = [
  { nombre: 'Sancocho de gallina', precioExtra: '0' },
  { nombre: 'Atollado', precioExtra: '0' },
];

/** @type {GrupoMenu[]} */
export const gruposCentenario = [
  { nombre: SANCOCHO_O_ATOLLADO, minimo: 1, maximo: 1, opciones: SOPAS },
  {
    nombre: PERNIL_O_PECHUGA,
    minimo: 1,
    maximo: 1,
    opciones: [
      { nombre: 'Pernil', precioExtra: '0' },
      { nombre: 'Pechuga', precioExtra: '0' },
    ],
  },
  {
    nombre: ASADO_O_A_LA_CRIOLLA,
    minimo: 1,
    maximo: 1,
    opciones: [
      { nombre: 'Asado', precioExtra: '0' },
      { nombre: 'A la criolla', precioExtra: '0' },
    ],
  },
  // En un plato familiar la mesa puede querer de las dos sopas.
  { nombre: SOPAS_DEL_PLATO_FAMILIAR, minimo: 1, maximo: 2, opciones: SOPAS },
];

/** La nota de la carta sobre el atollado. */
const SIN_ARROZ_CON_ATOLLADO = 'Con atollado no lleva arroz en la bandeja.';

/**
 * Un plato que se pide con sancocho de gallina o atollado.
 * @param {string} nombre
 * @param {string} precio
 */
function platoConSopa(nombre, precio) {
  return { nombre, descripcion: SIN_ARROZ_CON_ATOLLADO, precio, grupos: [SANCOCHO_O_ATOLLADO] };
}

/**
 * Un plato tradicional: además de la sopa, se elige la presa y cómo se prepara.
 * @param {string} nombre
 * @param {string} precio
 */
function platoTradicional(nombre, precio) {
  return {
    ...platoConSopa(nombre, precio),
    grupos: [SANCOCHO_O_ATOLLADO, PERNIL_O_PECHUGA, ASADO_O_A_LA_CRIOLLA],
  };
}

/**
 * Un plato familiar, con una o las dos sopas.
 * @param {string} nombre
 * @param {string} precio
 */
function platoFamiliar(nombre, precio) {
  return {
    nombre,
    descripcion: SIN_ARROZ_CON_ATOLLADO,
    precio,
    grupos: [SOPAS_DEL_PLATO_FAMILIAR],
  };
}

/** @type {CategoriaMenu[]} */
export const menuCentenario = [
  {
    nombre: 'Tradicional',
    productos: [
      platoTradicional('Pernil o pechuga de gallina', '39000'),
      platoTradicional('Pernil o pechuga de pollo', '37000'),
    ],
  },
  {
    nombre: 'Asados',
    productos: [
      platoConSopa('Costilla de cerdo', '39900'),
      platoConSopa('Filete de cerdo', '38900'),
    ],
  },
  {
    nombre: 'Chuletas y fiambre',
    productos: [
      platoConSopa('Chuleta de cerdo', '39900'),
      platoConSopa('Chuleta de pollo', '39000'),
      platoConSopa('Fiambre valluno', '53000'),
    ],
  },
  {
    nombre: 'Platos familiares',
    productos: [
      platoFamiliar('Gallina entera (6 personas)', '199000'),
      platoFamiliar('Media gallina (3 personas)', '109000'),
      platoFamiliar('Pollo entero (6 personas)', '176000'),
      platoFamiliar('Medio pollo (3 personas)', '99000'),
    ],
  },
  {
    nombre: 'Adicionales',
    productos: [
      { nombre: 'Porción de sancocho', precio: '10000' },
      { nombre: 'Porción de atollado', precio: '14000' },
      { nombre: 'Chorizo asado', precio: '6000' },
      { nombre: 'Tostada de plátano', precio: '4000' },
      { nombre: 'Papas a la francesa', precio: '5500' },
      { nombre: 'Porción de arroz', precio: '4000' },
      { nombre: 'Porción de ensalada', precio: '4000' },
    ],
  },
  {
    nombre: 'Jarras',
    productos: [
      { nombre: 'Jarra de agua de panela con limón', precio: '9000' },
      { nombre: 'Jarra de mandarina', precio: '22000' },
      { nombre: 'Jarra de naranja', precio: '22000' },
      { nombre: 'Jarra de limonada natural', precio: '20000' },
      { nombre: 'Jarra de jugo de uva', precio: '22000' },
    ],
  },
  {
    nombre: 'Vasos',
    productos: [
      { nombre: 'Vaso de agua de panela con limón', precio: '3000' },
      { nombre: 'Vaso de limonada natural', precio: '6000' },
      { nombre: 'Vaso de zumo de uva', precio: '6000' },
      { nombre: 'Vaso de mandarina', precio: '6000' },
      { nombre: 'Vaso de naranja', precio: '6000' },
      { nombre: 'Vaso de limonada cerezada', precio: '9000' },
      { nombre: 'Vaso de limonada de coco', precio: '10000' },
    ],
  },
  {
    nombre: 'Gaseosas y agua',
    productos: [
      { nombre: 'Botella de agua', precio: '2500' },
      { nombre: 'Botella de agua con gas', precio: '2800' },
      { nombre: 'Gaseosa personal PET', precio: '4000' },
      { nombre: 'Gaseosa personal de vidrio', precio: '3500' },
      { nombre: 'Gaseosa familiar', precio: '10000' },
    ],
  },
];
