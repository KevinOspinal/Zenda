// @ts-check
// Pruebas del tablero de cocina con un backend simulado.
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TarjetaComanda from '~/components/cocina/TarjetaComanda.vue';
import PaginaCocina from '~/pages/cocina.vue';
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

  it('"Todo listo" termina lo que falta; con todo listo, "Ya salió" la quita', async () => {
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

    const lista = await mountSuspended(TarjetaComanda, {
      props: {
        comanda: comandaDe(
          pedido('2', 'Mesa 2', [{ estadoCocina: 'listo', nombre: 'IND Classic', minutos: 5 }]),
        ),
      },
    });
    const yaSalio = lista.findAll('button').find((b) => b.text().includes('Ya salió'));
    await yaSalio?.trigger('click');
    expect(lista.emitted('entregar')).toHaveLength(1);
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
