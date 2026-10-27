// @ts-check
// Pruebas de la administración con un backend simulado: menú, mesas, usuarios y
// configuración.
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import FormularioMesa from '~/components/admin/FormularioMesa.vue';
import FormularioProducto from '~/components/admin/FormularioProducto.vue';
import PaginaConfiguracion from '~/pages/admin/configuracion.vue';
import PaginaMenu from '~/pages/admin/menu.vue';
import PaginaUsuarios from '~/pages/admin/usuarios.vue';
import { useSesionStore } from '~/stores/sesion.js';
import { simularBackend } from './ayudantes.js';

const { fetchFalso } = vi.hoisted(() => ({ fetchFalso: vi.fn() }));
mockNuxtImport('$fetch', () => fetchFalso);

const ESPACIO_FIJO = '\u00a0';

/**
 * Llamadas al backend simulado con su método: "POST /mesas".
 * @returns {string[]}
 */
const llamadas = () =>
  fetchFalso.mock.calls.map(([ruta, opciones]) => `${opciones?.method ?? 'GET'} ${ruta}`);

/** @param {'dueno' | 'administrador'} rol */
function sesionComo(rol) {
  const sesion = useSesionStore();
  sesion.usuario = { id: 'u1', nombre: 'Andrés', email: 'a@x.test', rol };
  sesion.negocio = {
    id: 'n1',
    nombre: 'La Industria',
    nit: '900111222',
    regimenImpuesto: 'responsable_inc',
  };
}

beforeEach(() => {
  fetchFalso.mockReset();
  sesionComo('dueno');
});

describe('menú', () => {
  const CATEGORIAS = [{ id: 'c1', nombre: 'Bebidas', orden: 0 }];
  const PRODUCTOS = [
    {
      id: 'p1',
      categoriaId: 'c1',
      nombre: 'Agua',
      descripcion: null,
      precio: '2000',
      tipoImpuesto: 'impoconsumo',
      controlaStock: true,
      stock: '24',
      activo: true,
    },
  ];

  it('muestra los productos de la categoría y los activa o desactiva al instante', async () => {
    simularBackend(fetchFalso, {
      'GET /categorias': () => CATEGORIAS,
      'GET /productos': () => structuredClone(PRODUCTOS),
      'PATCH /productos/p1': (opciones) => ({ ...PRODUCTOS[0], ...opciones.body }),
      'GET /menu': () => [],
    });
    const pagina = await mountSuspended(PaginaMenu);
    await vi.waitFor(() => expect(pagina.text()).toContain('Agua'));
    expect(pagina.text()).toContain('Stock 24');

    await pagina.find('button[role="switch"]').trigger('click');

    await vi.waitFor(() => expect(llamadas()).toContain('PATCH /productos/p1'));
    const [, opciones] = fetchFalso.mock.calls.find(([ruta]) => ruta === '/productos/p1') ?? [];
    expect(opciones.body).toEqual({ activo: false });
  });

  it('el formulario solo ofrece los impuestos que permite el régimen del negocio', async () => {
    const formulario = await mountSuspended(FormularioProducto, {
      props: { categorias: CATEGORIAS },
    });

    expect(formulario.text()).toContain('INC 8 %');
    expect(formulario.text()).toContain('Sin impuesto');
    expect(formulario.text()).not.toContain('IVA 19 %');
  });
});

describe('mesas', () => {
  it('crea varias mesas de una vez siguiendo la numeración de la zona', async () => {
    simularBackend(fetchFalso, { 'POST /mesas': (opciones) => ({ id: 'x', ...opciones.body }) });
    const formulario = await mountSuspended(FormularioMesa, {
      props: { zonas: ['Terraza'], cantidadPorZona: { Terraza: 2 } },
    });

    // La zona propuesta es la primera; se piden 3 mesas.
    const cantidad = formulario.find('input[inputmode="numeric"], input[role="spinbutton"]');
    await cantidad.setValue('3');
    await cantidad.trigger('blur');
    await vi.waitFor(() => expect(formulario.text()).toContain('Terraza 3, Terraza 4, Terraza 5'));
    await formulario.find('form').trigger('submit');

    await vi.waitFor(() => expect(llamadas().filter((l) => l === 'POST /mesas')).toHaveLength(3));
    const nombres = fetchFalso.mock.calls.map(([, opciones]) => opciones.body.nombre);
    expect(nombres).toEqual(['Terraza 3', 'Terraza 4', 'Terraza 5']);
  });
});

describe('usuarios', () => {
  const USUARIOS = [
    {
      id: 'u1',
      nombre: 'Andrés',
      email: 'dueno@x.test',
      rol: 'dueno',
      activo: true,
      bloqueado: false,
    },
    {
      id: 'u2',
      nombre: 'Laura',
      email: 'laura@x.test',
      rol: 'mesero',
      activo: true,
      bloqueado: false,
    },
  ];

  it('el dueño puede crear empleados', async () => {
    simularBackend(fetchFalso, { 'GET /usuarios': () => USUARIOS });
    const pagina = await mountSuspended(PaginaUsuarios);

    await vi.waitFor(() => expect(pagina.text()).toContain('Laura'));
    expect(pagina.text()).toContain('Nuevo empleado');
  });

  it('el administrador solo los ve', async () => {
    sesionComo('administrador');
    simularBackend(fetchFalso, { 'GET /usuarios': () => USUARIOS });
    const pagina = await mountSuspended(PaginaUsuarios);

    await vi.waitFor(() => expect(pagina.text()).toContain('Laura'));
    expect(pagina.text()).not.toContain('Nuevo empleado');
  });
});

describe('configuración', () => {
  it('muestra el régimen del negocio y la vista previa de la propina sugerida', async () => {
    simularBackend(fetchFalso, {
      'GET /negocios/actual': () => ({
        id: 'n1',
        nombre: 'La Industria',
        nit: '900111222',
        ciudad: 'Cali',
        regimenImpuesto: 'responsable_inc',
        propinaSugerida: '10',
      }),
    });
    const pagina = await mountSuspended(PaginaConfiguracion);

    await vi.waitFor(() => expect(pagina.text()).toContain('La Industria'));
    expect(pagina.text()).toContain('Impuesto al consumo (INC 8 %)');
    expect(pagina.text()).toContain(`se sugieren $${ESPACIO_FIJO}5.000`);
  });
});
