// @ts-check
// Pruebas de los sonidos con un audio falso que anota lo que suena: cada interruptor del perfil
// apaga su clase de sonidos, los toques suenan más suave que los avisos, el error no se
// amontona y cada acción suena al terminar bien (o suena el error si falla).
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, ref } from 'vue';
import { useApi } from '~/composables/useApi.js';
import { usePedidoEnCurso } from '~/composables/usePedidoEnCurso.js';
import { SONIDOS, useSonidos } from '~/composables/useSonidos.js';
import { useCajaStore } from '~/stores/caja.js';
import { useDomiciliosStore } from '~/stores/domicilios.js';
import { usePedidosStore } from '~/stores/pedidos.js';
import { usePreferenciasStore } from '~/stores/preferencias.js';
import { errorDelApi, simularBackend } from './ayudantes.js';

const { fetchFalso } = vi.hoisted(() => ({ fetchFalso: vi.fn() }));
mockNuxtImport('$fetch', () => fetchFalso);

/**
 * Lo que anota el audio falso. Su reloj (en segundos) avanza 10 cada vez que se consulta,
 * para que ningún sonido se descarte por repetido, salvo que una prueba lo detenga.
 */
const audio = {
  /** Cada sonido: las frecuencias de sus notas y el volumen más alto que alcanzó. */
  sonidos: /** @type {{ frecuencias: number[], volumen: number }[]} */ ([]),
  reloj: 0,
  relojDetenido: false,
};

/** Audio del navegador falso: en lugar de sonar, anota cada nota en `audio`. */
class AudioFalso {
  state = 'running';
  destination = {};

  /** Cada sonido consulta el reloj una vez, al empezar: ahí empieza su anotación. */
  get currentTime() {
    if (!audio.relojDetenido) audio.reloj += 10;
    audio.sonidos.push({ frecuencias: [], volumen: 0 });
    return audio.reloj;
  }

  resume() {
    return Promise.resolve();
  }

  createOscillator() {
    const sonido = audio.sonidos[audio.sonidos.length - 1];
    return {
      type: 'sine',
      frequency: {
        /** @param {number} frecuencia */
        setValueAtTime: (frecuencia) => sonido.frecuencias.push(frecuencia),
        exponentialRampToValueAtTime: () => {},
      },
      /** @param {any} destino */
      connect: (destino) => destino,
      start: () => {},
      stop: () => {},
    };
  }

  createGain() {
    const sonido = audio.sonidos[audio.sonidos.length - 1];
    return {
      gain: {
        setValueAtTime: () => {},
        /** @param {number} valor */
        exponentialRampToValueAtTime: (valor) => (sonido.volumen = Math.max(sonido.volumen, valor)),
      },
      /** @param {any} destino */
      connect: (destino) => destino,
    };
  }
}
/** @type {any} */ (window).AudioContext = AudioFalso;

/** Lo que sonó de verdad (sin los sonidos descartados por repetidos). */
const tocados = () => audio.sonidos.filter((sonido) => sonido.frecuencias.length > 0);

/** El nombre de cada sonido que sonó (ver SONIDOS), en orden. */
function sonidosQueSonaron() {
  return tocados().map(
    ({ frecuencias }) =>
      Object.keys(SONIDOS).find(
        (nombre) =>
          SONIDOS[nombre].notas.map((nota) => nota.frecuencia).join() === frecuencias.join(),
      ) ?? `desconocido: ${frecuencias.join()}`,
  );
}

const PEDIDO = { id: 'p1', estado: 'enviado_a_cocina', tipo: 'mesa', items: [] };
const DOMICILIO = { id: 'd1', estado: 'enviado_a_cocina', tipo: 'domicilio', items: [] };

beforeEach(() => {
  fetchFalso.mockReset();
  audio.sonidos = [];
  audio.relojDetenido = false;
  const preferencias = usePreferenciasStore();
  preferencias.sonidos = true;
  preferencias.sonidosAlTocar = true;
});

describe('sonidos', () => {
  it('cada sonido tiene sus propias notas, para reconocerlo sin mirar', () => {
    const huellas = Object.values(SONIDOS).map((sonido) =>
      sonido.notas.map((nota) => nota.frecuencia).join(),
    );

    expect(new Set(huellas).size).toBe(huellas.length);
  });

  it('los toques suenan más suave que los avisos', () => {
    const sonidos = useSonidos();

    sonidos.productoAgregado();
    sonidos.platoListo();

    expect(sonidosQueSonaron()).toEqual(['productoAgregado', 'platoListo']);
    const [toque, aviso] = tocados();
    expect(toque.volumen).toBeLessThan(aviso.volumen);
  });

  it('cada interruptor del perfil apaga solo su clase de sonidos', () => {
    const preferencias = usePreferenciasStore();
    const sonidos = useSonidos();

    preferencias.sonidosAlTocar = false;
    sonidos.cobroRegistrado();
    sonidos.comandaNueva();
    preferencias.sonidosAlTocar = true;
    preferencias.sonidos = false;
    sonidos.cobroRegistrado();
    sonidos.comandaNueva();

    expect(sonidosQueSonaron()).toEqual(['comandaNueva', 'cobroRegistrado']);
  });

  it('si fallan varias cosas a la vez, el error suena una sola vez', () => {
    const sonidos = useSonidos();
    audio.relojDetenido = true;

    sonidos.error();
    sonidos.error();
    sonidos.error();
    expect(sonidosQueSonaron()).toEqual(['error']);

    // Un par de segundos después ya puede volver a sonar.
    audio.reloj += 2;
    sonidos.error();
    expect(sonidosQueSonaron()).toEqual(['error', 'error']);
  });
});

describe('cada acción suena al terminar bien', () => {
  const ACCIONES = [
    {
      accion: 'enviar a la cocina',
      rutas: { 'POST /pedidos/p1/enviar-cocina': () => PEDIDO },
      hacer: () => usePedidosStore().enviarACocina('p1'),
      sonido: 'enviadoACocina',
    },
    {
      accion: 'cobrar',
      rutas: {
        'POST /pedidos/p1/cobrar': () => ({
          pedido: { ...PEDIDO, estado: 'pagado' },
          cambio: '0',
          advertencias: [],
        }),
      },
      hacer: () => usePedidosStore().cobrar('p1', { pagos: [] }),
      sonido: 'cobroRegistrado',
    },
    {
      accion: 'entregar los platos listos',
      rutas: { 'PATCH /pedidos/p1/cocina': () => PEDIDO },
      hacer: () => usePedidosStore().cambiarEstadoCocinaDelPedido('p1', 'entregado'),
      sonido: 'entregaHecha',
    },
    {
      accion: 'entregar sin pasar por la cocina',
      rutas: { 'POST /pedidos/p1/entregar': () => ({ ...PEDIDO, estado: 'pagado' }) },
      hacer: () => usePedidosStore().entregarSinCocina('p1'),
      sonido: 'entregaHecha',
    },
    {
      accion: 'despachar un domicilio',
      rutas: { 'POST /pedidos/d1/despachar': () => DOMICILIO },
      hacer: () => useDomiciliosStore().despachar('d1', 'pedro'),
      sonido: 'domicilioDespachado',
    },
    {
      accion: 'recibir el dinero de un domiciliario',
      rutas: { 'POST /domiciliarios/pedro/liquidar': () => ({ pedidos: [], total: '0' }) },
      hacer: () => useDomiciliosStore().liquidar('pedro', []),
      sonido: 'cobroRegistrado',
    },
    {
      accion: 'abrir la caja',
      rutas: { 'POST /caja/abrir': () => ({}), 'GET /caja/actual': () => ({ id: 't1' }) },
      hacer: () => useCajaStore().abrir('100000'),
      sonido: 'cajaAbierta',
    },
    {
      accion: 'cerrar la caja',
      rutas: { 'POST /caja/cerrar': () => ({ id: 't1' }) },
      hacer: () => useCajaStore().cerrar('100000'),
      sonido: 'cajaCerrada',
    },
  ];

  it.each(ACCIONES)('$accion', async ({ rutas, hacer, sonido }) => {
    simularBackend(fetchFalso, rutas);

    await hacer();

    expect(sonidosQueSonaron()).toEqual([sonido]);
  });

  it('si la acción falla, suena el error y no la confirmación', async () => {
    simularBackend(fetchFalso, {
      'POST /pedidos/p1/cobrar': () => {
        throw errorDelApi(409, 'PEDIDO_CERRADO');
      },
    });

    await expect(usePedidosStore().cobrar('p1', { pagos: [] })).rejects.toThrow();

    expect(sonidosQueSonaron()).toEqual(['error']);
  });

  it('si falla una consulta no suena: la pantalla ya lo muestra con «Reintentar»', async () => {
    simularBackend(fetchFalso, {
      'GET /mesas': () => {
        throw errorDelApi(500, 'ERROR_INTERNO');
      },
    });

    await expect(useApi().get('/mesas')).rejects.toThrow();

    expect(sonidosQueSonaron()).toEqual([]);
  });
});

describe('tomar un pedido', () => {
  it('agregar un producto suena al tocarlo, sin esperar al API; quitarlo, cuando se quita', async () => {
    const gaseosa = {
      id: 'i1',
      productoId: 'gaseosa',
      cantidad: '1',
      estadoCocina: 'pendiente',
      producto: { nombre: 'Gaseosa personal' },
    };
    const abierto = { ...PEDIDO, estado: 'abierto', total: '0', items: [] };
    /** @type {(pedido: unknown) => void} */
    let responderAgregar = () => {};
    simularBackend(fetchFalso, {
      'GET /mesas': () => [],
      'GET /pedidos/p1': () => abierto,
      'POST /pedidos/p1/items': () => new Promise((resolver) => (responderAgregar = resolver)),
      'DELETE /pedidos/p1/items/i1': () => abierto,
    });
    /** @type {ReturnType<typeof usePedidoEnCurso> | undefined} */
    let pedidoEnCurso;
    const Envoltura = defineComponent({
      setup() {
        pedidoEnCurso = usePedidoEnCurso({
          pedidoId: ref('p1'),
          mesaId: ref(''),
          alCrear: () => {},
        });
        return () => h('div');
      },
    });
    await mountSuspended(Envoltura);
    await vi.waitFor(() => expect(pedidoEnCurso?.pedido.value).toBeTruthy());

    // El API todavía no responde y ya sonó.
    const agregando = pedidoEnCurso?.agregar({ id: 'gaseosa', nombre: 'Gaseosa personal' });
    expect(sonidosQueSonaron()).toEqual(['productoAgregado']);
    await vi.waitFor(() =>
      expect(fetchFalso).toHaveBeenCalledWith('/pedidos/p1/items', expect.anything()),
    );
    responderAgregar({ ...abierto, items: [gaseosa] });
    await agregando;

    await pedidoEnCurso?.quitar(gaseosa);
    expect(sonidosQueSonaron()).toEqual(['productoAgregado', 'productoQuitado']);
  });
});
