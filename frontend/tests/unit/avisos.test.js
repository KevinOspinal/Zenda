// @ts-check
// Pruebas de los avisos de platos listos: uno por mesa, sin sonar a cada rato, y a quién le
// tocan los de un pedido sin mesero asignado.
import { describe, expect, it } from 'vitest';
import {
  crearAgrupadorDeAvisos,
  esDeTodosLosMeseros,
  textoDeAvisoListo,
} from '../../app/utils/avisos.js';

describe('crearAgrupadorDeAvisos', () => {
  it('junta en un solo aviso los platos de una mesa que salen seguidos', () => {
    const agrupador = crearAgrupadorDeAvisos({ ventanaMs: 8000, intervaloSonidoMs: 4000 });

    expect(agrupador.registrar('mesa4', 1, 0).cantidad).toBe(1);
    expect(agrupador.registrar('mesa4', 2, 1000).cantidad).toBe(3);
    // Otra mesa lleva su propia cuenta.
    expect(agrupador.registrar('mesa7', 1, 1500).cantidad).toBe(1);
  });

  it('cuando el aviso ya se fue, la cuenta empieza de nuevo', () => {
    const agrupador = crearAgrupadorDeAvisos({ ventanaMs: 8000, intervaloSonidoMs: 4000 });
    agrupador.registrar('mesa4', 2, 0);

    expect(agrupador.registrar('mesa4', 1, 9000).cantidad).toBe(1);
  });

  it('suena como máximo una vez cada pocos segundos, aunque lleguen muchos platos', () => {
    const agrupador = crearAgrupadorDeAvisos({ ventanaMs: 8000, intervaloSonidoMs: 4000 });

    const sonidos = [0, 500, 1000, 3999, 4000, 4100].map(
      (ahora, i) => agrupador.registrar(`mesa${i}`, 1, ahora).sonar,
    );

    expect(sonidos).toEqual([true, false, false, false, true, false]);
  });

  it('al entregarse, la mesa se olvida', () => {
    const agrupador = crearAgrupadorDeAvisos({ ventanaMs: 8000, intervaloSonidoMs: 4000 });
    agrupador.registrar('mesa4', 3, 0);
    agrupador.olvidar('mesa4');

    expect(agrupador.registrar('mesa4', 1, 100).cantidad).toBe(1);
  });
});

describe('textoDeAvisoListo', () => {
  it('nombra el plato si es uno solo, o dice cuántos son', () => {
    expect(textoDeAvisoListo('Mesa 4', 1, 'IND Classic')).toBe('Mesa 4 · IND Classic');
    expect(textoDeAvisoListo('Mesa 4', 3, 'IND Classic')).toBe('Mesa 4 · 3 platos listos');
  });
});

describe('esDeTodosLosMeseros', () => {
  it('un pedido del dueño, el administrador o el cajero es de todos los meseros', () => {
    for (const rol of ['dueno', 'administrador', 'cajero']) {
      expect(esDeTodosLosMeseros({ mesero: { rol } })).toBe(true);
    }
  });

  it('el de un mesero es solo suyo; sin saber quién lo tomó, también', () => {
    expect(esDeTodosLosMeseros({ mesero: { rol: 'mesero' } })).toBe(false);
    expect(esDeTodosLosMeseros({})).toBe(false);
  });
});
