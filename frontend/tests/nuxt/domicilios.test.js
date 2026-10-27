// @ts-check
// Pruebas de los domicilios en la caja con un backend simulado: registrar uno nuevo, ver en
// qué va cada domicilio, despacharlo (con el enlace de WhatsApp) y entregarlo.
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DespacharDomicilio from '~/components/caja/DespacharDomicilio.vue';
import DomiciliosEnCurso from '~/components/caja/DomiciliosEnCurso.vue';
import NuevoDomicilio from '~/components/caja/NuevoDomicilio.vue';
import TarjetaDomicilio from '~/components/caja/TarjetaDomicilio.vue';
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
