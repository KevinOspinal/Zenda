// @ts-check
// Pruebas de los stores de pedidos y mesas con un backend simulado: cargar, acciones y
// eventos en vivo.
import { mockNuxtImport } from '@nuxt/test-utils/runtime';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useMesasStore } from '~/stores/mesas.js';
import { usePedidosStore } from '~/stores/pedidos.js';
import { errorDelApi, simularBackend } from './ayudantes.js';

const { fetchFalso } = vi.hoisted(() => ({ fetchFalso: vi.fn() }));
mockNuxtImport('$fetch', () => fetchFalso);

/**
 * Pedido como lo entrega el API.
 * @param {string} id
 * @param {object} [cambios]
 */
const pedidoDelApi = (id, cambios = {}) => ({
  id,
  mesaId: `mesa-${id}`,
  mesa: { id: `mesa-${id}`, nombre: `Mesa ${id}` },
  meseroId: 'laura',
  estado: 'enviado_a_cocina',
  total: '28000',
  abiertoEn: '2026-10-27T15:00:00.000Z',
  items: [
    {
      id: `${id}-a`,
      productoId: 'p1',
      cantidad: '2',
      estadoCocina: 'listo',
      producto: { nombre: 'IND Classic' },
    },
    {
      id: `${id}-b`,
      productoId: 'p2',
      cantidad: '1',
      estadoCocina: 'pendiente',
      producto: { nombre: 'Gaseosa' },
    },
  ],
  ...cambios,
});

beforeEach(() => {
  setActivePinia(createPinia());
  fetchFalso.mockReset();
});

describe('pedidos activos', () => {
  it('trae los pedidos activos con sus ítems en una sola petición', async () => {
    simularBackend(fetchFalso, { 'GET /pedidos': () => [pedidoDelApi('1'), pedidoDelApi('2')] });
    const pedidos = usePedidosStore();

    await pedidos.cargarActivos();

    expect(pedidos.estadoCarga).toBe('listo');
    expect(pedidos.lista).toHaveLength(2);
    expect(fetchFalso.mock.calls[0][1].query).toEqual({ activos: true, incluirItems: true });
    expect(pedidos.pedidoDeMesa('mesa-2')?.id).toBe('2');
  });

  it('si falla la primera carga, queda en error con un mensaje claro', async () => {
    simularBackend(fetchFalso, {
      'GET /pedidos': () => {
        throw errorDelApi(500, 'INTERNAL_ERROR');
      },
    });
    const pedidos = usePedidosStore();

    await pedidos.cargarActivos();

    expect(pedidos.estadoCarga).toBe('error');
    expect(pedidos.errorCarga).toBe('Algo salió mal de nuestro lado. Intenta de nuevo.');
  });

  it('los platos listos se agrupan por mesa y se pueden filtrar por mesero', async () => {
    simularBackend(fetchFalso, {
      'GET /pedidos': () => [pedidoDelApi('1'), pedidoDelApi('2', { meseroId: 'juan' })],
    });
    const pedidos = usePedidosStore();
    await pedidos.cargarActivos();

    expect(pedidos.pedidosConPlatosListos()).toHaveLength(2);
    expect(
      pedidos.pedidosConPlatosListos('laura').map(({ pedido, items }) => [pedido.id, items.length]),
    ).toEqual([['1', 1]]);
  });
});

describe('acciones', () => {
  it('crear envía un uuidOffline para no duplicar el pedido si la petición se repite', async () => {
    simularBackend(fetchFalso, { 'POST /pedidos': () => pedidoDelApi('9', { estado: 'abierto' }) });
    const pedidos = usePedidosStore();

    const pedido = await pedidos.crear({
      mesaId: 'mesa-9',
      items: [{ productoId: 'p1', cantidad: 1 }],
    });

    expect(pedido.id).toBe('9');
    const cuerpo = fetchFalso.mock.calls[0][1].body;
    expect(cuerpo.mesaId).toBe('mesa-9');
    expect(cuerpo.uuidOffline).toMatch(/^[0-9a-f-]{36}$/);
    expect(pedidos.porId['9']).toBeDefined();
  });

  it('cambiar el estado de cocina se ve al instante y se revierte si el API lo rechaza', async () => {
    simularBackend(fetchFalso, {
      'GET /pedidos': () => [pedidoDelApi('1')],
      'PATCH /pedidos/1/items/1-b/cocina': () => {
        throw errorDelApi(409, 'CAMBIO_COCINA_INVALIDO');
      },
    });
    const pedidos = usePedidosStore();
    await pedidos.cargarActivos();

    const cambio = pedidos.cambiarEstadoCocina('1', '1-b', 'preparando');
    expect(pedidos.porId['1'].items[1].estadoCocina).toBe('preparando');

    await expect(cambio).rejects.toMatchObject({ codigo: 'CAMBIO_COCINA_INVALIDO' });
    expect(pedidos.porId['1'].items[1].estadoCocina).toBe('pendiente');
  });
});

describe('todos los platos de un pedido a la vez', () => {
  it('se ven al instante y van en una sola petición', async () => {
    simularBackend(fetchFalso, {
      'GET /pedidos': () => [pedidoDelApi('1')],
      'PATCH /pedidos/1/cocina': () => {
        const pedido = pedidoDelApi('1');
        pedido.items = pedido.items.map((item) =>
          item.estadoCocina === 'listo' ? { ...item, estadoCocina: 'entregado' } : item,
        );
        return pedido;
      },
    });
    const pedidos = usePedidosStore();
    await pedidos.cargarActivos();

    const cambio = pedidos.cambiarEstadoCocinaDelPedido('1', 'entregado');
    // Se ve al instante, antes de que responda el API.
    expect(pedidos.pedidosConPlatosListos()).toEqual([]);
    await cambio;

    const llamadas = fetchFalso.mock.calls.filter(([ruta]) => ruta === '/pedidos/1/cocina');
    expect(llamadas).toHaveLength(1);
    expect(llamadas[0]?.[1].body).toEqual({ estadoCocina: 'entregado' });
  });

  it('si el API lo rechaza, los platos vuelven a como estaban', async () => {
    simularBackend(fetchFalso, {
      'GET /pedidos': () => [pedidoDelApi('1')],
      'PATCH /pedidos/1/cocina': () => {
        throw errorDelApi(403, 'SIN_PERMISO');
      },
    });
    const pedidos = usePedidosStore();
    await pedidos.cargarActivos();

    await expect(pedidos.cambiarEstadoCocinaDelPedido('1', 'entregado')).rejects.toMatchObject({
      codigo: 'SIN_PERMISO',
    });
    expect(pedidos.pedidosConPlatosListos()[0]?.items).toHaveLength(1);
  });
});

describe('eventos en vivo', () => {
  it('un plato que cambia en la cocina se actualiza sin pedir nada al API', async () => {
    simularBackend(fetchFalso, { 'GET /pedidos': () => [pedidoDelApi('1')] });
    const pedidos = usePedidosStore();
    await pedidos.cargarActivos();
    fetchFalso.mockClear();

    pedidos.alCambiarEstadoCocina({ pedidoId: '1', itemId: '1-b', estadoCocina: 'listo' });

    expect(pedidos.pedidosConPlatosListos()[0]?.items).toHaveLength(2);
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  it('varios platos que cambian a la vez se actualizan con un solo evento', async () => {
    simularBackend(fetchFalso, { 'GET /pedidos': () => [pedidoDelApi('1')] });
    const pedidos = usePedidosStore();
    await pedidos.cargarActivos();
    fetchFalso.mockClear();

    pedidos.alCambiarEstadoCocinaDelPedido({
      pedidoId: '1',
      estadoCocina: 'entregado',
      items: [{ id: '1-a' }],
    });

    expect(pedidos.pedidosConPlatosListos()).toEqual([]);
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  it('un pedido con cambios se trae completo del API', async () => {
    simularBackend(fetchFalso, {
      'GET /pedidos': () => [pedidoDelApi('1')],
      'GET /pedidos/1': () => pedidoDelApi('1', { total: '40000' }),
    });
    const pedidos = usePedidosStore();
    await pedidos.cargarActivos();

    await pedidos.alCambiarPedido({ id: '1' });

    expect(pedidos.porId['1'].total).toBe('40000');
  });

  it('un pedido cobrado o anulado sale de los activos', async () => {
    simularBackend(fetchFalso, { 'GET /pedidos': () => [pedidoDelApi('1')] });
    const pedidos = usePedidosStore();
    await pedidos.cargarActivos();

    pedidos.alCerrarPedido({ id: '1' });

    expect(pedidos.lista).toHaveLength(0);
  });
});

describe('mesas', () => {
  it('una mesa que cambia en vivo se actualiza y se resalta un momento', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    simularBackend(fetchFalso, {
      'GET /mesas': () => [
        { id: 'm1', nombre: 'Mesa 1', zona: 'Salón', capacidad: 4, estado: 'libre' },
      ],
    });
    const mesas = useMesasStore();
    await mesas.cargar();

    mesas.alCambiarEstado({ mesaId: 'm1', estado: 'ocupada' });

    expect(mesas.lista[0].estado).toBe('ocupada');
    expect(mesas.resaltadas.has('m1')).toBe(true);
    vi.advanceTimersByTime(1500);
    expect(mesas.resaltadas.has('m1')).toBe(false);
    vi.useRealTimers();
  });
});
