// @ts-check
// Pruebas de los menús que carga scripts/cargar-menu.js: cada categoría, producto y grupo de
// opciones pasa las mismas validaciones que el API (así la carga no se queda a medias en
// producción por un dato mal escrito), y la carta de Centenario trae los precios y las opciones
// de su carta vigente.
import { describe, expect, it } from 'vitest';
import { MENUS } from '../prisma/datos/menus.js';
import {
  SANCOCHO_O_ATOLLADO,
  SOPAS_DEL_PLATO_FAMILIAR,
  gruposCentenario,
  menuCentenario,
} from '../prisma/datos/menuCentenario.js';
import { normalizar } from '../scripts/cambiosDelMenu.js';
import { esquemaCrearCategoria, esquemaCrearProducto } from '../src/modules/menu/menu.schemas.js';
import { esquemaGrupoOpciones } from '../src/modules/opciones/opciones.schemas.js';

const ID_DE_EJEMPLO = '00000000-0000-4000-8000-000000000000';

/**
 * Un id de ejemplo distinto para cada posición (el API rechaza grupos repetidos en un producto).
 * @param {unknown} _valor
 * @param {number} indice
 */
const idDeEjemplo = (_valor, indice) =>
  ID_DE_EJEMPLO.slice(0, -2) + String(indice).padStart(2, '0');

/**
 * Mensaje de los errores de validación, para que la prueba diga qué dato está mal.
 * @param {import('zod').ZodSafeParseResult<unknown>} resultado
 * @param {string} que
 */
function errores(resultado, que) {
  return resultado.success
    ? []
    : resultado.error.issues.map((e) => `${que}: ${e.path.join('.')} ${e.message}`);
}

describe.each(Object.entries(MENUS))('menú "%s"', (_nombre, menu) => {
  it('las categorías, los productos y los grupos pasan las validaciones del API', () => {
    const problemas = [
      ...menu.grupos.flatMap((grupo, orden) =>
        errores(
          esquemaGrupoOpciones.safeParse({
            ...grupo,
            orden,
            opciones: grupo.opciones.map((o) => ({ ...o, tipoImpuesto: 'impoconsumo' })),
          }),
          grupo.nombre,
        ),
      ),
      ...menu.categorias.flatMap((categoria, orden) => [
        ...errores(
          esquemaCrearCategoria.safeParse({ nombre: categoria.nombre, orden }),
          categoria.nombre,
        ),
        ...categoria.productos.flatMap((producto) =>
          errores(
            esquemaCrearProducto.safeParse({
              categoriaId: ID_DE_EJEMPLO,
              nombre: producto.nombre,
              descripcion: producto.descripcion,
              precio: producto.precio,
              tipoImpuesto: 'impoconsumo',
              gruposOpciones: (producto.grupos ?? []).map(idDeEjemplo),
            }),
            producto.nombre,
          ),
        ),
      ]),
    ];

    expect(problemas).toEqual([]);
  });

  it('cada producto usa grupos que existen en el mismo menú', () => {
    const grupos = new Set(menu.grupos.map((grupo) => normalizar(grupo.nombre)));
    const faltantes = menu.categorias
      .flatMap((categoria) => categoria.productos)
      .flatMap((producto) => producto.grupos ?? [])
      .filter((nombre) => !grupos.has(normalizar(nombre)));

    expect(faltantes).toEqual([]);
  });

  it('no repite nombres: el script los usa para reconocer lo que el negocio ya tiene', () => {
    const repetidos = (/** @type {string[]} */ nombres) =>
      nombres.map(normalizar).filter((nombre, indice, todos) => todos.indexOf(nombre) !== indice);

    expect(repetidos(menu.categorias.map((c) => c.nombre))).toEqual([]);
    expect(repetidos(menu.grupos.map((g) => g.nombre))).toEqual([]);
    // Un producto se reconoce aunque esté en otra categoría: su nombre no se repite en el menú.
    expect(repetidos(menu.categorias.flatMap((c) => c.productos.map((p) => p.nombre)))).toEqual([]);
  });
});

describe('carta de Centenario', () => {
  /** Precios de la carta vigente, tal como están impresos. */
  const CARTA = {
    'Pernil o pechuga de gallina': '39000',
    'Pernil o pechuga de pollo': '37000',
    'Costilla de cerdo': '39900',
    'Filete de cerdo': '38900',
    'Chuleta de cerdo': '39900',
    'Chuleta de pollo': '39000',
    'Fiambre valluno': '53000',
    'Gallina entera (6 personas)': '199000',
    'Media gallina (3 personas)': '109000',
    'Pollo entero (6 personas)': '176000',
    'Medio pollo (3 personas)': '99000',
    'Porción de sancocho': '10000',
    'Porción de atollado': '14000',
    'Chorizo asado': '6000',
    'Tostada de plátano': '4000',
    'Papas a la francesa': '5500',
    'Porción de arroz': '4000',
    'Porción de ensalada': '4000',
    'Jarra de agua de panela con limón': '9000',
    'Jarra de mandarina': '22000',
    'Jarra de naranja': '22000',
    'Jarra de limonada natural': '20000',
    'Jarra de jugo de uva': '22000',
    'Vaso de agua de panela con limón': '3000',
    'Vaso de limonada natural': '6000',
    'Vaso de zumo de uva': '6000',
    'Vaso de mandarina': '6000',
    'Vaso de naranja': '6000',
    'Vaso de limonada cerezada': '9000',
    'Vaso de limonada de coco': '10000',
    'Botella de agua': '2500',
    'Botella de agua con gas': '2800',
    'Gaseosa personal PET': '4000',
    'Gaseosa personal de vidrio': '3500',
    'Gaseosa familiar': '10000',
  };
  const productos = menuCentenario.flatMap((categoria) => categoria.productos);

  it('cada producto cuesta lo mismo que en la carta, sin que falte ni sobre ninguno', () => {
    const enElMenu = Object.fromEntries(productos.map((p) => [p.nombre, p.precio]));

    expect(enElMenu).toEqual(CARTA);
  });

  it('cada plato se pide eligiendo la sopa, y ninguna opción cambia el precio de la carta', () => {
    const platos = menuCentenario
      .filter((categoria) => categoria.nombre !== 'Adicionales')
      .flatMap((categoria) => categoria.productos)
      .filter((producto) => producto.grupos);
    const familiares = menuCentenario.find((c) => c.nombre === 'Platos familiares')?.productos;

    // Los platos individuales llevan "sancocho o atollado" (una) y los familiares, una o las dos.
    expect(platos).toHaveLength(11);
    for (const plato of platos) {
      const sopa = familiares?.includes(plato) ? SOPAS_DEL_PLATO_FAMILIAR : SANCOCHO_O_ATOLLADO;
      expect(`${plato.nombre}: ${plato.grupos?.[0]}`).toBe(`${plato.nombre}: ${sopa}`);
    }
    const extras = gruposCentenario.flatMap((g) => g.opciones).map((o) => o.precioExtra);
    expect(new Set(extras)).toEqual(new Set(['0']));
  });
});
