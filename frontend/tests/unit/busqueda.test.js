// @ts-check
// Pruebas de la búsqueda de las listas: sin tildes ni mayúsculas, por palabras en cualquier
// orden, y las partes que se resaltan.
import { describe, expect, it } from 'vitest';
import { coincideBusqueda, normalizarTexto, partesResaltadas } from '../../app/utils/busqueda.js';

describe('normalizarTexto', () => {
  it('quita las tildes y pasa a minúsculas sin cambiar el largo', () => {
    expect(normalizarTexto('Árbol Ñandú')).toBe('arbol nandu');
    expect(normalizarTexto('Árbol Ñandú')).toHaveLength('Árbol Ñandú'.length);
  });
});

describe('coincideBusqueda', () => {
  it('encuentra por palabras, en cualquier orden y sin importar tildes ni mayúsculas', () => {
    expect(coincideBusqueda('Gaseosa 1.5 L', 'gaseosa 1.5')).toBe(true);
    expect(coincideBusqueda('Gaseosa 1.5 L', '1.5 GASEOSA')).toBe(true);
    expect(coincideBusqueda('Limonada de coco', 'limonáda')).toBe(true);
    expect(coincideBusqueda('Agua', 'jugo')).toBe(false);
  });

  it('una búsqueda vacía o solo con espacios encuentra todo', () => {
    expect(coincideBusqueda('Agua', '')).toBe(true);
    expect(coincideBusqueda('Agua', '   ')).toBe(true);
  });
});

describe('partesResaltadas', () => {
  it('marca lo que coincide, sin importar tildes, y conserva el texto original', () => {
    expect(partesResaltadas('Ana Ruiz', 'ruí')).toEqual([
      { texto: 'Ana ', coincide: false },
      { texto: 'Rui', coincide: true },
      { texto: 'z', coincide: false },
    ]);
    expect(partesResaltadas('José Pérez', 'jose')).toEqual([
      { texto: 'José', coincide: true },
      { texto: ' Pérez', coincide: false },
    ]);
  });

  it('marca cada palabra buscada y todas sus apariciones, juntando las que se tocan', () => {
    expect(partesResaltadas('ana banana', 'an')).toEqual([
      { texto: 'an', coincide: true },
      { texto: 'a b', coincide: false },
      { texto: 'anan', coincide: true },
      { texto: 'a', coincide: false },
    ]);
    expect(partesResaltadas('Marta Ruiz', 'ruiz marta')).toEqual([
      { texto: 'Marta', coincide: true },
      { texto: ' ', coincide: false },
      { texto: 'Ruiz', coincide: true },
    ]);
  });

  it('sin búsqueda, el texto va entero y sin marcar', () => {
    expect(partesResaltadas('Ana', '  ')).toEqual([{ texto: 'Ana', coincide: false }]);
    expect(partesResaltadas('', 'ana')).toEqual([]);
  });
});
