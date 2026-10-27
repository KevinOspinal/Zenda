// @ts-check
// Pruebas de la caja con un backend simulado: abrir la caja, la pantalla con el turno y el
// cobro completo con propina, efectivo y cambio.
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AbrirCaja from '~/components/caja/AbrirCaja.vue';
import ModalCobro from '~/components/caja/ModalCobro.vue';
import PaginaCaja from '~/pages/caja/index.vue';
import { useSesionStore } from '~/stores/sesion.js';
import { errorDelApi, simularBackend } from './ayudantes.js';

const { fetchFalso } = vi.hoisted(() => ({ fetchFalso: vi.fn() }));
mockNuxtImport('$fetch', () => fetchFalso);

const ESPACIO_FIJO = '\u00a0';
/** @param {string} valor Por ejemplo "38.000". */
const pesos = (valor) => `$${ESPACIO_FIJO}${valor}`;

const PEDIDO = {
  id: 'p1',
  mesaId: 'm4',
  mesa: { id: 'm4', nombre: 'Mesa 4' },
  meseroId: 'laura',
  estado: 'enviado_a_cocina',
  subtotal: '35185.18',
  impuestos: '2814.82',
  total: '38000',
  propinaSugerida: '3518.00',
  abiertoEn: new Date().toISOString(),
  items: [
    {
      id: 'i1',
      productoId: 'a',
      cantidad: '2',
      precioUnitario: '12000',
      estadoCocina: 'listo',
      notas: null,
      producto: { nombre: 'IND Classic Artesanal' },
    },
    {
      id: 'i2',
      productoId: 'b',
      cantidad: '1',
      precioUnitario: '14000',
      estadoCocina: 'listo',
      notas: null,
      producto: { nombre: 'IND Bacon Artesanal' },
    },
  ],
};

const TURNO = {
  id: 't1',
  abiertoEn: new Date().toISOString(),
  montoInicial: '100000',
  resumen: {
    ventasPorMetodo: {
      efectivo: '30000.00',
      tarjeta: '8000.00',
      transferencia: '0.00',
      otro: '0.00',
    },
    totalCobrado: '38000.00',
    totalVendido: '36000.00',
    propinas: '2000.00',
    efectivoEsperado: '130000.00',
    pedidos: { pagados: 1, abiertos: 1, anulados: 0 },
  },
};

/** Botón del documento (los modales se dibujan fuera del componente) por su texto. */
const botonConTexto = (/** @type {string} */ texto) =>
  /** @type {HTMLButtonElement | undefined} */ (
    [...document.querySelectorAll('button')].find((boton) => boton.textContent?.includes(texto))
  );

/**
 * Escribe en un campo del documento como lo haría el usuario.
 * @param {HTMLInputElement} campo
 * @param {string} valor
 */
function escribir(campo, valor) {
  campo.value = valor;
  campo.dispatchEvent(new Event('input', { bubbles: true }));
}

beforeEach(() => {
  fetchFalso.mockReset();
  document.body.querySelectorAll('[role="dialog"]').forEach((dialogo) => dialogo.remove());
  useSesionStore().usuario = { id: 'c1', nombre: 'Camilo', email: 'c@x.test', rol: 'cajero' };
});

describe('abrir la caja', () => {
  it('con un monto rápido abre la caja con esa base', async () => {
    simularBackend(fetchFalso, {
      'POST /caja/abrir': () => ({ id: 't1' }),
      'GET /caja/actual': () => TURNO,
    });
    const pantalla = await mountSuspended(AbrirCaja);

    await pantalla
      .findAll('button')
      .find((b) => b.text() === pesos('100.000'))
      ?.trigger('click');
    await pantalla.find('form').trigger('submit');

    await vi.waitFor(() => {
      const [, opciones] = fetchFalso.mock.calls.find(([ruta]) => ruta === '/caja/abrir') ?? [];
      expect(opciones?.body).toEqual({ montoInicial: '100000' });
    });
  });
});

describe('pantalla de caja', () => {
  it('sin turno abierto, invita a abrir la caja', async () => {
    simularBackend(fetchFalso, {
      'GET /caja/actual': () => {
        throw errorDelApi(404, 'SIN_TURNO_ABIERTO');
      },
      'GET /pedidos': () => [],
    });

    const pagina = await mountSuspended(PaginaCaja);

    await vi.waitFor(() => expect(pagina.text()).toContain('Abre la caja para empezar a vender'));
  });

  it('con turno abierto, muestra el resumen y los pedidos por cobrar', async () => {
    simularBackend(fetchFalso, {
      'GET /caja/actual': () => TURNO,
      'GET /pedidos': () => [PEDIDO],
    });

    const pagina = await mountSuspended(PaginaCaja);

    await vi.waitFor(() => expect(pagina.text()).toContain('Mesa 4'));
    expect(pagina.text()).toContain('Efectivo en caja');
    expect(pagina.text()).toContain(pesos('130.000'));
  });
});

describe('cobrar', () => {
  it('con la propina sugerida y un billete de $ 50.000: cobra total + propina y muestra el cambio', async () => {
    simularBackend(fetchFalso, {
      'GET /pedidos/p1': () => PEDIDO,
      'POST /pedidos/p1/cobrar': () => ({
        pedido: { ...PEDIDO, estado: 'pagado' },
        cambio: '8482.00',
        advertencias: [],
      }),
    });
    await mountSuspended(ModalCobro, { props: { pedidoId: 'p1', abierto: true } });
    await vi.waitFor(() => expect(botonConTexto('Sugerida')).toBeDefined());

    // 1. El cliente acepta la propina sugerida: el total a pagar sube a $ 41.518.
    botonConTexto('Sugerida')?.click();
    await vi.waitFor(() => expect(document.body.textContent).toContain(pesos('41.518')));

    // 2. Paga con un billete de $ 50.000: el cambio se ve antes de confirmar.
    const recibido = /** @type {HTMLInputElement} */ (
      document.querySelector('input[aria-label="Efectivo recibido"]')
    );
    escribir(recibido, '50000');
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain(`Cambio: ${pesos('8.482')}`),
    );

    // 3. Confirmar envía los pagos y la propina.
    const confirmar = botonConTexto('Confirmar cobro');
    expect(confirmar?.disabled).toBe(false);
    confirmar?.click();

    await vi.waitFor(() => expect(document.body.textContent).toContain('Devuelve'));
    const [, opciones] =
      fetchFalso.mock.calls.find(([ruta]) => ruta === '/pedidos/p1/cobrar') ?? [];
    expect(opciones.body).toEqual({
      pagos: [{ metodo: 'efectivo', monto: '41518', recibido: '50000' }],
      propina: '3518.00',
    });
  });

  it('no deja confirmar si lo recibido no alcanza', async () => {
    simularBackend(fetchFalso, { 'GET /pedidos/p1': () => PEDIDO });
    await mountSuspended(ModalCobro, { props: { pedidoId: 'p1', abierto: true } });
    await vi.waitFor(() =>
      expect(document.querySelector('input[aria-label="Efectivo recibido"]')).not.toBeNull(),
    );

    escribir(
      /** @type {HTMLInputElement} */ (
        document.querySelector('input[aria-label="Efectivo recibido"]')
      ),
      '20000',
    );

    await vi.waitFor(() => expect(document.body.textContent).toContain('No alcanza para'));
    expect(botonConTexto('Confirmar cobro')?.disabled).toBe(true);
  });
});
