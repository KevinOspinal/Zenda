// @ts-check
// Pruebas con mala señal: el servidor recibe la petición, pero la respuesta se pierde (o no
// llega nada). La app repite sola lo que se puede repetir sin riesgo, con el mismo uuidOffline
// y la misma claveIdempotencia: el servidor no duplica pedidos ni productos. Cobrar nunca se
// repite solo.
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePedidoEnCurso } from '~/composables/usePedidoEnCurso.js';
import { usePedidosStore } from '~/stores/pedidos.js';
import { errorDeRed, errorDelApi } from './ayudantes.js';

const { fetchFalso } = vi.hoisted(() => ({ fetchFalso: vi.fn() }));
mockNuxtImport('$fetch', () => fetchFalso);

const AGUA = { id: 'agua', nombre: 'Agua' };
const GASEOSA = { id: 'gaseosa', nombre: 'Gaseosa' };

/**
 * Un backend falso que recuerda los pedidos y, como el real, reconoce las repeticiones: el
 * mismo uuidOffline devuelve el pedido que ya existe y la misma claveIdempotencia no agrega
 * otro producto.
 *
 * `red.estado` simula la señal:
 * - 'buena': todo llega.
 * - 'pierde': la petición llega y se procesa, pero la respuesta se pierde (una vez; después
 *   queda como diga `red.despuesDePerder`).
 * - 'caida': no llega nada.
 */
function servidorFalso() {
  const red = { estado: 'buena', despuesDePerder: 'buena' };
  /** @type {Map<string, any>} */
  const pedidos = new Map();
  let ultimoPedido = 0;
  let ultimoItem = 0;

  /** @param {string} id */
  function buscar(id) {
    const pedido = pedidos.get(id);
    if (!pedido) throw errorDelApi(404, 'NO_ENCONTRADO');
    return pedido;
  }

  /**
   * @param {any} pedido
   * @param {any} item
   */
  function agregar(pedido, item) {
    const repetido =
      item.claveIdempotencia &&
      pedido.items.some((/** @type {any} */ i) => i.claveIdempotencia === item.claveIdempotencia);
    if (repetido) return;
    ultimoItem += 1;
    pedido.items.push({
      id: `i${ultimoItem}`,
      productoId: item.productoId,
      cantidad: String(item.cantidad),
      estadoCocina: 'pendiente',
      claveIdempotencia: item.claveIdempotencia ?? null,
      producto: { nombre: item.productoId === 'agua' ? 'Agua' : 'Gaseosa' },
    });
  }

  /**
   * Lo que hace el servidor con cada petición.
   * @param {string} metodo
   * @param {string} ruta
   * @param {any} cuerpo
   */
  function procesar(metodo, ruta, cuerpo) {
    if (metodo === 'GET' && ruta === '/mesas') return [];
    if (metodo === 'POST' && ruta === '/pedidos') {
      const existente = [...pedidos.values()].find((p) => p.uuidOffline === cuerpo.uuidOffline);
      if (existente) return existente;
      ultimoPedido += 1;
      const pedido = {
        id: `n${ultimoPedido}`,
        uuidOffline: cuerpo.uuidOffline,
        tipo: 'mostrador',
        mesaId: null,
        estado: 'abierto',
        total: '0',
        abiertoEn: new Date().toISOString(),
        items: [],
      };
      for (const item of cuerpo.items) agregar(pedido, item);
      pedidos.set(pedido.id, pedido);
      return pedido;
    }

    const [, id, accion, itemId] = ruta.match(/^\/pedidos\/([^/]+)\/?([^/]*)\/?([^/]*)$/) ?? [];
    const pedido = buscar(id);
    if (metodo === 'GET' && !accion) return pedido;
    if (metodo === 'POST' && accion === 'items') {
      agregar(pedido, cuerpo);
      return pedido;
    }
    if (metodo === 'DELETE' && accion === 'items') {
      const antes = pedido.items.length;
      pedido.items = pedido.items.filter((/** @type {any} */ i) => i.id !== itemId);
      if (pedido.items.length === antes) throw errorDelApi(404, 'ITEM_NO_ENCONTRADO');
      return pedido;
    }
    if (metodo === 'POST' && accion === 'enviar-cocina') {
      pedido.estado = 'enviado_a_cocina';
      return pedido;
    }
    if (metodo === 'POST' && accion === 'cobrar') {
      if (pedido.estado === 'pagado') throw errorDelApi(409, 'PEDIDO_CERRADO');
      pedido.estado = 'pagado';
      return { pedido, cambio: '0.00', advertencias: [] };
    }
    throw new Error(`Ruta no simulada: ${metodo} ${ruta}`);
  }

  /**
   * Reemplaza a $fetch: pasa por la red simulada y responde una copia (como llega por HTTP).
   * @param {string} ruta
   * @param {any} [opciones]
   */
  async function responder(ruta, opciones = {}) {
    if (red.estado === 'caida') throw errorDeRed();
    const respuesta = structuredClone(procesar(opciones.method ?? 'GET', ruta, opciones.body));
    if (red.estado === 'pierde') {
      red.estado = red.despuesDePerder;
      throw errorDeRed();
    }
    return respuesta;
  }

  return { red, pedidos, responder };
}

/**
 * Cuerpos enviados a una ruta, en orden.
 * @param {string} metodo
 * @param {string} ruta
 */
const cuerposEnviadosA = (metodo, ruta) =>
  fetchFalso.mock.calls
    .filter(([r, opciones]) => r === ruta && (opciones?.method ?? 'GET') === metodo)
    .map(([, opciones]) => opciones?.body);

/** Deja pasar el tiempo de todos los reintentos (unos 45 s). */
const dejarPasarLosReintentos = () => vi.advanceTimersByTimeAsync(60_000);

let servidor = servidorFalso();

beforeEach(() => {
  fetchFalso.mockReset();
  servidor = servidorFalso();
  fetchFalso.mockImplementation(servidor.responder);
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('el store repite solo lo que se puede repetir', () => {
  it('crear: si la respuesta se pierde, repite con el mismo uuidOffline y queda un pedido', async () => {
    servidor.red.estado = 'pierde';
    const pedidos = usePedidosStore();

    const creando = pedidos.crear({ items: [{ productoId: 'agua', cantidad: 1 }] });
    await dejarPasarLosReintentos();
    const pedido = await creando;

    const envios = cuerposEnviadosA('POST', '/pedidos');
    expect(envios).toHaveLength(2);
    expect(envios[1].uuidOffline).toBe(envios[0].uuidOffline);
    expect(servidor.pedidos.size).toBe(1);
    expect(pedido.items).toHaveLength(1);
  });

  it('agregar: si la respuesta se pierde, repite con la misma clave y queda un producto', async () => {
    const pedidos = usePedidosStore();
    await pedidos.crear({ items: [] });
    servidor.red.estado = 'pierde';

    const agregando = pedidos.agregarItem('n1', { productoId: 'agua', cantidad: 1 });
    await dejarPasarLosReintentos();
    const pedido = await agregando;

    const envios = cuerposEnviadosA('POST', '/pedidos/n1/items');
    expect(envios).toHaveLength(2);
    expect(envios[0].claveIdempotencia).toEqual(expect.any(String));
    expect(envios[1].claveIdempotencia).toBe(envios[0].claveIdempotencia);
    expect(servidor.pedidos.get('n1').items).toHaveLength(1);
    expect(pedido.items).toHaveLength(1);
  });

  it('quitar: si el reintento ya no lo encuentra, es que sí se quitó (no es un error)', async () => {
    const pedidos = usePedidosStore();
    await pedidos.crear({ items: [{ productoId: 'agua', cantidad: 1 }] });
    servidor.red.estado = 'pierde';

    const quitando = pedidos.quitarItem('n1', 'i1');
    await dejarPasarLosReintentos();
    const pedido = await quitando;

    expect(pedido.items).toEqual([]);
    expect(pedidos.porId.n1.items).toEqual([]);
  });

  it('enviar a cocina: si la respuesta se pierde, lo repite (repetirlo no cambia nada)', async () => {
    const pedidos = usePedidosStore();
    await pedidos.crear({ items: [{ productoId: 'agua', cantidad: 1 }] });
    servidor.red.estado = 'pierde';

    const enviando = pedidos.enviarACocina('n1');
    await dejarPasarLosReintentos();

    expect((await enviando).estado).toBe('enviado_a_cocina');
    expect(cuerposEnviadosA('POST', '/pedidos/n1/enviar-cocina')).toHaveLength(2);
  });

  it('cobrar: nunca se repite solo, aunque se pierda la respuesta', async () => {
    const pedidos = usePedidosStore();
    await pedidos.crear({ items: [{ productoId: 'agua', cantidad: 1 }] });
    servidor.red.estado = 'pierde';

    const cobrando = pedidos.cobrar('n1', { pagos: [{ metodo: 'efectivo', monto: '0' }] });
    const resultado = expect(cobrando).rejects.toMatchObject({ codigo: 'SIN_CONEXION' });
    await dejarPasarLosReintentos();
    await resultado;

    expect(cuerposEnviadosA('POST', '/pedidos/n1/cobrar')).toHaveLength(1);
  });

  it('un error del negocio (caja cerrada) no se repite', async () => {
    fetchFalso.mockImplementation(async () => {
      throw errorDelApi(409, 'CAJA_CERRADA');
    });
    const pedidos = usePedidosStore();

    await expect(pedidos.crear({ items: [] })).rejects.toMatchObject({ codigo: 'CAJA_CERRADA' });
    expect(fetchFalso).toHaveBeenCalledTimes(1);
  });
});

describe('tomar el pedido con mala señal', () => {
  /** Monta la lógica de tomar un pedido de mostrador nuevo. */
  async function pedidoNuevo() {
    /** @type {ReturnType<typeof usePedidoEnCurso> | undefined} */
    let pedidoEnCurso;
    const Envoltura = defineComponent({
      setup() {
        pedidoEnCurso = usePedidoEnCurso({ pedidoId: ref(''), mesaId: ref(''), alCrear: () => {} });
        return () => h('div');
      },
    });
    await mountSuspended(Envoltura);
    return /** @type {ReturnType<typeof usePedidoEnCurso>} */ (pedidoEnCurso);
  }

  it('un producto que no se pudo enviar no se pierde ni se duplica', async () => {
    const pedidoEnCurso = await pedidoNuevo();

    // 1. El primer toque crea el pedido en el servidor, pero la respuesta se pierde y la señal
    //    se cae: mientras se insiste, la pantalla dice "Enviando… sin señal".
    servidor.red.estado = 'pierde';
    servidor.red.despuesDePerder = 'caida';
    const agregandoAgua = pedidoEnCurso.agregar(AGUA);
    await vi.waitFor(() => expect(pedidoEnCurso.reintentando.value).toBe(true));
    await dejarPasarLosReintentos();
    await agregandoAgua;

    // 2. Al final avisa que no se pudo, con "Reintentar".
    expect(pedidoEnCurso.reintentando.value).toBe(false);
    const aviso = useToast().toasts.value.find((t) => t.title === 'No se pudo enviar: Agua');
    expect(aviso?.actions?.[0]?.label).toBe('Reintentar');

    // 3. Vuelve la señal y el mesero toca otro producto: usa el mismo uuidOffline, así que no
    //    se crea otro pedido; la gaseosa se agrega al que ya existía.
    servidor.red.estado = 'buena';
    await pedidoEnCurso.agregar(GASEOSA);

    const uuids = new Set(cuerposEnviadosA('POST', '/pedidos').map((cuerpo) => cuerpo.uuidOffline));
    expect(uuids.size).toBe(1);
    expect(servidor.pedidos.size).toBe(1);
    expect(servidor.pedidos.get('n1').items.map((/** @type {any} */ i) => i.productoId)).toEqual([
      'agua',
      'gaseosa',
    ]);

    // 4. "Reintentar" el agua no la duplica: lleva la misma clave del primer toque.
    await /** @type {any} */ (aviso?.actions?.[0])?.onClick();
    expect(servidor.pedidos.get('n1').items).toHaveLength(2);
    expect(pedidoEnCurso.items.value).toHaveLength(2);
  });

  it('dos toques del mismo producto son dos productos (cada toque tiene su clave)', async () => {
    const pedidoEnCurso = await pedidoNuevo();

    await pedidoEnCurso.agregar(AGUA);
    await pedidoEnCurso.agregar(AGUA);

    expect(servidor.pedidos.get('n1').items).toHaveLength(2);
    expect(pedidoEnCurso.cantidades.value.agua).toBe(2);
  });
});
