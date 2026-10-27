// @ts-check
// Pruebas de la estructura por rol: navegación inferior, avisos de secciones pendientes y
// cambio de contraseña desde el perfil.
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PantallaEnConstruccion from '~/components/comunes/PantallaEnConstruccion.vue';
import NavegacionInferior from '~/components/navegacion/NavegacionInferior.vue';
import FormularioContrasena from '~/components/perfil/FormularioContrasena.vue';
import { seccionesDe } from '~/utils/roles.js';
import { errorDelApi, sesionDelApi, simularBackend } from './ayudantes.js';

const { fetchFalso } = vi.hoisted(() => ({ fetchFalso: vi.fn() }));
mockNuxtImport('$fetch', () => fetchFalso);

beforeEach(() => {
  fetchFalso.mockReset();
});

/**
 * Textos de los enlaces y botones de la navegación inferior.
 * @param {Awaited<ReturnType<typeof mountSuspended>>} navegacion
 */
const botones = (navegacion) =>
  navegacion.findAll('ul > li > a, ul > li > button').map((elemento) => elemento.text());

describe('navegación inferior (celular)', () => {
  it('el mesero ve sus 4 secciones, sin "Más"', async () => {
    const navegacion = await mountSuspended(NavegacionInferior, {
      props: { secciones: seccionesDe('mesero') },
    });

    expect(botones(navegacion)).toEqual(['Mesas', 'Pedidos', 'Avisos', 'Perfil']);
  });

  it('el cajero ve sus 5 secciones', async () => {
    const navegacion = await mountSuspended(NavegacionInferior, {
      props: { secciones: seccionesDe('cajero') },
    });

    expect(botones(navegacion)).toEqual(['Caja', 'Mesas', 'Mostrador', 'Clientes', 'Perfil']);
  });

  it('el dueño ve 4 secciones y el resto en "Más"', async () => {
    const navegacion = await mountSuspended(NavegacionInferior, {
      props: { secciones: seccionesDe('dueno') },
    });

    expect(botones(navegacion)).toEqual(['Reportes', 'Caja', 'Mesas', 'Mostrador', 'Más']);
  });
});

describe('pantalla en construcción', () => {
  it('dice qué tendrá la sección y en qué fase llega', async () => {
    const pantalla = await mountSuspended(PantallaEnConstruccion, {
      props: { seccion: 'reportes', fase: 6, descripcion: 'Ventas del día.' },
    });

    expect(pantalla.text()).toContain('Reportes');
    expect(pantalla.text()).toContain('Ventas del día.');
    expect(pantalla.text()).toContain('Llega en la Fase 6');
  });
});

describe('cambiar contraseña', () => {
  /**
   * Llena el formulario y lo envía.
   * @param {Awaited<ReturnType<typeof mountSuspended>>} formulario
   * @param {[string, string, string]} valores Actual, nueva y confirmación.
   */
  async function enviar(formulario, [actual, nueva, confirmacion]) {
    const campos = formulario.findAll('input[type="password"]');
    await campos[0]?.setValue(actual);
    await campos[1]?.setValue(nueva);
    await campos[2]?.setValue(confirmacion);
    await formulario.find('form').trigger('submit');
  }

  it('no llama al API si la confirmación no coincide', async () => {
    const formulario = await mountSuspended(FormularioContrasena);

    await enviar(formulario, ['Actual-2026', 'Nueva-2026', 'Otra-2026']);

    await vi.waitFor(() => expect(formulario.text()).toContain('Las contraseñas no coinciden'));
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  it('cambia la contraseña y limpia el formulario', async () => {
    simularBackend(fetchFalso, { 'POST /auth/cambiar-contrasena': () => sesionDelApi('2') });
    const formulario = await mountSuspended(FormularioContrasena);

    await enviar(formulario, ['Actual-2026', 'Nueva-2026', 'Nueva-2026']);

    await vi.waitFor(() => expect(fetchFalso).toHaveBeenCalled());
    const [, opciones] = fetchFalso.mock.calls[0];
    expect(opciones.body).toEqual({
      contrasenaActual: 'Actual-2026',
      contrasenaNueva: 'Nueva-2026',
    });
    await vi.waitFor(() => {
      const campo = /** @type {HTMLInputElement} */ (formulario.find('input').element);
      expect(campo.value).toBe('');
    });
  });

  it('si la contraseña actual es incorrecta, lo dice claramente', async () => {
    simularBackend(fetchFalso, {
      'POST /auth/cambiar-contrasena': () => {
        throw errorDelApi(401, 'CONTRASENA_INCORRECTA');
      },
    });
    const formulario = await mountSuspended(FormularioContrasena);

    await enviar(formulario, ['Mala-2026', 'Nueva-2026', 'Nueva-2026']);

    await vi.waitFor(() =>
      expect(formulario.text()).toContain('La contraseña actual no es correcta.'),
    );
  });
});
