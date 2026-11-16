// @ts-check
// Pruebas de la lógica del inventario: el estado del stock, los contadores, el orden, los
// grupos por categoría y el historial (stock después de cada movimiento, días, puntos de la
// gráfica y resumen de la semana). La búsqueda se prueba en busqueda.test.js.
import { describe, expect, it } from 'vitest';
import {
  ESTADOS_STOCK,
  LIMITE_MOVIMIENTOS,
  STOCK_BAJO,
  agruparPorCategoria,
  agruparPorDia,
  claseDeMovimiento,
  compararPorUrgencia,
  conteoPorEstado,
  estadoDeStock,
  etiquetaDeDia,
  historialConStock,
  puntosDeStock,
  resumenDeLaSemana,
} from '../../app/utils/inventario.js';

/**
 * @param {string} id
 * @param {string} stock
 * @param {Partial<{ nombre: string, activo: boolean }>} [extra]
 */
const producto = (id, stock, extra = {}) => ({ id, nombre: id, stock, activo: true, ...extra });

describe('estadoDeStock', () => {
  it('negativo es por revisar, cero agotado, hasta el mínimo bajo y lo demás con stock', () => {
    expect(estadoDeStock('-3')).toBe('revisar');
    expect(estadoDeStock('0')).toBe('agotado');
    expect(estadoDeStock('0.000')).toBe('agotado');
    expect(estadoDeStock('-0')).toBe('agotado');
    expect(estadoDeStock(String(STOCK_BAJO))).toBe('bajo');
    expect(estadoDeStock('0.5')).toBe('bajo');
    expect(estadoDeStock(String(STOCK_BAJO + 1))).toBe('con_stock');
  });

  it('cada estado tiene etiqueta, contador, ícono y color', () => {
    for (const estado of Object.values(ESTADOS_STOCK)) {
      expect(estado.etiqueta).toBeTruthy();
      expect(estado.plural).toBeTruthy();
      expect(estado.icono).toMatch(/^i-lucide-/);
      expect(estado.color).toBeTruthy();
    }
  });
});

describe('conteoPorEstado', () => {
  it('cuenta los productos de cada estado', () => {
    const productos = [
      producto('a', '-24'),
      producto('b', '-1'),
      producto('c', '0'),
      producto('d', '5'),
      producto('e', '40'),
    ];

    expect(conteoPorEstado(productos)).toEqual({ revisar: 2, agotado: 1, bajo: 1, con_stock: 1 });
  });
});

describe('compararPorUrgencia', () => {
  it('lo urgente primero; dentro de cada estado, el de menos stock; los inactivos al final', () => {
    const productos = [
      producto('con stock', '30'),
      producto('inactivo negativo', '-50', { activo: false }),
      producto('bajo', '3'),
      producto('poco negativo', '-2'),
      producto('agotado', '0'),
      producto('muy negativo', '-66'),
    ];

    expect([...productos].sort(compararPorUrgencia).map((p) => p.id)).toEqual([
      'muy negativo',
      'poco negativo',
      'agotado',
      'bajo',
      'con stock',
      'inactivo negativo',
    ]);
  });

  it('con el mismo estado y stock, por nombre', () => {
    const productos = [producto('Jugo', '10'), producto('Agua', '10')];

    expect([...productos].sort(compararPorUrgencia).map((p) => p.id)).toEqual(['Agua', 'Jugo']);
  });
});

describe('agruparPorCategoria', () => {
  const apariencia = { icono: 'i-lucide-cup-soda', fondo: 'bg-x', texto: 'text-x' };
  const bebidas = { id: 'c2', nombre: 'Bebidas', posicion: 1, apariencia };
  const cervezas = { id: 'c1', nombre: 'Cervezas', posicion: 0, apariencia };

  it('sigue el orden de la carta, junta los sin categoría al final y cuenta los por atender', () => {
    const productos = [producto('agua', '-2'), producto('club', '20'), producto('raro', '4')];
    const categorias = new Map([
      ['agua', bebidas],
      ['club', cervezas],
    ]);

    const grupos = agruparPorCategoria(productos, categorias, 'Sin categoría');

    expect(grupos.map((g) => [g.nombre, g.productos.map((p) => p.id), g.porAtender])).toEqual([
      ['Cervezas', ['club'], 0],
      ['Bebidas', ['agua'], 1],
      ['Sin categoría', ['raro'], 1],
    ]);
  });
});

describe('historial', () => {
  const movimientos = [
    { id: 'm1', tipo: 'compra', cantidad: '24', fecha: '2026-11-10T15:00:00.000Z' },
    { id: 'm3', tipo: 'venta', cantidad: '-2', fecha: '2026-11-16T01:00:00.000Z' },
    { id: 'm2', tipo: 'venta', cantidad: '-3', fecha: '2026-11-15T20:00:00.000Z' },
    {
      id: 'm4',
      tipo: 'ajuste',
      cantidad: '2',
      fecha: '2026-11-16T02:00:00.000Z',
      pedidoId: 'p1',
    },
  ];
  // Stock de ahora: 24 - 3 - 2 + 2.
  const stockActual = '21';

  it('calcula hacia atrás cuánto quedó después de cada movimiento, del más reciente al más antiguo', () => {
    const historial = historialConStock(/** @type {any} */ (movimientos), stockActual);

    expect(historial.map((m) => [m.id, m.stockDespues])).toEqual([
      ['m4', '21'],
      ['m3', '19'],
      ['m2', '21'],
      ['m1', '24'],
    ]);
  });

  it('un ajuste con pedido es la devolución de una venta anulada', () => {
    expect(claseDeMovimiento(/** @type {any} */ (movimientos[3]))).toBe('anulacion');
    expect(claseDeMovimiento(/** @type {any} */ ({ tipo: 'ajuste', pedidoId: null }))).toBe(
      'ajuste',
    );
  });

  it('agrupa por día de Colombia: la 1 a. m. UTC del 16 todavía es el 15 en Colombia', () => {
    const ahora = '2026-11-16T15:00:00.000Z';
    const historial = historialConStock(/** @type {any} */ (movimientos), stockActual);

    const dias = agruparPorDia(historial, ahora);

    expect(dias.map((d) => [d.etiqueta, d.movimientos.map((m) => m.id)])).toEqual([
      ['Ayer', ['m4', 'm3', 'm2']],
      ['mar 10 nov', ['m1']],
    ]);
    expect(etiquetaDeDia('2026-11-16T14:00:00.000Z', ahora)).toBe('Hoy');
  });

  it('los puntos de la gráfica van del más antiguo a ahora y terminan en el stock actual', () => {
    const ahora = '2026-11-16T15:00:00.000Z';
    const historial = historialConStock(/** @type {any} */ (movimientos), stockActual);

    const puntos = puntosDeStock(historial, stockActual, ahora);

    expect(puntos.map((p) => p.stock)).toEqual([24, 21, 19, 21, 21]);
    expect(puntos.at(-1)?.tiempo).toBe(new Date(ahora).getTime());
    expect(puntosDeStock([], '5', ahora)).toEqual([]);
  });

  it('resume lo vendido y comprado en 7 días, descontando lo anulado', () => {
    const resumen = resumenDeLaSemana(/** @type {any} */ (movimientos), '2026-11-16T15:00:00.000Z');

    // Vendidas: 3 + 2 - 2 devueltas por la anulación. La compra fue hace 6 días.
    expect(resumen).toEqual({ vendidas: '3', compradas: '24', incompleto: false });
    expect(
      resumenDeLaSemana(/** @type {any} */ (movimientos), '2026-11-20T15:00:00.000Z').compradas,
    ).toBe('0');
  });

  it('si llegó el máximo de movimientos y todos son de esta semana, la cifra es "al menos"', () => {
    const muchos = Array.from({ length: LIMITE_MOVIMIENTOS }, (_, i) => ({
      id: `v${i}`,
      tipo: 'venta',
      cantidad: '-1',
      fecha: '2026-11-16T12:00:00.000Z',
    }));

    expect(resumenDeLaSemana(/** @type {any} */ (muchos), '2026-11-16T15:00:00.000Z')).toEqual({
      vendidas: String(LIMITE_MOVIMIENTOS),
      compradas: '0',
      incompleto: true,
    });
  });
});
