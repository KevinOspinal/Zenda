// @ts-check
// Pruebas de fechas y tiempos en hora de Colombia.
import { describe, expect, it } from 'vitest';
import {
  diaEnColombia,
  duracionCorta,
  fechaRelativa,
  formatearFechaCorta,
  formatearFechaYHora,
  formatearHora,
  haceCuanto,
  minutosTranscurridos,
} from '../../app/utils/fechas.js';

/**
 * Cada navegador separa "p. m." con espacios distintos (normal, fijo o angosto).
 * Las pruebas comparan con espacios normales.
 * @param {string} texto
 */
const conEspaciosNormales = (texto) => texto.replace(/[\u00a0\u202f]/g, ' ');

// 26 de octubre de 2026, 7:45 p. m. en Colombia (00:45 del 27 en UTC).
const NOCHE_DEL_26 = '2026-10-27T00:45:00Z';

describe('hora y fecha en Colombia', () => {
  it('muestra la hora de Colombia aunque en UTC ya sea otro día', () => {
    expect(conEspaciosNormales(formatearHora(NOCHE_DEL_26))).toBe('7:45 p. m.');
  });

  it('muestra la fecha corta sin comas ni "de"', () => {
    expect(formatearFechaCorta(NOCHE_DEL_26)).toBe('lun 26 oct');
  });

  it('da el día en formato YYYY-MM-DD para los filtros de los reportes', () => {
    expect(diaEnColombia(NOCHE_DEL_26)).toBe('2026-10-26');
  });

  it('da la fecha y la hora completas, como van en un recibo', () => {
    expect(conEspaciosNormales(formatearFechaYHora(NOCHE_DEL_26))).toBe('26/10/2026 7:45 p. m.');
  });

  it('rechaza fechas inválidas', () => {
    expect(() => formatearHora('no es fecha')).toThrow(TypeError);
  });
});

describe('fechaRelativa', () => {
  const ahora = '2026-10-27T15:00:00Z'; // martes 27, 10:00 a. m. en Colombia

  it('dice "hoy" para el mismo día', () => {
    expect(conEspaciosNormales(fechaRelativa('2026-10-27T13:30:00Z', ahora))).toBe(
      'hoy 8:30 a. m.',
    );
  });

  it('dice "ayer" para el día anterior en Colombia', () => {
    expect(conEspaciosNormales(fechaRelativa(NOCHE_DEL_26, ahora))).toBe('ayer 7:45 p. m.');
  });

  it('usa la fecha corta para días anteriores', () => {
    expect(conEspaciosNormales(fechaRelativa('2026-10-20T17:00:00Z', ahora))).toBe(
      'mar 20 oct 12:00 p. m.',
    );
  });

  it('justo después de medianoche, lo de antes de medianoche ya es "ayer"', () => {
    const despuesDeMedianoche = '2026-10-27T05:05:00Z'; // 12:05 a. m. del 27 en Colombia
    expect(conEspaciosNormales(fechaRelativa(NOCHE_DEL_26, despuesDeMedianoche))).toBe(
      'ayer 7:45 p. m.',
    );
  });
});

describe('tiempos transcurridos', () => {
  const abierto = '2026-10-27T15:00:00Z';

  it('cuenta minutos completos', () => {
    expect(minutosTranscurridos(abierto, '2026-10-27T15:12:59Z')).toBe(12);
  });

  it('nunca da negativo si el reloj del dispositivo va atrasado', () => {
    expect(minutosTranscurridos(abierto, '2026-10-27T14:59:00Z')).toBe(0);
  });

  it('muestra duraciones cortas en minutos y horas', () => {
    expect(duracionCorta(0)).toBe('0 min');
    expect(duracionCorta(12)).toBe('12 min');
    expect(duracionCorta(65)).toBe('1 h 05 min');
    expect(duracionCorta(120)).toBe('2 h');
  });

  it('dice hace cuánto pasó algo', () => {
    expect(haceCuanto(abierto, '2026-10-27T15:00:30Z')).toBe('hace un momento');
    expect(haceCuanto(abierto, '2026-10-27T15:12:00Z')).toBe('hace 12 min');
  });
});
