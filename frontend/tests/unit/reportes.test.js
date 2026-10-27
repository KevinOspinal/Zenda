// @ts-check
// Pruebas de los periodos y de los datos de los reportes.
import { describe, expect, it } from 'vitest';
import { diasDelRango, rangoDePeriodo } from '../../app/utils/periodos.js';
import { completarHoras, etiquetaDeHora, horaPico } from '../../app/utils/reportes.js';

// Miércoles 28 de octubre de 2026, 9:00 p. m. en Colombia (ya es 29 en UTC).
const MIERCOLES_NOCHE = '2026-10-29T02:00:00Z';

describe('rangoDePeriodo (hora de Colombia)', () => {
  it('hoy y ayer, aunque en UTC ya sea el día siguiente', () => {
    expect(rangoDePeriodo('hoy', MIERCOLES_NOCHE)).toEqual({
      desde: '2026-10-28',
      hasta: '2026-10-28',
    });
    expect(rangoDePeriodo('ayer', MIERCOLES_NOCHE)).toEqual({
      desde: '2026-10-27',
      hasta: '2026-10-27',
    });
  });

  it('la semana empieza el lunes', () => {
    expect(rangoDePeriodo('semana', MIERCOLES_NOCHE)).toEqual({
      desde: '2026-10-26',
      hasta: '2026-10-28',
    });
    // Un domingo, la semana va desde el lunes anterior.
    expect(rangoDePeriodo('semana', '2026-11-01T15:00:00Z')).toEqual({
      desde: '2026-10-26',
      hasta: '2026-11-01',
    });
  });

  it('el mes va desde el día 1', () => {
    expect(rangoDePeriodo('mes', MIERCOLES_NOCHE)).toEqual({
      desde: '2026-10-01',
      hasta: '2026-10-28',
    });
  });

  it('cuenta los días del rango, incluidos ambos extremos', () => {
    expect(diasDelRango({ desde: '2026-10-28', hasta: '2026-10-28' })).toBe(1);
    expect(diasDelRango({ desde: '2026-10-01', hasta: '2026-10-28' })).toBe(28);
  });
});

describe('datos de los reportes', () => {
  it('dice la hora como en Colombia', () => {
    expect(etiquetaDeHora(0)).toBe('12 a. m.');
    expect(etiquetaDeHora(12)).toBe('12 p. m.');
    expect(etiquetaDeHora(13)).toBe('1 p. m.');
  });

  it('completa con cero las horas sin ventas', () => {
    const horas = completarHoras([
      { hora: 12, ventas: 2, total: '28000.00' },
      { hora: 14, ventas: 1, total: '12000.00' },
    ]);

    expect(horas.map((h) => [h.hora, h.total])).toEqual([
      [12, 28000],
      [13, 0],
      [14, 12000],
    ]);
    expect(horas[1].etiqueta).toBe('1 p. m.');
  });

  it('encuentra la hora pico por total', () => {
    expect(
      horaPico([
        { hora: 12, ventas: 5, total: '28000.00' },
        { hora: 19, ventas: 3, total: '52000.00' },
      ])?.hora,
    ).toBe(19);
    expect(horaPico([])).toBeNull();
  });
});
