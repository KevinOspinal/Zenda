// @ts-check
// Pruebas de las pantallas del mesero con un backend simulado: tomar pedido, mapa de mesas
// y avisos de platos listos.
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, ref, toRef } from 'vue';
import TomarPedido from '~/components/pedidos/TomarPedido.vue';
import { usePedidoEnCurso } from '~/composables/usePedidoEnCurso.js';
import PaginaAvisos from '~/pages/avisos.vue';
import PaginaMesas from '~/pages/mesas/index.vue';
import { useCajaStore } from '~/stores/caja.js';
import { useSesionStore } from '~/stores/sesion.js';
import { simularBackend, errorDelApi } from './ayudantes.js';

const { fetchFalso, navegarFalso } = vi.hoisted(() => ({
  fetchFalso: vi.fn(),
  navegarFalso: vi.fn(),
}));
mockNuxtImport('$fetch', () => fetchFalso);
mockNuxtImport('navigateTo', () => navegarFalso);

const MESAS = [
  { id: 'm1', nombre: 'Mesa 1', zona: 'Salón', capacidad: 4, estado: 'libre' },
  { id: 'm4', nombre: 'Mesa 4', zona: 'Salón', capacidad: 6, estado: 'ocupada' },
];

/** Pedido de la Mesa 4 con un plato listo (del mesero de la sesión). */
const PEDIDO_MESA_4 = {
  id: 'p4',
  mesaId: 'm4',
  mesa: { id: 'm4', nombre: 'Mesa 4' },
  meseroId: 'laura',
  estado: 'enviado_a_cocina',
  total: '38000',
  abiertoEn: new Date(Date.now() - 32 * 60_000).toISOString(),
  items: [
    {
      id: 'i1',
      productoId: 'p1',
      cantidad: '2',
      estadoCocina: 'listo',
      notas: 'Sin cebolla',
      producto: { nombre: 'IND Classic Artesanal' },
    },
    {
      id: 'i2',
      productoId: 'p2',
      cantidad: '1',
      estadoCocina: 'preparando',
      notas: null,
      producto: { nombre: 'Gaseosa personal' },
    },
  ],
};

/**
 * Pedido nuevo como lo responde el API.
 * @param {string} id
 * @param {number} numeroDeItems
 */
const pedidoNuevo = (id, numeroDeItems) => ({
  id,
  mesaId: 'm1',
  mesa: { id: 'm1', nombre: 'Mesa 1' },
  meseroId: 'laura',
  estado: 'abierto',
  total: String(12000 * numeroDeItems),
  abiertoEn: new Date().toISOString(),
  items: [],
});

beforeEach(() => {
  fetchFalso.mockReset();
  navegarFalso.mockReset();
  const sesion = useSesionStore();
  sesion.usuario = { id: 'laura', nombre: 'Laura', email: 'laura@x.test', rol: 'mesero' };
});

describe('tomar un pedido nuevo', () => {
  it('tocar varios productos muy rápido crea UN solo pedido y agrega el resto a ese', async () => {
    let itemsAgregados = 0;
    simularBackend(fetchFalso, {
      'GET /mesas': () => MESAS,
      'GET /pedidos': () => [],
      'POST /pedidos': async () => {
        await new Promise((resolver) => setTimeout(resolver, 20));
        return pedidoNuevo('nuevo-1', 1);
      },
      'POST /pedidos/nuevo-1/items': () => pedidoNuevo('nuevo-1', 1 + ++itemsAgregados),
    });
    const alCrear = vi.fn();
    /** @type {ReturnType<typeof usePedidoEnCurso> | undefined} */
    let pedidoEnCurso;
    const Envoltura = defineComponent({
      props: { pedidoId: { type: String, default: '' }, mesaId: { type: String, default: '' } },
      setup(props) {
        pedidoEnCurso = usePedidoEnCurso({
          pedidoId: toRef(props, 'pedidoId'),
          mesaId: toRef(props, 'mesaId'),
          alCrear,
        });
        return () => h('div');
      },
    });
    await mountSuspended(Envoltura, { props: { mesaId: 'm1' } });
    const producto = { id: 'p1', nombre: 'IND Classic Artesanal' };

    await Promise.all([
      pedidoEnCurso?.agregar(producto),
      pedidoEnCurso?.agregar(producto),
      pedidoEnCurso?.agregar(producto),
    ]);

    const rutas = fetchFalso.mock.calls.map(
      ([ruta, opciones]) => `${opciones?.method ?? 'GET'} ${ruta}`,
    );
    expect(rutas.filter((r) => r === 'POST /pedidos')).toHaveLength(1);
    expect(rutas.filter((r) => r === 'POST /pedidos/nuevo-1/items')).toHaveLength(2);
    expect(alCrear).toHaveBeenCalledExactlyOnceWith('nuevo-1');
    // Mientras tanto, el contador de la tarjeta ya mostraba los 3.
    expect(pedidoEnCurso?.total.value).toBe('36000');
  });

  it('si la caja está cerrada, lo avisa y la marca como cerrada', async () => {
    simularBackend(fetchFalso, {
      'GET /mesas': () => MESAS,
      'POST /pedidos': () => {
        throw errorDelApi(409, 'CAJA_CERRADA');
      },
    });
    /** @type {ReturnType<typeof usePedidoEnCurso> | undefined} */
    let pedidoEnCurso;
    const Envoltura = defineComponent({
      setup() {
        pedidoEnCurso = usePedidoEnCurso({
          pedidoId: ref(''),
          mesaId: ref('m1'),
          alCrear: () => {},
        });
        return () => h('div');
      },
    });
    await mountSuspended(Envoltura);

    await pedidoEnCurso?.agregar({ id: 'p1', nombre: 'IND Classic' });

    expect(useCajaStore().abierta).toBe(false);
  });
});

describe('mapa de mesas', () => {
  it('muestra cada mesa con su estado y resalta la que tiene platos listos', async () => {
    simularBackend(fetchFalso, {
      'GET /mesas': () => MESAS,
      'GET /pedidos': () => [PEDIDO_MESA_4],
      'GET /caja/estado': () => ({ abierta: true, turnoId: 't1', abiertoEn: '' }),
    });

    const pagina = await mountSuspended(PaginaMesas);

    await vi.waitFor(() => expect(pagina.text()).toContain('Mesa 4'));
    expect(pagina.text()).toContain('Libre');
    expect(pagina.text()).toContain('¡Listo!');
    expect(pagina.text()).toContain('1 con platos listos');
    expect(pagina.text()).not.toContain('La caja está cerrada');
  });

  it('con la caja cerrada, lo avisa arriba', async () => {
    simularBackend(fetchFalso, {
      'GET /mesas': () => MESAS,
      'GET /pedidos': () => [],
      'GET /caja/estado': () => ({ abierta: false, turnoId: null, abiertoEn: null }),
    });

    const pagina = await mountSuspended(PaginaMesas);

    await vi.waitFor(() => expect(pagina.text()).toContain('La caja está cerrada'));
    expect(pagina.text()).toContain('Pide al cajero que la abra');
  });
});

/** La Mesa 4 con sus dos platos listos, con los precios que trae el API. */
function mesa4ConDosListos() {
  const pedido = structuredClone(PEDIDO_MESA_4);
  pedido.items[1].estadoCocina = 'listo';
  pedido.items[0].precioUnitario = '15000';
  pedido.items[1].precioUnitario = '8000';
  return pedido;
}

describe('avisos de platos listos', () => {
  it('una tarjeta por mesa; con un solo plato listo, "Entregado" lo entrega', async () => {
    simularBackend(fetchFalso, {
      'GET /pedidos': () => [structuredClone(PEDIDO_MESA_4)],
      'PATCH /pedidos/p4/cocina': () => ({
        ...PEDIDO_MESA_4,
        items: [{ ...PEDIDO_MESA_4.items[0], estadoCocina: 'entregado' }, PEDIDO_MESA_4.items[1]],
      }),
    });

    const pagina = await mountSuspended(PaginaAvisos);
    await vi.waitFor(() => expect(pagina.text()).toContain('IND Classic Artesanal'));
    expect(pagina.text()).toContain('1 mesa con platos listos');
    expect(pagina.text()).toContain('Sin cebolla');
    // La gaseosa sigue en la cocina: se avisará cuando esté lista.
    expect(pagina.text()).toContain('1 aún en la cocina');

    const entregado = pagina.findAll('button').find((boton) => boton.text().includes('Entregado'));
    await entregado?.trigger('click');

    await vi.waitFor(() => expect(pagina.text()).toContain('No hay platos listos por ahora'));
    const [, opciones] =
      fetchFalso.mock.calls.find(([ruta]) => ruta === '/pedidos/p4/cocina') ?? [];
    expect(opciones.body).toEqual({ estadoCocina: 'entregado' });
  });

  it('varios platos de una mesa: "Entregar todo" o uno por uno', async () => {
    const pedido = mesa4ConDosListos();
    simularBackend(fetchFalso, {
      'GET /pedidos': () => [structuredClone(pedido)],
      'PATCH /pedidos/p4/items/i2/cocina': () => ({
        ...pedido,
        items: [pedido.items[0], { ...pedido.items[1], estadoCocina: 'entregado' }],
      }),
    });

    const pagina = await mountSuspended(PaginaAvisos);
    await vi.waitFor(() => expect(pagina.text()).toContain('Entregar todo (2)'));
    // Una sola tarjeta para los dos platos.
    expect(pagina.findAll('article')).toHaveLength(1);

    // Se lleva solo la gaseosa: la mesa queda con un plato listo.
    await pagina.find('button[aria-label="Entregado: Gaseosa personal"]').trigger('click');

    await vi.waitFor(() => expect(pagina.text()).not.toContain('Entregar todo (2)'));
    expect(pagina.text()).toContain('1 plato listo');
  });
});

describe('cuenta de la mesa', () => {
  it('con platos listos, "Entregar todo" los entrega de una vez', async () => {
    const pedido = mesa4ConDosListos();
    simularBackend(fetchFalso, {
      'GET /pedidos/p4': () => structuredClone(pedido),
      'GET /menu': () => [],
      'GET /mesas': () => [{ id: 'm4', nombre: 'Mesa 4', zona: 'Salón', capacidad: 4 }],
      'GET /caja/estado': () => ({ abierta: true }),
      'PATCH /pedidos/p4/cocina': () => ({
        ...pedido,
        items: pedido.items.map((item) => ({ ...item, estadoCocina: 'entregado' })),
      }),
    });

    const pantalla = await mountSuspended(TomarPedido, { props: { pedidoId: 'p4' } });
    await vi.waitFor(() => expect(pantalla.text()).toContain('2 platos listos para llevar'));
    await pantalla
      .findAll('button')
      .find((boton) => boton.text().includes('Entregar todo'))
      ?.trigger('click');

    await vi.waitFor(() => expect(pantalla.text()).not.toContain('platos listos para llevar'));
    const [, opciones] =
      fetchFalso.mock.calls.find(([ruta]) => ruta === '/pedidos/p4/cocina') ?? [];
    expect(opciones.body).toEqual({ estadoCocina: 'entregado' });
  });
});
