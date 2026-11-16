// @ts-check
// Pruebas de las contraseñas nuevas: los requisitos que se marcan, la regla completa (la del
// backend) y la contraseña generada al azar.
import { describe, expect, it } from 'vitest';
import {
  LARGO_MAXIMO_CONTRASENA,
  contrasenaValida,
  generarContrasena,
  requisitosDe,
} from '../../app/utils/contrasenas.js';

describe('requisitosDe', () => {
  it('marca cada requisito a medida que se cumple', () => {
    const cumplidos = (/** @type {string} */ texto) =>
      requisitosDe(texto)
        .filter((requisito) => requisito.cumplido)
        .map((requisito) => requisito.id);
    expect(cumplidos('')).toEqual([]);
    expect(cumplidos('ñ')).toEqual(['letra']);
    expect(cumplidos('12345678')).toEqual(['largo', 'numero']);
    expect(cumplidos('Centenario2026')).toEqual(['largo', 'letra', 'numero']);
  });
});

describe('contrasenaValida', () => {
  it('pide 8 caracteres o más, con una letra y un número, y no más de 128', () => {
    expect(contrasenaValida('Centenario2026')).toBe(true);
    expect(contrasenaValida('abc12')).toBe(false);
    expect(contrasenaValida('solo letras')).toBe(false);
    expect(contrasenaValida('12345678')).toBe(false);
    expect(contrasenaValida(`a1${'x'.repeat(LARGO_MAXIMO_CONTRASENA)}`)).toBe(false);
  });
});

describe('generarContrasena', () => {
  it('da tres grupos de cuatro letras o números, fáciles de dictar, y cumple la regla', () => {
    for (let vez = 0; vez < 50; vez += 1) {
      const contrasena = generarContrasena();
      expect(contrasena).toMatch(/^[A-Za-z2-9]{4}-[A-Za-z2-9]{4}-[A-Za-z2-9]{4}$/);
      expect(contrasena).not.toMatch(/[01OIl]/);
      expect(contrasenaValida(contrasena)).toBe(true);
    }
  });

  it('cada vez es distinta', () => {
    const generadas = new Set(Array.from({ length: 20 }, () => generarContrasena()));
    expect(generadas.size).toBe(20);
  });

  it('descarta los bytes que harían más probables unas letras, y repite si no hay números', () => {
    // Primero solo letras (la "A", byte 0) y bytes descartados (≥ 220); luego, "A" y "2".
    let llamada = 0;
    const alAzar = (/** @type {Uint8Array} */ bytes) => {
      llamada += 1;
      bytes.fill(255);
      for (let i = 0; i < bytes.length; i += 2) bytes[i] = llamada === 1 ? 0 : i % 4 ? 0 : 46;
      return bytes;
    };
    expect(generarContrasena(alAzar)).toBe('2A2A-2A2A-2A2A');
  });
});
