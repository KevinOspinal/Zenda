// @ts-check
// Pruebas del dinero en pantalla: conversión, sumas exactas y formato de pesos colombianos.
import { describe, expect, it } from 'vitest';
import {
  aDecimal,
  esMontoValido,
  formatearCantidad,
  formatearPesos,
  formatearPorcentaje,
  montoComoTexto,
  sumar,
} from '../../app/utils/dinero.js';

// Intl separa el signo $ del número con un espacio que no se parte entre líneas (U+00A0).
const ESPACIO_FIJO = '\u00a0';

describe('aDecimal', () => {
  it('convierte el texto que envía el API', () => {
    expect(aDecimal('25925.92').toFixed(2)).toBe('25925.92');
    expect(aDecimal(2000).toFixed(0)).toBe('2000');
  });

  it('rechaza valores vacíos o que no son números', () => {
    expect(() => aDecimal('')).toThrow(TypeError);
    expect(() => aDecimal('doce mil')).toThrow(TypeError);
    expect(() => aDecimal(Number.NaN)).toThrow(TypeError);
    expect(() => aDecimal(Number.POSITIVE_INFINITY)).toThrow(TypeError);
  });
});

describe('sumar', () => {
  it('suma sin errores de punto flotante (0,1 + 0,2 = 0,3)', () => {
    expect(sumar(['0.1', '0.2']).toString()).toBe('0.3');
  });

  it('suma una lista vacía como cero', () => {
    expect(sumar([]).isZero()).toBe(true);
  });

  it('suma pagos mixtos del API', () => {
    expect(sumar(['30000', '8000', '4000.50']).toFixed(2)).toBe('42000.50');
  });
});

describe('formatearPesos', () => {
  it('muestra precios y totales enteros sin centavos', () => {
    expect(formatearPesos('12000')).toBe(`$${ESPACIO_FIJO}12.000`);
    expect(formatearPesos('1500000')).toBe(`$${ESPACIO_FIJO}1.500.000`);
  });

  it('muestra los centavos cuando existen: nunca los esconde', () => {
    expect(formatearPesos('25925.92')).toBe(`$${ESPACIO_FIJO}25.925,92`);
  });

  it('puede mostrar siempre centavos, para bases e impuestos', () => {
    expect(formatearPesos('2074', { conCentavos: true })).toBe(`$${ESPACIO_FIJO}2.074,00`);
  });

  it('muestra valores negativos', () => {
    expect(formatearPesos('-500')).toBe(`-$${ESPACIO_FIJO}500`);
  });

  it('no pierde precisión con valores grandes', () => {
    expect(formatearPesos('999999999999.99')).toBe(`$${ESPACIO_FIJO}999.999.999.999,99`);
  });
});

describe('formatearCantidad y formatearPorcentaje', () => {
  it('muestra cantidades con coma decimal y sin ceros de más', () => {
    expect(formatearCantidad('2')).toBe('2');
    expect(formatearCantidad('0.5')).toBe('0,5');
    expect(formatearCantidad('1.250')).toBe('1,25');
  });

  it('muestra porcentajes con el espacio fijo antes del signo', () => {
    expect(formatearPorcentaje('10')).toBe(`10${ESPACIO_FIJO}%`);
    expect(formatearPorcentaje('48.28')).toBe(`48,28${ESPACIO_FIJO}%`);
  });
});

describe('esMontoValido', () => {
  it('acepta lo mismo que el API: dígitos y máximo 2 decimales con punto', () => {
    expect(esMontoValido('12000')).toBe(true);
    expect(esMontoValido('12000.5')).toBe(true);
  });

  it('rechaza separadores de miles, comas, signos y más de 2 decimales', () => {
    expect(esMontoValido('12.000.00')).toBe(false);
    expect(esMontoValido('12000,50')).toBe(false);
    expect(esMontoValido('-500')).toBe(false);
    expect(esMontoValido('10.123')).toBe(false);
    expect(esMontoValido('')).toBe(false);
  });
});

describe('montoComoTexto', () => {
  it('sin decimales si es entero; con dos si tiene centavos', () => {
    expect(montoComoTexto('42000.00')).toBe('42000');
    expect(montoComoTexto('42000.5')).toBe('42000.50');
  });
});
