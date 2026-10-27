// @ts-check
// Pruebas de las reglas del tablero de cocina y de los identificadores de pedidos.
import { describe, expect, it, vi } from 'vitest';
import {
  armarTablero,
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

describe('armarTablero', () => {
  const ahora = '2026-10-27T15:30:00.000Z';
  /**
   * @param {string} id
   * @param {string} estado
   * @param {Array<[string, string]>} platos [estadoCocina, creadoEn]
   */
  const pedido = (id, estado, platos) => ({
    id,
    estado,
    items: platos.map(([estadoCocina, creadoEn], i) => ({
      id: `${id}-${i}`,
      estadoCocina,
      creadoEn,
    })),
  });

  it('pone cada comanda en su columna y la que más espera va primero', () => {
    const tablero = armarTablero(
      [
        pedido('a', 'enviado_a_cocina', [['pendiente', '2026-10-27T15:20:00.000Z']]),
        pedido('b', 'enviado_a_cocina', [['pendiente', '2026-10-27T15:05:00.000Z']]),
        pedido('c', 'enviado_a_cocina', [['preparando', '2026-10-27T15:10:00.000Z']]),
        pedido('d', 'enviado_a_cocina', [
          ['listo', '2026-10-27T15:00:00.000Z'],
          ['entregado', '2026-10-27T15:00:00.000Z'],
        ]),
      ],
      ahora,
    );

    expect(tablero.pendiente.map((c) => c.pedido.id)).toEqual(['b', 'a']);
    expect(tablero.preparando.map((c) => c.pedido.id)).toEqual(['c']);
    expect(tablero.listo.map((c) => c.pedido.id)).toEqual(['d']);
    // Los platos entregados no se muestran.
    expect(tablero.listo[0].items).toHaveLength(1);
    expect(tablero.pendiente[0].minutos).toBe(25);
  });

  it('no muestra pedidos sin enviar a la cocina ni comandas ya entregadas', () => {
    const tablero = armarTablero(
      [
        pedido('abierto', 'abierto', [['pendiente', '2026-10-27T15:20:00.000Z']]),
        pedido('entregado', 'enviado_a_cocina', [['entregado', '2026-10-27T15:00:00.000Z']]),
      ],
      ahora,
    );

    expect(Object.values(tablero).flat()).toHaveLength(0);
  });
});
