// @ts-check
// Pruebas de la lógica del mapa de mesas: el dibujo de cada mesa, cómo va la cocina, la
// espera, los filtros del resumen y los grupos por zona.
import { describe, expect, it } from 'vitest';
import {
  FILTROS_MESAS,
  LIENZO_MESA,
  MAX_SILLAS_DIBUJADAS,
  agruparPorZona,
  avanceDeCocina,
  conteoPorFiltro,
  cumpleFiltro,
  datosDeMesa,
  esperaMucho,
  faltaEnviarACocina,
  figuraDeMesa,
  minutosEsperandoCocina,
} from '../../app/utils/mesas.js';

/**
 * Los dos rectángulos se tocan o se montan.
 * @param {import('../../app/utils/mesas.js').Rectangulo} a
 * @param {import('../../app/utils/mesas.js').Rectangulo} b
 */
const seCruzan = (a, b) =>
  a.x < b.x + b.ancho && b.x < a.x + a.ancho && a.y < b.y + b.alto && b.y < a.y + a.alto;

describe('figuraDeMesa', () => {
  it('la forma depende de los puestos: redonda, cuadrada o rectangular', () => {
    expect(figuraDeMesa(2).forma).toBe('redonda');
    expect(figuraDeMesa(4).forma).toBe('cuadrada');
    expect(figuraDeMesa(6).forma).toBe('rectangular');
  });

  it('dibuja una silla por puesto, sin salirse del dibujo ni montarse en la mesa', () => {
    for (let puestos = 1; puestos <= MAX_SILLAS_DIBUJADAS; puestos += 1) {
      const { mesa, sillas } = figuraDeMesa(puestos);

      expect(sillas).toHaveLength(puestos);
      for (const silla of [mesa, ...sillas]) {
        expect(silla.x).toBeGreaterThanOrEqual(0);
        expect(silla.y).toBeGreaterThanOrEqual(0);
        expect(silla.x + silla.ancho).toBeLessThanOrEqual(LIENZO_MESA.ancho);
        expect(silla.y + silla.alto).toBeLessThanOrEqual(LIENZO_MESA.alto);
      }
      for (const [i, silla] of sillas.entries()) {
        expect(seCruzan(silla, mesa)).toBe(false);
        for (const otra of sillas.slice(i + 1)) expect(seCruzan(silla, otra)).toBe(false);
      }
    }
  });

  it('una mesa más grande que el dibujo muestra cuántos puestos no caben', () => {
    const figura = figuraDeMesa(16);

    expect(figura.sillas).toHaveLength(MAX_SILLAS_DIBUJADAS);
    expect(figura.sillasDeMas).toBe(4);
  });

  it('una capacidad inválida se dibuja como una mesa de un puesto', () => {
    expect(figuraDeMesa(0).sillas).toHaveLength(1);
    expect(figuraDeMesa(Number.NaN).sillas).toHaveLength(1);
  });
});

describe('avanceDeCocina', () => {
  it('cuenta los productos en cada paso de la cocina', () => {
    const items = [
      { estadoCocina: 'entregado' },
      { estadoCocina: 'entregado' },
      { estadoCocina: 'listo' },
      { estadoCocina: 'preparando' },
      { estadoCocina: 'pendiente' },
    ];

    expect(avanceDeCocina(items)).toEqual({
      pendiente: 1,
      preparando: 1,
      listo: 1,
      entregado: 2,
      total: 5,
    });
  });
});

describe('faltaEnviarACocina', () => {
  it('avisa del pedido abierto con productos que nunca se envió', () => {
    expect(faltaEnviarACocina({ estado: 'abierto', items: [{}] })).toBe(true);
    expect(faltaEnviarACocina({ estado: 'abierto', items: [] })).toBe(false);
    expect(faltaEnviarACocina({ estado: 'enviado_a_cocina', items: [{}] })).toBe(false);
    expect(faltaEnviarACocina(null)).toBe(false);
  });
});

describe('minutosEsperandoCocina', () => {
  const ahora = '2026-11-15T20:30:00.000Z';

  it('cuenta desde el plato más antiguo que todavía falta', () => {
    const pedido = {
      estado: 'enviado_a_cocina',
      items: [
        { estadoCocina: 'entregado', creadoEn: '2026-11-15T19:50:00.000Z' },
        { estadoCocina: 'preparando', creadoEn: '2026-11-15T20:05:00.000Z' },
        { estadoCocina: 'pendiente', creadoEn: '2026-11-15T20:20:00.000Z' },
      ],
    };

    expect(minutosEsperandoCocina(pedido, ahora)).toBe(25);
  });

  it('no cuenta si el pedido no se ha enviado o ya no le falta nada', () => {
    const items = [{ estadoCocina: 'pendiente', creadoEn: '2026-11-15T20:00:00.000Z' }];

    expect(minutosEsperandoCocina({ estado: 'abierto', items }, ahora)).toBeNull();
    expect(
      minutosEsperandoCocina(
        { estado: 'enviado_a_cocina', items: [{ ...items[0], estadoCocina: 'listo' }] },
        ahora,
      ),
    ).toBeNull();
  });

  it('un pedido ya cobrado que espera platos también cuenta', () => {
    const pedido = {
      estado: 'pagado',
      items: [{ estadoCocina: 'preparando', creadoEn: '2026-11-15T20:10:00.000Z' }],
    };

    expect(minutosEsperandoCocina(pedido, ahora)).toBe(20);
  });

  it('ignora los platos que aún no traen su hora, sin fallar', () => {
    const pedido = {
      estado: 'enviado_a_cocina',
      items: [
        { estadoCocina: 'pendiente' },
        { estadoCocina: 'pendiente', creadoEn: 'no es fecha' },
        { estadoCocina: 'preparando', creadoEn: '2026-11-15T20:15:00.000Z' },
      ],
    };

    expect(minutosEsperandoCocina(pedido, ahora)).toBe(15);
    expect(
      minutosEsperandoCocina({
        estado: 'enviado_a_cocina',
        items: [{ estadoCocina: 'pendiente' }],
      }),
    ).toBeNull();
  });
});

describe('esperaMucho', () => {
  it('es urgente desde los mismos minutos que en la cocina', () => {
    expect(esperaMucho(null)).toBe(false);
    expect(esperaMucho(20)).toBe(false);
    expect(esperaMucho(21)).toBe(true);
  });
});

describe('datosDeMesa', () => {
  const ahora = '2026-11-15T20:30:00.000Z';
  const pedido = {
    estado: 'enviado_a_cocina',
    abiertoEn: '2026-11-15T19:45:00.000Z',
    total: '126000',
    mesero: { nombre: 'Laura Gómez', rol: 'mesero' },
    items: [
      { estadoCocina: 'entregado', creadoEn: '2026-11-15T19:50:00.000Z' },
      { estadoCocina: 'listo', creadoEn: '2026-11-15T19:50:00.000Z' },
    ],
  };

  it('resume el pedido de la mesa: tiempo, total, cocina y quién la atiende', () => {
    const datos = datosDeMesa(pedido, { pagada: false, platosListos: true }, ahora);

    expect(datos).toMatchObject({
      minutos: 45,
      total: '126000',
      platosListos: true,
      sinEnviar: false,
      minutosEsperando: null,
      mesero: 'Laura Gómez',
    });
    expect(datos.avance).toMatchObject({ entregado: 1, listo: 1, total: 2 });
  });

  it('una mesa que ya pagó no muestra total: espera sus platos', () => {
    expect(datosDeMesa(pedido, { pagada: true, platosListos: false }, ahora).total).toBeNull();
  });

  it('una mesa sin pedido no tiene nada que contar', () => {
    expect(datosDeMesa(null, { pagada: false, platosListos: false }, ahora)).toMatchObject({
      pedido: null,
      minutos: null,
      avance: null,
    });
  });
});

describe('filtros del resumen', () => {
  const mesas = [
    { id: 'm1', estado: 'libre' },
    { id: 'm2', estado: 'ocupada' },
    { id: 'm3', estado: 'ocupada' },
  ];
  const datosPorMesa = new Map([
    ['m2', { platosListos: true, minutosEsperando: null }],
    ['m3', { platosListos: false, minutosEsperando: 25 }],
  ]);

  it('cada filtro tiene etiqueta, ícono y color', () => {
    for (const filtro of Object.values(FILTROS_MESAS)) {
      expect(filtro.etiqueta).toBeTruthy();
      expect(filtro.icono).toMatch(/^i-lucide-/);
      expect(filtro.color).toBeTruthy();
    }
  });

  it('cuenta las mesas de cada filtro', () => {
    expect(conteoPorFiltro(mesas, datosPorMesa)).toEqual({
      libres: 1,
      ocupadas: 2,
      listos: 1,
      esperando: 1,
    });
  });

  it('una mesa libre no entra en platos listos ni en esperando', () => {
    expect(cumpleFiltro('listos', mesas[0], undefined)).toBe(false);
    expect(cumpleFiltro('esperando', mesas[0], undefined)).toBe(false);
  });
});

describe('agruparPorZona', () => {
  it('agrupa en el orden en que aparece cada zona y junta las que no tienen', () => {
    const mesas = [
      { id: '1', zona: 'Salón' },
      { id: '2', zona: 'Terraza' },
      { id: '3', zona: null },
      { id: '4', zona: 'Salón' },
    ];

    expect(agruparPorZona(mesas, 'Sin zona')).toEqual([
      { zona: 'Salón', mesas: [mesas[0], mesas[3]] },
      { zona: 'Terraza', mesas: [mesas[1]] },
      { zona: 'Sin zona', mesas: [mesas[2]] },
    ]);
  });
});
