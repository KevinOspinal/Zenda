// @ts-check
// Menús que se pueden cargar en un negocio con scripts/cargar-menu.js, por su nombre corto
// (por ejemplo, --menu centenario). Cada uno trae sus categorías con sus productos y, si los
// usa, sus grupos de opciones (la proteína, el término...).
import { gruposCentenario, menuCentenario } from './menuCentenario.js';
import { menuLaIndustria } from './menuLaIndustria.js';

/**
 * Grupo de opciones de un menú. Los productos lo nombran en `grupos`.
 * @typedef {object} GrupoMenu
 * @property {string} nombre
 * @property {number} minimo 0 = opcional; 1 o más = obligatorio.
 * @property {number | null} maximo 1 = elegir una sola; null = sin límite.
 * @property {{ nombre: string, precioExtra: string }[]} opciones Lo que suma cada una al
 *   precio del plato, con el impuesto incluido.
 */

/**
 * Producto de un menú: como los de La Industria, más los grupos de opciones que se eligen al
 * pedirlo (por su nombre, en el orden en que se muestran).
 * @typedef {import('./menuLaIndustria.js').ProductoMenu & { grupos?: string[] }} ProductoMenu
 */

/** @typedef {{ nombre: string, productos: ProductoMenu[] }} CategoriaMenu */

/**
 * @typedef {object} MenuParaCargar
 * @property {string} negocio De qué negocio es la carta.
 * @property {CategoriaMenu[]} categorias En el orden de la carta.
 * @property {GrupoMenu[]} grupos
 */

/** @type {Readonly<Record<string, MenuParaCargar>>} */
export const MENUS = Object.freeze({
  'la-industria': { negocio: 'La Industria', categorias: menuLaIndustria, grupos: [] },
  centenario: {
    negocio: 'Restaurante Centenario',
    categorias: menuCentenario,
    grupos: gruposCentenario,
  },
});
