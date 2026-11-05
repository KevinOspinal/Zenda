// @ts-check
// Pruebas de los menús que carga scripts/cargar-menu.js: cada categoría, producto y grupo de
// opciones pasa las mismas validaciones que el API (así la carga no se queda a medias en
// producción por un dato mal escrito), y en la carta de Centenario cada plato con su proteína
// cuesta lo mismo que en la carta física.
import { describe, expect, it } from 'vitest';
import { MENUS } from '../prisma/datos/menus.js';
import { PROTEINA, gruposCentenario, menuCentenario } from '../prisma/datos/menuCentenario.js';
import { aDecimal } from '../src/lib/dinero.js';
import { esquemaCrearCategoria, esquemaCrearProducto } from '../src/modules/menu/menu.schemas.js';
import { esquemaGrupoOpciones } from '../src/modules/opciones/opciones.schemas.js';

const ID_DE_EJEMPLO = '00000000-0000-4000-8000-000000000000';

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

/** @param {string} nombre */
const normalizar = (nombre) => nombre.trim().toLowerCase();

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
              gruposOpciones: (producto.grupos ?? []).map(() => ID_DE_EJEMPLO),
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

  it('no repite nombres: el script los usaría para saltarse lo que cree que ya existe', () => {
    const repetidos = (/** @type {string[]} */ nombres) =>
      nombres.map(normalizar).filter((nombre, indice, todos) => todos.indexOf(nombre) !== indice);

    expect(repetidos(menu.categorias.map((c) => c.nombre))).toEqual([]);
    expect(repetidos(menu.grupos.map((g) => g.nombre))).toEqual([]);
    for (const categoria of menu.categorias) {
      expect(repetidos(categoria.productos.map((p) => p.nombre))).toEqual([]);
    }
  });
});

describe('carta de Centenario', () => {
  /** Precios de los platos individuales en la carta física, por proteína. */
  const CARTA = {
    'Sancocho de gallina': {
      Pernil: 28000,
      Pechuga: 30000,
      'Chuleta de pollo': 33000,
      'Chuleta de cerdo': 33000,
      'Punta de anca': 35000,
      'Tilapia frita': 33000,
      'Filete de pollo': 30000,
    },
    'Atollado ginebrino': {
      Pernil: 30000,
      Pechuga: 32000,
      'Chuleta de pollo': 35000,
      'Chuleta de cerdo': 35000,
      'Punta de anca': 37000,
      'Tilapia frita': 35000,
      'Filete de pollo': 32000,
    },
  };

  it('cada plato individual con su proteína cuesta lo mismo que en la carta', () => {
    const proteinas = /** @type {import('../prisma/datos/menus.js').GrupoMenu} */ (
      gruposCentenario.find((grupo) => grupo.nombre === PROTEINA)
    ).opciones;
    const individuales = menuCentenario[0].productos;

    for (const [plato, precios] of Object.entries(CARTA)) {
      const producto = individuales.find((p) => p.nombre === plato);
      for (const [proteina, precioEnCarta] of Object.entries(precios)) {
        const opcion = proteinas.find((o) => o.nombre === proteina);
        const total = aDecimal(producto?.precio ?? '0').plus(opcion?.precioExtra ?? 'NaN');
        expect(`${plato} con ${proteina}: ${total.toString()}`).toBe(
          `${plato} con ${proteina}: ${precioEnCarta}`,
        );
      }
    }
  });
});
