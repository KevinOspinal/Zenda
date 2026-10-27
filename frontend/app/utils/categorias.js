// @ts-check
// Ícono y tono de color de cada categoría del menú.
//
// Los productos no tienen foto en el API: cada categoría se reconoce por un ícono (según
// palabras de su nombre) y un tono (según su posición en el menú, para que categorías
// vecinas se distingan). Las tarjetas de producto usan la apariencia de su categoría.

/**
 * Reglas para elegir el ícono por palabras del nombre (sin tildes y en minúscula).
 * Gana la primera regla que coincida, por eso las más específicas van primero.
 * Todos los íconos existen en Lucide (verificado en @iconify-json/lucide).
 */
const REGLAS_DE_ICONO = Object.freeze([
  { palabras: ['salchipapa', 'papas', 'papa ', 'frita'], icono: 'i-lucide-popcorn' },
  { palabras: ['hamburguesa', 'burger'], icono: 'i-lucide-hamburger' },
  { palabras: ['perro', 'hot dog', 'hotdog'], icono: 'i-lucide-sandwich' },
  { palabras: ['asado', 'parrilla', 'carne', 'churrasco', 'picada'], icono: 'i-lucide-beef' },
  { palabras: ['pollo', 'alita', 'nugget'], icono: 'i-lucide-drumstick' },
  { palabras: ['pescado', 'marisco', 'ceviche'], icono: 'i-lucide-fish' },
  { palabras: ['pizza'], icono: 'i-lucide-pizza' },
  { palabras: ['sandwich', 'sanduche', 'wrap'], icono: 'i-lucide-sandwich' },
  { palabras: ['ensalada'], icono: 'i-lucide-salad' },
  { palabras: ['sopa', 'caldo', 'sancocho'], icono: 'i-lucide-soup' },
  { palabras: ['desayuno', 'huevo', 'calentado'], icono: 'i-lucide-egg-fried' },
  { palabras: ['arepa', 'empanada', 'panaderia', 'bunuelo'], icono: 'i-lucide-croissant' },
  { palabras: ['helado'], icono: 'i-lucide-ice-cream-cone' },
  { palabras: ['postre', 'torta', 'dulce'], icono: 'i-lucide-cake-slice' },
  // Las bebidas con alcohol van antes que el café: "Vinos tintos" no es un tinto (café).
  { palabras: ['cerveza'], icono: 'i-lucide-beer' },
  { palabras: ['vino'], icono: 'i-lucide-wine' },
  { palabras: ['coctel', 'licor', 'trago'], icono: 'i-lucide-martini' },
  { palabras: ['cafe', 'tinto', 'capuchino', 'cappuccino'], icono: 'i-lucide-coffee' },
  { palabras: ['jugo', 'limonada', 'batido', 'malteada'], icono: 'i-lucide-citrus' },
  { palabras: ['bebida', 'gaseosa', 'refresco', 'agua'], icono: 'i-lucide-cup-soda' },
  { palabras: ['combo'], icono: 'i-lucide-layers' },
  { palabras: ['promo'], icono: 'i-lucide-badge-percent' },
  { palabras: ['adicion', 'extra', 'acompanamiento'], icono: 'i-lucide-circle-plus' },
  { palabras: ['entrada'], icono: 'i-lucide-utensils-crossed' },
]);

/** Ícono cuando ninguna regla coincide. */
export const ICONO_CATEGORIA_GENERICA = 'i-lucide-utensils';

/**
 * Tonos decorativos de las categorías. Son distintos de los colores con significado
 * (verde = listo, ámbar = atención, rojo = error) para no confundir.
 * Las clases van completas para que Tailwind las encuentre al revisar el código.
 */
export const TONOS_DE_CATEGORIA = Object.freeze([
  { fondo: 'bg-orange-100 dark:bg-orange-500/15', texto: 'text-orange-700 dark:text-orange-300' },
  { fondo: 'bg-cyan-100 dark:bg-cyan-500/15', texto: 'text-cyan-700 dark:text-cyan-300' },
  { fondo: 'bg-violet-100 dark:bg-violet-500/15', texto: 'text-violet-700 dark:text-violet-300' },
  { fondo: 'bg-lime-100 dark:bg-lime-500/15', texto: 'text-lime-700 dark:text-lime-300' },
  { fondo: 'bg-pink-100 dark:bg-pink-500/15', texto: 'text-pink-700 dark:text-pink-300' },
  { fondo: 'bg-indigo-100 dark:bg-indigo-500/15', texto: 'text-indigo-700 dark:text-indigo-300' },
  { fondo: 'bg-yellow-100 dark:bg-yellow-500/15', texto: 'text-yellow-700 dark:text-yellow-300' },
  {
    fondo: 'bg-fuchsia-100 dark:bg-fuchsia-500/15',
    texto: 'text-fuchsia-700 dark:text-fuchsia-300',
  },
]);

/**
 * Pasa un texto a minúsculas y sin tildes: "Adiciones Á" → "adiciones a".
 * @param {string} texto
 */
function normalizar(texto) {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/**
 * Ícono de una categoría según su nombre.
 * @param {string} nombre
 */
export function iconoDeCategoria(nombre) {
  // El espacio final permite reglas como "papa " que no coinciden con "papaya".
  const texto = `${normalizar(nombre)} `;
  const regla = REGLAS_DE_ICONO.find((r) => r.palabras.some((palabra) => texto.includes(palabra)));
  return regla?.icono ?? ICONO_CATEGORIA_GENERICA;
}

/**
 * Apariencia completa de una categoría: ícono por su nombre y tono por su posición.
 * @param {string} nombre
 * @param {number} posicion Lugar de la categoría en el menú (0, 1, 2...).
 * @returns {{ icono: string, fondo: string, texto: string }}
 */
export function aparienciaDeCategoria(nombre, posicion) {
  const indice = Math.abs(Math.trunc(posicion)) % TONOS_DE_CATEGORIA.length;
  return { icono: iconoDeCategoria(nombre), ...TONOS_DE_CATEGORIA[indice] };
}
