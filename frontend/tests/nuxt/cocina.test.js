// @ts-check
// Pruebas del tablero de cocina con un backend simulado.
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TarjetaComanda from '~/components/cocina/TarjetaComanda.vue';
import PaginaCocina from '~/pages/cocina.vue';
import { usePedidosStore } from '~/stores/pedidos.js';
import { armarTablero } from '~/utils/cocina.js';
import { simularBackend } from './ayudantes.js';

const { fetchFalso } = vi.hoisted(() => ({ fetchFalso: vi.fn() }));
mockNuxtImport('$fetch', () => fetchFalso);

const hace = (/** @type {number} */ minutos) =>
  new Date(Date.now() - minutos * 60_000).toISOString();

/**
 * Pedido de cocina como lo entrega el API.
 * @param {string} id
 * @param {string} mesa
 * @param {Array<{ estadoCocina: string, nombre: string, notas?: string, minutos: number }>} platos
 * @param {string} [estado]
 */
const pedido = (id, mesa, platos, estado = 'enviado_a_cocina') => ({
  id,
  estado,
  mesa: { id: `m-${id}`, nombre: mesa },
  mesaId: `m-${id}`,
  meseroId: 'laura',
  total: '10000',
  abiertoEn: hace(Math.max(...platos.map((p) => p.minutos))),
  items: platos.map((plato, i) => ({
    id: `${id}-${i}`,
    productoId: `p${i}`,
    cantidad: '1',
    estadoCocina: plato.estadoCocina,
    notas: plato.notas ?? null,
    creadoEn: hace(plato.minutos),
    producto: { nombre: plato.nombre },
  })),
});

beforeEach(() => {
  fetchFalso.mockReset();
});

describe('tarjeta de comanda', () => {
  /** @param {any} pedidoDeCocina */
  const comandaDe = (pedidoDeCocina) => ({
    pedido: pedidoDeCocina,
    items: pedidoDeCocina.items,
    minutos: 0,
  });

  it('muestra la mesa, los platos con sus notas y que es nueva', async () => {
    const tarjeta = await mountSuspended(TarjetaComanda, {
      props: {
        comanda: comandaDe(
          pedido('1', 'Mesa 4', [
            { estadoCocina: 'pendiente', nombre: 'IND Classic', notas: 'Sin cebolla', minutos: 0 },
          ]),
        ),
      },
    });

    expect(tarjeta.text()).toContain('Mesa 4');
    expect(tarjeta.text()).toContain('IND Classic');
    expect(tarjeta.text()).toContain('Sin cebolla');
    expect(tarjeta.text()).toContain('Nueva');
  });

  it('tocar un plato pide avanzarlo; los listos no se pueden tocar', async () => {
    const comanda = comandaDe(
      pedido('1', 'Mesa 4', [
        { estadoCocina: 'pendiente', nombre: 'IND Classic', minutos: 3 },
        { estadoCocina: 'listo', nombre: 'Gaseosa', minutos: 3 },
      ]),
    );
    const tarjeta = await mountSuspended(TarjetaComanda, { props: { comanda } });
    const [pendiente, listo] = tarjeta.findAll('li button');

    await pendiente?.trigger('click');

    expect(tarjeta.emitted('avanzar')?.[0]).toEqual([comanda.items[0]]);
    expect(listo?.attributes('disabled')).toBeDefined();
  });

  it('"Todo listo" termina lo que falta; en mostrador, "Ya salió" la quita', async () => {
    const conPendientes = await mountSuspended(TarjetaComanda, {
      props: {
        comanda: comandaDe(
          pedido('1', 'Mesa 4', [
            { estadoCocina: 'preparando', nombre: 'IND Classic', minutos: 5 },
          ]),
        ),
      },
    });
    const todoListo = conPendientes.findAll('button').find((b) => b.text().includes('Todo listo'));
    await todoListo?.trigger('click');
    expect(conPendientes.emitted('todoListo')).toHaveLength(1);

    const mostrador = await mountSuspended(TarjetaComanda, {
      props: {
        comanda: comandaDe({
          ...pedido('2', 'Mostrador', [
            { estadoCocina: 'listo', nombre: 'IND Classic', minutos: 5 },
          ]),
          mesa: null,
          mesaId: null,
        }),
      },
    });
    const yaSalio = mostrador.findAll('button').find((b) => b.text().includes('Ya salió'));
    expect(yaSalio).toBeDefined();
    await yaSalio?.trigger('click');
    expect(mostrador.emitted('entregar')).toHaveLength(1);
  });

  it('en una mesa, con todo listo, espera al mesero: la entrega no la marca la cocina', async () => {
    const enMesa = await mountSuspended(TarjetaComanda, {
      props: {
        comanda: comandaDe(
          pedido('3', 'Mesa 2', [{ estadoCocina: 'listo', nombre: 'IND Classic', minutos: 5 }]),
        ),
      },
    });

    expect(enMesa.text()).toContain('Esperando al mesero');
    expect(enMesa.findAll('button').some((b) => b.text().includes('Ya salió'))).toBe(false);
  });

  it('una comanda que el cliente ya pagó lo dice', async () => {
    const cobrada = await mountSuspended(TarjetaComanda, {
      props: {
        comanda: comandaDe(
          pedido(
            '4',
            'Mesa 3',
            [{ estadoCocina: 'preparando', nombre: 'IND Classic', minutos: 2 }],
            'pagado',
          ),
        ),
      },
    });

    expect(cobrada.text()).toContain('Pagado');
  });
});

describe('tablero de cocina', () => {
  it('reparte las comandas en sus columnas y deja fuera las no enviadas', async () => {
    simularBackend(fetchFalso, {
      'GET /pedidos': () => [
        pedido('a', 'Mesa 1', [{ estadoCocina: 'pendiente', nombre: 'Perro Clasic', minutos: 4 }]),
        pedido('b', 'Mesa 2', [
          { estadoCocina: 'preparando', nombre: 'La Texana 2P', minutos: 14 },
        ]),
        pedido('c', 'Terraza 1', [
          { estadoCocina: 'listo', nombre: 'Salchi Classic 1P', minutos: 26 },
        ]),
        pedido(
          'd',
          'Mesa 9',
          [{ estadoCocina: 'pendiente', nombre: 'No enviado', minutos: 1 }],
          'abierto',
        ),
      ],
    });

    const pagina = await mountSuspended(PaginaCocina);
    await vi.waitFor(() => expect(pagina.text()).toContain('Perro Clasic'));

    const columnas = pagina.findAll('section');
    expect(columnas[0]?.text()).toContain('Mesa 1');
    expect(columnas[1]?.text()).toContain('Mesa 2');
    expect(columnas[2]?.text()).toContain('Terraza 1');
    expect(pagina.text()).not.toContain('No enviado');
  });

  it('tocar un plato pendiente lo pasa a preparando en el API', async () => {
    const comanda = pedido('a', 'Mesa 1', [
      { estadoCocina: 'pendiente', nombre: 'Perro Clasic', minutos: 4 },
    ]);
    simularBackend(fetchFalso, {
      'GET /pedidos': () => [structuredClone(comanda)],
      'PATCH /pedidos/a/items/a-0/cocina': () => {
        const actualizado = structuredClone(comanda);
        actualizado.items[0].estadoCocina = 'preparando';
        return actualizado;
      },
    });

    const pagina = await mountSuspended(PaginaCocina);
    await vi.waitFor(() => expect(pagina.text()).toContain('Perro Clasic'));
    await pagina.find('li button').trigger('click');

    await vi.waitFor(() => {
      const [, opciones] =
        fetchFalso.mock.calls.find(([ruta]) => ruta === '/pedidos/a/items/a-0/cocina') ?? [];
      expect(opciones?.body).toEqual({ estadoCocina: 'preparando' });
    });
    await vi.waitFor(() => expect(pagina.findAll('section')[1]?.text()).toContain('Mesa 1'));
  });
});

describe('pedidos cobrados con platos en la cocina', () => {
  /**
   * Pedido que pasó por la cocina, con un plato preparándose.
   * @param {string} id
   * @param {{ estado?: string, enMesa?: boolean }} [opciones]
   */
  const enviado = (id, { estado = 'enviado_a_cocina', enMesa = true } = {}) => ({
    ...pedido(
      id,
      'Mesa 5',
      [{ estadoCocina: 'preparando', nombre: 'IND Classic', minutos: 3 }],
      estado,
    ),
    ...(enMesa ? {} : { mesa: null, mesaId: null }),
    enviadoACocinaEn: hace(3),
  });

  it('la cocina los sigue viendo hasta que sale el último plato', async () => {
    simularBackend(fetchFalso, {
      'GET /pedidos': ({ query }) =>
        query.cocina ? [enviado('c', { estado: 'pagado', enMesa: false })] : [],
    });
    const pedidos = usePedidosStore();
    await pedidos.cargarActivos();

    // No está por cobrar (no cuenta como activo), pero sigue en el tablero.
    expect(pedidos.lista).toHaveLength(0);
    expect(armarTablero(pedidos.comandas).preparando.map((c) => c.pedido.id)).toEqual(['c']);

    pedidos.alCambiarEstadoCocina({ pedidoId: 'c', itemId: 'c-0', estadoCocina: 'listo' });
    expect(pedidos.buscar('c')).not.toBeNull();
    pedidos.alCambiarEstadoCocina({ pedidoId: 'c', itemId: 'c-0', estadoCocina: 'entregado' });
    expect(pedidos.buscar('c')).toBeNull();
  });

  it('si se cobra mientras se prepara, deja de estar por cobrar pero no sale del tablero', async () => {
    simularBackend(fetchFalso, {
      'GET /pedidos': ({ query }) => (query.activos ? [enviado('m')] : []),
    });
    const pedidos = usePedidosStore();
    await pedidos.cargarActivos();

    pedidos.alCerrarPedido({ id: 'm', estado: 'pagado' });

    expect(pedidos.lista).toHaveLength(0);
    expect(pedidos.comandas.map((p) => p.id)).toEqual(['m']);
    expect(pedidos.buscar('m')?.estado).toBe('pagado');
  });

  it('una venta cobrada sin pasar por la cocina, o una anulada, sale de una vez', async () => {
    const sinCocina = pedido(
      's',
      'Mesa 6',
      [{ estadoCocina: 'pendiente', nombre: 'Gaseosa', minutos: 1 }],
      'abierto',
    );
    simularBackend(fetchFalso, {
      'GET /pedidos': ({ query }) => (query.activos ? [sinCocina, enviado('x')] : []),
    });
    const pedidos = usePedidosStore();
    await pedidos.cargarActivos();

    pedidos.alCerrarPedido({ id: 's', estado: 'pagado' });
    pedidos.alCerrarPedido({ id: 'x', estado: 'anulado' });

    expect(pedidos.comandas).toHaveLength(0);
  });
});
