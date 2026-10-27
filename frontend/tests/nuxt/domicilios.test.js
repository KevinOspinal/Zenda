// @ts-check
// Pruebas de los domicilios en la caja con un backend simulado: registrar uno nuevo, ver en
// qué va cada domicilio, despacharlo (con el enlace de WhatsApp) y entregarlo.
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DespacharDomicilio from '~/components/caja/DespacharDomicilio.vue';
import DomiciliosEnCurso from '~/components/caja/DomiciliosEnCurso.vue';
import NuevoDomicilio from '~/components/caja/NuevoDomicilio.vue';
import TarjetaDomicilio from '~/components/caja/TarjetaDomicilio.vue';
import PedidoCerrado from '~/components/pedidos/PedidoCerrado.vue';
import TomarPedido from '~/components/pedidos/TomarPedido.vue';
import { useDomiciliosStore } from '~/stores/domicilios.js';
import { useSesionStore } from '~/stores/sesion.js';
import { simularBackend } from './ayudantes.js';

const { fetchFalso, navegarFalso } = vi.hoisted(() => ({
  fetchFalso: vi.fn(),
  navegarFalso: vi.fn(),
}));
mockNuxtImport('$fetch', () => fetchFalso);
mockNuxtImport('navigateTo', () => navegarFalso);

const ESPACIO_FIJO = '\u00a0';
/** @param {string} valor */
const pesos = (valor) => `$${ESPACIO_FIJO}${valor}`;

/**
 * Domicilio de $15.000 como lo entrega el API a la caja.
 * @param {Record<string, unknown>} [cambios]
 * @param {Record<string, unknown>} [entrega]
 */
const domicilio = (cambios = {}, entrega = {}) => ({
  id: 'd1',
  tipo: 'domicilio',
  origen: 'whatsapp',
  numero: 15,
  nombreCliente: 'Juan',
  mesa: null,
  estado: 'enviado_a_cocina',
  total: '15000',
  valorDomicilio: '3000',
  abiertoEn: new Date().toISOString(),
  enviadoACocinaEn: new Date().toISOString(),
  items: [{ id: 'i1', estadoCocina: 'listo', cantidad: '1', producto: { nombre: 'IND Classic' } }],
  entrega: {
    telefono: '3109876543',
    direccion: 'Calle 10 # 5-20',
    indicaciones: 'Apto 302',
    pagaCon: '50000',
    despachadoEn: null,
    entregadoEn: null,
    domiciliario: null,
    ...entrega,
  },
  ...cambios,
});

const EN_CAMINO = {
  despachadoEn: new Date().toISOString(),
  domiciliario: { id: 'dm1', nombre: 'Pedro Gómez', telefono: '3001234567' },
};

const botonConTexto = (/** @type {string} */ texto) =>
  /** @type {HTMLButtonElement | undefined} */ (
    [...document.querySelectorAll('button')].find((boton) => boton.textContent?.includes(texto))
  );

/**
 * Escribe en el campo de un formulario como lo haría el usuario.
 * @param {string} etiqueta Texto de la etiqueta del campo.
 * @param {string} valor
 */
function escribirEn(etiqueta, valor) {
  // Solo etiquetas de un campo: las opciones de un grupo también son <label> (sin "for").
  const label = [...document.querySelectorAll('label')].find(
    (l) => l.htmlFor && l.textContent?.trim().startsWith(etiqueta),
  );
  const campo = /** @type {HTMLInputElement} */ (
    document.getElementById(/** @type {HTMLLabelElement} */ (label).htmlFor)
  );
  campo.value = valor;
  campo.dispatchEvent(new Event('input', { bubbles: true }));
}

beforeEach(() => {
  fetchFalso.mockReset();
  navegarFalso.mockReset();
  document.body.querySelectorAll('[role="dialog"]').forEach((dialogo) => dialogo.remove());
  useSesionStore().usuario = { id: 'c1', nombre: 'Camilo', email: 'c@x.test', rol: 'cajero' };
});

describe('nuevo domicilio', () => {
  it('propone el valor del negocio y registra el domicilio antes de tomar los productos', async () => {
    simularBackend(fetchFalso, {
      'GET /negocios/actual': () => ({ id: 'n1', valorDomicilio: '3000' }),
      'POST /pedidos': (opciones) => domicilio({ id: 'd9', ...opciones.body, items: [] }),
    });
    await mountSuspended(NuevoDomicilio, { props: { abierto: true } });
    await vi.waitFor(() =>
      expect(
        /** @type {HTMLInputElement} */ (
          document.querySelector('input[aria-label="Valor del domicilio"]')
        ).value,
      ).toBe('3000'),
    );

    escribirEn('Nombre del cliente', 'Juan');
    escribirEn('Teléfono', '310 987 6543');
    escribirEn('Dirección', 'Calle 10 # 5-20');
    const pagaCon = /** @type {HTMLInputElement} */ (
      document.querySelector('input[aria-label="Con cuánto paga"]')
    );
    pagaCon.value = '50.000';
    pagaCon.dispatchEvent(new Event('input', { bubbles: true }));
    botonConTexto('Registrar y agregar productos')?.click();

    await vi.waitFor(() => expect(navegarFalso).toHaveBeenCalledWith('/pedidos/d9'));
    const [, opciones] =
      fetchFalso.mock.calls.find(([ruta, o]) => ruta === '/pedidos' && o?.method === 'POST') ?? [];
    expect(opciones.body).toMatchObject({
      tipo: 'domicilio',
      origen: 'whatsapp',
      nombreCliente: 'Juan',
      valorDomicilio: '3000',
      items: [],
      entrega: { telefono: '310 987 6543', direccion: 'Calle 10 # 5-20', pagaCon: '50000' },
    });
  });
});

describe('tarjeta de un domicilio', () => {
  it('listo para salir: dice cuánto cobrar y el cambio, y deja despacharlo', async () => {
    const tarjeta = await mountSuspended(TarjetaDomicilio, {
      props: { domicilio: domicilio() },
    });

    const texto = tarjeta.text();
    expect(texto).toContain('#15 · Juan');
    expect(texto).toContain('Listo para salir');
    expect(texto).toContain(`Cobrar ${pesos('15.000')}`);
    expect(texto).toContain(`Lleva cambio de ${pesos('35.000')}`);

    const despachar = tarjeta.findAll('button').find((b) => b.text().includes('Despachar'));
    await despachar?.trigger('click');
    expect(tarjeta.emitted('despachar')).toHaveLength(1);
  });

  it('sin enviar a cocina y ya cobrado: ofrece enviarlo y ya no deja agregar productos', async () => {
    const tarjeta = await mountSuspended(TarjetaDomicilio, {
      props: {
        domicilio: domicilio({
          estado: 'pagado',
          enviadoACocinaEn: null,
          items: [{ id: 'i1', estadoCocina: 'pendiente', producto: { nombre: 'IND Classic' } }],
        }),
      },
    });

    const texto = tarjeta.text();
    expect(texto).toContain('Sin enviar a cocina');
    expect(texto).toContain('Ver pedido');
    expect(texto).not.toContain('Agregar productos');
    expect(texto).not.toContain('Despachar');
    await tarjeta
      .findAll('button')
      .find((b) => b.text().includes('Enviar a cocina'))
      ?.trigger('click');
    expect(tarjeta.emitted('enviarACocina')).toHaveLength(1);
  });

  it('en cocina: espera; no se despacha hasta que la cocina lo tenga listo', async () => {
    const tarjeta = await mountSuspended(TarjetaDomicilio, {
      props: {
        domicilio: domicilio({
          items: [{ id: 'i1', estadoCocina: 'preparando', producto: { nombre: 'IND Classic' } }],
        }),
      },
    });

    const esperando = tarjeta
      .findAll('button')
      .find((b) => b.text().includes('Esperando a la cocina'));
    expect(esperando?.attributes('disabled')).toBeDefined();
    expect(tarjeta.text()).not.toContain('Despachar');
    // Sin cobrar, todavía se le pueden agregar productos.
    expect(tarjeta.text()).toContain('Agregar productos');
  });

  it('en camino: dice quién lo lleva y deja marcarlo entregado', async () => {
    const tarjeta = await mountSuspended(TarjetaDomicilio, {
      props: { domicilio: domicilio({}, EN_CAMINO) },
    });

    expect(tarjeta.text()).toContain('En camino');
    expect(tarjeta.text()).toContain('Con Pedro Gómez');
    const entregar = tarjeta.findAll('button').find((b) => b.text().includes('Cobrar y entregar'));
    await entregar?.trigger('click');
    expect(tarjeta.emitted('entregar')).toHaveLength(1);
  });
});

describe('domicilios en curso', () => {
  it('uno pagado se entrega de una vez; uno sin cobrar pide primero el cobro', async () => {
    simularBackend(fetchFalso, {
      'POST /pedidos/pagado/entregar': () =>
        domicilio({ id: 'pagado', estado: 'pagado' }, { ...EN_CAMINO, entregadoEn: 'ya' }),
    });
    const domicilios = useDomiciliosStore();
    domicilios.porId = {
      pagado: domicilio({ id: 'pagado', estado: 'pagado', nombreCliente: 'Ana' }, EN_CAMINO),
      porCobrar: domicilio({ id: 'porCobrar', numero: 16 }, EN_CAMINO),
    };
    const lista = await mountSuspended(DomiciliosEnCurso);

    const deAna = lista.findAll('article').find((tarjeta) => tarjeta.text().includes('Ana'));
    await deAna
      ?.findAll('button')
      .find((b) => b.text().includes('Entregado'))
      ?.trigger('click');
    await vi.waitFor(() => expect(domicilios.porId.pagado).toBeUndefined());

    const porCobrar = lista.findAll('article').find((tarjeta) => tarjeta.text().includes('#16'));
    await porCobrar
      ?.findAll('button')
      .find((b) => b.text().includes('Cobrar y entregar'))
      ?.trigger('click');
    expect(lista.emitted('cobrarYEntregar')?.[0]?.[0]).toMatchObject({ id: 'porCobrar' });
  });
});

describe('enviar a cocina un domicilio', () => {
  it('desde la lista de domicilios, aunque ya se haya cobrado', async () => {
    const sinEnviar = domicilio({
      estado: 'pagado',
      enviadoACocinaEn: null,
      items: [{ id: 'i1', estadoCocina: 'pendiente', producto: { nombre: 'IND Classic' } }],
    });
    simularBackend(fetchFalso, {
      'POST /pedidos/d1/enviar-cocina': () => ({
        ...sinEnviar,
        enviadoACocinaEn: new Date().toISOString(),
      }),
    });
    const domicilios = useDomiciliosStore();
    domicilios.porId = { d1: sinEnviar };
    const lista = await mountSuspended(DomiciliosEnCurso);

    await lista
      .findAll('button')
      .find((b) => b.text().includes('Enviar a cocina'))
      ?.trigger('click');

    await vi.waitFor(() => expect(lista.text()).toContain('En cocina'));
    expect(fetchFalso.mock.calls.some(([ruta]) => ruta === '/pedidos/d1/enviar-cocina')).toBe(true);
  });

  it('un domicilio cobrado sin enviar a cocina dice qué falta y deja enviarlo', async () => {
    const cobrado = domicilio({
      estado: 'pagado',
      enviadoACocinaEn: null,
      cerradoEn: new Date().toISOString(),
      items: [
        {
          id: 'i1',
          estadoCocina: 'pendiente',
          cantidad: '1',
          precioUnitario: '12000',
          producto: { nombre: 'IND Classic' },
        },
      ],
    });
    simularBackend(fetchFalso, {
      'GET /pedidos/d1': () => structuredClone(cobrado),
      'GET /menu': () => [],
      'GET /mesas': () => [],
      'GET /caja/estado': () => ({ abierta: true }),
      'POST /pedidos/d1/enviar-cocina': () => ({
        ...cobrado,
        enviadoACocinaEn: new Date().toISOString(),
      }),
    });

    const pantalla = await mountSuspended(TomarPedido, { props: { pedidoId: 'd1' } });
    await vi.waitFor(() => expect(pantalla.text()).toContain('Falta enviarlo a la cocina'));
    const texto = pantalla.text();
    expect(texto).toContain('#15 · Juan');
    expect(texto).toContain('IND Classic');
    // El seguimiento dice qué pasó y qué sigue; la entrega, a dónde va.
    expect(texto).toContain('Seguimiento');
    expect(texto).toContain('Falta');
    expect(texto).toContain('Calle 10 # 5-20');
    expect(texto).not.toContain('otro dispositivo');

    await pantalla
      .findAll('button')
      .find((b) => b.text().includes('Enviar a cocina'))
      ?.trigger('click');

    await vi.waitFor(() => expect(navegarFalso).toHaveBeenCalledWith('/caja'));
    expect(fetchFalso.mock.calls.some(([ruta]) => ruta === '/pedidos/d1/enviar-cocina')).toBe(true);
  });
});

describe('pedido cerrado', () => {
  it('una mesa cobrada: recibo con el pago, sin pedir nada más', async () => {
    const vista = await mountSuspended(PedidoCerrado, {
      props: {
        volverA: '/mesas',
        pedido: {
          id: 'p4',
          tipo: 'mesa',
          mesa: { id: 'm4', nombre: 'Mesa 4' },
          estado: 'pagado',
          total: '38000',
          propina: '3800',
          valorDomicilio: '0',
          abiertoEn: '2026-10-27T18:40:00.000Z',
          enviadoACocinaEn: '2026-10-27T18:45:00.000Z',
          cerradoEn: '2026-10-27T19:30:00.000Z',
          items: [
            {
              id: 'i1',
              cantidad: '2',
              precioUnitario: '19000',
              estadoCocina: 'entregado',
              producto: { nombre: 'IND Classic Artesanal' },
            },
          ],
          pagos: [{ id: 'pg1', metodo: 'efectivo', monto: '41800' }],
        },
      },
    });

    const texto = vista.text();
    expect(texto).toContain('Pedido cobrado');
    expect(texto).toContain(pesos('38.000'));
    expect(texto).toContain('Propina');
    expect(texto).toContain('Pagado con');
    expect(texto).toContain('Efectivo');
    expect(texto).not.toContain('Enviar a cocina');
  });
});

describe('despachar un domicilio', () => {
  it('sale con el único domiciliario activo y deja enviarle los datos por WhatsApp', async () => {
    simularBackend(fetchFalso, {
      'GET /domiciliarios': () => [{ id: 'dm1', nombre: 'Pedro Gómez', telefono: '3001234567' }],
      'POST /pedidos/d1/despachar': () => domicilio({}, EN_CAMINO),
    });
    await mountSuspended(DespacharDomicilio, { props: { pedido: domicilio(), abierto: true } });
    await vi.waitFor(() => expect(document.body.textContent).toContain('Pedro Gómez'));

    botonConTexto('Despachar')?.click();

    await vi.waitFor(() => expect(document.body.textContent).toContain('Salió con Pedro Gómez'));
    const [, opciones] =
      fetchFalso.mock.calls.find(([ruta]) => ruta === '/pedidos/d1/despachar') ?? [];
    expect(opciones.body).toEqual({ domiciliarioId: 'dm1' });
    const enlace = /** @type {HTMLAnchorElement} */ (
      document.querySelector('a[href^="https://wa.me/573001234567?text="]')
    );
    expect(enlace).not.toBeNull();
    expect(decodeURIComponent(enlace.href)).toContain('Dirección: Calle 10 # 5-20');
  });
});
