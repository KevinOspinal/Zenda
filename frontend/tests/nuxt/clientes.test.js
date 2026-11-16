// @ts-check
// Pruebas de la pantalla de clientes con un backend simulado: la lista por letra, la búsqueda
// (por nombre o documento con o sin puntos, resaltada, y la que se suma desde el API), los que
// no tienen correo, la ficha al lado (PC) y en una hoja (celular), editar en el mismo lugar,
// registrar lo que se buscó, y el aviso de documento ya registrado (también en la caja).
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SelectorCliente from '~/components/caja/SelectorCliente.vue';
import FormularioCliente from '~/components/clientes/FormularioCliente.vue';
import PaginaClientes from '~/pages/clientes.vue';
import { useSesionStore } from '~/stores/sesion.js';
import { simularBackend } from './ayudantes.js';

const { fetchFalso } = vi.hoisted(() => ({ fetchFalso: vi.fn() }));
mockNuxtImport('$fetch', () => fetchFalso);

/**
 * @param {string} id
 * @param {string} nombre
 * @param {'cc' | 'nit' | 'ce' | 'pasaporte' | 'otro'} tipoDocumento
 * @param {string} numeroDocumento
 * @param {object} [extra]
 */
const cliente = (id, nombre, tipoDocumento, numeroDocumento, extra = {}) => ({
  id,
  nombre,
  tipoDocumento,
  numeroDocumento,
  email: `${id}@correo.test`,
  telefono: null,
  ...extra,
});

// Seis letras (A, B, C, D, E y #): con cinco o más, aparece el índice.
const CLIENTES = () => [
  cliente('c1', 'Ana María Restrepo', 'cc', '1037654321', { telefono: '3001234567' }),
  cliente('c2', 'Bavaria S.A.', 'nit', '860005224'),
  cliente('c3', 'Carolina Úsuga', 'cc', '43987654', { email: null }),
  cliente('c4', 'David Smith', 'pasaporte', 'X1234567'),
  cliente('c5', 'Esteban Quintero', 'cc', '98765432', { email: null }),
  cliente('c6', '3D Impresiones SAS', 'nit', '901234567'),
];
// Una clienta que no viene en la lista inicial: solo la encuentra la búsqueda del API.
const ZULMA = cliente('c7', 'Zulma Arango', 'cc', '52111222');

/**
 * El backend simulado de clientes: la lista sin texto y, con texto, lo que encuentre (como el
 * API: el nombre contiene o el documento empieza por).
 * @param {Record<string, (opciones: any) => any>} [extra]
 */
function backend(extra = {}) {
  return simularBackend(fetchFalso, {
    'GET /clientes': (opciones) => {
      const texto = String(opciones.query?.buscar ?? '').toLowerCase();
      if (!texto) return CLIENTES();
      return [...CLIENTES(), ZULMA].filter(
        (c) => c.nombre.toLowerCase().includes(texto) || c.numeroDocumento.startsWith(texto),
      );
    },
    ...extra,
  });
}

/**
 * Cambia el tamaño de la pantalla simulada: desde 1024 px, la ficha va al lado.
 * @param {number} width
 * @param {number} height
 */
function pantalla(width, height) {
  const ventana =
    /** @type {{ happyDOM: { setViewport: (tamano: { width: number, height: number }) => void } }} */ (
      /** @type {unknown} */ (window)
    );
  ventana.happyDOM.setViewport({ width, height });
}

/**
 * Nombres de los clientes en pantalla, en orden.
 * @param {import('@vue/test-utils').VueWrapper} pagina
 */
const nombresEnPantalla = (pagina) => pagina.findAll('button.principal').map((b) => b.text());

/**
 * El primer botón (dentro de un envoltorio) cuyo texto contiene algo.
 * @param {import('@vue/test-utils').VueWrapper | import('@vue/test-utils').DOMWrapper<Element>} donde
 * @param {string} texto
 */
const boton = (donde, texto) => donde.findAll('button').find((b) => b.text().includes(texto));

/**
 * El diálogo abierto que contiene un texto (las hojas van al final del body).
 * @param {string} texto
 */
const dialogoCon = (texto) =>
  vi.waitFor(() => {
    const dialogo = [...document.body.querySelectorAll('[role="dialog"]')].find((d) =>
      d.textContent?.includes(texto),
    );
    expect(dialogo).toBeTruthy();
    return /** @type {HTMLElement} */ (dialogo);
  });

/** Lo que se le preguntó al API con `buscar`. */
const busquedasAlApi = () =>
  fetchFalso.mock.calls
    .filter(([ruta, opciones]) => ruta === '/clientes' && opciones?.query?.buscar)
    .map(([, opciones]) => opciones.query.buscar);

beforeEach(() => {
  fetchFalso.mockReset();
  document.body.querySelectorAll('[role="dialog"]').forEach((dialogo) => dialogo.remove());
  useSesionStore().usuario = {
    id: 'u1',
    nombre: 'Marta Ruiz',
    email: 'marta@laindustria.test',
    rol: 'dueno',
  };
});
afterEach(() => pantalla(1024, 768));

describe('pantalla de clientes', () => {
  it('ordena por letra con índice, muestra el documento con puntos y filtra a los sin correo', async () => {
    pantalla(1280, 800);
    backend();
    const pagina = await mountSuspended(PaginaClientes);
    await vi.waitFor(() => expect(pagina.text()).toContain('Ana María Restrepo'));

    // Por letra, y lo que no empieza por letra al final.
    const letras = pagina.findAll('section > h2').map((h) => h.text());
    expect(letras).toEqual(['A', 'B', 'C', 'D', 'E', '#']);
    expect(pagina.findAll('nav[aria-label="Ir a una letra"] button')).toHaveLength(6);
    expect(nombresEnPantalla(pagina).at(-1)).toBe('3D Impresiones SAS');
    // La sigla separada del número, y el número con puntos de miles.
    expect(pagina.text()).toMatch(/CC\s1\.037\.654\.321/);
    expect(pagina.text()).toMatch(/NIT\s860\.005\.224/);
    expect(pagina.text()).toMatch(/PA\sX1234567/);
    expect(
      pagina.find('button.principal[aria-label^="Carolina Úsuga"]').attributes('aria-label'),
    ).toBe('Carolina Úsuga, CC 43.987.654, sin correo');

    // Sin elegido, al lado está el resumen: cuántos tienen correo para la factura.
    const resumen = () => pagina.find('aside[aria-label="Resumen de los clientes"]');
    expect(resumen().text()).toContain('4 de 6');
    expect(resumen().find('[role="meter"]').attributes('aria-valuenow')).toBe('4');
    await boton(resumen(), 'Ver solo los 2 sin correo')?.trigger('click');
    await vi.waitFor(() =>
      expect(nombresEnPantalla(pagina)).toEqual(['Carolina Úsuga', 'Esteban Quintero']),
    );
    expect(pagina.find('button[aria-pressed="true"]').text()).toContain('Sin correo');
    await boton(resumen(), 'Ver a todos')?.trigger('click');
    await vi.waitFor(() => expect(nombresEnPantalla(pagina)).toHaveLength(6));
  });

  it('busca por nombre sin tildes o por documento sin puntos, y resalta lo que coincide', async () => {
    backend();
    const pagina = await mountSuspended(PaginaClientes);
    await vi.waitFor(() => expect(pagina.text()).toContain('Carolina Úsuga'));

    await pagina.find('input[type="search"]').setValue('usuga');
    await vi.waitFor(() => expect(nombresEnPantalla(pagina)).toEqual(['Carolina Úsuga']));
    expect(pagina.find('button.principal mark').text()).toBe('Úsuga');
    // Al buscar ya no van por letra.
    expect(pagina.findAll('section > h2')).toHaveLength(0);

    // El documento como se escriba: sin puntos encuentra al que los tiene, y los marca.
    await pagina.find('input[type="search"]').setValue('43987');
    await vi.waitFor(() => expect(nombresEnPantalla(pagina)).toEqual(['Carolina Úsuga']));
    expect(pagina.find('.cifra mark').text()).toBe('43.987');
    // Al API se le pregunta sin puntos (busca "empieza por").
    await pagina.find('input[type="search"]').setValue('43.987');
    await vi.waitFor(() => expect(busquedasAlApi()).toContain('43987'));
  });

  it('suma a la lista lo que encuentra el API aunque no estuviera en la lista inicial', async () => {
    backend();
    const pagina = await mountSuspended(PaginaClientes);
    await vi.waitFor(() => expect(pagina.text()).toContain('Ana María Restrepo'));
    expect(pagina.text()).not.toContain('Zulma Arango');

    await pagina.find('input[type="search"]').setValue('zulma');
    await vi.waitFor(() => expect(nombresEnPantalla(pagina)).toEqual(['Zulma Arango']));
    expect(busquedasAlApi()).toEqual(['zulma']);
  });

  it('en PC, la ficha de alguien sin correo lleva a agregarlo y se edita en el mismo lugar', async () => {
    pantalla(1280, 800);
    /** @type {unknown[]} */
    const cambios = [];
    backend({
      'PATCH /clientes/c3': (opciones) => {
        cambios.push(opciones.body);
        return { id: 'c3', ...opciones.body };
      },
    });
    const pagina = await mountSuspended(PaginaClientes);
    await vi.waitFor(() => expect(pagina.text()).toContain('Carolina Úsuga'));

    await pagina.find('button.principal[aria-label^="Carolina Úsuga"]').trigger('click');
    const ficha = () => pagina.find('aside[aria-label="Ficha de Carolina Úsuga"]');
    await vi.waitFor(() =>
      expect(ficha().text()).toContain('Sin correo: la factura electrónica no le llegará'),
    );
    expect(ficha().text()).toContain('43.987.654');
    expect(pagina.find('[aria-current="true"]').text()).toContain('Carolina Úsuga');

    // «Agregar correo» cambia la ficha por el formulario, sin salir de la lista.
    await boton(ficha(), 'Agregar correo')?.trigger('click');
    await vi.waitFor(() => expect(ficha().find('input[name="email"]').exists()).toBe(true));
    await ficha().find('input[name="email"]').setValue('Carolina@Correo.TEST');
    await ficha().find('form').trigger('submit');

    await vi.waitFor(() =>
      expect(cambios).toEqual([
        {
          tipoDocumento: 'cc',
          numeroDocumento: '43987654',
          nombre: 'Carolina Úsuga',
          email: 'carolina@correo.test',
          telefono: null,
        },
      ]),
    );
    await vi.waitFor(() => expect(ficha().text()).toContain('La factura electrónica le llega a'));
    expect(ficha().text()).toContain('carolina@correo.test');

    // Cerrar la ficha vuelve al resumen, ya con un cliente más con correo.
    await ficha().find('button[aria-label="Cerrar la ficha"]').trigger('click');
    await vi.waitFor(() =>
      expect(pagina.find('aside[aria-label="Resumen de los clientes"]').text()).toContain('5 de 6'),
    );
  });

  it('en el celular, la ficha abre en una hoja con WhatsApp y llamar', async () => {
    pantalla(390, 844);
    backend();
    const pagina = await mountSuspended(PaginaClientes);
    await vi.waitFor(() => expect(pagina.text()).toContain('Ana María Restrepo'));

    await pagina.find('button.principal[aria-label^="Ana María Restrepo"]').trigger('click');

    const hoja = await dialogoCon('La factura electrónica le llega a');
    expect(hoja.textContent).toContain('c1@correo.test');
    expect(hoja.textContent).toContain('300 123 4567');
    expect(hoja.querySelector('a[href="https://wa.me/573001234567"]')).toBeTruthy();
    expect(hoja.querySelector('a[href^="tel:"]')).toBeTruthy();
    expect(pagina.find('aside').exists()).toBe(false);
  });

  it('si lo buscado no existe, lo registra con ese número y lo deja elegido', async () => {
    pantalla(1280, 800);
    /** @type {unknown[]} */
    const creados = [];
    backend({
      'POST /clientes': (opciones) => {
        creados.push(opciones.body);
        return { id: 'c9', ...opciones.body };
      },
    });
    const pagina = await mountSuspended(PaginaClientes);
    await vi.waitFor(() => expect(pagina.text()).toContain('Ana María Restrepo'));

    await pagina.find('input[type="search"]').setValue('1.122.334');
    await vi.waitFor(() => expect(pagina.text()).toContain('No encontramos «1.122.334»'));
    await boton(pagina, 'Registrar a «1.122.334»')?.trigger('click');

    const registro = () => pagina.find('aside[aria-label="Registrar un cliente"]');
    await vi.waitFor(() => expect(registro().exists()).toBe(true));
    const numero = registro().find('input[name="numeroDocumento"]');
    expect(/** @type {HTMLInputElement} */ (numero.element).value).toBe('1.122.334');
    expect(registro().text()).toContain('Se verá así: CC 1.122.334');
    await registro().find('input[name="nombre"]').setValue('Juan Pablo Ríos');
    await registro().find('form').trigger('submit');

    await vi.waitFor(() =>
      expect(creados).toEqual([
        {
          tipoDocumento: 'cc',
          numeroDocumento: '1122334',
          nombre: 'Juan Pablo Ríos',
          email: null,
          telefono: null,
        },
      ]),
    );
    await vi.waitFor(() =>
      expect(pagina.find('aside[aria-label="Ficha de Juan Pablo Ríos"]').exists()).toBe(true),
    );
  });
});

describe('formulario de cliente', () => {
  it('avisa mientras se escribe si el documento ya está registrado y lleva a ese cliente', async () => {
    backend();
    const formulario = await mountSuspended(FormularioCliente);

    // Con puntos también: se compara sin ellos.
    await formulario.find('input[name="numeroDocumento"]').setValue('1.037.654.321');
    await vi.waitFor(() =>
      expect(formulario.text()).toContain('Ya está registrado: Ana María Restrepo'),
    );
    expect(formulario.text()).toContain('CC 1.037.654.321. No se puede registrar dos veces.');
    await boton(formulario, 'Ver su ficha')?.trigger('click');
    expect(formulario.emitted('existente')?.[0]?.[0]).toMatchObject({ id: 'c1' });

    // El mismo número con otro tipo de documento no es el mismo cliente.
    // Los tipos van en orden: CC, NIT, CE, pasaporte y otro.
    await formulario.findAll('[role="radio"]')[1]?.trigger('click');
    expect(formulario.text()).toContain('Número de NIT');
    await vi.waitFor(() => expect(formulario.text()).not.toContain('Ya está registrado'));
  });

  it('en la caja, el cliente que ya existía se usa de una vez', async () => {
    backend();
    const selector = await mountSuspended(SelectorCliente, { props: { modelValue: null } });

    await boton(selector, 'Factura a nombre de un cliente')?.trigger('click');
    await boton(selector, 'Registrar cliente nuevo')?.trigger('click');
    await selector.find('input[name="numeroDocumento"]').setValue('43987654');
    await vi.waitFor(() => expect(selector.text()).toContain('Ya está registrado: Carolina Úsuga'));
    await boton(selector, 'Usar este cliente')?.trigger('click');

    expect(selector.emitted('update:modelValue')?.[0]?.[0]).toMatchObject({ id: 'c3' });
  });
});
