// @ts-check
// Pruebas del tablero de reportes con un backend simulado.
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime';
import { flushPromises } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { UApp } from '#components';
import TopProductos from '~/components/reportes/TopProductos.vue';
import PaginaReportes from '~/pages/reportes.vue';
import { rangoDePeriodo } from '~/utils/periodos.js';
import { simularBackend } from './ayudantes.js';

const { fetchFalso } = vi.hoisted(() => ({ fetchFalso: vi.fn() }));
mockNuxtImport('$fetch', () => fetchFalso);

const ESPACIO_FIJO = '\u00a0';
/** @param {string} valor */
const pesos = (valor) => `$${ESPACIO_FIJO}${valor}`;

const RANGO = { desde: '2026-10-28', hasta: '2026-10-28' };

/** Monta la página dentro de <UApp>, como en la app real: las gráficas usan sus tooltips. */
const montarPagina = () =>
  mountSuspended(defineComponent({ render: () => h(UApp, null, () => h(PaginaReportes)) }));

/** Resumen de un día con 3 ventas, la hora pico a la 1 p. m. y una anulación. */
const resumenConVentas = () => ({
  rango: RANGO,
  ventas: 3,
  total: '58000.00',
  subtotal: '53703.70',
  impuestos: '4296.30',
  ajusteRedondeo: '0.00',
  propinas: '4000.00',
  ticketPromedio: '19333.33',
  anulaciones: { cantidad: 1, total: '10000.00' },
  porHora: [
    { hora: 12, ventas: 1, total: '28000.00' },
    { hora: 13, ventas: 2, total: '30000.00' },
  ],
  porDia: [{ fecha: '2026-10-28', ventas: 3, total: '58000.00' }],
  porTipo: [
    { tipo: 'mesa', ventas: 2, total: '43000.00' },
    { tipo: 'mostrador', ventas: 0, total: '0.00' },
    { tipo: 'domicilio', ventas: 1, total: '15000.00' },
  ],
  porOrigen: [
    { origen: 'local', ventas: 2, total: '43000.00' },
    { origen: 'whatsapp', ventas: 1, total: '15000.00' },
    { origen: 'telefono', ventas: 0, total: '0.00' },
    { origen: 'otro', ventas: 0, total: '0.00' },
  ],
});

/** Productos más vendidos; se puede cambiar el nombre del primero. */
const productosVendidos = (primero = 'IND Classic Artesanal') => ({
  rango: RANGO,
  total: '58000.00',
  productos: [
    {
      productoId: 'a',
      producto: primero,
      categoria: 'Hamburguesas',
      cantidad: '3',
      total: '36000.00',
      participacion: '62.07',
    },
    {
      productoId: 'b',
      producto: 'Gaseosa personal 400 ml',
      categoria: 'Bebidas',
      cantidad: '3',
      total: '12000.00',
      participacion: '20.69',
    },
  ],
});

const metodosDePago = () => ({
  rango: RANGO,
  total: '62000.00',
  metodos: [
    { metodo: 'efectivo', pagos: 2, total: '40000.00', participacion: '64.52' },
    { metodo: 'tarjeta', pagos: 1, total: '22000.00', participacion: '35.48' },
    { metodo: 'transferencia', pagos: 0, total: '0.00', participacion: '0.00' },
    { metodo: 'otro', pagos: 0, total: '0.00', participacion: '0.00' },
  ],
});

/** Backend con ventas en el periodo. */
function conVentas() {
  simularBackend(fetchFalso, {
    'GET /reportes/resumen': resumenConVentas,
    'GET /reportes/por-producto': () => productosVendidos(),
    'GET /reportes/por-metodo-pago': metodosDePago,
  });
}

beforeEach(() => {
  fetchFalso.mockReset();
});

describe('tablero de reportes', () => {
  it('pide los tres reportes del día de hoy (hora de Colombia)', async () => {
    conVentas();
    await montarPagina();

    await vi.waitFor(() => expect(fetchFalso).toHaveBeenCalledTimes(3));
    const [, opciones] = fetchFalso.mock.calls[0];
    expect(opciones.query).toEqual(rangoDePeriodo('hoy'));
  });

  it('muestra los indicadores, la hora pico, el top de productos y los métodos de pago', async () => {
    conVentas();
    const pagina = await montarPagina();

    await vi.waitFor(() => expect(pagina.text()).toContain('IND Classic Artesanal'));
    const texto = pagina.text();
    expect(texto).toContain('Número de ventas');
    expect(texto).toContain('Hora pico: 1 p. m.');
    expect(texto).toContain(pesos('19.333,33'));
    expect(texto).toContain(`Por ${pesos('10.000')}`);
    expect(texto).toContain('62,07');
    expect(texto).toContain('Métodos de pago');
    expect(texto).toContain('Efectivo');
    expect(texto).toContain('64,52');
    // Ventas por canal: por tipo de pedido y por dónde llegaron.
    expect(texto).toContain('Ventas por canal');
    expect(texto).toContain('Domicilio');
    expect(texto).toContain('WhatsApp');
  });

  it('si el dueño cambia de periodo antes de que llegue la respuesta, muestra solo el último', async () => {
    const hoy = rangoDePeriodo('hoy').desde;
    /** @type {(resumen: object) => void} */
    let responderHoy = () => {};
    simularBackend(fetchFalso, {
      // El resumen de hoy tarda; el de ayer llega de inmediato.
      'GET /reportes/resumen': ({ query }) =>
        query.desde === hoy
          ? new Promise((resolver) => {
              responderHoy = resolver;
            })
          : resumenConVentas(),
      'GET /reportes/por-producto': ({ query }) =>
        productosVendidos(query.desde === hoy ? 'Vendido hoy' : 'Vendido ayer'),
      'GET /reportes/por-metodo-pago': metodosDePago,
    });
    const pagina = await montarPagina();

    const botonAyer = pagina.findAll('button').find((boton) => boton.text() === 'Ayer');
    expect(botonAyer).toBeDefined();
    await botonAyer?.trigger('click');
    await vi.waitFor(() => expect(pagina.text()).toContain('Vendido ayer'));

    // La respuesta de hoy llega tarde y se descarta.
    responderHoy(resumenConVentas());
    await flushPromises();
    expect(pagina.text()).toContain('Vendido ayer');
    expect(pagina.text()).not.toContain('Vendido hoy');
  });

  it('sin ventas en el periodo, lo dice claramente', async () => {
    simularBackend(fetchFalso, {
      'GET /reportes/resumen': () => ({
        rango: RANGO,
        ventas: 0,
        total: '0.00',
        subtotal: '0.00',
        impuestos: '0.00',
        ajusteRedondeo: '0.00',
        propinas: '0.00',
        ticketPromedio: '0.00',
        anulaciones: { cantidad: 0, total: '0.00' },
        porHora: [],
        porDia: [],
      }),
      'GET /reportes/por-producto': () => ({ rango: RANGO, total: '0.00', productos: [] }),
      'GET /reportes/por-metodo-pago': () => ({ rango: RANGO, total: '0.00', metodos: [] }),
    });
    const pagina = await montarPagina();

    await vi.waitFor(() => expect(pagina.text()).toContain('Aún no hay ventas en este periodo'));
  });

  it('el top muestra los 10 primeros productos y deja abrir la lista completa', async () => {
    const productos = Array.from({ length: 12 }, (_, i) => ({
      productoId: `p${i + 1}`,
      producto: `Producto ${i + 1}`,
      categoria: 'Varios',
      cantidad: '1',
      total: String(12000 - i * 500),
      participacion: '8.33',
    }));
    const top = await mountSuspended(TopProductos, { props: { productos } });

    expect(top.findAll('li')).toHaveLength(10);
    expect(top.text()).not.toContain('Producto 12');

    await top.find('button').trigger('click');
    expect(top.findAll('li')).toHaveLength(12);
    expect(top.text()).toContain('Producto 12');
    expect(top.text()).toContain('Ver solo los 10 primeros');
  });
});
