// @ts-check
// Pruebas de lo que scripts/cargar-menu.js propone cambiar en un negocio para que su menú quede
// como la carta: crear lo nuevo, actualizar lo que cambió (sin perder lo que la carta no dice),
// no tocar lo que ya está al día y proponer retirar lo que ya no está en la carta.
import { describe, expect, it } from 'vitest';
import { MENUS } from '../prisma/datos/menus.js';
import { calcularCambios } from '../scripts/cambiosDelMenu.js';

/** @typedef {import('../prisma/datos/menus.js').MenuParaCargar} MenuParaCargar */
/** @typedef {import('../scripts/cambiosDelMenu.js').MenuDelNegocio} MenuDelNegocio */

/**
 * Lo que tendría un negocio con una carta ya cargada, como lo devuelve el API (los precios con
 * centavos, como los guarda la base). Los ids se arman con los nombres para leer la prueba.
 * @param {MenuParaCargar} carta
 * @returns {MenuDelNegocio}
 */
function negocioConLaCarta(carta) {
  return {
    grupos: carta.grupos.map((grupo) => ({
      id: `grupo ${grupo.nombre}`,
      nombre: grupo.nombre,
      minimo: grupo.minimo,
      maximo: grupo.maximo,
      opciones: grupo.opciones.map((opcion) => ({
        id: `opción ${opcion.nombre}`,
        nombre: opcion.nombre,
        precioExtra: `${opcion.precioExtra}.00`,
        activo: true,
      })),
    })),
    categorias: carta.categorias.map((categoria, orden) => ({
      id: `categoría ${categoria.nombre}`,
      nombre: categoria.nombre,
      orden,
    })),
    productos: carta.categorias.flatMap((categoria) =>
      categoria.productos.map((producto) => ({
        id: `producto ${producto.nombre}`,
        nombre: producto.nombre,
        categoriaId: `categoría ${categoria.nombre}`,
        precio: `${producto.precio}.00`,
        descripcion: producto.descripcion ?? null,
        activo: true,
        gruposOpciones: (producto.grupos ?? []).map((nombre) => `grupo ${nombre}`),
      })),
    ),
  };
}

/** Un resumen de la carta vieja de Centenario (la de 2022), como quedó cargada en producción. */
const CARTA_VIEJA_DE_CENTENARIO = {
  negocio: 'Restaurante Centenario',
  grupos: [
    {
      nombre: 'Proteína',
      minimo: 1,
      maximo: 1,
      opciones: [
        { nombre: 'Pernil', precioExtra: '0' },
        { nombre: 'Pechuga', precioExtra: '2000' },
      ],
    },
    {
      nombre: 'Sancocho o atollado',
      minimo: 1,
      maximo: 2,
      opciones: [
        { nombre: 'Sancocho', precioExtra: '0' },
        { nombre: 'Atollado', precioExtra: '0' },
      ],
    },
  ],
  categorias: [
    {
      nombre: 'Platos individuales',
      productos: [{ nombre: 'Sancocho de gallina', precio: '28000', grupos: ['Proteína'] }],
    },
    {
      nombre: 'Platos familiares',
      productos: [
        {
          nombre: 'Media gallina (3 personas)',
          descripcion: 'Plato de sancocho o atollado, entrada, arroz y arepa.',
          precio: '90000',
          grupos: ['Sancocho o atollado'],
        },
      ],
    },
    {
      nombre: 'Bebidas',
      productos: [
        { nombre: 'Botella de agua', precio: '3500' },
        { nombre: 'Jugo Hit', precio: '4000' },
      ],
    },
  ],
};

/**
 * @param {import('../scripts/cambiosDelMenu.js').CambiosDelMenu} cambios
 * @param {string} nombre
 */
const delProducto = (cambios, nombre) =>
  cambios.productos.find((c) => c.producto.nombre === nombre);

describe('cambios para que el menú del negocio quede como la carta', () => {
  it('en un negocio sin menú, todo se crea y no hay nada que retirar', () => {
    const cambios = calcularCambios(
      MENUS.centenario,
      { categorias: [], productos: [], grupos: [] },
      'exento',
    );

    const acciones = [...cambios.grupos, ...cambios.categorias, ...cambios.productos].map(
      (cambio) => cambio.accion,
    );
    expect(new Set(acciones)).toEqual(new Set(['crear']));
    expect(cambios.productos).toHaveLength(35);
    expect(cambios.productosARetirar).toEqual([]);
    expect(cambios.gruposARetirar).toEqual([]);
  });

  it('si la carta ya está cargada, no cambia nada', () => {
    const cambios = calcularCambios(
      MENUS.centenario,
      negocioConLaCarta(MENUS.centenario),
      'exento',
    );

    const acciones = [...cambios.grupos, ...cambios.categorias, ...cambios.productos].map(
      (cambio) => cambio.accion,
    );
    expect(new Set(acciones)).toEqual(new Set(['igual']));
    expect(cambios.productosARetirar).toEqual([]);
    expect(cambios.gruposARetirar).toEqual([]);
  });

  describe('sobre la carta vieja de Centenario', () => {
    const cambios = calcularCambios(
      MENUS.centenario,
      negocioConLaCarta(CARTA_VIEJA_DE_CENTENARIO),
      'exento',
    );

    it('actualiza el precio, la descripción y las opciones de los platos que siguen', () => {
      const mediaGallina = delProducto(cambios, 'Media gallina (3 personas)');

      expect(mediaGallina?.accion).toBe('actualizar');
      expect(mediaGallina?.id).toBe('producto Media gallina (3 personas)');
      expect(mediaGallina?.campos).toEqual(['precio', 'descripcion', 'grupos']);
      expect(mediaGallina?.detalle[0]).toBe('precio $90.000 → $109.000');
    });

    it('mueve a su categoría nueva los productos que cambiaron de categoría', () => {
      const botella = delProducto(cambios, 'Botella de agua');

      expect(botella?.campos).toEqual(['precio', 'categoria']);
      expect(botella?.detalle).toContain('pasa de Bebidas a Gaseosas y agua');
    });

    it('crea los platos nuevos y pone las categorías en el orden de la carta', () => {
      expect(delProducto(cambios, 'Pernil o pechuga de gallina')?.accion).toBe('crear');
      const familiares = cambios.categorias.find((c) => c.nombre === 'Platos familiares');
      expect(familiares).toMatchObject({ accion: 'actualizar', orden: 3 });
    });

    it('reemplaza las opciones de un grupo y conserva las que siguen', () => {
      const sopa = cambios.grupos.find((c) => c.grupo.nombre === 'Sancocho o atollado');

      expect(sopa?.accion).toBe('actualizar');
      expect(sopa?.cuerpo.maximo).toBe(1);
      expect(sopa?.cuerpo.opciones.map((o) => [o.nombre, o.id])).toEqual([
        ['Sancocho de gallina', undefined],
        ['Atollado', 'opción Atollado'],
      ]);
      expect(sopa?.cuerpo.opciones.every((o) => o.tipoImpuesto === 'exento')).toBe(true);
    });

    it('propone retirar los productos y los grupos que ya no están en la carta', () => {
      expect(cambios.productosARetirar.map((p) => p.nombre)).toEqual([
        'Sancocho de gallina',
        'Jugo Hit',
      ]);
      expect(cambios.gruposARetirar.map((g) => g.nombre)).toEqual(['Proteína']);
    });
  });

  it('no toca lo que la carta no dice, ni retira los grupos que sus productos siguen usando', () => {
    /** @type {MenuParaCargar} */
    const carta = {
      negocio: 'Hamburguesería',
      grupos: [],
      categorias: [
        { nombre: 'Hamburguesas', productos: [{ nombre: 'Sencilla', precio: '15000' }] },
      ],
    };
    /** @type {MenuDelNegocio} */
    const negocio = {
      categorias: [{ id: 'c1', nombre: 'Hamburguesas', orden: 0 }],
      grupos: [
        { id: 'g1', nombre: 'Término de la carne', minimo: 1, maximo: 1, opciones: [] },
        { id: 'g2', nombre: 'Salsas', minimo: 0, maximo: null, opciones: [] },
      ],
      productos: [
        {
          id: 'p1',
          nombre: 'Sencilla',
          categoriaId: 'c1',
          precio: '15000',
          descripcion: 'Carne de res, queso y tocineta.',
          activo: true,
          gruposOpciones: ['g1'],
        },
      ],
    };

    const cambios = calcularCambios(carta, negocio, 'impoconsumo');

    expect(cambios.productos[0].accion).toBe('igual');
    // "Salsas" no lo usa ningún producto: se propone borrar; el término sí se usa.
    expect(cambios.gruposARetirar.map((g) => g.nombre)).toEqual(['Salsas']);
  });

  it('reconoce los nombres sin importar tildes ni mayúsculas, y reactiva lo que estaba inactivo', () => {
    /** @type {MenuParaCargar} */
    const carta = {
      negocio: 'Centenario',
      grupos: [],
      categorias: [
        { nombre: 'Adicionales', productos: [{ nombre: 'Porción de arroz', precio: '4000' }] },
      ],
    };
    /** @type {MenuDelNegocio} */
    const negocio = {
      categorias: [{ id: 'c1', nombre: 'adicionales', orden: 0 }],
      grupos: [],
      productos: [
        {
          id: 'p1',
          nombre: 'porcion  de arroz',
          categoriaId: 'c1',
          precio: '4000',
          descripcion: null,
          activo: false,
          gruposOpciones: [],
        },
      ],
    };

    const cambios = calcularCambios(carta, negocio, 'exento');

    expect(cambios.categorias[0].accion).toBe('igual');
    expect(cambios.productos[0]).toMatchObject({
      accion: 'actualizar',
      id: 'p1',
      campos: ['activo'],
    });
    expect(cambios.productosARetirar).toEqual([]);
  });
});
