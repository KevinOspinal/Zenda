// @ts-check
// Pruebas de las utilidades de dinero: conversión a Decimal, redondeo a la par y sumas.
import { describe, expect, it } from 'vitest';
import { aDecimal, redondear, redondearMonto, sumar } from '../src/lib/dinero.js';

describe('aDecimal', () => {
  it('convierte texto y números sin errores de punto flotante', () => {
    expect(aDecimal('0.1').plus(aDecimal('0.2')).toString()).toBe('0.3');
    expect(aDecimal(3500).toString()).toBe('3500');
  });

  it('rechaza valores que no son números finitos', () => {
    expect(() => aDecimal('abc')).toThrow();
    expect(() => aDecimal(Infinity)).toThrow(TypeError);
  });
});

describe('redondeo a la par (NTC 3711, usado por la DIAN)', () => {
  it('si el dígito a eliminar es exactamente 5, redondea hacia el dígito par', () => {
    expect(redondearMonto('2.345').toFixed(2)).toBe('2.34');
    expect(redondearMonto('2.355').toFixed(2)).toBe('2.36');
    expect(redondearMonto('0.125').toFixed(2)).toBe('0.12');
    expect(redondearMonto('0.135').toFixed(2)).toBe('0.14');
  });

  it('si después del 5 hay más dígitos, redondea hacia arriba', () => {
    expect(redondearMonto('2.3451').toFixed(2)).toBe('2.35');
  });

  it('fuera del caso del 5 redondea de forma normal', () => {
    expect(redondearMonto('2.344').toFixed(2)).toBe('2.34');
    expect(redondearMonto('2.346').toFixed(2)).toBe('2.35');
  });

  it('redondea valores negativos de forma simétrica', () => {
    expect(redondearMonto('-2.345').toFixed(2)).toBe('-2.34');
  });

  it('permite redondear a 6 decimales para valores unitarios', () => {
    expect(redondear('3240.7407407407', 6).toString()).toBe('3240.740741');
  });
});

describe('sumar', () => {
  it('suma valores con precisión decimal', () => {
    expect(sumar(['0.10', '0.20', '0.30']).toFixed(2)).toBe('0.60');
  });

  it('devuelve 0 con una lista vacía', () => {
    expect(sumar([]).toString()).toBe('0');
  });
});
