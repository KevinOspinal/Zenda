// @ts-check
// Pruebas de la pantalla del domiciliario con un backend simulado: la entrega en curso con cómo
// llegar y cuánto cobrar, elegir otra, "Entregado" con deshacer, lo que lleva para la caja, el
// aviso cuando le asignan un domicilio y darle acceso a Zenda desde Domiciliarios.
import { UApp } from '#components';
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import AccesoDomiciliario from '~/components/admin/AccesoDomiciliario.vue';
import PaginaEntregas from '~/pages/entregas.vue';
import { useEntregasStore } from '~/stores/entregas.js';
import { useSesionStore } from '~/stores/sesion.js';
import { simularBackend } from './ayudantes.js';

const { fetchFalso } = vi.hoisted(() => ({ fetchFalso: vi.fn() }));
mockNuxtImport('$fetch', () => fetchFalso);

const ESPACIO_FIJO = ' ';
/** @param {string} valor */
const pesos = (valor) => `$${ESPACIO_FIJO}${valor}`;

const PEDRO = { id: 'dm1', nombre: 'Pedro Gómez', telefono: '3001234567', usuarioId: 'u1' };

/**
 * Domicilio en camino con Pedro, como se lo entrega el API.
 * @param {Record<string, unknown>} cambios
 * @param {Record<string, unknown>} [entrega]
 */
const entregaDe = (cambios, entrega = {}) => ({
  tipo: 'domicilio',
  origen: 'whatsapp',
  mesa: null,
  estado: 'enviado_a_cocina',
  total: '15000',
  abiertoEn: new Date().toISOString(),
  enviadoACocinaEn: new Date().toISOString(),
  items: [
    { id: 'i1', cantidad: '1', estadoCocina: 'entregado', producto: { nombre: 'IND Classic' } },
  ],
  entrega: {
    telefono: '3109876543',
    direccion: 'Calle 10 # 5-20',
    indicaciones: 'Apto 302',
    formaPago: 'contra_entrega',
    pagaCon: '50000',
    ubicacionUrl: null,
    despachadoEn: new Date(Date.now() - 10 * 60_000).toISOString(),
    entregadoEn: null,
    domiciliario: PEDRO,
    ...entrega,
  },
  ...cambios,
});

const JUAN = entregaDe({ id: 'p1', numero: 15, nombreCliente: 'Juan' });
const ANA = entregaDe(
  { id: 'p2', numero: 16, nombreCliente: 'Ana', estado: 'pagado' },
  { formaPago: 'anticipado', pagaCon: null, despachadoEn: new Date().toISOString() },
);
const LUIS = entregaDe(
  { id: 'p3', numero: 12, nombreCliente: 'Luis', total: '20000' },
  { entregadoEn: new Date().toISOString() },
);

/** Páginas montadas en la prueba: se desmontan al terminar, para no confundir sus botones. */
const montadas = /** @type {{ unmount: () => void }[]} */ ([]);

/** Monta la pantalla dentro de <UApp>, como en la app real: así se ven sus avisos. */
async function montarEntregas() {
  const pagina = await mountSuspended(
    defineComponent({ render: () => h(UApp, null, () => h(PaginaEntregas)) }),
  );
  montadas.push(pagina);
  return pagina;
}

/**
 * Toca un botón de la pantalla por su texto (los avisos se dibujan aparte, en el documento).
 * @param {any} pagina
 * @param {string} texto
 */
const tocar = (pagina, texto) =>
  pagina
    .findAll('button')
    .find((/** @type {any} */ boton) => boton.text().includes(texto))
    ?.trigger('click');

const botonConTexto = (/** @type {string} */ texto) =>
  /** @type {HTMLButtonElement | undefined} */ (
    [...document.querySelectorAll('button')].find((boton) => boton.textContent?.includes(texto))
  );

beforeEach(() => {
  fetchFalso.mockReset();
  const sesion = useSesionStore();
  sesion.usuario = { id: 'u1', nombre: 'Pedro Gómez', email: 'pedro@x.test', rol: 'domiciliario' };
  sesion.negocio = { id: 'n1', nombre: 'La Industria', nit: '900111222', ciudad: 'El Cerrito' };
  const entregas = useEntregasStore();
  entregas.porId = {};
  entregas.estadoCarga = 'sin_cargar';
  entregas.confirmando = {};
});

afterEach(() => {
  vi.useRealTimers();
  for (const pagina of montadas.splice(0)) pagina.unmount();
});

describe('entregas del domiciliario', () => {
  it('la entrega en curso dice cómo llegar, cuánto cobrar y el cambio; abajo, lo de la caja', async () => {
    simularBackend(fetchFalso, { 'GET /pedidos': () => [ANA, JUAN, LUIS] });

    const pagina = await montarEntregas();

    await vi.waitFor(() => expect(pagina.text()).toContain('#15 · Juan'));
    const texto = pagina.text();
    // La que salió primero va en grande.
    expect(texto).toContain('Calle 10 # 5-20');
    expect(texto).toContain('Contra entrega · cóbrale');
    expect(texto).toContain(pesos('15.000'));
    expect(texto).toContain(`lleva ${pesos('35.000')} de cambio`);
    const mapa = pagina.findAll('a').find((a) => a.text().includes('Google Maps'));
    expect(mapa?.attributes('href')).toContain('El%20Cerrito');
    // Las demás, para elegir, y lo que debe llevar a la caja.
    expect(texto).toContain('También llevas');
    expect(texto).toContain('#16 · Ana');
    expect(texto).toContain('Por entregar en la caja');
    expect(texto).toContain('#12 · Luis');
  });

  it('al elegir otra entrega, pasa a la grande', async () => {
    simularBackend(fetchFalso, { 'GET /pedidos': () => [JUAN, ANA] });
    const pagina = await montarEntregas();
    await vi.waitFor(() => expect(pagina.text()).toContain('También llevas'));

    await pagina.find('button[aria-label="Entregar ahora #16 · Ana"]').trigger('click');

    await vi.waitFor(() => expect(pagina.text()).toContain('Ya está pagado'));
    expect(pagina.text()).toContain('No le cobres nada al cliente.');
  });

  it('"Entregado" se puede deshacer; si no, se confirma y queda por liquidar', async () => {
    simularBackend(fetchFalso, {
      'GET /pedidos': () => [JUAN],
      'POST /pedidos/p1/entregar': () => ({
        ...JUAN,
        entrega: { ...JUAN.entrega, entregadoEn: new Date().toISOString() },
      }),
    });
    const pagina = await montarEntregas();
    await vi.waitFor(() => expect(pagina.text()).toContain('#15 · Juan'));

    // 1. Se tocó por error: se deshace y la entrega vuelve, sin llegar al API.
    await tocar(pagina, 'Entregado');
    await vi.waitFor(() => expect(pagina.text()).toContain('Sin entregas por ahora'));
    // El aviso con "Deshacer" se dibuja aparte, en el documento, un instante después.
    await vi.waitFor(() => expect(botonConTexto('Deshacer')).toBeDefined());
    botonConTexto('Deshacer')?.click();
    await vi.waitFor(() => expect(pagina.text()).toContain('Contra entrega · cóbrale'));
    expect(useEntregasStore().confirmando).toEqual({});
    expect(fetchFalso.mock.calls.some(([ruta]) => ruta === '/pedidos/p1/entregar')).toBe(false);

    // 2. Esta vez sí: a los 5 segundos se confirma y el dinero queda para la caja. El reloj
    //    falso también avanza solo, para que terminen las animaciones de la tarjeta.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'], shouldAdvanceTime: true });
    await tocar(pagina, 'Entregado');
    await vi.advanceTimersByTimeAsync(4000);
    expect(fetchFalso.mock.calls.some(([ruta]) => ruta === '/pedidos/p1/entregar')).toBe(false);
    await vi.advanceTimersByTimeAsync(1000);
    vi.useRealTimers();
    await vi.waitFor(() =>
      expect(fetchFalso.mock.calls.some(([ruta]) => ruta === '/pedidos/p1/entregar')).toBe(true),
    );
    await vi.waitFor(() => expect(pagina.text()).toContain('Por entregar en la caja'));
  });

  it('sin entregas, le dice que le avisaremos', async () => {
    simularBackend(fetchFalso, { 'GET /pedidos': () => [] });

    const pagina = await montarEntregas();

    await vi.waitFor(() => expect(pagina.text()).toContain('Sin entregas por ahora'));
    expect(pagina.text()).toContain('te avisamos aquí con sonido y vibración');
    expect(pagina.text()).not.toContain('Entregado');
  });

  it('cuando la caja le asigna un domicilio, le avisa y aparece en grande', async () => {
    simularBackend(fetchFalso, {
      'GET /pedidos': () => [],
      'GET /pedidos/p1': () => JUAN,
    });
    const pagina = await montarEntregas();
    await vi.waitFor(() => expect(pagina.text()).toContain('Sin entregas por ahora'));

    await useEntregasStore().alCambiarPedido({ id: 'p1' });

    await vi.waitFor(() => expect(document.body.textContent).toContain('¡Nuevo domicilio!'));
    expect(pagina.text()).toContain('#15 · Juan');
    // La tarjeta se resalta un momento.
    expect(pagina.find('article').classes()).toContain('ring-4');
  });
});

describe('acceso del domiciliario', () => {
  it('el dueño le da correo y contraseña para entrar desde su celular', async () => {
    const sesion = useSesionStore();
    sesion.usuario = { id: 'd0', nombre: 'Andrés', email: 'a@x.test', rol: 'dueno' };
    simularBackend(fetchFalso, {
      'POST /domiciliarios/dm1/acceso': (opciones) => ({
        ...PEDRO,
        acceso: { email: opciones.body.email, activo: true },
      }),
    });
    const modal = await mountSuspended(AccesoDomiciliario, {
      props: { abierto: true, domiciliario: { ...PEDRO, acceso: null } },
    });
    await vi.waitFor(() => expect(botonConTexto('Dar acceso')).toBeDefined());

    const [correo, contrasena] = /** @type {HTMLInputElement[]} */ ([
      ...document.querySelectorAll('[role="dialog"] input'),
    ]);
    correo.value = 'Pedro@LaIndustria.test';
    correo.dispatchEvent(new Event('input', { bubbles: true }));
    contrasena.value = 'Domicilios2026';
    contrasena.dispatchEvent(new Event('input', { bubbles: true }));
    expect(document.body.textContent).toContain('NIT 900111222');
    botonConTexto('Dar acceso')?.click();

    await vi.waitFor(() => expect(modal.emitted('guardado')).toHaveLength(1));
    const [, opciones] =
      fetchFalso.mock.calls.find(([ruta]) => ruta === '/domiciliarios/dm1/acceso') ?? [];
    expect(opciones.body).toEqual({
      email: 'pedro@laindustria.test',
      contrasena: 'Domicilios2026',
    });
  });
});
