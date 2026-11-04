// @ts-check
// Pruebas de las opciones de los productos: cómo se describe la regla de un grupo, qué forma
// de elegir le corresponde en el formulario, cómo se eligen al pedir y cómo se muestran.
import { describe, expect, it } from 'vitest';
import {
  alternarOpcion,
  describirRegla,
  formaDeElegir,
  gruposPendientes,
  precioConOpciones,
  requiereElegir,
  textoDeOpciones,
} from '../../app/utils/opciones.js';

const ESPACIO_FIJO = '\u00a0';

/** Término: elegir 1, obligatorio. */
const TERMINO = {
  id: 'g1',
  nombre: 'Término de la carne',
  minimo: 1,
  maximo: 1,
  opciones: [
    { id: 'azul', nombre: 'Azul', precioExtra: '0' },
    { id: 'tres-cuartos', nombre: '3/4', precioExtra: '0' },
  ],
};
/** Salsas: hasta 2, opcional. */
const SALSAS = {
  id: 'g2',
  nombre: 'Salsas',
  minimo: 0,
  maximo: 2,
  opciones: [
    { id: 'rosada', nombre: 'Rosada', precioExtra: '0' },
    { id: 'tartara', nombre: 'Tártara', precioExtra: '0' },
    { id: 'pina', nombre: 'Piña', precioExtra: '0' },
  ],
};
/** Adiciones: varias, con precio. */
const ADICIONES = {
  id: 'g3',
  nombre: 'Adiciones',
  minimo: 0,
  maximo: null,
  opciones: [
    { id: 'queso', nombre: 'Queso', precioExtra: '2160' },
    { id: 'tocineta', nombre: 'Tocineta', precioExtra: '3000' },
  ],
};

describe('describirRegla', () => {
  it.each([
    [{ minimo: 1, maximo: 1 }, 'Elige 1'],
    [{ minimo: 0, maximo: 1 }, 'Elige 1'],
    [{ minimo: 2, maximo: 2 }, 'Elige 2'],
    [{ minimo: 0, maximo: 3 }, 'Elige hasta 3'],
    [{ minimo: 1, maximo: 3 }, 'Elige de 1 a 3'],
    [{ minimo: 0, maximo: null }, 'Elige las que quieras'],
    [{ minimo: 2, maximo: null }, 'Elige al menos 2'],
  ])('%o → "%s"', (regla, texto) => {
    expect(describirRegla(regla)).toBe(texto);
  });
});

describe('formaDeElegir', () => {
  it('reconoce las formas comunes', () => {
    expect(formaDeElegir({ minimo: 1, maximo: 1 })).toBe('una_obligatoria');
    expect(formaDeElegir({ minimo: 0, maximo: 1 })).toBe('una_opcional');
    expect(formaDeElegir({ minimo: 0, maximo: null })).toBe('varias_opcionales');
  });

  it('cualquier otra regla es personalizada', () => {
    expect(formaDeElegir({ minimo: 2, maximo: 2 })).toBe('personalizada');
    expect(formaDeElegir({ minimo: 0, maximo: 3 })).toBe('personalizada');
  });
});

describe('elegir opciones al pedir', () => {
  it('en un grupo de una sola opción, elegir otra reemplaza la anterior', () => {
    expect(alternarOpcion(TERMINO, ['azul', 'queso'], 'tres-cuartos')).toEqual([
      'queso',
      'tres-cuartos',
    ]);
  });

  it('el término obligatorio elegido no se suelta al tocarlo de nuevo', () => {
    expect(alternarOpcion(TERMINO, ['azul'], 'azul')).toEqual(['azul']);
  });

  it('en un grupo con máximo, no deja pasarse; soltar una abre espacio', () => {
    const dos = ['rosada', 'tartara'];

    expect(alternarOpcion(SALSAS, dos, 'pina')).toEqual(dos);
    expect(alternarOpcion(SALSAS, dos, 'rosada')).toEqual(['tartara']);
  });

  it('las adiciones sin límite se suman y se sueltan', () => {
    expect(alternarOpcion(ADICIONES, ['queso'], 'tocineta')).toEqual(['queso', 'tocineta']);
    expect(alternarOpcion(ADICIONES, ['queso', 'tocineta'], 'queso')).toEqual(['tocineta']);
  });

  it('dice qué grupos obligatorios faltan y si el producto exige elegir', () => {
    const grupos = [TERMINO, ADICIONES];

    expect(gruposPendientes(grupos, ['queso']).map((g) => g.nombre)).toEqual([
      'Término de la carne',
    ]);
    expect(gruposPendientes(grupos, ['azul'])).toEqual([]);
    expect(requiereElegir({ grupos })).toBe(true);
    expect(requiereElegir({ grupos: [ADICIONES] })).toBe(false);
    expect(requiereElegir({})).toBe(false);
  });

  it('el precio de la unidad suma las adiciones elegidas', () => {
    const precio = precioConOpciones('10800', [TERMINO, ADICIONES], ['azul', 'queso', 'tocineta']);

    expect(precio.toFixed(0)).toBe('15960');
  });
});

describe('texto de las opciones', () => {
  const opciones = [
    { nombre: '3/4', precioExtra: '0' },
    { nombre: 'Queso', precioExtra: '2160' },
    { nombre: 'Sin cebolla', precioExtra: '0' },
  ];

  it('en la cuenta lleva el precio de las adiciones', () => {
    expect(textoDeOpciones(opciones)).toBe(`3/4 · Queso +$${ESPACIO_FIJO}2.160 · Sin cebolla`);
  });

  it('en la cocina, solo los nombres', () => {
    expect(textoDeOpciones(opciones, { conPrecio: false })).toBe('3/4 · Queso · Sin cebolla');
  });

  it('sin opciones, queda vacío', () => {
    expect(textoDeOpciones(undefined)).toBe('');
    expect(textoDeOpciones([])).toBe('');
  });
});
