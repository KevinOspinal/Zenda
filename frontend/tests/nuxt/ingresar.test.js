// @ts-check
// Pruebas de la pantalla de ingreso con un backend simulado.
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PaginaIngresar from '~/pages/ingresar.vue';
import { useSesionStore } from '~/stores/sesion.js';
import { NEGOCIO, USUARIO, errorDelApi, sesionDelApi, simularBackend } from './ayudantes.js';

// $fetch y navigateTo son importaciones automáticas de Nuxt: se reemplazan en las pruebas.
const { fetchFalso, navegarFalso } = vi.hoisted(() => ({
  fetchFalso: vi.fn(),
  navegarFalso: vi.fn(),
}));
mockNuxtImport('$fetch', () => fetchFalso);
mockNuxtImport('navigateTo', () => navegarFalso);

beforeEach(() => {
  fetchFalso.mockReset();
  navegarFalso.mockReset();
  // Este dispositivo ya ingresó antes a La Industria.
  const sesion = useSesionStore();
  sesion.nitRecordado = NEGOCIO.nit;
  sesion.negocioRecordado = NEGOCIO.nombre;
});

/**
 * Escribe el correo y la contraseña y envía el formulario.
 * @param {Awaited<ReturnType<typeof mountSuspended>>} pagina
 */
async function enviarCredenciales(pagina) {
  await pagina.find('input[type="email"]').setValue(USUARIO.email);
  await pagina.find('input[autocomplete="current-password"]').setValue('Industria-2026');
  await pagina.find('form').trigger('submit');
}

describe('pantalla de ingreso', () => {
  it('con el negocio recordado, muestra su nombre y no pide el NIT', async () => {
    const pagina = await mountSuspended(PaginaIngresar);

    expect(pagina.text()).toContain('La Industria');
    expect(pagina.text()).toContain('NIT 900111222');
    expect(pagina.find('input[inputmode="numeric"]').exists()).toBe(false);
  });

  it('ingresa y lleva al inicio del rol', async () => {
    simularBackend(fetchFalso, {
      'POST /auth/login': () => sesionDelApi('1'),
      'GET /auth/yo': () => ({ usuario: USUARIO, negocio: NEGOCIO }),
    });
    const pagina = await mountSuspended(PaginaIngresar);

    await enviarCredenciales(pagina);

    await vi.waitFor(() => expect(navegarFalso).toHaveBeenCalledWith('/mesas', { replace: true }));
    const [, opciones] = fetchFalso.mock.calls.find(([ruta]) => ruta === '/auth/login') ?? [];
    expect(opciones.body).toEqual({
      nit: '900111222',
      email: USUARIO.email,
      password: 'Industria-2026',
    });
  });

  it('con credenciales incorrectas, muestra un mensaje claro y borra la contraseña', async () => {
    simularBackend(fetchFalso, {
      'POST /auth/login': () => {
        throw errorDelApi(401, 'CREDENCIALES_INVALIDAS');
      },
    });
    const pagina = await mountSuspended(PaginaIngresar);

    await enviarCredenciales(pagina);

    await vi.waitFor(() =>
      expect(pagina.text()).toContain('NIT, correo o contraseña incorrectos.'),
    );
    const contrasena = pagina.find('input[autocomplete="current-password"]').element;
    expect(/** @type {HTMLInputElement} */ (contrasena).value).toBe('');
  });

  it('con demasiados intentos, bloquea el botón con una cuenta regresiva', async () => {
    simularBackend(fetchFalso, {
      'POST /auth/login': () => {
        throw errorDelApi(429, 'DEMASIADAS_SOLICITUDES', { 'Retry-After': '45' });
      },
    });
    const pagina = await mountSuspended(PaginaIngresar);

    await enviarCredenciales(pagina);

    await vi.waitFor(() => expect(pagina.text()).toContain('Espera 45 s'));
    expect(pagina.find('button[type="submit"]').attributes('disabled')).toBeDefined();
  });

  it('valida el NIT antes de llamar al API', async () => {
    const pagina = await mountSuspended(PaginaIngresar);
    // "Cambiar" deja escribir otro NIT.
    const cambiar = pagina.findAll('button').find((boton) => boton.text() === 'Cambiar');
    await cambiar?.trigger('click');

    await pagina.find('input[inputmode="numeric"]').setValue('900.111.222-1');
    await enviarCredenciales(pagina);

    await vi.waitFor(() => expect(pagina.text()).toContain('Escribe solo los números del NIT'));
    expect(fetchFalso).not.toHaveBeenCalled();
  });
});
