// @ts-check
// Pruebas de la precuenta y del cobro con Bre-B, con un backend simulado: lo que lleva la
// precuenta, imprimirla desde la caja y desde la cuenta del mesero, el QR y la llave en el cobro
// por transferencia y la configuración del dueño (llave y QR del banco).
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ConfiguracionBreB from '~/components/admin/ConfiguracionBreB.vue';
import DetallePedidoCaja from '~/components/caja/DetallePedidoCaja.vue';
import PagosDelCobro from '~/components/caja/PagosDelCobro.vue';
import PanelCuenta from '~/components/pedidos/PanelCuenta.vue';
import PrecuentaDelPedido from '~/components/recibos/PrecuentaDelPedido.vue';
import { useNegocioStore } from '~/stores/negocio.js';
import { useSesionStore } from '~/stores/sesion.js';
import { simularBackend } from './ayudantes.js';

const { fetchFalso, leerQrFalso } = vi.hoisted(() => ({
  fetchFalso: vi.fn(),
  leerQrFalso: vi.fn(),
}));
mockNuxtImport('$fetch', () => fetchFalso);
// El entorno de pruebas no tiene canvas para leer imágenes: la lectura del QR se simula (la
// lectura real se prueba en tests/unit/breB.test.js).
mockNuxtImport('leerQrDeImagen', () => leerQrFalso);

const ESPACIO_FIJO = ' ';
/** @param {string} valor */
const pesos = (valor) => `$${ESPACIO_FIJO}${valor}`;

/** Contenido de un QR de pago (formato EMVCo, el que usan los QR de los bancos). */
const QR_DEL_BANCO =
  '00020101021126360014CO.COM.BREB.LLA0112@laindustria5204581253031705802CO5912La Industria6004Cali6304AB12';

/** Negocio con INC, propina sugerida del 10 % y cobro por Bre-B. */
const NEGOCIO = {
  id: 'n1',
  nombre: 'La Industria',
  nit: '900111222',
  ciudad: 'Cali',
  regimenImpuesto: 'responsable_inc',
  propinaSugerida: '10',
  valorDomicilio: '3000',
  direccion: 'Carrera 2 # 98-22',
  telefono: '3123334444',
  pieRecibo: null,
  llaveBreB: '@laindustria',
  qrBreB: QR_DEL_BANCO,
  facturaElectronica: true,
};
const NEGOCIO_SIN_BRE_B = { ...NEGOCIO, llaveBreB: null, qrBreB: null };

/** Pedido abierto de la Mesa 4: $21.600 con INC (base $20.000), propina sugerida $2.000. */
const PEDIDO_MESA = {
  id: 'p1',
  tipo: 'mesa',
  numero: 21,
  nombreCliente: null,
  mesa: { id: 'm4', nombre: 'Mesa 4' },
  estado: 'enviado_a_cocina',
  subtotal: '20000.00',
  impuestos: '1600.00',
  total: '21600',
  propina: '0',
  valorDomicilio: '0',
  propinaSugerida: '2000.00',
  abiertoEn: new Date().toISOString(),
  items: [
    {
      id: 'i1',
      cantidad: '2',
      precioUnitario: '10800',
      estadoCocina: 'preparando',
      notas: 'Término medio',
      producto: { nombre: 'IND Classic Artesanal' },
    },
  ],
  pagos: [],
  cliente: null,
  recibo: null,
};

/**
 * Botón de un componente montado, por su texto.
 * @param {import('@vue/test-utils').VueWrapper} componente
 * @param {string} texto
 */
function botonDe(componente, texto) {
  const boton = componente.findAll('button').find((b) => b.text().includes(texto));
  if (!boton) throw new Error(`No hay un botón "${texto}"`);
  return boton;
}

/** @param {'dueno' | 'cajero' | 'mesero'} rol */
function sesionComo(rol) {
  const sesion = useSesionStore();
  sesion.usuario = { id: 'u1', nombre: 'Laura Gómez', email: 'l@x.test', rol };
  sesion.negocio = {
    id: 'n1',
    nombre: 'La Industria',
    nit: '900111222',
    regimenImpuesto: 'responsable_inc',
  };
  return sesion;
}

beforeEach(() => {
  fetchFalso.mockReset();
  leerQrFalso.mockReset();
  useNegocioStore().actualizar(null);
  document.body.querySelectorAll('[role="dialog"]').forEach((dialogo) => dialogo.remove());
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('precuenta', () => {
  it('lleva el negocio, los productos, el total, la propina voluntaria y cómo pagar por Bre-B', async () => {
    const precuenta = await mountSuspended(PrecuentaDelPedido, {
      props: { pedido: PEDIDO_MESA, negocio: NEGOCIO, fecha: '2026-11-03T20:15:00.000Z' },
    });

    const texto = precuenta.text();
    expect(texto).toContain('La Industria');
    expect(texto).toContain('NIT 900111222');
    expect(texto).toContain('PRECUENTA');
    expect(texto).toContain('Mesa 4');
    expect(texto).toContain('IND Classic Artesanal');
    expect(texto).toContain('Término medio');
    expect(texto).toContain('Impoconsumo (INC)');
    expect(texto).toContain(pesos('21.600'));
    expect(texto).toContain('Propina sugerida');
    expect(texto).toContain(pesos('2.000'));
    expect(texto).toContain('Total con propina');
    expect(texto).toContain(pesos('23.600'));
    expect(texto).toContain('La propina es voluntaria');
    expect(texto).toContain('PAGA CON BRE-B');
    expect(texto).toContain('@laindustria');
    expect(precuenta.find('svg[aria-label="QR para pagar con Bre-B"]').exists()).toBe(true);
    expect(texto).toContain('Este documento no es una factura ni un recibo de pago.');
  });

  it('sin propina sugerida ni Bre-B, no muestra esos bloques', async () => {
    const precuenta = await mountSuspended(PrecuentaDelPedido, {
      props: {
        pedido: { ...PEDIDO_MESA, propinaSugerida: '0.00' },
        negocio: NEGOCIO_SIN_BRE_B,
        fecha: '2026-11-03T20:15:00.000Z',
      },
    });

    expect(precuenta.text()).not.toContain('Propina sugerida');
    expect(precuenta.find('[data-bloque="bre-b"]').exists()).toBe(false);
    expect(precuenta.text()).toContain(pesos('21.600'));
  });

  it('la caja la imprime con el pedido y el negocio al día', async () => {
    sesionComo('cajero');
    const imprimir = vi.fn();
    window.print = imprimir;
    simularBackend(fetchFalso, {
      'GET /pedidos/p1': () => PEDIDO_MESA,
      'GET /negocios/actual': () => NEGOCIO,
    });
    const detalle = await mountSuspended(DetallePedidoCaja, { props: { pedido: PEDIDO_MESA } });

    await botonDe(detalle, 'Precuenta').trigger('click');

    await vi.waitFor(() => expect(imprimir).toHaveBeenCalledTimes(1));
    const { documento } = useImpresion();
    expect(documento.value).toMatchObject({
      tipo: 'precuenta',
      pedido: { id: 'p1' },
      negocio: { llaveBreB: '@laindustria' },
    });
  });

  it('si no se pudo traer el pedido, avisa y no imprime', async () => {
    sesionComo('cajero');
    const imprimir = vi.fn();
    window.print = imprimir;
    simularBackend(fetchFalso, { 'GET /negocios/actual': () => NEGOCIO });
    const detalle = await mountSuspended(DetallePedidoCaja, { props: { pedido: PEDIDO_MESA } });

    await botonDe(detalle, 'Precuenta').trigger('click');

    await vi.waitFor(() =>
      expect(useToast().toasts.value.map((aviso) => aviso.title)).toContain(
        'No pudimos preparar la precuenta',
      ),
    );
    expect(imprimir).not.toHaveBeenCalled();
  });

  it('el mesero la imprime desde la cuenta de un pedido que ya existe', async () => {
    sesionComo('mesero');
    const props = { items: PEDIDO_MESA.items, total: '21600', estadoPedido: 'enviado_a_cocina' };

    const nuevo = await mountSuspended(PanelCuenta, { props });
    expect(nuevo.text()).not.toContain('Imprimir precuenta');

    const existente = await mountSuspended(PanelCuenta, { props: { ...props, pedidoId: 'p1' } });
    expect(existente.text()).toContain('Imprimir precuenta');
  });
});

describe('cobro por transferencia con Bre-B', () => {
  /** @param {string} metodo */
  const pagoCon = (metodo) => [{ metodo, monto: '21600', recibido: '', referencia: '' }];

  it('muestra el QR, la llave y el valor a pagar', async () => {
    sesionComo('cajero');
    simularBackend(fetchFalso, { 'GET /negocios/actual': () => NEGOCIO });

    const pagos = await mountSuspended(PagosDelCobro, {
      props: { modelValue: pagoCon('transferencia'), aPagar: '21600' },
    });

    await vi.waitFor(() => expect(pagos.text()).toContain('Paga con Bre-B'));
    expect(pagos.text()).toContain('@laindustria');
    expect(pagos.text()).toContain(pesos('21.600'));
    expect(pagos.find('svg[aria-label="QR para pagar con Bre-B"]').exists()).toBe(true);
    expect(pagos.text()).toContain('Revisa en tu banco que la plata llegó');
  });

  it('en efectivo no aparece', async () => {
    sesionComo('cajero');
    simularBackend(fetchFalso, { 'GET /negocios/actual': () => NEGOCIO });

    const pagos = await mountSuspended(PagosDelCobro, {
      props: { modelValue: pagoCon('efectivo'), aPagar: '21600' },
    });

    expect(pagos.text()).not.toContain('Paga con Bre-B');
  });

  it('sin Bre-B configurado, el dueño ve dónde configurarlo y la caja no ve nada', async () => {
    simularBackend(fetchFalso, { 'GET /negocios/actual': () => NEGOCIO_SIN_BRE_B });

    sesionComo('dueno');
    const delDueno = await mountSuspended(PagosDelCobro, {
      props: { modelValue: pagoCon('transferencia'), aPagar: '21600' },
    });
    await vi.waitFor(() => expect(delDueno.text()).toContain('Configura tu llave y tu QR'));

    sesionComo('cajero');
    const deLaCaja = await mountSuspended(PagosDelCobro, {
      props: { modelValue: pagoCon('transferencia'), aPagar: '21600' },
    });
    await vi.waitFor(() => expect(useNegocioStore().datos).not.toBeNull());
    expect(deLaCaja.text()).not.toContain('Configura tu llave');
    expect(deLaCaja.text()).not.toContain('Paga con Bre-B');
  });
});

describe('configuración del cobro con Bre-B', () => {
  /** @param {HTMLInputElement} entrada @param {string} valor */
  function escribir(entrada, valor) {
    entrada.value = valor;
    entrada.dispatchEvent(new Event('input'));
  }

  /** Simula elegir una imagen en el selector de archivos. */
  function subirImagen() {
    const selector = /** @type {HTMLInputElement} */ (document.querySelector('input[type="file"]'));
    const imagen = new File(['imagen'], 'qr.png', { type: 'image/png' });
    Object.defineProperty(selector, 'files', { value: [imagen], configurable: true });
    selector.dispatchEvent(new Event('change'));
  }

  it('guarda la llave como la registran los bancos', async () => {
    sesionComo('dueno');
    const patch = vi.fn(() => ({ ...NEGOCIO_SIN_BRE_B, llaveBreB: '3001234567' }));
    simularBackend(fetchFalso, { 'PATCH /negocios/actual': (opciones) => patch(opciones.body) });
    const configuracion = await mountSuspended(ConfiguracionBreB, {
      props: { negocio: NEGOCIO_SIN_BRE_B },
    });

    escribir(configuracion.find('input[placeholder="@turestaurante"]').element, '300 123 4567');
    await vi.waitFor(() => expect(configuracion.text()).toContain('Celular'));
    await configuracion.find('form').trigger('submit');

    await vi.waitFor(() =>
      expect(patch).toHaveBeenCalledWith({ llaveBreB: '3001234567', qrBreB: null }),
    );
    expect(configuracion.emitted('guardado')).toHaveLength(1);
  });

  it('no deja guardar algo que no es una llave', async () => {
    sesionComo('dueno');
    const patch = vi.fn();
    simularBackend(fetchFalso, { 'PATCH /negocios/actual': patch });
    const configuracion = await mountSuspended(ConfiguracionBreB, {
      props: { negocio: NEGOCIO_SIN_BRE_B },
    });

    escribir(configuracion.find('input[placeholder="@turestaurante"]').element, 'laindustria');
    await configuracion.find('form').trigger('submit');

    await vi.waitFor(() => expect(configuracion.text()).toContain('Escribe una llave válida'));
    expect(patch).not.toHaveBeenCalled();
  });

  it('lee el QR de la imagen del banco, lo muestra y guarda su contenido', async () => {
    sesionComo('dueno');
    leerQrFalso.mockResolvedValue(QR_DEL_BANCO);
    const patch = vi.fn(() => ({ ...NEGOCIO_SIN_BRE_B, qrBreB: QR_DEL_BANCO }));
    simularBackend(fetchFalso, { 'PATCH /negocios/actual': (opciones) => patch(opciones.body) });
    const configuracion = await mountSuspended(ConfiguracionBreB, {
      props: { negocio: NEGOCIO_SIN_BRE_B },
      attachTo: document.body,
    });

    subirImagen();

    await vi.waitFor(() =>
      expect(configuracion.find('svg[aria-label="QR de cobro del negocio"]').exists()).toBe(true),
    );
    expect(configuracion.text()).not.toContain('no parece de cobro');
    await configuracion.find('form').trigger('submit');
    await vi.waitFor(() =>
      expect(patch).toHaveBeenCalledWith({ llaveBreB: null, qrBreB: QR_DEL_BANCO }),
    );
    configuracion.unmount();
  });

  it('avisa si la imagen no tiene un QR, o si el QR no parece de cobro', async () => {
    sesionComo('dueno');
    const configuracion = await mountSuspended(ConfiguracionBreB, {
      props: { negocio: NEGOCIO_SIN_BRE_B },
      attachTo: document.body,
    });

    leerQrFalso.mockResolvedValue(null);
    subirImagen();
    await vi.waitFor(() =>
      expect(configuracion.text()).toContain('No encontramos un QR en esa imagen'),
    );

    leerQrFalso.mockResolvedValue('https://laindustria.co/menu');
    subirImagen();
    await vi.waitFor(() => expect(configuracion.text()).toContain('Este QR no parece de cobro'));
    configuracion.unmount();
  });
});
