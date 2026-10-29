// @ts-check
// Pruebas de los negocios sin factura electrónica con un backend simulado: el recibo de venta,
// imprimirlo al cobrar, reimprimirlo desde los últimos recibos, cambiar cómo factura el negocio
// y los datos del recibo.
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DatosDelRecibo from '~/components/admin/DatosDelRecibo.vue';
import FacturacionDelNegocio from '~/components/admin/FacturacionDelNegocio.vue';
import FormularioProducto from '~/components/admin/FormularioProducto.vue';
import ModalCobro from '~/components/caja/ModalCobro.vue';
import UltimosRecibos from '~/components/caja/UltimosRecibos.vue';
import ReciboDeVenta from '~/components/recibos/ReciboDeVenta.vue';
import { useSesionStore } from '~/stores/sesion.js';
import { simularBackend } from './ayudantes.js';

const { fetchFalso } = vi.hoisted(() => ({ fetchFalso: vi.fn() }));
mockNuxtImport('$fetch', () => fetchFalso);

const ESPACIO_FIJO = '\u00a0';
/** @param {string} valor */
const pesos = (valor) => `$${ESPACIO_FIJO}${valor}`;

const ENCABEZADO = {
  nombre: 'La Esquina',
  nit: '1020304050',
  ciudad: 'Cali',
  direccion: 'Carrera 2 # 98-22',
  telefono: '312 333 4444',
  pieRecibo: '¡Gracias por tu compra!',
};

/** Pedido de mostrador sin impuestos, ya cobrado con un billete de $20.000. */
const PEDIDO_COBRADO = {
  id: 'p1',
  tipo: 'mostrador',
  numero: 16,
  nombreCliente: 'Ana',
  mesa: null,
  estado: 'pagado',
  subtotal: '15000',
  impuestos: '0',
  total: '15000',
  propina: '0',
  valorDomicilio: '0',
  propinaSugerida: '0.00',
  abiertoEn: new Date().toISOString(),
  items: [
    {
      id: 'i1',
      cantidad: '1',
      precioUnitario: '15000',
      estadoCocina: 'entregado',
      notas: 'Sin cebolla',
      producto: { nombre: 'IND Classic Artesanal' },
    },
  ],
  pagos: [{ id: 'pg1', metodo: 'efectivo', monto: '15000', recibido: '20000' }],
  cliente: null,
  recibo: { numero: 7, emitidoEn: '2026-10-28T19:45:00.000Z', encabezado: ENCABEZADO },
};

/** El mismo recibo como lo lista GET /recibos. */
const RECIBO_EN_LISTA = {
  id: 'r7',
  pedidoId: 'p1',
  numero: 7,
  emitidoEn: '2026-10-28T19:45:00.000Z',
  pedido: {
    tipo: 'mostrador',
    numero: 16,
    nombreCliente: 'Ana',
    total: '15000',
    mesa: null,
    pagos: [{ metodo: 'efectivo' }],
  },
};

const botonConTexto = (/** @type {string} */ texto) =>
  /** @type {HTMLButtonElement | undefined} */ (
    [...document.querySelectorAll('button')].find((boton) => boton.textContent?.includes(texto))
  );

/** @param {string} regimenImpuesto */
function sesionDeNegocio(regimenImpuesto) {
  const sesion = useSesionStore();
  sesion.usuario = { id: 'u1', nombre: 'Andrés', email: 'a@x.test', rol: 'dueno' };
  sesion.negocio = { id: 'n1', nombre: 'La Esquina', nit: '1020304050', regimenImpuesto };
  return sesion;
}

beforeEach(() => {
  fetchFalso.mockReset();
  document.body.querySelectorAll('[role="dialog"]').forEach((dialogo) => dialogo.remove());
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('recibo de venta', () => {
  it('trae los datos del negocio, el número, los productos, el pago con su cambio y las leyendas', async () => {
    const recibo = await mountSuspended(ReciboDeVenta, { props: { pedido: PEDIDO_COBRADO } });

    const texto = recibo.text();
    expect(texto).toContain('La Esquina');
    expect(texto).toContain('NIT 1020304050');
    expect(texto).toContain('Carrera 2 # 98-22');
    expect(texto).toContain('RECIBO DE VENTA No. 000007');
    expect(texto).toContain('#16 · Ana');
    expect(texto).toContain('IND Classic Artesanal');
    expect(texto).toContain('Sin cebolla');
    expect(texto).toContain(pesos('15.000'));
    expect(texto).toContain('Cambio');
    expect(texto).toContain(pesos('5.000'));
    expect(texto).toContain('No responsable de IVA ni del impuesto al consumo');
    expect(texto).toContain('Este recibo no es una factura electrónica.');
    expect(texto).toContain('¡Gracias por tu compra!');
  });

  it('al cobrar, deja imprimir el recibo sin salir de la caja', async () => {
    sesionDeNegocio('no_responsable').usuario = {
      id: 'c1',
      nombre: 'Camilo',
      email: 'c@x.test',
      rol: 'cajero',
    };
    // El entorno de pruebas no tiene diálogo de impresión: se simula.
    const imprimir = vi.fn();
    window.print = imprimir;
    simularBackend(fetchFalso, {
      'GET /pedidos/p1': () => ({ ...PEDIDO_COBRADO, estado: 'abierto', pagos: [], recibo: null }),
      'POST /pedidos/p1/cobrar': () => ({
        pedido: PEDIDO_COBRADO,
        cambio: '0.00',
        advertencias: [],
      }),
    });
    await mountSuspended(ModalCobro, { props: { pedidoId: 'p1', abierto: true } });
    await vi.waitFor(() => expect(botonConTexto('Confirmar cobro')?.disabled).toBe(false));

    botonConTexto('Confirmar cobro')?.click();
    await vi.waitFor(() => expect(botonConTexto('Imprimir recibo No. 000007')).toBeDefined());
    botonConTexto('Imprimir recibo No. 000007')?.click();

    await vi.waitFor(() => expect(imprimir).toHaveBeenCalledTimes(1));
    // El que sale al cobrar es el original.
    expect(useImpresionDeRecibo().copia.value).toBe(false);
  });

  it('una reimpresión sale marcada como copia', async () => {
    const original = await mountSuspended(ReciboDeVenta, { props: { pedido: PEDIDO_COBRADO } });
    const copia = await mountSuspended(ReciboDeVenta, {
      props: { pedido: PEDIDO_COBRADO, copia: true },
    });

    expect(original.text()).not.toContain('COPIA');
    expect(copia.text()).toContain('*** COPIA ***');
  });
});

describe('últimos recibos', () => {
  it('lista los recibos y reimprime uno como copia', async () => {
    sesionDeNegocio('no_responsable');
    const imprimir = vi.fn();
    window.print = imprimir;
    simularBackend(fetchFalso, {
      'GET /recibos': () => [RECIBO_EN_LISTA],
      'GET /pedidos/p1': () => PEDIDO_COBRADO,
    });
    await mountSuspended(UltimosRecibos, { props: { abierto: true } });

    await vi.waitFor(() => expect(document.body.textContent).toContain('No. 000007'));
    expect(document.body.textContent).toContain('#16 · Ana');
    expect(document.body.textContent).toContain(pesos('15.000'));
    expect(document.body.textContent).toContain('Efectivo');

    botonConTexto('Reimprimir')?.click();

    await vi.waitFor(() => expect(imprimir).toHaveBeenCalledTimes(1));
    const { pedido, copia } = useImpresionDeRecibo();
    expect(pedido.value.recibo.numero).toBe(7);
    expect(copia.value).toBe(true);
  });

  it('busca un recibo viejo por su número', async () => {
    sesionDeNegocio('no_responsable');
    simularBackend(fetchFalso, {
      'GET /recibos': (opciones) => (opciones.query?.numero ? [] : [RECIBO_EN_LISTA]),
    });
    await mountSuspended(UltimosRecibos, { props: { abierto: true } });
    await vi.waitFor(() => expect(document.body.textContent).toContain('No. 000007'));

    const buscador = /** @type {HTMLInputElement} */ (
      document.querySelector('input[aria-label="Buscar por número de recibo"]')
    );
    buscador.value = '000002';
    buscador.dispatchEvent(new Event('input'));

    await vi.waitFor(() =>
      expect(document.body.textContent).toContain('No encontramos el recibo No. 000002'),
    );
    const [, opciones] = fetchFalso.mock.calls.findLast(([ruta]) => ruta === '/recibos') ?? [];
    expect(opciones.query).toEqual({ numero: 2 });
  });
});

describe('cómo factura el negocio', () => {
  it('pasar a "sin factura electrónica" pide confirmación y actualiza la sesión', async () => {
    const sesion = sesionDeNegocio('responsable_inc');
    const negocio = { id: 'n1', nombre: 'La Esquina', regimenImpuesto: 'responsable_inc' };
    simularBackend(fetchFalso, {
      'PATCH /negocios/actual': (opciones) => ({
        ...negocio,
        ...opciones.body,
        facturaElectronica: false,
      }),
    });
    const facturacion = await mountSuspended(FacturacionDelNegocio, { props: { negocio } });

    await facturacion.findAll('[role="radio"]')[2]?.trigger('click');
    await facturacion
      .findAll('button')
      .find((b) => b.text().includes('Guardar'))
      ?.trigger('click');
    await vi.waitFor(() => expect(document.body.textContent).toContain('quedarán sin impuesto'));
    botonConTexto('Sí, cambiar')?.click();

    await vi.waitFor(() => expect(facturacion.emitted('guardado')).toHaveLength(1));
    const [, opciones] = fetchFalso.mock.calls.find(([ruta]) => ruta === '/negocios/actual') ?? [];
    expect(opciones.body).toEqual({ regimenImpuesto: 'no_responsable' });
    expect(sesion.negocio?.regimenImpuesto).toBe('no_responsable');
  });

  it('los datos del recibo se guardan; los vacíos se borran', async () => {
    sesionDeNegocio('no_responsable');
    simularBackend(fetchFalso, {
      'PATCH /negocios/actual': (opciones) => ({ id: 'n1', ...opciones.body }),
    });
    const datos = await mountSuspended(DatosDelRecibo, {
      props: { negocio: { id: 'n1', direccion: null, telefono: null, pieRecibo: null } },
    });

    const [direccion, , pie] = datos.findAll('input');
    await direccion?.setValue('Carrera 2 # 98-22');
    await pie?.setValue('¡Gracias por tu compra!');
    await datos.find('form').trigger('submit');

    await vi.waitFor(() => expect(datos.emitted('guardado')).toHaveLength(1));
    const [, opciones] = fetchFalso.mock.calls.find(([ruta]) => ruta === '/negocios/actual') ?? [];
    expect(opciones.body).toEqual({
      direccion: 'Carrera 2 # 98-22',
      telefono: null,
      pieRecibo: '¡Gracias por tu compra!',
    });
  });

  it('sin factura electrónica, un producto no pide impuesto', async () => {
    sesionDeNegocio('no_responsable');

    const formulario = await mountSuspended(FormularioProducto, {
      props: { categorias: [{ id: 'c1', nombre: 'Bebidas', orden: 0 }] },
    });

    expect(formulario.text()).toContain('el negocio no factura electrónicamente');
    expect(formulario.text()).not.toContain('INC 8 %');
  });
});
