// @ts-check
// Menú de "La Industria" (comidas rápidas: hamburguesas, salchipapas, perros y asados),
// transcrito de la carta física. Precios en pesos con el impuesto incluido.
//
// Convenciones de la carta:
// - Salchipapas: "1P" es para una persona y "2P" para dos.
// - Hamburguesas: "Artesanal" y "Angus" son el tipo de carne.
// - Los productos marcados con "x" o sin precio en la carta no se incluyen.

/**
 * @typedef {object} ProductoMenu
 * @property {string} nombre
 * @property {string} [descripcion]
 * @property {string} precio Pesos colombianos, con impuesto incluido.
 * @property {boolean} [controlaStock] Si el producto descuenta inventario al venderse.
 * @property {string} [stock] Unidades iniciales si controla inventario.
 */

/**
 * @typedef {object} CategoriaMenu
 * @property {string} nombre
 * @property {ProductoMenu[]} productos
 */

/**
 * Crea las dos versiones de una hamburguesa (carne artesanal y carne angus).
 * Si la carta no trae precio para una versión, esa versión no se crea.
 * @param {string} nombre
 * @param {string | undefined} descripcion
 * @param {string | null} precioArtesanal
 * @param {string | null} precioAngus
 * @returns {ProductoMenu[]}
 */
function hamburguesa(nombre, descripcion, precioArtesanal, precioAngus) {
  /** @type {ProductoMenu[]} */
  const versiones = [];
  if (precioArtesanal) {
    versiones.push({ nombre: `${nombre} Artesanal`, descripcion, precio: precioArtesanal });
  }
  if (precioAngus) {
    versiones.push({ nombre: `${nombre} Angus`, descripcion, precio: precioAngus });
  }
  return versiones;
}

/**
 * Crea las dos porciones de una salchipapa: para 1 persona (1P) y para 2 personas (2P).
 * @param {string} nombre
 * @param {string | undefined} descripcion
 * @param {string} precio1P
 * @param {string} precio2P
 * @returns {ProductoMenu[]}
 */
function salchipapa(nombre, descripcion, precio1P, precio2P) {
  return [
    { nombre: `${nombre} 1P`, descripcion, precio: precio1P },
    { nombre: `${nombre} 2P`, descripcion, precio: precio2P },
  ];
}

/** @type {CategoriaMenu[]} */
export const menuLaIndustria = [
  {
    nombre: 'Hamburguesas',
    productos: [
      ...hamburguesa('IND Classic', undefined, '12000', '22000'),
      ...hamburguesa('IND Bacon', 'Tocineta', '14000', '24000'),
      ...hamburguesa('IND Pork', 'Queso philadelphia, pulled pork', '21000', null),
      ...hamburguesa('IND Monster', '3 carnes, 3 quesos y tocineta', '26000', '50000'),
      ...hamburguesa('IND Doble', '2 carnes, 2 quesos, tocineta', '20000', '36000'),
      ...hamburguesa('Suggar Daddy', 'Maduro guayabo, tocineta, queso campesino', '20000', '31000'),
      ...hamburguesa('IND Monterrey', 'Pulled pork, guacamole, pico e gallo', '20000', '31000'),
      ...hamburguesa('El Pibe', 'Chorizo y guacamole', '20000', '31000'),
      ...hamburguesa('IND del Rancho', 'Ranchera, queso en maicitos, tocineta', '20000', '31000'),
      ...hamburguesa('IND Cronchy', 'Pollo apanado y tocineta', '18000', null),
      ...hamburguesa('IND Mixtica', 'Pollo apanado y carne de res', '21000', '30000'),
    ],
  },
  {
    nombre: 'Promociones',
    productos: [
      { nombre: 'Promo 2x1 Classic', precio: '23000' },
      { nombre: 'Promo 2x1 Bacon', precio: '27000' },
      { nombre: 'Promo 2x1 Doble', precio: '33000' },
      { nombre: 'Promo 2x1 Monster', precio: '45000' },
      { nombre: 'Promo 3x2 Classic', precio: '33000' },
      { nombre: 'Promo 3x2 Bacon', precio: '37000' },
      { nombre: 'Promo 3x2 Doble', precio: '45000' },
      { nombre: 'Promo 3x2 Monster', precio: '65000' },
    ],
  },
  {
    nombre: 'Salchipapas',
    productos: [
      ...salchipapa('Salchi Classic', 'Papa criolla, salchicha, ripio', '10000', '20000'),
      ...salchipapa('Salchi Gratinada', 'Queso gratinado', '11000', '22000'),
      ...salchipapa('Salchi Bacon', 'Tocineta', '13000', '26000'),
      ...salchipapa('La Texana', 'Pulled pork, pico e gallo, guacamole, doritos', '20000', '40000'),
      ...salchipapa('Salchi Porky', 'Chicharrón y guacamole', '25000', '50000'),
      ...salchipapa(
        'Salchi Matecaña',
        'Costilla, bacon, maduro guayabo, queso gratinado en maicito',
        '21000',
        '42000',
      ),
      ...salchipapa('Salchi La Manu', 'Chicharrón, costilla, maduro', '20000', '40000'),
      ...salchipapa('Salchi Todo Terreno', 'Pollo apanado, chorizo, costilla', '26000', '52000'),
      ...salchipapa('Salchi Cronchy', 'Pollo apanado', '18000', '36000'),
      ...salchipapa(
        'Salchi del Rancho',
        'Ranchera, maicitos, tocineta, maduro guayabo, costilla',
        '25000',
        '50000',
      ),
      ...salchipapa(
        'La Cualquiera',
        'Pollo a la naranja, costilla, maduro guayabo',
        '25000',
        '50000',
      ),
      ...salchipapa('La Oficial', 'Chicharrón, queso en maicito, ranchera', '25000', '50000'),
      ...salchipapa('Salchi Pulled', 'Pulled pork, ranchera, queso en maicitos', '23000', '46000'),
      ...salchipapa(
        'Salchi Industria',
        'Pollo apanado, chicharrón, costilla, maduro y tocineta',
        '25000',
        '50000',
      ),
      ...salchipapa(
        'Salchi Caleña',
        'Maduro guayabo, tocineta, queso en maicitos',
        '17000',
        '34000',
      ),
      ...salchipapa('Pal Pétalo', 'Costilla, chicharrón, chorizo, guacamole', '25000', '50000'),
      ...salchipapa('Salchi Mistic', 'Chicharrón y costilla', '22000', '44000'),
      ...salchipapa('Salchi Pibe', 'Queso en maicitos, chorizo', '20000', '40000'),
      ...salchipapa('Salchi Costilla', 'Costilla ahumada', '17000', '34000'),
      ...salchipapa('Salchi Burguer', 'Salchipapa con carne de hamburguesa', '15000', '30000'),
    ],
  },
  {
    nombre: 'Perros',
    productos: [
      { nombre: 'Perro Clasic', precio: '15000' },
      { nombre: 'Perro Bacon', descripcion: 'Tocineta', precio: '17000' },
      { nombre: 'Choriperro Clasic', precio: '15000' },
      { nombre: 'Choriperro Bacon', descripcion: 'Tocineta, chorizo', precio: '17000' },
    ],
  },
  {
    nombre: 'Combos',
    productos: [
      { nombre: 'Combo Burguer IND', descripcion: 'Hamburguesa, papa, gaseosa', precio: '22000' },
      { nombre: 'Combo Perro IND', descripcion: 'Perro, papa, gaseosa', precio: '20000' },
    ],
  },
  {
    nombre: 'Asados',
    productos: [
      {
        nombre: 'La Picada',
        descripcion: 'Chorizo, chicharrón, costilla, yuca, papa',
        precio: '30000',
      },
      { nombre: 'Chicharrón 250 g', precio: '20000' },
      { nombre: 'Chicharrón 500 g', precio: '40000' },
    ],
  },
  {
    nombre: 'Adiciones',
    productos: [
      { nombre: 'Adición ranchera', precio: '3000' },
      { nombre: 'Adición queso', precio: '3000' },
      { nombre: 'Adición maicitos', precio: '6000' },
      { nombre: 'Adición maduro', precio: '6000' },
      { nombre: 'Adición tocineta', precio: '2000' },
      { nombre: 'Adición pulled pork', precio: '6000' },
      { nombre: 'Adición carne artesanal', precio: '6000' },
      { nombre: 'Adición chorizo', precio: '6000' },
      { nombre: 'Adición guacamole', precio: '3000' },
    ],
  },
  {
    nombre: 'Bebidas',
    productos: [
      // Las bebidas embotelladas controlan inventario: se descuentan al venderse.
      { nombre: 'Agua', precio: '2000', controlaStock: true, stock: '24' },
      { nombre: 'Jugo Hit', precio: '7000', controlaStock: true, stock: '12' },
      { nombre: 'Gaseosa 1.5 L', precio: '7000', controlaStock: true, stock: '12' },
      { nombre: 'Gaseosa personal 400 ml', precio: '4000', controlaStock: true, stock: '48' },
    ],
  },
];
