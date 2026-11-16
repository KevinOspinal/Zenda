// @ts-check
// Pruebas de la pantalla de usuarios con un backend simulado: contadores que filtran, chips
// por rol, búsqueda resaltada, vista rápida (PC) y hoja de abajo (celular), desactivar con
// confirmación, el único dueño protegido, restablecer la contraseña en dos pasos y el campo
// de contraseña nueva. (Crear y editar cuentas se prueba en admin.test.js.)
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CampoContrasenaNueva from '~/components/comunes/CampoContrasenaNueva.vue';
import PaginaUsuarios from '~/pages/admin/usuarios.vue';
import { useSesionStore } from '~/stores/sesion.js';
import { simularBackend } from './ayudantes.js';

const { fetchFalso } = vi.hoisted(() => ({ fetchFalso: vi.fn() }));
mockNuxtImport('$fetch', () => fetchFalso);

const EN_10_MIN = () => new Date(Date.now() + 10 * 60_000).toISOString();

/**
 * @param {string} id
 * @param {string} nombre
 * @param {string} rol
 * @param {object} [extra]
 */
const cuenta = (id, nombre, rol, extra = {}) => ({
  id,
  nombre,
  email: `${id}@laindustria.test`,
  rol,
  activo: true,
  bloqueado: false,
  bloqueadoHasta: null,
  creadoEn: '2026-10-27T15:00:00Z',
  ...extra,
});

// u1 es la sesión (administrador de Zenda).
const CUENTAS = () => [
  cuenta('u1', 'Andrés Gómez', 'administrador_zenda'),
  cuenta('u2', 'Marta Ruiz', 'dueno'),
  cuenta('u3', 'Camilo Torres', 'cajero', { bloqueado: true, bloqueadoHasta: EN_10_MIN() }),
  cuenta('u4', 'Laura Pérez', 'mesero'),
  cuenta('u5', 'Diana Castaño', 'mesero', { activo: false }),
];

/**
 * El backend simulado de usuarios, con lo que se le pase encima.
 * @param {Record<string, (opciones: any) => any>} [extra]
 */
function backend(extra = {}) {
  return simularBackend(fetchFalso, { 'GET /usuarios': () => CUENTAS(), ...extra });
}

/**
 * Cambia el tamaño de la pantalla simulada: desde 1024 px, la vista rápida va al lado.
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
 * Nombres de las cuentas en pantalla, en orden.
 * @param {import('@vue/test-utils').VueWrapper} pagina
 */
const nombresEnPantalla = (pagina) => pagina.findAll('button.principal').map((b) => b.text());

/**
 * @param {import('@vue/test-utils').VueWrapper} pagina
 * @param {string} etiqueta
 */
const contador = (pagina, etiqueta) =>
  pagina
    .findAll('[aria-label="Filtrar las cuentas"] button')
    .find((boton) => boton.text().includes(etiqueta));

/**
 * El diálogo abierto que contiene un texto (los modales y hojas van al final del body).
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

/**
 * @param {HTMLElement} contenedor
 * @param {string} texto
 */
const botonCon = (contenedor, texto) =>
  /** @type {HTMLButtonElement | undefined} */ (
    [...contenedor.querySelectorAll('button')].find((boton) => boton.textContent?.includes(texto))
  );

beforeEach(() => {
  fetchFalso.mockReset();
  document.body.querySelectorAll('[role="dialog"]').forEach((dialogo) => dialogo.remove());
  useSesionStore().usuario = {
    id: 'u1',
    nombre: 'Andrés Gómez',
    email: 'u1@laindustria.test',
    rol: 'administrador_zenda',
  };
});
afterEach(() => pantalla(1024, 768));

describe('pantalla de usuarios', () => {
  it('ordena por rol, cuenta cada estado y los contadores y chips filtran', async () => {
    backend();
    const pagina = await mountSuspended(PaginaUsuarios);
    await vi.waitFor(() => expect(pagina.text()).toContain('Laura Pérez'));

    // Del administrador de Zenda a los meseros; los inactivos al final de su rol.
    expect(nombresEnPantalla(pagina)).toEqual([
      'Andrés Gómez',
      'Marta Ruiz',
      'Camilo Torres',
      'Laura Pérez',
      'Diana Castaño',
    ]);
    for (const [etiqueta, cuantos] of [
      ['Activos', '3'],
      ['Bloqueados', '1'],
      ['Inactivos', '1'],
    ]) {
      expect(contador(pagina, etiqueta)?.find('.sr-only').text()).toBe(cuantos);
    }
    expect(pagina.text()).toMatch(/hasta las \d{1,2}:\d{2}/);

    await contador(pagina, 'Bloqueados')?.trigger('click');
    await vi.waitFor(() => expect(nombresEnPantalla(pagina)).toEqual(['Camilo Torres']));
    await contador(pagina, 'Bloqueados')?.trigger('click');

    const chipMesero = pagina
      .findAll('[aria-label="Ver un rol"] button')
      .find((boton) => boton.text().includes('Mesero'));
    expect(chipMesero?.text()).toContain('2');
    await chipMesero?.trigger('click');
    await vi.waitFor(() =>
      expect(nombresEnPantalla(pagina)).toEqual(['Laura Pérez', 'Diana Castaño']),
    );
    expect(chipMesero?.attributes('aria-pressed')).toBe('true');
  });

  it('busca por nombre o correo, sin tildes, y resalta lo que coincide', async () => {
    backend();
    const pagina = await mountSuspended(PaginaUsuarios);
    await vi.waitFor(() => expect(pagina.text()).toContain('Laura Pérez'));

    await pagina.find('input[type="search"]').setValue('perez');
    await vi.waitFor(() => expect(nombresEnPantalla(pagina)).toEqual(['Laura Pérez']));
    expect(pagina.find('button.principal mark').text()).toBe('Pérez');
    expect(pagina.text()).toContain('1 de 5 personas');

    await pagina.find('input[type="search"]').setValue('u2@');
    await vi.waitFor(() => expect(nombresEnPantalla(pagina)).toEqual(['Marta Ruiz']));
  });

  it('en PC, una cuenta bloqueada abre la vista rápida que explica cómo desbloquearla', async () => {
    pantalla(1280, 800);
    backend();
    const pagina = await mountSuspended(PaginaUsuarios);
    await vi.waitFor(() => expect(pagina.text()).toContain('Camilo Torres'));

    await pagina.find('button.principal[aria-label^="Camilo Torres"]').trigger('click');

    const vistaRapida = () => pagina.find('aside[aria-label="Vista rápida de Camilo Torres"]');
    await vi.waitFor(() => expect(vistaRapida().text()).toContain('Bloqueado hasta las'));
    expect(vistaRapida().text()).toContain('ya mismo si le restableces la contraseña');
    expect(vistaRapida().text()).toContain('Cobrar, abrir y cerrar la caja');
    // Las pantallas a las que entra un cajero.
    expect(vistaRapida().text()).toContain('Mostrador');
    const acciones = vistaRapida()
      .findAll('footer button')
      .map((boton) => boton.text());
    expect(acciones).toEqual(['Restablecer contraseña', 'Editar', 'Desactivar']);
  });

  it('en el celular, la cuenta propia abre una hoja que lleva a Perfil, sin acciones', async () => {
    pantalla(390, 844);
    backend();
    const pagina = await mountSuspended(PaginaUsuarios);
    await vi.waitFor(() => expect(pagina.text()).toContain('Andrés Gómez'));

    await pagina.find('button.principal[aria-label^="Andrés Gómez"]').trigger('click');

    const hoja = await dialogoCon('tu contraseña se cambia en Perfil');
    expect(botonCon(hoja, 'Restablecer contraseña')).toBeUndefined();
    expect(pagina.find('aside').exists()).toBe(false);
  });

  it('desactivar pide confirmación y luego guarda; activar no la pide', async () => {
    pantalla(1280, 800);
    /** @type {unknown[]} */
    const cambios = [];
    backend({
      'PATCH /usuarios/u4': (opciones) => {
        cambios.push(opciones.body);
        return cuenta('u4', 'Laura Pérez', 'mesero', opciones.body);
      },
      'PATCH /usuarios/u5': (opciones) => {
        cambios.push(opciones.body);
        return cuenta('u5', 'Diana Castaño', 'mesero', opciones.body);
      },
    });
    const pagina = await mountSuspended(PaginaUsuarios);
    await vi.waitFor(() => expect(pagina.text()).toContain('Laura Pérez'));

    // Desactivar a Laura: primero la confirmación, nada se guarda todavía.
    await pagina.find('button.principal[aria-label^="Laura Pérez"]').trigger('click');
    const vistaRapida = () => pagina.find('aside');
    await vi.waitFor(() => expect(vistaRapida().text()).toContain('Desactivar'));
    await vistaRapida()
      .findAll('button')
      .find((boton) => boton.text() === 'Desactivar')
      ?.trigger('click');
    const confirmacion = await dialogoCon('¿Desactivar a Laura Pérez?');
    expect(cambios).toEqual([]);
    botonCon(confirmacion, 'Desactivar')?.click();
    await vi.waitFor(() => expect(cambios).toEqual([{ activo: false }]));
    await vi.waitFor(() =>
      expect(contador(pagina, 'Inactivos')?.find('.sr-only').text()).toBe('2'),
    );

    // Activar a Diana: de una vez (no quita nada), y es la acción principal.
    await pagina.find('button.principal[aria-label^="Diana Castaño"]').trigger('click');
    await vi.waitFor(() => expect(vistaRapida().text()).toContain('No puede ingresar'));
    const principal = vistaRapida().find('footer button');
    expect(principal.text()).toBe('Activar');
    await principal.trigger('click');
    await vi.waitFor(() => expect(cambios).toEqual([{ activo: false }, { activo: true }]));
  });

  it('al único dueño activo no se le ofrece desactivarlo, y se explica por qué', async () => {
    pantalla(1280, 800);
    backend();
    const pagina = await mountSuspended(PaginaUsuarios);
    await vi.waitFor(() => expect(pagina.text()).toContain('Marta Ruiz'));

    await pagina.find('button.principal[aria-label^="Marta Ruiz"]').trigger('click');

    const vistaRapida = () => pagina.find('aside');
    await vi.waitFor(() => expect(vistaRapida().text()).toContain('Es el único dueño activo'));
    const acciones = vistaRapida()
      .findAll('footer button')
      .map((boton) => boton.text());
    expect(acciones).toEqual(['Restablecer contraseña', 'Editar']);
  });

  it('restablece la contraseña con una generada y la muestra para entregarla', async () => {
    pantalla(1280, 800);
    /** @type {unknown[]} */
    const restablecidas = [];
    backend({
      'POST /usuarios/u3/restablecer-contrasena': (opciones) => {
        restablecidas.push(opciones.body);
        return null;
      },
    });
    const pagina = await mountSuspended(PaginaUsuarios);
    await vi.waitFor(() => expect(pagina.text()).toContain('Camilo Torres'));

    await pagina.find('button.principal[aria-label^="Camilo Torres"]').trigger('click');
    await vi.waitFor(() => expect(pagina.find('aside').text()).toContain('Restablecer'));
    await pagina
      .find('aside')
      .findAll('button')
      .find((boton) => boton.text() === 'Restablecer contraseña')
      ?.trigger('click');

    const modal = await dialogoCon('Restablecer la contraseña de Camilo Torres');
    // Sin contraseña válida, no deja restablecer.
    expect(botonCon(modal, 'Restablecer')?.disabled).toBe(true);
    botonCon(modal, 'Generar una segura')?.click();
    await vi.waitFor(() => expect(botonCon(modal, 'Restablecer')?.disabled).toBe(false));
    const generada = /** @type {HTMLInputElement} */ (modal.querySelector('input')).value;
    expect(generada).toMatch(/^[A-Za-z2-9]{4}-[A-Za-z2-9]{4}-[A-Za-z2-9]{4}$/);
    botonCon(modal, 'Restablecer')?.click();

    await vi.waitFor(() => expect(restablecidas).toEqual([{ contrasenaNueva: generada }]));
    // Paso 2: la contraseña a la vista para dictarla, y la cuenta ya no está bloqueada.
    const listo = await dialogoCon('Contraseña restablecida');
    expect(listo.textContent).toContain(generada);
    expect(listo.textContent).toContain('Entrégasela a Camilo en persona');
    await vi.waitFor(() =>
      expect(contador(pagina, 'Bloqueados')?.find('.sr-only').text()).toBe('0'),
    );
  });
});

describe('campo de contraseña nueva', () => {
  it('marca los requisitos mientras se escribe y la muestra u oculta', async () => {
    const campo = await mountSuspended(CampoContrasenaNueva, { props: { modelValue: '' } });
    const cumplidos = () =>
      campo.findAll('li').filter((requisito) => requisito.text().includes('(listo)')).length;
    expect(cumplidos()).toBe(0);

    await campo.setProps({ modelValue: 'abc' });
    expect(cumplidos()).toBe(1);
    await campo.setProps({ modelValue: 'Centenario2026' });
    expect(cumplidos()).toBe(3);

    expect(campo.find('input').attributes('type')).toBe('password');
    await campo.find('button[aria-label="Mostrar la contraseña"]').trigger('click');
    expect(campo.find('input').attributes('type')).toBe('text');
  });
});
