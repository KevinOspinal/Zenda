// @ts-check
// Pruebas de las reglas de los grupos de opciones: cómo se describen y qué forma de elegir
// les corresponde en el formulario.
import { describe, expect, it } from 'vitest';
import { describirRegla, formaDeElegir } from '../../app/utils/opciones.js';

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
