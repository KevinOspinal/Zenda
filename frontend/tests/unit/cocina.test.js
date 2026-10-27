// @ts-check
// Pruebas de las reglas del tablero de cocina y de los identificadores de pedidos.
import { describe, expect, it, vi } from 'vitest';
import {
  columnaDeComanda,
  esAgregadoDespues,
  minutosDeEspera,
  siguienteEstadoCocina,
} from '../../app/utils/cocina.js';
import { generarUuid } from '../../app/utils/identificadores.js';

/**
 * Plato de una comanda.
 * @param {'pendiente' | 'preparando' | 'listo' | 'entregado'} estadoCocina
 * @param {string} [creadoEn]
 */
const plato = (estadoCocina, creadoEn = '2026-10-27T15:00:00.000Z') => ({ estadoCocina, creadoEn });

describe('siguienteEstadoCocina', () => {
  it('cada toque avanza un paso: pendiente → preparando → listo → entregado', () => {
    expect(siguienteEstadoCocina('pendiente')).toBe('preparando');
    expect(siguienteEstadoCocina('preparando')).toBe('listo');
    expect(siguienteEstadoCocina('listo')).toBe('entregado');
  });

  it('un plato entregado ya no avanza', () => {
    expect(siguienteEstadoCocina('entregado')).toBeNull();
  });
});

describe('columnaDeComanda', () => {
  it('sin empezar: Pendiente', () => {
    expect(columnaDeComanda([plato('pendiente'), plato('pendiente')])).toBe('pendiente');
  });

  it('con algo en preparación: Preparando (aunque falten platos por empezar)', () => {
    expect(columnaDeComanda([plato('preparando'), plato('pendiente')])).toBe('preparando');
    expect(columnaDeComanda([plato('preparando'), plato('listo')])).toBe('preparando');
  });

  it('todo lo que falta entregar está listo: Listo', () => {
    expect(columnaDeComanda([plato('listo'), plato('entregado')])).toBe('listo');
  });

  it('un plato nuevo en una comanda ya lista la devuelve a Pendiente', () => {
    expect(columnaDeComanda([plato('listo'), plato('pendiente')])).toBe('pendiente');
  });

  it('todo entregado: sale del tablero', () => {
    expect(columnaDeComanda([plato('entregado')])).toBeNull();
    expect(columnaDeComanda([])).toBeNull();
  });
});

describe('minutosDeEspera', () => {
  const ahora = '2026-10-27T15:30:00.000Z';

  it('cuenta desde el plato más antiguo que todavía falta', () => {
    const items = [
      plato('listo', '2026-10-27T15:00:00.000Z'),
      plato('pendiente', '2026-10-27T15:12:00.000Z'),
      plato('preparando', '2026-10-27T15:10:00.000Z'),
    ];
    expect(minutosDeEspera(items, ahora)).toBe(20);
  });

  it('si todo está listo, cuenta desde el primer plato', () => {
    expect(minutosDeEspera([plato('listo', '2026-10-27T15:05:00.000Z')], ahora)).toBe(25);
  });
});

describe('esAgregadoDespues', () => {
  it('marca los platos que llegaron más de un minuto después del primero', () => {
    const primero = plato('listo', '2026-10-27T15:00:00.000Z');
    const casiJunto = plato('pendiente', '2026-10-27T15:00:40.000Z');
    const despues = plato('pendiente', '2026-10-27T15:08:00.000Z');
    const items = [primero, casiJunto, despues];

    expect(esAgregadoDespues(primero, items)).toBe(false);
    expect(esAgregadoDespues(casiJunto, items)).toBe(false);
    expect(esAgregadoDespues(despues, items)).toBe(true);
  });
});

describe('generarUuid', () => {
  const FORMATO_UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

  it('genera UUID v4 distintos', () => {
    const uno = generarUuid();
    expect(uno).toMatch(FORMATO_UUID_V4);
    expect(generarUuid()).not.toBe(uno);
  });

  it('funciona aunque el navegador no tenga randomUUID (http por IP en la red local)', () => {
    const original = globalThis.crypto.randomUUID;
    vi.spyOn(globalThis.crypto, 'randomUUID').mockImplementation(/** @type {any} */ (undefined));
    // @ts-expect-error: simula un navegador sin randomUUID.
    globalThis.crypto.randomUUID = undefined;
    try {
      expect(generarUuid()).toMatch(FORMATO_UUID_V4);
    } finally {
      globalThis.crypto.randomUUID = original;
      vi.restoreAllMocks();
    }
  });
});
